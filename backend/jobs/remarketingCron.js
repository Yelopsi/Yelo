// backend/cron/remarketingCron.js

const { Op } = require('sequelize');
const db = require('../models');
const { sendRemarketingEmail } = require('../services/emailService');

/**
 * Encontra psicólogos que se cadastraram mas não ativaram a assinatura
 * e envia e-mails de remarketing em intervalos definidos.
 */
async function sendPendingSubscriptionEmails() {
    console.log('CRON: Iniciando verificação de assinaturas pendentes para remarketing...');

    const now = new Date();

    // Define os critérios para cada etapa do funil de remarketing
    const remarketingSteps = [
        {
            step: 1,
            // Registrados entre 24h e 48h atrás
            minHours: 24,
            maxHours: 48,
        },
        {
            step: 2,
            // Registrados entre 3 e 4 dias atrás (72h - 96h)
            minHours: 72,
            maxHours: 96,
        },
        {
            step: 3,
            // Registrados entre 7 e 8 dias atrás (168h - 192h)
            minHours: 168,
            maxHours: 192,
        },
        {
            step: 4,
            // Registrados entre 14 e 15 dias atrás (336h - 360h) -> Fim do período Trial
            minHours: 336,
            maxHours: 360,
        }
    ];

    for (const config of remarketingSteps) {
        // Calcula as datas de início e fim para a janela de busca
        const startDate = new Date(now.getTime() - config.maxHours * 60 * 60 * 1000);
        const endDate = new Date(now.getTime() - config.minHours * 60 * 60 * 1000);

        try {
            // Busca psicólogos que:
            // 1. Se cadastraram na janela de tempo definida (ex: entre 1 e 2 dias atrás)
            // 2. Não estão com status 'active'
            // 3. Não são isentos de pagamento (VIPs)
            const pendingPsychologists = await db.Psychologist.findAll({
                where: {
                    createdAt: {
                        [Op.between]: [startDate, endDate],
                    },
                    status: { [Op.ne]: 'active' },
                    is_exempt: { [Op.not]: true },
                }
            });

            // Para o passo 4 (Leads), filtra apenas os psicólogos que receberam cliques no WhatsApp
            const eligiblePsychologists = config.step === 4 
                ? pendingPsychologists.filter(p => (p.whatsapp_clicks || 0) > 0)
                : pendingPsychologists;

            if (eligiblePsychologists.length > 0) {
                console.log(`CRON: Encontrados ${eligiblePsychologists.length} psicólogos para o passo ${config.step} de remarketing.`);

                for (const psychologist of eligiblePsychologists) {
                    await sendRemarketingEmail(psychologist, config.step);
                    console.log(`CRON: E-mail de remarketing (passo ${config.step}) enviado para ${psychologist.email}.`);                    
                    // Adiciona um log no banco de dados para auditoria
                    if (db.SystemLog) {
                        await db.SystemLog.create({
                            level: 'info',
                            message: `[REMARKETING_SENT] E-mail passo ${config.step} enviado para ${psychologist.email}`,
                            meta: {
                                psychologistId: psychologist.id,
                                email: psychologist.email,
                                step: config.step
                            }
                        }).catch(logError => console.error(`CRON: Falha ao salvar log de remarketing para ${psychologist.email}:`, logError));
                    }
                }
            }
        } catch (error) {
            console.error(`CRON: Erro ao processar passo ${config.step} de remarketing:`, error);
        }
    }
    console.log('CRON: Verificação de remarketing finalizada.');
}

module.exports = { sendPendingSubscriptionEmails };