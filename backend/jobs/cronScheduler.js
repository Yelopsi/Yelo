const db = require('../models');
const { Op } = require('sequelize');
const { generateAiQuestion } = require('./generateAiQuestion');

// ============================================================================
// 1. AUDITORIA DE INTEGRIDADE DA BASE DE DADOS (Limpeza de Inadimplentes)
// ============================================================================
async function runIntegrityAudit() {
    console.log('🛡️ [CRON AUDIT] Executando auditoria de integridade da base de dados...');
    try {
        // Revoga is_exempt se a pessoa já for pagante
        await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false WHERE ("stripeSubscriptionId" IS NOT NULL OR "subscriptionId" IS NOT NULL) AND "is_exempt" = true;`);
        // Bloqueia quem não tem assinatura nem isenção e já venceu
        await db.sequelize.query(`UPDATE "Psychologists" SET status = 'inactive' WHERE ("stripeSubscriptionId" IS NULL AND "subscriptionId" IS NULL) AND ("is_exempt" IS NULL OR "is_exempt" = false) AND status = 'active' AND ("planExpiresAt" IS NULL OR "planExpiresAt" <= NOW());`);
        // Bloqueia quem tem plano mas venceu
        await db.sequelize.query(`UPDATE "Psychologists" SET status = 'inactive' WHERE "planExpiresAt" <= NOW() AND ("is_exempt" IS NULL OR "is_exempt" = false) AND status = 'active';`);
        // Bloqueia VIPs que não tem plano setado
        await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false, status = 'inactive' WHERE "is_exempt" = true AND ("plano" IS NULL OR "plano" = '');`);
        
        console.log('✅ [CRON AUDIT] Auditoria de integridade e limpeza de inadimplentes concluída.');
    } catch (e) { 
        console.error('⚠️ [CRON AUDIT] Erro durante a auditoria de integridade:', e.message); 
    }
}

// ============================================================================
// 2. ROTINA DE RESUMO DIÁRIO (Agenda do Psicólogo)
// ============================================================================
async function sendDailySummaries(now, currentHM) {
    try {
        const psisSummary = await db.Psychologist.findAll({ 
            where: { dailySummaryTime: currentHM } 
        });

        if (psisSummary.length > 0) {
            console.log(`⏰ [CRON] Enviando resumo diário para ${psisSummary.length} psicólogos às ${currentHM}...`);
            
            const brtDateStr = now.toLocaleDateString("sv-SE", {timeZone: "America/Sao_Paulo"}); 
            const startOfDay = new Date(`${brtDateStr}T00:00:00-03:00`);
            const endOfDay = new Date(`${brtDateStr}T23:59:59.999-03:00`);
            const psiIds = psisSummary.map(p => p.id);

            const appointments = await db.Appointment.findAll({
                where: { 
                    psychologistId: { [Op.in]: psiIds },
                    start: { [Op.between]: [startOfDay, endOfDay] }
                },
                order: [['start', 'ASC']]
            });

            const appointmentsByPsi = {};
            appointments.forEach(app => {
                if (!appointmentsByPsi[app.psychologistId]) appointmentsByPsi[app.psychologistId] = [];
                appointmentsByPsi[app.psychologistId].push(app);
            });

            for (const psi of psisSummary) {
                const apps = appointmentsByPsi[psi.id] || [];
                if (apps.length > 0) {
                    let msgLines = [`Olá ${psi.nome}. Segue o resumo das suas sessões de hoje:`];
                    for (const app of apps) {
                        const time = new Date(app.start).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
                        const patientName = app.title || 'Paciente'; 
                        let statusText = app.status;
                        if (app.status === 'confirmed') statusText = 'confirmou';
                        if (app.status === 'cancelled') statusText = 'cancelou';
                        if (app.status === 'rescheduled') statusText = 'reagendou';
                        if (app.status === 'scheduled') statusText = 'aguardando confirmação';

                        msgLines.push(`${patientName}, às ${time} - ${statusText}`);
                    }
                    // FUTURO: Integração do disparo de Email/WhatsApp viria aqui
                }
            }
        }
    } catch (e) { console.error("❌ [CRON] Erro no cron de resumo diário:", e.message); }
}

