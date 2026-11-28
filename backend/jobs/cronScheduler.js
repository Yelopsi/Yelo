const db = require('../models');
const { Op } = require('sequelize');
const PaymentStateService = require('../services/paymentStateService');
const pricingLaunch = require('../utils/pricingLaunch');
// ============================================================================
// 0. CONVERSÃO AUTOMÁTICA DE TRIALS TOKENIZADOS (Trimestral / Semestral D+7)
// ============================================================================
async function processTokenizedTrials() {
    try {
        const ASAAS_API_URL = PaymentStateService.getAsaasApiUrl();
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
        if (!ASAAS_API_KEY) return;

        const dueTrials = await db.Subscription.findAll({
            where: {
                status: 'TRIAL_CARD_TOKENIZED',
                currentPeriodEnd: { [Op.lte]: new Date() }
            }
        });

        for (const sub of dueTrials) {
            const psi = await db.Psychologist.findByPk(sub.psychologistId);
            if (!psi || psi.status !== 'active' || psi.cancelAtPeriodEnd || psi.subscriptionId !== sub.id) {
                await sub.update({ status: 'CANCELED' });
                if (psi && psi.subscriptionId === sub.id) {
                    await psi.update({ plano: 'Comunidade', planExpiresAt: null, subscriptionId: null, cancelAtPeriodEnd: false });
                }
                continue;
            }

            let meta;
            try { meta = JSON.parse(sub.plan); } catch (e) { continue; }
            if (!meta || !meta.token) continue;

            try {
                const { res, payData } = await PaymentStateService.createInstallmentChargeWithToken({
                    customerId: sub.asaasCustomerId,
                    creditCardToken: meta.token,
                    meta,
                    psychologistId: psi.id
                });

                if (res.ok && payData.id && !payData.errors) {
                    const realRefId = payData.installment || payData.id;
                    const monthsToAdd = meta.cycle === 'SEMIANNUAL' ? 6 : (meta.cycle === 'QUARTERLY' ? 3 : 1);
                    const now = new Date();
                    const novaValidade = PaymentStateService.addMonthsSafe(now, monthsToAdd);

                    await sub.update({ status: 'CONVERTED' });
                    await db.Subscription.upsert({
                        id: realRefId,
                        psychologistId: psi.id,
                        asaasCustomerId: sub.asaasCustomerId,
                        plan: PaymentStateService.buildInstallmentPlanMeta({
                            ...meta,
                            autoRenew: meta.cycle === 'QUARTERLY' || meta.cycle === 'SEMIANNUAL'
                        }),
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: novaValidade
                    });
                    await PaymentStateService.syncPaymentToDatabase(psi, {
                        ...payData,
                        value: payData.value != null ? payData.value : Number(((Number(meta.totalValue) || 0) / (Number(meta.installmentCount) || 1)).toFixed(2)),
                        billingType: payData.billingType || 'CREDIT_CARD'
                    }).catch(() => {});
                    await psi.update({
                        subscriptionId: realRefId,
                        plano: meta.planType,
                        planExpiresAt: novaValidade,
                        firstPaidAt: psi.firstPaidAt || now,
                        cancelAtPeriodEnd: false,
                        canceledAt: null
                    });
                    console.log(`✅ [CRON TRIAL] Trial tokenizado convertido (${meta.cycle}): Psi ID ${psi.id}`);
                } else {
                    await sub.update({ status: 'FAILED' });
                    await psi.update({ plano: 'Comunidade', planExpiresAt: null, subscriptionId: null });
                    console.warn(`❌ [CRON TRIAL] Falha na cobrança pós-trial do Psi ID ${psi.id}:`, payData.errors?.[0]?.description || res.status);
                }
            } catch (err) {
                console.error(`⚠️ [CRON TRIAL] Erro de rede ao cobrar trial tokenizado Psi ID ${psi.id}:`, err.message);
            }
        }
    } catch (e) {
        console.error('❌ [CRON TRIAL] Erro no processTokenizedTrials:', e.message);
    }
}

