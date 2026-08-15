const db = require('../models');
const { Op } = require('sequelize');
const { sendMessage, getWhatsAppStatus } = require('../services/whatsappService');
const { runOutboundBatch } = require('../jobs/whatsappOutboundJob');

// --- PROSPECÇÃO DE LEADS (OUTBOUND) ---

// 1. Busca os leads cadastrados
exports.getLeads = async (req, res) => {
    try {
        // AUTO-SYNC: Garante que a tabela existe no banco de dados de produção (Render)
        if (db.Lead) await db.Lead.sync();

        // CALCULANDO KPIs (MÉTRICAS DO FUNIL)
        const pendentes = await db.Lead.count({ where: { status_funil: 'Pendente' } });
        const contatados = await db.Lead.count({ where: { status_funil: 'Contatado' } });
        const aguardando = await db.Lead.count({ where: { status_funil: 'Aguardando' } });
        const cadastrados = await db.Lead.count({ where: { status_funil: 'Cadastrado' } });

        // Conta quantos psicólogos se cadastraram de fato pelo link mágico do WhatsApp e separa por status
        const convitesWhatsappRaw = await db.Psychologist.findAll({
            where: {
                utm_source: 'whatsapp',
                utm_medium: 'convite_manual'
            },
            attributes: ['status', 'subscriptionId']
        });

        const convitesWhatsapp = convitesWhatsappRaw.length;
        const convitesWhatsapp_Incompletos = convitesWhatsappRaw.filter(p => p.status !== 'active').length;
        const convitesWhatsapp_Trial = convitesWhatsappRaw.filter(p => p.status === 'active' && !p.subscriptionId).length;
        const convitesWhatsapp_Pagantes = convitesWhatsappRaw.filter(p => p.status === 'active' && p.subscriptionId).length;

        const { filtro } = req.query;
        let whereClause = {};

        // 1. Buscar todos os psicólogos registrados para filtrar leads que já se cadastraram
        const registeredPsychologists = await db.Psychologist.findAll({
            attributes: ['email', 'telefone']
        });
        const registeredEmails = new Set(registeredPsychologists.map(p => p.email?.toLowerCase()).filter(Boolean));
        const registeredPhones = new Set(registeredPsychologists.map(p => p.telefone?.replace(/\D/g, '')).filter(Boolean));

        // 2. Buscar Inbound Leads (WaitingList)
        const rawWaitlist = db.WaitingList ? await db.WaitingList.findAll() : [];
        const inboundLeads = rawWaitlist.filter(w => {
            const email = w.email?.toLowerCase();
            const phone = w.telefone?.replace(/\D/g, '');
            // Só exibe se NÃO estiver registrado
            return !registeredEmails.has(email) && !registeredPhones.has(phone);
        }).map(w => ({
            id: 'wl_' + w.id,
            nome: w.nome || 'Lead Inbound',
            telefone: w.telefone,
            origem_url: 'Inbound (Questionário)',
            status_funil: w.status === 'invited' ? 'Contatado' : 'Pendente',
            data_ultimo_contato: w.status === 'invited' ? w.updatedAt : null,
            data_proximo_followup: null,
            createdAt: w.createdAt,
            isInbound: true
        }));

        // 3. Buscar Outbound Leads (Leads)
        let leadsOutbound = await db.Lead.findAll({
            order: [['createdAt', 'DESC']]
        });
        leadsOutbound = leadsOutbound.filter(l => {
            const phone = l.telefone?.replace(/\D/g, '');
            // Só exibe se NÃO estiver registrado
            return !registeredPhones.has(phone);
        }).map(l => l.toJSON());

        // 4. Combinar e Aplicar Filtros
        let allLeads = [...inboundLeads, ...leadsOutbound].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filtro === 'followup_hoje') {
            const hojeFim = new Date();
            hojeFim.setHours(23, 59, 59, 999);
            allLeads = allLeads.filter(l => 
                ['Contatado', 'Aguardando'].includes(l.status_funil) && 
                l.data_proximo_followup && 
                new Date(l.data_proximo_followup) <= hojeFim
            );
        } else if (filtro === 'pendentes') {
            allLeads = allLeads.filter(l => l.status_funil === 'Pendente');
        }

        res.json({
            leads: allLeads,
            kpis: { 
                pendentes, contatados, aguardando, cadastrados, 
                convitesWhatsapp,
                convitesWhatsapp_Incompletos,
                convitesWhatsapp_Trial,
                convitesWhatsapp_Pagantes
            }
        });
    } catch (error) {
        console.error('[Admin] Erro ao buscar leads:', error);
        res.status(500).json({ error: 'Erro interno ao buscar leads: ' + error.message });
    }
};

