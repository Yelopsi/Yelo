const db = require('../models');
const { sendMessage, getWhatsAppStatus } = require('../services/whatsappService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const copysOutbound = {
    intro: `Olá, [PRIMEIRO NOME], como vai? Meu nome é *Anderson Costa*, também sou Psicólogo Clínico.\n\nVi que você faz atendimentos e fiquei curioso: como tem sido a captação de novos pacientes e a organização da sua rotina?\n\nPergunto porque sei o quanto é desgastante equilibrar os atendimentos com a gestão da agenda, a busca por pacientes, ter a formação em dia — coisas que a gente não aprende na graduação e que tomam um tempo precioso do que mais gostamos: _clinicar_.\n\nPor ter passado por isso, criei a *Yelo*, uma plataforma pensada para criar uma *comunidade* e ajudar colegas psicólogos/as a atrair mais pacientes e organizar melhor a rotina.\n\nSe fizer sentido pra você, te explico rapidamente por aqui mesmo como funciona. Pode ser?`
};

const runOutboundBatch = async (limit = 10) => {
    console.log(`\n🤖 [Automação WA] Iniciando lote de prospecção para até ${limit} leads...`);

    if (getWhatsAppStatus() !== 'CONNECTED') {
        console.log('🤖 [Automação WA] Abortado: O celular não está conectado.');
        return;
    }

    try {
        // Busca leads "Pendentes" (Novos)
        const leads = await db.Lead.findAll({
            where: { status_funil: 'Pendente' },
            limit: limit,
            order: [['createdAt', 'ASC']] // Pega os mais antigos primeiro
        });

        if (leads.length === 0) {
            console.log('🤖 [Automação WA] Nenhum lead pendente encontrado no momento.');
            return;
        }

        console.log(`🤖 [Automação WA] ${leads.length} leads selecionados para esta rodada. Iniciando envios...\n`);

        for (let i = 0; i < leads.length; i++) {
            const lead = leads[i];
            const telefone = lead.telefone;
            const nome = lead.nome || 'Colega';
            
            let primeiroNome = nome.trim().split(' ')[0];
            if (primeiroNome.toLowerCase().includes('psicólogo')) primeiroNome = 'colega';

            // Formata telefone para o link mágico
            let telefoneNum = telefone.replace(/\D/g, '');
            if (telefoneNum.length === 10 || telefoneNum.length === 11) { telefoneNum = '55' + telefoneNum; }

            const linkMagico = `yelopsi.com.br/profissionais?utm_source=outbound&utm_medium=whatsapp&utm_campaign=${telefoneNum}`;
            
            const msgFinal = copysOutbound.intro
                .replace(/\[PRIMEIRO NOME\]/g, primeiroNome)
                .replace(/www\.yelopsi\.com\.br\/profissionais/g, linkMagico);

            console.log(`[${i + 1}/${leads.length}] 📤 Preparando envio para ${primeiroNome} (${telefoneNum})...`);

            try {
                // Dispara a mensagem via WhatsApp
                await sendMessage(telefone, msgFinal);
                
                // Calcula a data para o próximo follow-up (+3 dias)
                const proximoFollowup = new Date();
                proximoFollowup.setDate(proximoFollowup.getDate() + 3);

                // Atualiza o status do lead no banco para "Contatado"
                await lead.update({
                    status_funil: 'Contatado',
                    data_ultimo_contato: new Date(),
                    data_proximo_followup: proximoFollowup
                });
                
                console.log(`✅ Mensagem enviada e status atualizado!`);
            } catch (err) {
                console.error(`❌ Falha ao enviar para ${primeiroNome}:`, err.message);
            }

            // Pausa dinâmica (Humanização) apenas se não for o último lead da fila
            if (i < leads.length - 1) {
                // Gera um número aleatório entre 35.000ms (35s) e 90.000ms (90s)
                const delayMs = Math.floor(Math.random() * (90000 - 35000 + 1)) + 35000;
                console.log(`⏳ Pausando por ${Math.round(delayMs / 1000)} segundos para simular comportamento humano...\n`);
                await sleep(delayMs);
            }
        }

        console.log(`\n🎉 [Automação WA] Lote de ${leads.length} disparos finalizado! O robô voltará a dormir.`);

    } catch (error) {
        console.error('❌ [Automação WA] Erro crítico no lote de prospecção:', error);
    }
};

module.exports = { runOutboundBatch };