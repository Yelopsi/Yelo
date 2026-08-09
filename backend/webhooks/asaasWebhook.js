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
    
    // FAIL-CLOSED OBRIGATÓRIO
    if (!expectedToken) {
        console.error("🚨 ERRO CRÍTICO DE CONFIGURAÇÃO: ASAAS_WEBHOOK_TOKEN ausente. Negando requisições por segurança (Fail-Closed).");
        return res.status(401).json({ error: 'Configuração de webhook ausente no servidor.' });
    }
    if (asaasToken !== expectedToken) {
        console.error("🚨 [ALERTA DE SEGURANÇA] Webhook bloqueado. Token esperado não confere com o recebido.");
        return res.status(401).json({ error: 'Token de Webhook inválido.' });
    }

    if (!event || !event.payment || !event.payment.id) {
        return res.status(400).json({ error: 'Payload de webhook inválido ou incompleto.' });
    }

    // ZERO TRUST: Consultar o Asaas diretamente
    let asaasPayment = null;
    try {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }

        const asaasRes = await fetch(`${ASAAS_API_URL}/payments/${event.payment.id}`, {
            headers: {
                'access_token': process.env.ASAAS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!asaasRes.ok) {
            console.error(`❌ [ASAAS] Falha ao consultar pagamento real ${event.payment.id}: ${asaasRes.status}`);
            return res.status(400).json({ error: 'Falha ao validar pagamento na API do Asaas.' });
        }

        asaasPayment = await asaasRes.json();
        
        if (!asaasPayment || !asaasPayment.id) {
            return res.status(400).json({ error: 'Resposta inválida da API do Asaas ou sem ID.' });
        }
    } catch (err) {
        console.error(`❌ [ASAAS] Erro de rede ao consultar pagamento:`, err.message);
        return res.status(500).json({ error: 'Erro interno ao validar pagamento.' });
    }

    // OVERRIDE: Substitui o payment forjado pelo payment REAL retornado pela API
    event.payment = asaasPayment;

    // --- PROTEÇÃO ANTI-SPOOFING DE EVENTOS ---
    const isPaidStatus = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(asaasPayment.status);
    
    // Se o evento for de ativação, o status real TEM que ser de um pagamento efetivado.
    if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event)) {
        if (!isPaidStatus) {
            console.error(`🚨 Spoofing detectado: Evento de ativação (${event.event}) mas pagamento não está pago (${asaasPayment.status}).`);
            return res.status(400).json({ error: 'Status financeiro real incompatível com o evento recebido.' });
        }
    }

    // Se o evento for de desativação/falha, o status real NÃO PODE ser de um pagamento pendente ou efetivado. Tem que ser explicitamente negativo.
    const negativeEvents = ['PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'];
    const negativeStatuses = ['OVERDUE', 'REFUNDED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'];
    
    if (negativeEvents.includes(event.event)) {
        if (!negativeStatuses.includes(asaasPayment.status)) {
            console.error(`🚨 Spoofing detectado: Evento negativo (${event.event}) visando desativação, mas pagamento real não está em estado de falha/estorno (${asaasPayment.status}).`);
            return res.status(400).json({ error: 'Status financeiro real incompatível com evento negativo.' });
        }
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
            await db.sequelize.transaction(async (t) => {
                const psi = await db.Psychologist.findOne({
                    where: { id: psychologistId },
                    lock: t.LOCK.UPDATE,
                    transaction: t
                });
                if (psi) {
                    // --- PROTEÇÃO CONTRA IDEMPOTÊNCIA E CONCORRÊNCIA ---
                    if (db.SystemLog && payment.id) {
                        const existingLog = await db.SystemLog.findOne({
                            where: {
                                message: { [db.Sequelize.Op.iLike]: '%Pagamento Confirmado%' },
                                meta: { [db.Sequelize.Op.contains]: { paymentId: payment.id } }
                            },
                            transaction: t
                        });
                        if (existingLog) {
                            console.log(`[ASAAS] Webhook duplicado ignorado. Fatura ${payment.id} já processada para ${psi.email}.`);
                            return res.json({ received: true, ignored: true, reason: 'Already processed' });
                        }
                    }

                    // --- PROTEÇÃO CONTRA WEBHOOKS ANTIGOS ---
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

                    await psi.update(updatePayload, { transaction: t });

                    // --- GAMIFICATION: Tenta atribuir a badge de Pioneiro ---
                    gamificationService.assignPioneerBadge(psi.id).catch(e => console.error("Erro no hook de badge Pioneiro (Pagamento):", e));

                    // [LOG DE SUCESSO PARA RASTREAMENTO E IDEMPOTÊNCIA]
                    if (db.SystemLog) {
                        await db.SystemLog.create({
                            level: 'info',
                            message: `[ASAAS] Pagamento Confirmado: ${psi.email} (Plano ${planType})`,
                            meta: { userEmail: psi.email, psychologistId: psi.id, paymentId: payment.id }
                        }, { transaction: t });
                    }

                    // --- ENVIA E-MAIL PERSONALIZADO YELO ---
                    emailService.sendPaymentConfirmationEmail(psi, planType, payment.value)
                        .catch(err => console.error("Erro ao enviar email de confirmação (background):", err.message));
                }
            });
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