// ============================================================================
// 0B. RENOVAÇÃO AUTOMÁTICA DE PLANOS PARCELADOS (Trimestral / Semestral)
// ============================================================================
async function processInstallmentRenewals() {
    try {
        const ASAAS_API_URL = PaymentStateService.getAsaasApiUrl();
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
        if (!ASAAS_API_KEY) return;

        const now = new Date();
        const dueSubs = await db.Subscription.findAll({
            where: {
                status: { [Op.in]: ['ACTIVE', 'CONFIRMED'] },
                currentPeriodEnd: { [Op.lte]: now }
            }
        });

        for (const sub of dueSubs) {
            const meta = PaymentStateService.parseSubscriptionPlanMeta(sub.plan);
            if (!meta || (meta.cycle !== 'QUARTERLY' && meta.cycle !== 'SEMIANNUAL')) {
                continue;
            }

            const psi = await db.Psychologist.findByPk(sub.psychologistId);
            if (!psi || psi.subscriptionId !== sub.id) {
                await sub.update({ status: 'INACTIVE' });
                continue;
            }

            const isNewPricing = pricingLaunch.isNewPricingActive();
            const downgradePsi = async () => {
                if (isNewPricing) {
                    await psi.update({
                        plano: 'Comunidade',
                        status: 'active',
                        planExpiresAt: null,
                        subscriptionId: null,
                        cancelAtPeriodEnd: false
                    });
                } else {
                    await psi.update({
                        status: 'inactive',
                        planExpiresAt: null,
                        subscriptionId: null,
                        cancelAtPeriodEnd: false
                    });
                }
            };

            // Respeita cancelamento agendado, ausência de cartão tokenizado ou conta inativa
            if (psi.cancelAtPeriodEnd || !meta.autoRenew || !meta.token || psi.status !== 'active') {
                await sub.update({
                    status: 'INACTIVE',
                    plan: PaymentStateService.buildInstallmentPlanMeta({ ...meta, autoRenew: false })
                });
                await downgradePsi();
                console.log(`ℹ️ [CRON RENEW] Ciclo parcelado (${meta.cycle}) encerrado sem renovação para Psi ID ${psi.id}`);
                continue;
            }

            // Verifica se houve parcela em atraso no ciclo anterior antes de renovar
            try {
                const isSinglePayRef = String(sub.id).startsWith('pay_');
                const overdueUrl = isSinglePayRef
                    ? `${ASAAS_API_URL}/payments/${sub.id}`
                    : `${ASAAS_API_URL}/payments?installment=${sub.id}&status=OVERDUE`;
                const overdueRes = await fetch(overdueUrl, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                if (overdueRes.ok) {
                    const overdueData = await overdueRes.json();
                    const hasOverdue = isSinglePayRef
                        ? (overdueData && overdueData.status === 'OVERDUE')
                        : (overdueData && Array.isArray(overdueData.data) && overdueData.data.length > 0);
                    if (hasOverdue) {
                        console.warn(`⚠️ [CRON RENEW] Parcela OVERDUE encontrada no ciclo ${sub.id} do Psi ID ${psi.id}. Renovação suspensa.`);
                        await sub.update({ status: 'INACTIVE' });
                        await downgradePsi();
                        continue;
                    }
                }
            } catch (checkErr) {
                console.error(`⚠️ [CRON RENEW] Erro ao verificar inadimplência do ciclo ${sub.id}:`, checkErr.message);
                continue;
            }

            try {
                const { res, payData } = await PaymentStateService.createInstallmentChargeWithToken({
                    customerId: sub.asaasCustomerId,
                    creditCardToken: meta.token,
                    meta,
                    psychologistId: psi.id
                });

                if (res.ok && payData.id && !payData.errors) {
                    const newRefId = payData.installment || payData.id;
                    const monthsToAdd = meta.cycle === 'SEMIANNUAL' ? 6 : 3;
                    const novaValidade = PaymentStateService.addMonthsSafe(now, monthsToAdd);

                    await sub.update({ status: 'RENEWED' });
                    await db.Subscription.upsert({
                        id: newRefId,
                        psychologistId: psi.id,
                        asaasCustomerId: sub.asaasCustomerId,
                        plan: PaymentStateService.buildInstallmentPlanMeta({ ...meta, autoRenew: true }),
                        status: 'ACTIVE',
                        currentPeriodStart: now,
                        currentPeriodEnd: novaValidade
                    });
                    await PaymentStateService.syncPaymentToDatabase(psi, {
                        ...payData,
                        value: payData.value != null ? payData.value : Number(((Number(meta.totalValue) || 0) / (Number(meta.installmentCount) || 1)).toFixed(2)),
                        billingType: payData.billingType || 'CREDIT_CARD'
                    }).catch(() => {});
                    await psi.update({
                        subscriptionId: newRefId,
                        plano: meta.planType,
                        planExpiresAt: novaValidade,
                        cancelAtPeriodEnd: false,
                        canceledAt: null
                    });
                    console.log(`✅ [CRON RENEW] Parcelamento ${meta.cycle} renovado automaticamente (${newRefId}) para Psi ID ${psi.id}`);
                } else {
                    await sub.update({ status: 'FAILED' });
                    await downgradePsi();
                    console.warn(`❌ [CRON RENEW] Recusa ao renovar parcelamento (${meta.cycle}) do Psi ID ${psi.id}:`, payData.errors?.[0]?.description || res.status);
                }
            } catch (err) {
                console.error(`⚠️ [CRON RENEW] Erro de rede ao renovar parcelamento Psi ID ${psi.id}:`, err.message);
            }
        }
    } catch (e) {
        console.error('❌ [CRON RENEW] Erro no processInstallmentRenewals:', e.message);
    }
}

// ============================================================================
// 1. AUDITORIA DE INTEGRIDADE DA BASE DE DADOS (Limpeza de Inadimplentes)
// ============================================================================
async function runIntegrityAudit() {
    console.log('🛡️ [CRON AUDIT] Executando auditoria de integridade da base de dados e Asaas...');
    await processTokenizedTrials();
    await processInstallmentRenewals();
    try {
        const ASAAS_API_URL = PaymentStateService.getAsaasApiUrl();

        // 1. Revoga is_exempt se a pessoa já for pagante
        await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false WHERE "subscriptionId" IS NOT NULL AND "is_exempt" = true;`);
        
        // 2. Bloqueia VIPs que não tem plano setado
        const newPricingActive = pricingLaunch.isNewPricingActive();
        if (newPricingActive) {
            await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false, plano = 'Comunidade' WHERE "is_exempt" = true AND ("plano" IS NULL OR "plano" = '');`);
        } else {
            await db.sequelize.query(`UPDATE "Psychologists" SET "is_exempt" = false, status = 'inactive' WHERE "is_exempt" = true AND ("plano" IS NULL OR "plano" = '');`);
        }

        // 3. Busca psicólogos pagos/em trial com plano vencido (exclui quem já está no Plano Comunidade gratuito)
        const expiredPsis = await db.Psychologist.findAll({
            where: {
                status: 'active',
                plano: { [Op.notIn]: ['Comunidade'] },
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
                // Período de testes (Trial) encerrado sem assinatura contratada
                shouldBlock = true;
                reason = 'Período de testes (Trial) encerrado sem assinatura';
            } else if (psi.subscriptionId.startsWith('trial_tok_')) {
                // Trial tokenizado já processado acima por processTokenizedTrials
                continue;
            } else if (psi.cancelAtPeriodEnd) {
                // Usuário cancelou a renovação e o período pago já encerrou (planExpiresAt <= now)
                shouldBlock = true;
                reason = 'Período pago encerrado após cancelamento de renovação';
            } else {
                // Tem assinatura ou parcelamento -> Consulta Ativa no Asaas
                try {
                    const isRecurringSub = psi.subscriptionId.startsWith('sub_');
                    if (isRecurringSub) {
                        const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, {
                            headers: { 'access_token': process.env.ASAAS_API_KEY }
                        });
                        if (subRes.ok) {
                            const subData = await subRes.json();
                            if (subData.status === 'INACTIVE' || subData.deleted) {
                                shouldBlock = true;
                                reason = 'Assinatura inativa ou cancelada no Asaas';
                            }
                        }
                    }

                    if (!shouldBlock) {
                        const isSinglePayRef = String(psi.subscriptionId).startsWith('pay_');
                        const queryParam = isRecurringSub
                            ? `subscription=${psi.subscriptionId}`
                            : `installment=${psi.subscriptionId}`;
                        const pUrl = isSinglePayRef
                            ? `${ASAAS_API_URL}/payments/${psi.subscriptionId}`
                            : `${ASAAS_API_URL}/payments?${queryParam}`;
                        const pRes = await fetch(pUrl, {
                            headers: { 'access_token': process.env.ASAAS_API_KEY }
                        });

                        if (pRes.ok) {
                            const pData = await pRes.json();
                            const payments = isSinglePayRef ? (pData && pData.id ? [pData] : []) : (pData.data || []);
                            
                            const hasOverdue = payments.some(p => p.status === 'OVERDUE');
                            
                            if (hasOverdue) {
                                shouldBlock = true;
                                reason = 'Pagamento em atraso (OVERDUE) no Asaas';

                                const overduePayment = payments.find(p => p.status === 'OVERDUE');
                                if (overduePayment && overduePayment.dueDate) {
                                    const dueDate = new Date(overduePayment.dueDate);
                                    const diffTime = now.getTime() - dueDate.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                    if (isRecurringSub && diffDays > 5) {
                                        try {
                                            await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, {
                                                method: 'DELETE',
                                                headers: { 'access_token': process.env.ASAAS_API_KEY }
                                            });
                                            console.log(`[ASAAS] Assinatura ${psi.subscriptionId} CANCELADA. Motivo: Fatura vencida há mais de 5 dias (${diffDays} dias).`);
                                        } catch (err) {
                                            console.error(`[ASAAS] Falha ao cancelar assinatura ${psi.subscriptionId} após limite de tolerância:`, err.message);
                                        }
                                    }
                                }
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
                            console.error(`[CRON AUDIT] Erro ao consultar Asaas para pagamentos da assinatura ${psi.subscriptionId}. Mantendo ativo por segurança.`);
                        }
                    }
                } catch (err) {
                    console.error(`[CRON AUDIT] Falha na request Asaas para ${psi.subscriptionId}:`, err.message);
                }
            }

            if (shouldBlock) {
                if (newPricingActive) {
                    console.log(`❌ [CRON AUDIT] Rebaixando psicólogo ID ${psi.id} (${psi.nome}) para Comunidade. Motivo: ${reason}`);
                    if (psi.subscriptionId) {
                        await PaymentStateService.cancelAndPurgeSubscription(psi.subscriptionId, {
                            psychologistId: psi.id
                        }).catch(() => {});
                    }
                    await psi.update({
                        plano: 'Comunidade',
                        planExpiresAt: null,
                        subscriptionId: null,
                        cancelAtPeriodEnd: false,
                        canceledAt: psi.canceledAt || new Date()
                    });
                } else {
                    console.log(`❌ [CRON AUDIT] Bloqueando psicólogo ID ${psi.id} (${psi.nome}). Motivo: ${reason}`);
                    await psi.update({
                        status: 'inactive',
                        cancelAtPeriodEnd: true,
                        canceledAt: psi.canceledAt || new Date()
                    });
                    if (psi.subscriptionId) {
                        await PaymentStateService.cancelAndPurgeSubscription(psi.subscriptionId, {
                            psychologistId: psi.id
                        }).catch(() => {});
                    }
                }
            }
        }

        // 4. Checagem de integridade: Psicólogos inativos ou com período cancelado já vencido que ainda possuem sub_... vinculada
        const auditNow = new Date();
        const inactiveWithSub = await db.Psychologist.findAll({
            where: {
                subscriptionId: { [Op.like]: 'sub_%' },
                [Op.or]: [
                    { status: { [Op.in]: ['inactive', 'vencido'] } },
                    {
                        cancelAtPeriodEnd: true,
                        [Op.or]: [
                            { planExpiresAt: null },
                            { planExpiresAt: { [Op.lte]: auditNow } }
                        ]
                    },
                    {
                        canceledAt: { [Op.ne]: null },
                        status: { [Op.ne]: 'active' }
                    }
                ]
            }
        });

        for (const psi of inactiveWithSub) {
            try {
                // Checa no Asaas se a assinatura ainda não foi deletada antes de purgar
                const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, {
                    headers: { 'access_token': process.env.ASAAS_API_KEY }
                });
                if (subRes.ok) {
                    const subData = await subRes.json();
                    if (subData && !subData.deleted) {
                        console.log(`🛡️ [CRON AUDIT] Purgando assinatura órfã no Asaas para psicólogo inativo/vencido ID ${psi.id} (${psi.nome})...`);
                        await PaymentStateService.cancelAndPurgeSubscription(psi.subscriptionId, {
                            psychologistId: psi.id,
                            customerId: subData.customer
                        });
                    }
                }
            } catch (err) {
                console.error(`[CRON AUDIT] Erro na checagem de assinatura inativa ${psi.subscriptionId}:`, err.message);
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
// 5. ROTINA DE RESUMO SEMANAL DE PERFORMANCE (Sexta-feira)
// ============================================================================
async function sendWeeklyPerformanceEmails(now) {
    console.log("📊 [CRON] Iniciando rotina de Resumo Semanal de Performance...");
    try {
        const emailService = require('../services/emailService');
        
        // Buscar todos os psicólogos ativos
        const activePsis = await db.Psychologist.findAll({
            where: { status: 'active' }
        });

        if (activePsis.length === 0) {
            console.log("📊 [CRON] Nenhum psicólogo ativo encontrado para o resumo semanal.");
            return;
        }

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        for (const psi of activePsis) {
            try {
                // Contar Matches nos últimos 7 dias
                const matchesCountResult = await db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id AND "createdAt" >= :date`,
                    { replacements: { id: psi.id, date: sevenDaysAgo }, type: db.sequelize.QueryTypes.SELECT }
                ).catch(() => db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "MatchEvents" WHERE "PsychologistId" = :id AND "createdAt" >= :date`,
                    { replacements: { id: psi.id, date: sevenDaysAgo }, type: db.sequelize.QueryTypes.SELECT }
                )).catch(() => [{ count: 0 }]);
                const matchesCount = parseInt(matchesCountResult[0].count);

                // Contar Visualizações de Perfil nos últimos 7 dias
                const profileViewsResult = await db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id AND "createdAt" >= :date`,
                    { replacements: { id: psi.id, date: sevenDaysAgo }, type: db.sequelize.QueryTypes.SELECT }
                ).catch(() => [{ count: 0 }]);
                const profileViewsCount = parseInt(profileViewsResult[0].count);

                // Obter o tema principal (mockado baseado nos temas_atuacao ou null)
                let topTheme = null;
                if (psi.temas_atuacao) {
                    let temasArr = [];
                    if (Array.isArray(psi.temas_atuacao)) {
                        temasArr = psi.temas_atuacao;
                    } else if (typeof psi.temas_atuacao === 'string') {
                        temasArr = psi.temas_atuacao.split(',');
                    }
                    if (temasArr.length > 0) {
                        topTheme = temasArr[0].trim ? temasArr[0].trim() : temasArr[0];
                    }
                }

                await emailService.sendWeeklyPerformanceEmail(psi, matchesCount, profileViewsCount, topTheme);
            } catch (err) {
                console.error(`❌ [CRON] Erro ao enviar resumo semanal para ${psi.email}:`, err.message);
            }
        }
        console.log(`✅ [CRON] Resumo Semanal de Performance enviado para ${activePsis.length} psicólogos.`);
    } catch (e) {
        console.error("❌ [CRON] Erro geral no cron de resumo semanal:", e.message);
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
    let lastWeeklySummaryDay = -1;
    let aiScheduleTimes = [];

    setInterval(async () => {
        const now = new Date();
        const currentHM = now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        const currentBrtHour = parseInt(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit' }), 10);
        const currentMinute = parseInt(now.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', minute: '2-digit' }), 10);
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

        // NOVO: RESUMO SEMANAL DE PERFORMANCE (Roda toda sexta-feira às 10h)
        const currentDayOfWeek = now.getDay(); // 0 = Domingo, 5 = Sexta-feira
        if (currentDayOfWeek === 5 && currentBrtHour === 10 && currentDay !== lastWeeklySummaryDay) {
            lastWeeklySummaryDay = currentDay;
            await sendWeeklyPerformanceEmails(now);
        }

        // 3 & 4. LEMBRETES DE SESSÃO, FEEDBACK E CONVERSÃO DE TRIAL TOKENIZADO (Verifica a cada virada de hora)
        if (currentBrtHour !== lastReminderHour) {
            lastReminderHour = currentBrtHour;
            await processTokenizedTrials();
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
            console.log(`🤖 [CRON IA] Horário sorteado atingido (${currentHM}). Iniciando Motor de Publicação Gradual...`);
            const releaseAiDraft = require('./releaseAiDraft');
            releaseAiDraft().catch(err => console.error("Erro na liberação da IA:", err));
            // Remove o horário para não rodar mais de uma vez naquele minuto,
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

module.exports = { startCronJobs, runIntegrityAudit, processTokenizedTrials, processInstallmentRenewals };
