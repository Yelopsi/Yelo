const { Op } = require('sequelize');
const db = require('./backend/models');
const emailService = require('./backend/services/emailService');

async function processRemarketing() {
    console.log('CRON: Iniciando rotina de remarketing para psicólogos inadimplentes...');

    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        // Busca psicólogos inativos, não administradores, sem assinatura Asaas, não VIPs
        const targetPsis = await db.Psychologist.findAll({
            where: {
                status: { [Op.in]: ['pending', 'inactive'] },
                stripeSubscriptionId: null, // Prova cabal de que não tem assinatura rodando
                is_exempt: { [Op.not]: true }, // Remove convidados/VIPs
                isAdmin: { [Op.not]: true }
            }
        });

        let enviados = 0;
        for (const psi of targetPsis) {
            const createdAt = new Date(psi.createdAt);
            const step = psi.remarketing_step || 0;

            // Passo 1: 24h após o cadastro
            if (step === 0 && createdAt <= oneDayAgo) {
                await emailService.sendRemarketingEmail(psi, 1);
                await psi.update({ remarketing_step: 1, last_remarketing_at: now });
                console.log(`[REMARKETING] Email passo 1 enviado para ${psi.email}`);
                enviados++;
            } else if (step === 1 && createdAt <= threeDaysAgo) {
                // Passo 2: 3 dias após o cadastro
                await emailService.sendRemarketingEmail(psi, 2);
                await psi.update({ remarketing_step: 2, last_remarketing_at: now });
                console.log(`[REMARKETING] Email passo 2 enviado para ${psi.email}`);
                enviados++;
            } else if (step === 2 && createdAt <= sevenDaysAgo) {
                // Passo 3: 7 dias após o cadastro
                await emailService.sendRemarketingEmail(psi, 3);
                await psi.update({ remarketing_step: 3, last_remarketing_at: now });
                console.log(`[REMARKETING] Email passo 3 enviado para ${psi.email}`);
                enviados++;
            } else if (step === 3 && createdAt <= fourteenDaysAgo && psi.whatsapp_clicks > 0) {
                // Passo 4: 14 dias após o cadastro (fim do trial) para usuários que receberam contatos
                await emailService.sendRemarketingEmail(psi, 4);
                await psi.update({ remarketing_step: 4, last_remarketing_at: now });
                console.log(`[REMARKETING] Email passo 4 (Conversão de Lead) enviado para ${psi.email}`);
                enviados++;
            }
        }
        console.log(`CRON: Rotina de remarketing finalizada. E-mails enviados: ${enviados}`);
    } catch (error) { console.error('Erro na rotina de remarketing:', error); }
}

module.exports = { processRemarketing };