// 2. Atualiza o status do lead após clique no WhatsApp
exports.registrarContatoLead = async (req, res) => {
    try {
        if (db.Lead) await db.Lead.sync(); // Garante que a tabela existe

        const { id } = req.params;

        if (typeof id === 'string' && id.startsWith('wl_')) {
            const realId = id.replace('wl_', '');
            const lead = await db.WaitingList.findByPk(realId);
            if (!lead) return res.status(404).json({ error: 'Lead Inbound não encontrado.' });
            
            await lead.update({ status: 'invited' });
            return res.json({ message: 'Contato Inbound registrado com sucesso!', lead });
        }

        const lead = await db.Lead.findByPk(id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado.' });
        }

        // Calcula a data para o próximo follow-up (+3 dias)
        const proximoFollowup = new Date();
        proximoFollowup.setDate(proximoFollowup.getDate() + 3);

        await lead.update({
            status_funil: 'Contatado',
            data_ultimo_contato: new Date(),
            data_proximo_followup: proximoFollowup
        });

        res.json({ 
            message: 'Contato registrado com sucesso!', 
            lead 
        });
    } catch (error) {
        console.error('[Admin] Erro ao registrar contato com lead:', error);
        res.status(500).json({ error: 'Erro interno ao registrar contato.' });
    }
};

// 3. Atualiza o status do lead manualmente (Aguardando // Cadastrado)
exports.atualizarStatusLead = async (req, res) => {
    try {
        const { status } = req.body;
        const { id } = req.params;

        if (typeof id === 'string' && id.startsWith('wl_')) {
            const realId = id.replace('wl_', '');
            const lead = await db.WaitingList.findByPk(realId);
            if (!lead) return res.status(404).json({ error: 'Lead Inbound não encontrado.' });
            
            // Mapeia os status do Lead para o WaitingList se possível, ou apenas ignora a atualização visual complexa
            if (status === 'Contatado') await lead.update({ status: 'invited' });
            return res.json({ success: true, message: 'Status Inbound atualizado com sucesso!' });
        }

        const lead = await db.Lead.findByPk(id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });
        
        await lead.update({ status_funil: status });
        res.json({ success: true, message: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('[Admin] Erro ao atualizar status do lead:', error);
        res.status(500).json({ error: 'Erro ao atualizar status.' });
    }
};

// 4. Remove o lead permanentemente (Recusa // Opt-out)
exports.excluirLead = async (req, res) => {
    try {
        const { id } = req.params;

        if (typeof id === 'string' && id.startsWith('wl_')) {
            const realId = id.replace('wl_', '');
            const lead = await db.WaitingList.findByPk(realId);
            if (!lead) return res.status(404).json({ error: 'Lead Inbound não encontrado.' });
            
            await lead.destroy();
            return res.json({ success: true, message: 'Lead Inbound excluído.' });
        }

        const lead = await db.Lead.findByPk(id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

        await lead.destroy();
        res.json({ success: true, message: 'Lead excluído da prospecção.' });
    } catch (error) {
        console.error('[Admin] Erro ao excluir lead:', error);
        res.status(500).json({ error: 'Erro ao excluir contato.' });
    }
};

// Função principal do scraper, separada para poder ser chamada pelo cron job e pela rota
exports.runScraperJob = async (io = null) => {
    // 2. Tentar usar Serper.dev (Buscador alternativo mais fácil e sem restrições)
    const SERPER_API_KEY = process.env.SERPER_API_KEY;

    if (!SERPER_API_KEY) {
      if (io) {
        const { dtoScraperResult } = require('../utils/socketDataMinimization');
        io.to('admins').emit('scraper_finished', dtoScraperResult(false, 0, 'Chave do Serper.dev não configurada (SERPER_API_KEY).'));
      }
      return;
    }

    const dorkQuery = process.env.SCRAPER_DORK_QUERY || 'site:instagram.com psicologo crp wa.me';
    console.log(`[SCRAPER API] Iniciando busca no Serper.dev com query: ${dorkQuery}`);

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                q: dorkQuery,
                gl: 'br',
                hl: 'pt-br'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`Erro do Serper: ${data.message || response.statusText}`);
        }

        if (!data.organic || data.organic.length === 0) {
            if (io) {
                const { dtoScraperResult } = require('../utils/socketDataMinimization');
                io.to('admins').emit('scraper_finished', dtoScraperResult(true, 0, 'Nenhum resultado encontrado.'));
            }
            return;
        }

        console.log(`[SCRAPER API] Encontrados ${data.organic.length} resultados orgânicos.`);

        const resultados = [];
        for (const item of data.organic) {
            let nome = item.title || 'Colega do Instagram';
            const url = item.link;
            const snippetText = item.snippet || "";

            // Limpeza Inteligente do Nome
            nome = nome.replace(/Psicólog[oa]\s*[-|]?\s*/ig, '');
            nome = nome.replace(/^[-|]\s*/, '');
            nome = nome.split('(@')[0].split('|')[0].split('-')[0].trim();
            if (!nome || nome.toLowerCase() === 'instagram') nome = 'Colega do Instagram';

            // Extração do Telefone via Regex no Snippet
            let telefone = '';
            const waMatch = snippetText.match(/wa\.me\/?(\d+)/i) || 
                            snippetText.match(/(?:whatsapp|wa|wpp|contato|psi|telefone).*?(\d{10,11})/i) ||
                            snippetText.match(/(?:55)?\+?\(?(?:\d{2})\)?\s*(?:9\d{4}|\d{4})[-.\s]?\d{4}/);
            
            if (waMatch) {
                const numStr = (waMatch[1] && waMatch[1].length > 2) ? waMatch[1] : waMatch[0];
                telefone = numStr.replace(/\D/g, '');
                if (telefone.length === 10 || telefone.length === 11) {
                    telefone = '55' + telefone;
                }
            }

            if (telefone && telefone.length >= 10) {
                resultados.push({ nome, telefone, url });
            }
        }

        console.log(`[SCRAPER API] Dentre eles, ${resultados.length} possuem WhatsApp válido. Salvando no banco...`);
        
        let totalSalvos = 0;
        for (const lead of resultados) {
            const [registro, created] = await db.Lead.findOrCreate({
                where: { telefone: lead.telefone },
                defaults: {
                    nome: lead.nome,
                    telefone: lead.telefone,
                    origem_url: lead.url,
                    status_funil: 'Pendente'
                }
            });
                
            if (!created && registro.nome.includes('Instagram') && !lead.nome.includes('Instagram')) {
                await registro.update({ nome: lead.nome });
            }

            if (created) {
                totalSalvos++;
            }
        }
        
        console.log(`[SCRAPER API] Prospecção Concluída! ${totalSalvos} novos leads.`);

        if (io) {
            const { dtoScraperResult } = require('../utils/socketDataMinimization');
            io.to('admins').emit('scraper_finished', dtoScraperResult(true, totalSalvos, 'Robô finalizado! Novos leads capturados via API.'));
        }
    } catch (error) {
        console.error('[SCRAPER API] Erro na prospecção:', error);
        if (io) {
            const { dtoScraperResult } = require('../utils/socketDataMinimization');
            io.to('admins').emit('scraper_finished', dtoScraperResult(false, 0, 'Erro ao buscar novos leads.'));
        }
    }
};