// ============================================================================
// 3. ROTINA DE LEMBRETES DE SESSÃO
// ============================================================================
async function checkSessionReminders(now) {
    console.log("⏰ [CRON] Verificando lembretes de sessão...");
    try {
        const lookAhead = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        
        // Graças à nossa nova model Appointment.js, esse include vai funcionar perfeitamente!
        const upcomingAppointments = await db.Appointment.findAll({
            where: { 
                start: { [Op.between]: [now, lookAhead] },
                status: { [Op.in]: ['scheduled'] } 
            },
            include: [{ model: db.Psychologist, as: 'psychologist' }]
        });
        
        if (upcomingAppointments.length > 0) {
            /// a lógica de disparo de mensagens fica preservada aqui, pronta para o futuro
            // console.log(`[CRON] ${upcomingAppointments.length} lembretes pendentes encontrados.`);
        }
    } catch (e) { 
        console.error("❌ [CRON] Erro no cron de lembretes:", e.message); 
    }
}

// ============================================================================
// 4. ROTINA DE LEMBRETES DE FEEDBACK DE WHATSAPP
// ============================================================================
async function checkFeedbackReminders(now) {
    console.log("⏰ [CRON] Verificando lembretes de feedback de WhatsApp pendentes...");
    try {
        const emailService = require('../services/emailService');
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const pendingFeedbacks = await db.WhatsAppClickLog.findAll({
            where: {
                feedbackGiven: false,
                reminderEmailSent: false,
                createdAt: { [Op.lte]: twentyFourHoursAgo }
            },
            include: [{ model: db.Psychologist, as: 'psychologist' }]
        });
        
        for (const log of pendingFeedbacks) {
            if (log.psychologist && log.psychologist.email) {
                let nameToUse = log.guestName && log.guestName !== 'Visitante' ? log.guestName : 'um paciente';
                await emailService.sendFeedbackRequestEmail(log.psychologist, nameToUse);
                log.reminderEmailSent = true;
                await log.save();
            }
        }
        if (pendingFeedbacks.length > 0) {
            console.log(`✅ [CRON] Enviados ${pendingFeedbacks.length} e-mails de lembrete de feedback.`);
        }
    } catch (e) {
        console.error("❌ [CRON] Erro no cron de lembretes de feedback:", e.message);
    }
}

// ============================================================================
// ORQUESTRADOR CENTRAL (Apenas Inicia e Define Tempos)
// ============================================================================
const startCronJobs = () => {
    console.log('⏰ [CRON] Inicializando agendadores de tarefas...');

    try {
        require('./scheduler.js');
        console.log('✅ [CRON] Scheduler externo ativado (Remarketing rodará às 10h).');
    } catch (err) {
        console.warn('⚠️ [CRON] Aviso: Não foi possível carregar o scheduler.js.', err.message);
    }

    let lastReminderHour = -1;
    let lastSummaryMinute = "";
    let lastAuditDay = -1;
    let lastAiQnaHour = -1;
    let lastScraperDay = -1;

    setInterval(async () => {
        const now = new Date();
        const currentHM = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const currentBrtHour = parseInt(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' }), 10);
        const currentDay = now.getDate();
        
        // 1. RESUMO DIÁRIO (Verifica a cada minuto)
        if (currentHM !== lastSummaryMinute) {
            lastSummaryMinute = currentHM;
            await sendDailySummaries(now, currentHM);
        }

        // 2. AUDITORIA DIÁRIA (Roda uma vez às 3h da manhã)
        if (currentBrtHour === 3 && currentDay !== lastAuditDay) {
            lastAuditDay = currentDay;
            await runIntegrityAudit();
        }

        // 3 & 4. LEMBRETES DE SESSÃO E FEEDBACK (Verifica a cada virada de hora)
        if (currentBrtHour !== lastReminderHour) {
            lastReminderHour = currentBrtHour;
            await checkSessionReminders(now);
            await checkFeedbackReminders(now);
        }

        // 5. GERAÇÃO DE PERGUNTAS IA (9h, 13h, 17h, 21h)
        if ([9, 13, 17, 21].includes(currentBrtHour) && currentBrtHour !== lastAiQnaHour) {
            lastAiQnaHour = currentBrtHour;
            generateAiQuestion().catch(e => console.error("Erro na geração de pergunta IA:", e));
        }

        // 6. ROBÔ DE PROSPECÇÃO (Scraper) DIÁRIO (Roda uma vez às 9h da manhã)
        if (currentBrtHour === 9 && currentDay !== lastScraperDay) {
            lastScraperDay = currentDay;
            const { runScraperJob } = require('../controllers/adminLeadController');
            runScraperJob().catch(e => console.error("Erro no job diário do scraper:", e));
        }
    }, 60000); 
};

module.exports = { startCronJobs };
