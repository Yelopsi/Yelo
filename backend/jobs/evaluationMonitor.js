const db = require('../models');
const { Op } = require('sequelize');
const { sendEvaluationEmail } = require('../services/emailService');

const DIAS_APOS_EXPIRACAO = 7;

async function checkAndSendEvaluationEmails() {
    console.log('⏰ [CRON] Iniciando verificação de e-mails de avaliação (Expirados/Churn)...');

    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - DIAS_APOS_EXPIRACAO);

        // Busca todos os psicólogos cujo plano expirou há 7 dias ou mais e que ainda não receberam o e-mail
        const psychologistsToEvaluate = await db.Psychologist.findAll({
            where: {
                planExpiresAt: {
                    [Op.ne]: null,
                    [Op.lte]: thresholdDate // Expirou há 7 dias ou mais
                },
                evaluationEmailSent: {
                    [Op.not]: true // Ainda não enviamos o e-mail
                },
                is_exempt: {
                    [Op.not]: true // Não aborrecer usuários VIP
                }
            }
        });

        if (psychologistsToEvaluate.length === 0) {
            return;
        }

        console.log(`✉️ [EMAIL BATCH] Encontrados ${psychologistsToEvaluate.length} profissionais expirados para avaliação.`);

        for (const psi of psychologistsToEvaluate) {
            try {
                await sendEvaluationEmail(psi);
                await psi.update({ evaluationEmailSent: true });
                // Pausa de 1,5 segundos entre e-mails para evitar bloqueios de SPAM do provedor SMTP
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (emailErr) {
                console.error(`Erro ao enviar e-mail de avaliação para ${psi.email}:`, emailErr.message);
            }
        }
    } catch (error) {
        console.error('Erro geral ao verificar e-mails de avaliação:', error);
    }
}

module.exports = { checkAndSendEvaluationEmails };