// 5. Dispara o robô (Scraper) em background via Google Custom Search API
exports.runScraper = async (req, res) => {
    // Responde de imediato para não dar Timeout na rota (o processo rodará em background)
    res.json({ message: 'Robô ativado em segundo plano! Você será avisado quando ele terminar a busca.' });

    // Chama o job passando o socket io
    exports.runScraperJob(req.io);
};

// 6. Teste manual de disparo de WhatsApp
exports.testWhatsAppMessage = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório.' });

        if (getWhatsAppStatus() !== 'CONNECTED') {
            return res.status(400).json({ error: 'O Robô do WhatsApp não está conectado.' });
        }

        const msgTeste = `🤖 *Teste da Yelo!*\n\nOlá! Se você recebeu esta mensagem, significa que o nosso servidor está conseguindo disparar mensagens em segundo plano pelo seu WhatsApp Business com sucesso!\n\nAgora já podemos ativar a automação real.`;

        await sendMessage(phone, msgTeste);

        res.status(200).json({ success: true, message: 'Mensagem de teste enviada.' });
    } catch (error) {
        console.error('Erro no teste de WhatsApp:', error);
        res.status(500).json({ error: error.message || 'Erro ao enviar mensagem de teste.' });
    }
};

// 7. Teste manual de disparo de Lote (Robô)
exports.testOutboundBatch = async (req, res) => {
    try {
        runOutboundBatch(2).catch(console.error); // Pega apenas 2 leads e roda em background
        res.status(200).json({ success: true, message: 'Lote iniciado em background. Acompanhe os logs no terminal.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao iniciar lote.' });
    }
};