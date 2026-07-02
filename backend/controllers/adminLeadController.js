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

        if (filtro === 'followup_hoje') {
            // Filtra contatos cuja data de próximo follow-up seja <= hoje (ou seja, vence hoje ou está atrasado)
            const hojeFim = new Date();
            hojeFim.setHours(23, 59, 59, 999);

            whereClause = {
                status_funil: {
                    [Op.in]: ['Contatado', 'Aguardando']
                },
                data_proximo_followup: {
                    [Op.lte]: hojeFim
                }
            };
        } else if (filtro === 'pendentes') {
            whereClause = { status_funil: 'Pendente' };
        }

        const leads = await db.Lead.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });

        res.json({
            leads: leads,
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
        const lead = await db.Lead.findByPk(req.params.id);
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
        const lead = await db.Lead.findByPk(req.params.id);
        if (!lead) return res.status(404).json({ error: 'Lead não encontrado.' });

        await lead.destroy();
        res.json({ success: true, message: 'Lead excluído da prospecção.' });
    } catch (error) {
        console.error('[Admin] Erro ao excluir lead:', error);
        res.status(500).json({ error: 'Erro ao excluir contato.' });
    }
};

// 5. Dispara o robô (Scraper) em background
exports.runScraper = async (req, res) => {
    try {
        const { exec } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(__dirname, '..', 'scripts', 'scraper.js');
        
        // Roda o processo desvinculado da thread HTTP principal
        exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
            let totalSalvos = 0;
            if (stdout) {
                // Expressão regular para encontrar o número de leads salvos no log do robô
                const match = stdout.match(/Total de (\d+) novos leads adicionados/);
                if (match) totalSalvos = parseInt(match[1], 10);
            }
            
            if (req.io) {
                req.io.to('admins').emit('scraper_finished', {
                    success: !error,
                    total: totalSalvos,
                    message: error ? error.message : `Robô finalizado! ${totalSalvos} novos leads capturados.`
                });
            }
        });
        
        // Responde de imediato para não dar Timeout no Render (que cai após 60 seg)
        res.json({ message: 'Robô ativado em segundo plano! Você será avisado quando ele terminar a busca.' });
    } catch (error) {
        console.error('[Admin] Erro ao iniciar scraper:', error);
        res.status(500).json({ error: 'Erro ao iniciar robô de prospecção.' });
    }
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