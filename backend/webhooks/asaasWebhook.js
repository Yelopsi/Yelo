const db = require('../models');
const emailService = require('../services/emailService');
const gamificationService = require('../services/gamificationService');

exports.handleWebhook = async (req, res) => {
    // O Asaas envia o evento no corpo do request (JSON)
    const event = req.body;
    
    // Validação básica de segurança (Opcional: verificar token no header se configurado no Asaas)
    // [FIX CRÍTICO] Verificação obrigatória do Token do Webhook do Asaas em Produção
    const asaasToken = req.headers['asaas-access-token'];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    if (expectedToken && asaasToken !== expectedToken) {
        console.error("🚨 [ALERTA DE SEGURANÇA] Webhook bloqueado. Token esperado não confere com o recebido.");
        return res.status(401).json({ error: 'Token de Webhook inválido.' });
    } else if (!expectedToken) {
        console.warn("⚠️ [AVISO] ASAAS_WEBHOOK_TOKEN não configurado no .env. Webhook aceito sem validação (Recomendado configurar por segurança).");
    }

    // --- NOVOS EVENTOS DE NOTIFICAÇÃO PERSONALIZADA YELO ---
    // Captura eventos de cobrança para enviar e-mail com estética Yelo
    const notificationEvents = [
        'PAYMENT_CREATED', // Cobrança criada
        'PAYMENT_DUEDATE_WARNING', // Aviso de vencimento (e 10 dias antes)
        'SEND_LINHA_DIGITAVEL', // Linha digitável no dia
        'PAYMENT_OVERDUE', // Vencida (e a cada 7 dias)
        'PAYMENT_UPDATED' // Atualizada
    ];

    if (notificationEvents.includes(event.event)) {
        const payment = event.payment;
        const externalId = payment.externalReference; // Pode ser ID de Psi ou Paciente
        
        try {
            let user = null;
            
            // 1. Tenta buscar Psicólogo
            if (externalId) {
                user = await db.Psychologist.findByPk(externalId);
            }
            // Fallback: busca por assinatura (Psi)
            if (!user && payment.subscription) {
                user = await db.Psychologist.findOne({ where: { stripeSubscriptionId: payment.subscription } });
            }

            if (user) {
                console.log(`📧 [YELO MAIL] Disparando notificação personalizada: ${event.event} para ${user.email}`);
                
                switch (event.event) {
                    case 'PAYMENT_CREATED':
                        if (payment.billingType !== 'CREDIT_CARD') {
                            await emailService.sendBillCreatedEmail(user, payment);
                        }
                        break;
                    case 'PAYMENT_DUEDATE_WARNING':
                        await emailService.sendDueDateWarningEmail(user, payment);
                        break;
                    case 'SEND_LINHA_DIGITAVEL':
                        // Apenas se for boleto/pix
                        if (payment.billingType === 'BOLETO' || payment.billingType === 'PIX') {
                            await emailService.sendDigitableLineEmail(user, payment);
                        }
                        break;
                    case 'PAYMENT_OVERDUE':
                        await emailService.sendOverdueEmail(user, payment);
                        break;
                    case 'PAYMENT_UPDATED':
                        // Evita spam: só avisa se mudou valor ou vencimento e não está paga
                        if (payment.status === 'PENDING' || payment.status === 'OVERDUE') {
                            await emailService.sendBillUpdatedEmail(user, payment);
                        }
                        break;
                }
            }
        } catch (err) {
            console.error(`❌ [YELO MAIL ERROR] Falha ao enviar notificação ${event.event}:`, err.message);
        }
        
        if (db.SystemLog) {
            db.SystemLog.create({
                level: 'info',
                message: `[ASAAS] Evento de Cobrança: ${event.event} recebido para ${externalId || payment.subscription || 'Desconhecido'}`,
                meta: { event: event.event }
            }).catch(() => {});
        }
    }
    // -------------------------------------------------------

    if (event.event === 'PAYMENT_CONFIRMED' || event.event === 'PAYMENT_RECEIVED') {
        const payment = event.payment;
        // O Asaas retorna o externalReference que enviamos na criação (ID do Psicólogo)
        const psychologistId = payment.externalReference;
        
        // Tenta extrair o plano da descrição (ex: "Assinatura Yelo - Plano CLINICAL")
        const description = payment.description || "";
        let planType = 'ESSENTIAL'; // Default
        if (description.includes('CLINICAL')) planType = 'CLINICAL';
        if (description.includes('REFERENCE')) planType = 'REFERENCE';

        try {
            const psi = await db.Psychologist.findByPk(psychologistId);
            if (psi) {
                // --- FIX: RELOAD PARA EVITAR RACE CONDITION ---
                await psi.reload();

                // --- PROTEÇÃO CONTRA IDEMPOTÊNCIA (Pagamentos Duplicados) ---
                if (db.SystemLog && payment.id) {
                    const existingLog = await db.SystemLog.findOne({
                        where: {
                            message: { [db.Sequelize.Op.iLike]: '%Pagamento Confirmado%' },
                            meta: { [db.Sequelize.Op.contains]: { paymentId: payment.id } }
                        }
                    });
                    if (existingLog) {
                        console.log(`[ASAAS] Webhook duplicado ignorado. Fatura ${payment.id} já processada para ${psi.email}.`);
                        return res.json({ received: true, ignored: true, reason: 'Already processed' });
                    }
                }

                // --- PROTEÇÃO CONTRA RACE CONDITION // WEBHOOKS ANTIGOS ---
                if (psi.status === 'active' && payment.subscription && psi.stripeSubscriptionId && psi.stripeSubscriptionId !== payment.subscription) {
                     return res.json({received: true});
                }
                
                if (psi.status === 'inactive' && !psi.stripeSubscriptionId) {
                    return res.json({received: true});
                }

                const currentPayments = (psi.subscription_payments_count || 0) + 1;

                const hoje = new Date();
                const novaValidade = new Date(hoje.setDate(hoje.getDate() + 30));

                const updatePayload = {
                    status: 'active',
                    planExpiresAt: novaValidade, 
                    plano: planType,
                    stripeSubscriptionId: payment.subscription,
                    subscription_payments_count: currentPayments
                };

                // Registra a data da primeira assinatura se ainda não existir
                if (!psi.subscribedAt) {
                    updatePayload.subscribedAt = new Date();
                }

                await psi.update(updatePayload);

                // --- GAMIFICATION: Tenta atribuir a badge de Pioneiro ---
                gamificationService.assignPioneerBadge(psi.id).catch(e => console.error("Erro no hook de badge Pioneiro (Pagamento):", e));

                // [LOG DE SUCESSO PARA RASTREAMENTO NO DASHBOARD E IDEMPOTÊNCIA]
                if (db.SystemLog) {
                    db.SystemLog.create({
                        level: 'info',
                        message: `[ASAAS] Pagamento Confirmado: ${psi.email} (Plano ${planType})`,
                        meta: { userEmail: psi.email, psychologistId: psi.id, paymentId: payment.id }
                    }).catch(() => {});
                }

                // --- ENVIA E-MAIL PERSONALIZADO YELO ---
                emailService.sendPaymentConfirmationEmail(psi, planType, payment.value)
                    .catch(err => console.error("Erro ao enviar email de confirmação (background):", err.message));
            }
        } catch (err) {
            console.error('Erro ao atualizar banco:', err);
            if (db.SystemLog) {
                db.SystemLog.create({ level: 'error', message: `Falha webhook Asaas (Psi ${psychologistId}): ${err.message}` }).catch(() => {});
            }
            return res.json({received: true}); 
        }
    }
    
    // --- LÓGICA DE ESTORNO // CANCELAMENTO IMEDIATO ---
    if (['PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS'].includes(event.event) || 
       (event.event === 'PAYMENT_UPDATED' && event.payment && ['REFUNDED', 'REFUND_IN_PROGRESS'].includes(event.payment.status))) {
        const payment = event.payment;
        let psychologistId = payment.externalReference;

        try {
            let psi = null;
            if (psychologistId) psi = await db.Psychologist.findByPk(psychologistId);
            if (!psi && payment.subscription) psi = await db.Psychologist.findOne({ where: { stripeSubscriptionId: payment.subscription } });

            if (psi) {
                // TRAVA DE SEGURANÇA: Se o estorno for de uma assinatura antiga e o usuário já tem uma assinatura nova ativa
                if (payment.subscription && psi.stripeSubscriptionId && psi.stripeSubscriptionId !== payment.subscription) {
                    console.log(`[ASAAS] Estorno ignorado para ${psi.email}. Assinatura estornada (${payment.subscription}) difere da atual ativa.`);
                } else {
                    await psi.update({ status: 'inactive', plano: null, planExpiresAt: new Date(), cancelAtPeriodEnd: false });
                    emailService.sendSubscriptionCancelledEmail(psi).catch(e => console.error("Erro email cancelamento:", e));
                    
                    if (db.SystemLog) {
                        db.SystemLog.create({
                            level: 'warning',
                            message: `[ASAAS] Pagamento Estornado/Cancelado: ${psi.email}`,
                            meta: { event: event.event, psychologistId: psi.id }
                        }).catch(() => {});
                    }
                }
            }
        } catch (err) { console.error('❌ [ASAAS] Erro ao processar estorno no banco:', err); }
    }

    // --- LÓGICA DE FALHA NO PAGAMENTO (NOVO) ---
    if (['PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'].includes(event.event)) {
        const payment = event.payment;
        let psychologistId = payment.externalReference;

        try {
            let psi = null;
            if (psychologistId) psi = await db.Psychologist.findByPk(psychologistId);
            if (!psi && payment.subscription) psi = await db.Psychologist.findOne({ where: { stripeSubscriptionId: payment.subscription } });
            if (psi) {
                // TRAVA DE SEGURANÇA: Se o psicólogo já tem uma validade futura ativa (por causa de outro pagamento pago),
                // ignoramos este aviso de falha/vencimento (pois geralmente é uma cobrança velha/duplicada que venceu).
                const now = new Date();
                if (psi.planExpiresAt && psi.planExpiresAt > now) {
                    console.log(`[ASAAS] Alerta de falha/vencimento ignorado para ${psi.email}. O plano está válido até ${psi.planExpiresAt}.`);
                } else if (psi.status === 'inactive') {
                    // TRAVA ANTI-LOOP: Se o Asaas reenviar o webhook por timeout de email, ignoramos se já estiver inativo
                    console.log(`[ASAAS] Retentativa de falha/vencimento ignorada. Usuário ${psi.email} já está inativo.`);
                } else {
                    await psi.update({ status: 'inactive', planExpiresAt: new Date() });
                    emailService.sendPaymentFailedEmail(psi, payment.invoiceUrl).catch(e => console.error("Erro email falha:", e));
                    
                    if (db.SystemLog) {
                        db.SystemLog.create({
                            level: 'error',
                            message: `[ASAAS] Pagamento Falhou/Venceu: ${psi.email}. Acesso suspenso.`,
                            meta: { event: event.event, psychologistId: psi.id }
                        }).catch(() => {});
                    }
                }
            }
        } catch (err) { console.error('Erro ao processar falha de pagamento:', err); }
    }
    res.json({received: true});
};