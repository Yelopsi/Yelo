const db = require('../models');
const { Op } = require('sequelize');
// ============================================================================
// 1. AUDITORIA DE INTEGRIDADE DA BASE DE DADOS (Limpeza de Inadimplentes)
// ============================================================================
async function runIntegrityAudit() {
    console.log('🛡️ [CRON AUDIT] Executando auditoria de integridade da base de dados e Asaas...');
    try {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }

        // 1. Revoga is_exempt se a pessoa já for pagante
        await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false WHERE "subscriptionId" IS NOT NULL AND "is_exempt" = true;`);
        
        // 2. Bloqueia VIPs que não tem plano setado
        await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false, status = 'inactive' WHERE "is_exempt" = true AND ("plano" IS NULL OR "plano" = '');`);

        // 3. Busca psicólogos com plano vencido ou sem assinatura
        const expiredPsis = await db.Psychologist.findAll({
            where: {
                status: 'active',
                [Op.or]: [
                    { is_exempt: null },
                    { is_exempt: false }
                ],
                [Op.or]: [
                    { planExpiresAt: { [Op.lte]: new Date() } },
                    { planExpiresAt: null }
                ]
            }
        });

        console.log(`[CRON AUDIT] Encontrados ${expiredPsis.length} psicólogos com plano vencido ou nulo. Iniciando checagem...`);

        const now = new Date();
        const fallbackDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 dias atrás

        for (const psi of expiredPsis) {
            let shouldBlock = false;
            let reason = '';

            if (!psi.subscriptionId) {
                // Sem assinatura no banco -> bloqueia direto na virada
                shouldBlock = true;
                reason = 'Sem assinatura no sistema';
            } else {
                // Tem assinatura -> Consulta Ativa no Asaas
                try {
                    const pRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${psi.subscriptionId}`, { 
                        headers: { 'access_token': process.env.ASAAS_API_KEY } 
                    });
                    
                    if (pRes.ok) {
                        const pData = await pRes.json();
                        const payments = pData.data || [];
                        
                        const hasOverdue = payments.some(p => p.status === 'OVERDUE');
                        
                        if (hasOverdue) {
                            shouldBlock = true;
                            reason = 'Pagamento em atraso (OVERDUE) no Asaas';
                        } else {
                            // Não tem pagamento em atraso (ex: boleto aguardando, cartão agendado)
                            // Só bloqueia se já passou da tolerância de 3 dias do Yelo
                            const expDate = psi.planExpiresAt ? new Date(psi.planExpiresAt) : null;
                            if (!expDate || expDate < fallbackDate) {
                                shouldBlock = true;
                                reason = 'Limite de tolerância de 3 dias estourado';
                            }
                        }
                    } else {
                        console.error(`[CRON AUDIT] Erro ao consultar Asaas para assinatura ${psi.subscriptionId}. Mantendo ativo por segurança.`);
                    }
                } catch (err) {
                    console.error(`[CRON AUDIT] Falha na request Asaas para ${psi.subscriptionId}:`, err.message);
                }
            }

            if (shouldBlock) {
                console.log(`❌ [CRON AUDIT] Bloqueando psicólogo ID ${psi.id} (${psi.nome}). Motivo: ${reason}`);
                await psi.update({ status: 'inactive' });
            }
        }
        
        console.log('✅ [CRON AUDIT] Auditoria inteligente e limpeza de inadimplentes concluída.');
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
    let lastScraperDay = -1;
    let lastAiScheduleDay = -1;
    let lastPrivacyPruningDay = -1;
    let aiScheduleTimes = [];

    setInterval(async () => {
        const now = new Date();
        const currentHM = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const currentBrtHour = parseInt(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' }), 10);
        const currentDay = now.getDate();
        
        // 1. PROCESSADOR DE WEBHOOKS (Roda a cada minuto)
        try {
            const WebhookProcessor = require('../workers/webhookProcessor');
            await WebhookProcessor.processPendingWebhooks();
        } catch(e) {
            console.error('Erro no processador de webhooks:', e.message);
        }

        // 2. RESUMO DIÁRIO (Verifica a cada minuto)
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

        // 5. MOTOR EDITORIAL DA COMUNIDADE (Geração Aleatória de Perguntas IA)
        // Resetamos e definimos a agenda de IA uma vez por dia, à meia-noite (ou no primeiro minuto que o app rodar no dia)
        if (currentDay !== lastAiScheduleDay) {
            lastAiScheduleDay = currentDay;
            aiScheduleTimes = [];
            const numJobs = Math.floor(Math.random() * 4) + 3; // Gera entre 3 e 6
            for (let i = 0; i < numJobs; i++) {
                // Sorteia uma hora entre 08h e 22h, e um minuto entre 0 e 59
                const h = Math.floor(Math.random() * (22 - 8 + 1)) + 8;
                const m = Math.floor(Math.random() * 60);
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                aiScheduleTimes.push(timeStr);
            }
            console.log(`🤖 [CRON IA] Sorteada a agenda editorial de hoje: ${aiScheduleTimes.length} rascunhos. Horários: ${aiScheduleTimes.join(', ')}`);
        }

        // Se o minuto atual bater com algum horário sorteado, dispara o robô da IA
        if (aiScheduleTimes.includes(currentHM)) {
            console.log(`🤖 [CRON IA] Horário sorteado atingido (${currentHM}). Iniciando Motor Editorial...`);
            const generateAiQuestionV2 = require('./generateAiQuestionV2');
            generateAiQuestionV2().catch(err => console.error("Erro na geração da IA:", err));
            // Opcional: remover o horário para não rodar mais de uma vez naquele minuto,
            // mas o SetInterval já roda a cada 60s, então o "currentHM" muda e não roda duplo.
        }

        // 6. ROBÔ DE PROSPECÇÃO (Scraper) DIÁRIO (Roda uma vez às 9h da manhã)
        if (currentBrtHour === 9 && currentDay !== lastScraperDay) {
            lastScraperDay = currentDay;
            const { runScraperJob } = require('../controllers/adminLeadController');
            runScraperJob().catch(e => console.error("Erro no job diário do scraper:", e));
        }

        // 7. ROBÔ DE PRIVACIDADE E EXPURGO LGPD (Roda uma vez às 3h da manhã)
        if (currentBrtHour === 3 && currentDay !== lastPrivacyPruningDay) {
            lastPrivacyPruningDay = currentDay;
            const { runPrivacyPruning } = require('./privacyPruningJob');
            // Executando como live-run na madrugada para descarte de dados expirados
            runPrivacyPruning({ dryRun: false }).catch(e => console.error("Erro no job de privacy:", e));
        }
    }, 60000); 
};

module.exports = { startCronJobs };
