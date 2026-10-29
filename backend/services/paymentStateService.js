const db = require('../models');
const emailService = require('./emailService');
const gamificationService = require('./gamificationService');

class PaymentStateService {
    /**
     * Processa um evento assíncrono do Asaas e projeta as mudanças no estado financeiro
     */
    static async processAsaasEvent(event) {
        if (event && event.event === 'PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED') {
            await this.processPixAutomaticRefused(event);
            return;
        }

        if (!event || !event.payment || !event.payment.id) {
            throw new Error('Payload do evento inválido ou ausente.');
        }

        // 1. ZERO TRUST: Consultar o Asaas diretamente
        const asaasPayment = await this.fetchRealPayment(event.payment.id);
        
        // Substitui o payment forjado pelo payment REAL
        event.payment = asaasPayment;

        // 2. PROTEÇÃO ANTI-SPOOFING
        this.validateSpoofing(event, asaasPayment);

        // 3. EXECUTA AS REGRAS DE NEGÓCIO POR TIPO DE EVENTO
        await this.handleNotifications(event);
        await this.updateFinancialState(event, asaasPayment);
    }

    static getAsaasApiUrl() {
        let url = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
        if (process.env.ASAAS_API_KEY && process.env.ASAAS_API_KEY.includes('prod_')) {
            url = 'https://api.asaas.com/v3';
        } else if (url.includes('sandbox.asaas.com') && !url.includes('/api')) {
            url = url.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        return url.trim().replace(/\/+$/, '');
    }

    /**
     * Cancela e purga uma assinatura no Asaas e no banco local:
     * 1. Remove faturas PENDING e OVERDUE geradas no Asaas
     * 2. Deleta a assinatura no Asaas
     * 3. Desativa notificações do cliente no Asaas para cessar SMS e e-mails de cobrança
     * 4. Cancela faturas locais PENDING/OVERDUE
     * 5. Atualiza Subscriptions local para INACTIVE
     */
    static async cancelAndPurgeSubscription(subscriptionId, options = {}) {
        if (!subscriptionId) return;
        const ASAAS_API_URL = this.getAsaasApiUrl();
        const apiKey = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
        if (!apiKey) return;

        let customerId = options.customerId || null;

        try {
            // 1. Busca dados da assinatura no Asaas se não tivermos customerId
            if (!customerId) {
                const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
                    headers: { 'access_token': apiKey }
                });
                if (subRes.ok) {
                    const subData = await subRes.json();
                    customerId = subData.customer;
                }
            }

            // 2. Busca e deleta faturas abertas (PENDING e OVERDUE) desta assinatura no Asaas
            const [pendingRes, overdueRes] = await Promise.all([
                fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments?status=PENDING`, {
                    headers: { 'access_token': apiKey }
                }),
                fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}/payments?status=OVERDUE`, {
                    headers: { 'access_token': apiKey }
                })
            ]);
            const pendingData = await pendingRes.json().catch(() => ({ data: [] }));
            const overdueData = await overdueRes.json().catch(() => ({ data: [] }));
            const openPayments = [
                ...(pendingData.data || []),
                ...(overdueData.data || [])
            ];

            for (const p of openPayments) {
                await fetch(`${ASAAS_API_URL}/payments/${p.id}`, {
                    method: 'DELETE',
                    headers: { 'access_token': apiKey }
                }).catch(() => {});
                await db.Payment.update({ status: 'CANCELED' }, { where: { id: p.id } }).catch(() => {});
            }

            // 3. Deleta a assinatura no Asaas para cessar o ciclo
            await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionId}`, {
                method: 'DELETE',
                headers: { 'access_token': apiKey }
            }).catch(() => {});

            // 4. Desativa notificações do cliente no Asaas para nunca mais mandar SMS/Email de cobrança
            if (customerId) {
                await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
                    body: JSON.stringify({ notificationDisabled: true })
                }).catch(() => {});
            }

            // 5. Atualiza modelos locais
            await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: subscriptionId } }).catch(() => {});
            if (options.psychologistId) {
                await db.Payment.update({ status: 'CANCELED' }, {
                    where: {
                        psychologistId: options.psychologistId,
                        status: ['PENDING', 'OVERDUE']
                    }
                }).catch(() => {});
            }
            console.log(`[ASAAS PURGE] Assinatura ${subscriptionId} cancelada e faturas abertas limpas com sucesso.`);
        } catch (err) {
            console.error(`[ASAAS PURGE] Erro ao purgar assinatura ${subscriptionId}:`, err.message);
        }
    }

    static async fetchRealPayment(paymentId) {
        const ASAAS_API_URL = this.getAsaasApiUrl();

        const asaasRes = await fetch(`${ASAAS_API_URL}/payments/${paymentId}`, {
            headers: {
                'access_token': process.env.ASAAS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!asaasRes.ok) {
            throw new Error(`Falha ao consultar pagamento real ${paymentId} no Asaas: ${asaasRes.status}`);
        }

        const asaasPayment = await asaasRes.json();
        if (!asaasPayment || !asaasPayment.id) {
            throw new Error('Resposta inválida da API do Asaas ou sem ID.');
        }

        return asaasPayment;
    }

    static validateSpoofing(event, asaasPayment) {
        const isPaidStatus = ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(asaasPayment.status);
        
        if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event)) {
            if (!isPaidStatus) {
                throw new Error(`Spoofing detectado: Evento de ativação (${event.event}) mas pagamento real não está pago (${asaasPayment.status}).`);
            }
        }

        const negativeEvents = [
            'PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 
            'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_OVERDUE', 
            'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'
        ];
        const negativeStatuses = [
            'OVERDUE', 'REFUNDED', 'REFUND_IN_PROGRESS', 'CHARGEBACK_REQUESTED', 
            'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'
        ];
        
        // PAYMENT_DELETED geralmente cancela o pagamento, o status no Asaas nem sempre é listado em negativeStatuses, mas validamos se faz sentido
        if (negativeEvents.includes(event.event) && event.event !== 'PAYMENT_DELETED') {
            if (!negativeStatuses.includes(asaasPayment.status)) {
                throw new Error(`Spoofing detectado: Evento negativo (${event.event}), mas pagamento não está em falha/estorno (${asaasPayment.status}).`);
            }
        }
    }

    static async handleNotifications(event) {
        const notificationEvents = [
            'PAYMENT_CREATED', 'PAYMENT_DUEDATE_WARNING', 'SEND_LINHA_DIGITAVEL', 
            'PAYMENT_OVERDUE', 'PAYMENT_UPDATED'
        ];

        if (!notificationEvents.includes(event.event)) return;

        const payment = event.payment;
        const externalId = payment.externalReference;
        
        let user = null;
        if (externalId) {
            user = await db.Psychologist.findByPk(externalId);
        }
        if (!user && payment.subscription) {
            user = await db.Psychologist.findOne({ where: { subscriptionId: payment.subscription } });
        }

        if (user) {
            const userStatus = String(user.status || '').toLowerCase();
            // Se o usuário cancelou a renovação, a assinatura, ou está inativo/vencido, suprimimos avisos de vencimento e cobranças
            if (user.cancelAtPeriodEnd || user.canceledAt || userStatus === 'inactive' || userStatus === 'vencido') {
                console.log(`[ASAAS] Supressão de e-mail ${event.event} para ${user.email} (cancelamento agendado/efetuado ou inativo)`);
                return;
            }

            try {
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
                        if (payment.billingType === 'BOLETO' || payment.billingType === 'PIX') {
                            await emailService.sendDigitableLineEmail(user, payment);
                        }
                        break;
                    case 'PAYMENT_OVERDUE':
                        await emailService.sendOverdueEmail(user, payment);
                        break;
                    case 'PAYMENT_UPDATED':
                        if (payment.status === 'PENDING' || payment.status === 'OVERDUE') {
                            await emailService.sendBillUpdatedEmail(user, payment);
                        }
                        break;
                }
            } catch (err) {
                console.error(`❌ Erro ao enviar email ${event.event}:`, err.message);
            }
        }
    }

    static async updateFinancialState(event, asaasPayment) {
        const payment = asaasPayment;
        const externalId = payment.externalReference;
        
        let psi = null;
        if (externalId) psi = await db.Psychologist.findByPk(externalId);
        if (!psi && payment.subscription) psi = await db.Psychologist.findOne({ where: { subscriptionId: payment.subscription } });

        if (!psi) {
            console.log(`[ASAAS] Psicólogo não encontrado para o pagamento ${payment.id}. Ignorando.`);
            return;
        }

        // Checagem de idempotência: verifica o estado prévio desta fatura no banco local
        const existingPayment = await db.Payment.findOne({ where: { id: payment.id } });
        const wasAlreadyPaid = existingPayment && ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(existingPayment.status);

        // SINCRONIZAÇÃO EM TEMPO REAL COM O BANCO DE DADOS LOCAL
        await this.syncPaymentToDatabase(psi, payment);

        // Eventos Positivos
        // IMPORTANTE: Para cartão de crédito, PAYMENT_RECEIVED é apenas liquidação contábil (D+30), não uma nova cobrança do cliente.
        // O evento de faturamento/renovação de cartão é exclusivamente PAYMENT_CONFIRMED.
        // Para PIX/Boleto, PAYMENT_RECEIVED é o evento de faturamento legítimo.
        const isCreditCardSettlement = payment.billingType === 'CREDIT_CARD' && event.event === 'PAYMENT_RECEIVED';

        if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event)) {
            if (!isCreditCardSettlement && !wasAlreadyPaid) {
                await this.processPaymentSuccess(psi, payment);
            } else if (isCreditCardSettlement) {
                console.log(`[ASAAS] Evento PAYMENT_RECEIVED para cartão ${payment.id} tratado exclusivamente como liquidação D+30 (não estende assinatura).`);
            } else if (wasAlreadyPaid) {
                console.log(`[ASAAS] Pagamento ${payment.id} já foi processado anteriormente. Ciclo mantido (idempotência garantida).`);
            }
            await this.syncPaymentToLedger(event.event, payment);
        }
        
        // Eventos Negativos
        const negativeEvents = [
            'PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 
            'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_OVERDUE', 
            'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
            'PAYMENT_CHARGEBACK_DISPUTE', 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
        ];
        
        if (negativeEvents.includes(event.event) || 
           (event.event === 'PAYMENT_UPDATED' && ['REFUNDED', 'REFUND_IN_PROGRESS'].includes(payment.status))) {
            await this.processPaymentFailure(psi, payment, event.event);
            await this.syncNegativePaymentToLedger(event.event, payment);
        }
    }

    static async processPixAutomaticRefused(event) {
        const instruction = event.paymentInstruction || event.payment;
        if (!instruction || !instruction.id) return;

        const attempt = instruction.retryAttempt || 0; 
        
        // Se já for a tentativa 3 (já esgotou a política 3R), não faz nada. 
        if (attempt >= 3) {
            console.log(`[ASAAS] Pix Automático: Retentativas esgotadas (Tentativa ${attempt}). A cobrança pai permanecerá OVERDUE.`);
            return;
        }

        // Calcula a nova dueDate
        const now = new Date();
        let daysToAdd = 1;
        if (attempt === 0) daysToAdd = 1;      // Falha original -> Tenta D+1
        else if (attempt === 1) daysToAdd = 2; // Falha T1 -> Tenta em +2 dias (D+3 no total)
        else if (attempt === 2) daysToAdd = 2; // Falha T2 -> Tenta em +2 dias (D+5 no total)

        const nextRetryDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        const dueDateStr = nextRetryDate.toISOString().split('T')[0];

        try {
            console.log(`[ASAAS] Pix Automático: Agendando retentativa ${attempt + 1} para instrução ${instruction.id} na data ${dueDateStr}`);
            
            let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
            ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
            if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
                ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
            }
            const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

            const fetch = require('node-fetch');
            const res = await fetch(`${ASAAS_API_URL}/pix/automatic/paymentInstructions/${instruction.id}/retries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                body: JSON.stringify({ dueDate: dueDateStr })
            });

            if (!res.ok) {
                const err = await res.json();
                console.error(`[ASAAS] Erro ao agendar retentativa de Pix Automático:`, err);
            } else {
                console.log(`[ASAAS] Retentativa de Pix Automático agendada com sucesso.`);
            }
        } catch (e) {
            console.error(`[ASAAS] Exceção ao agendar retentativa de Pix Automático:`, e);
        }
    }

    static async syncPaymentToLedger(eventType, payment) {
        // Fetch current events for this payment
        const existingEvents = await db.PaymentFinancialEvent.findAll({
            where: { paymentId: payment.id }
        });
        const hasConfirmed = existingEvents.some(e => e.eventType === 'PAYMENT_CONFIRMED');
        const hasCredited = existingEvents.some(e => e.eventType === 'PAYMENT_CREDITED');

        const confDate = payment.confirmedDate || payment.clientPaymentDate;
        const confDateOnly = confDate ? confDate.substring(0, 10) : null;
        
        let shouldCreateConfirmed = false;
        let shouldCreateCredited = false;

        if (eventType === 'PAYMENT_CONFIRMED') {
            shouldCreateConfirmed = !hasConfirmed;
        } else if (eventType === 'PAYMENT_RECEIVED') {
            shouldCreateConfirmed = !hasConfirmed;
            shouldCreateCredited = !hasCredited;
        }

        if (hasConfirmed) {
            const existingConf = existingEvents.find(e => e.eventType === 'PAYMENT_CONFIRMED');
            if (parseFloat(existingConf.grossAmount) !== parseFloat(payment.value)) {
                console.error(`🚨 LEDGER_EVENT_CONFLICT: PAYMENT_CONFIRMED para ${payment.id} tem valor bruto diferente do original.`);
            }
        }
        if (hasCredited && eventType === 'PAYMENT_RECEIVED') {
            const existingCred = existingEvents.find(e => e.eventType === 'PAYMENT_CREDITED');
            if (parseFloat(existingCred.cashDeltaAmount) !== parseFloat(payment.netValue)) {
                console.error(`🚨 LEDGER_EVENT_CONFLICT: PAYMENT_CREDITED para ${payment.id} tem netValue diferente do original.`);
            }
        }

        // Out-of-order check: if eventType=PAYMENT_RECEIVED but payment is not actually received, abort credited
        const isActuallyReceived = payment.status === 'RECEIVED' || payment.status === 'RECEIVED_IN_CASH';
        if (eventType === 'PAYMENT_RECEIVED' && !isActuallyReceived) {
            console.log(`[LEDGER] PAYMENT_RECEIVED recebido, mas status no Asaas ainda é ${payment.status}. Adiando CREDITED.`);
            shouldCreateCredited = false;
        }

        await db.sequelize.transaction(async (t) => {
            if (shouldCreateConfirmed && confDateOnly) {
                const confPayload = {
                    paymentId: payment.id,
                    externalEventId: payment.id,
                    eventType: 'PAYMENT_CONFIRMED',
                    grossAmount: payment.value,
                    feeAmount: null,
                    netCashAmount: null,
                    cashDeltaAmount: null,
                    eventDate: confDateOnly,
                    sourceMetadata: {
                        id: payment.id,
                        status: payment.status,
                        billingType: payment.billingType,
                        confirmedDate: payment.confirmedDate,
                        clientPaymentDate: payment.clientPaymentDate,
                        expectedCreditDate: payment.creditDate || payment.estimatedCreditDate,
                        value: payment.value,
                        netValue: payment.netValue,
                        dateSource: payment.confirmedDate ? 'confirmedDate' : 'clientPaymentDate'
                    }
                };
                
                try {
                    await db.PaymentFinancialEvent.create(confPayload, { transaction: t });
                    console.log(`[LEDGER] PAYMENT_CONFIRMED gravado para ${payment.id}.`);
                } catch (err) {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        // Idempotente na constraint
                        const existing = await db.PaymentFinancialEvent.findOne({ where: { paymentId: payment.id, eventType: 'PAYMENT_CONFIRMED' }, transaction: t });
                        if (parseFloat(existing.grossAmount) !== parseFloat(payment.value)) {
                            console.error(`🚨 LEDGER_EVENT_CONFLICT: PAYMENT_CONFIRMED para ${payment.id} tem valor bruto diferente do original.`);
                        }
                    } else {
                        throw err;
                    }
                }
            }

            if (shouldCreateCredited && payment.creditDate) {
                const fee = payment.value - payment.netValue;
                const credPayload = {
                    paymentId: payment.id,
                    externalEventId: payment.id,
                    eventType: 'PAYMENT_CREDITED',
                    grossAmount: payment.value,
                    feeAmount: fee,
                    netCashAmount: payment.netValue,
                    cashDeltaAmount: payment.netValue,
                    eventDate: payment.creditDate.substring(0, 10),
                    sourceMetadata: {
                        id: payment.id,
                        status: payment.status,
                        billingType: payment.billingType,
                        creditDate: payment.creditDate,
                        value: payment.value,
                        netValue: payment.netValue
                    }
                };

                try {
                    await db.PaymentFinancialEvent.create(credPayload, { transaction: t });
                    console.log(`[LEDGER] PAYMENT_CREDITED gravado para ${payment.id}. Caixa atualizado.`);
                } catch (err) {
                    if (err.name === 'SequelizeUniqueConstraintError') {
                        // Idempotente na constraint
                        const existing = await db.PaymentFinancialEvent.findOne({ where: { paymentId: payment.id, eventType: 'PAYMENT_CREDITED' }, transaction: t });
                        if (parseFloat(existing.cashDeltaAmount) !== parseFloat(payment.netValue)) {
                            console.error(`🚨 LEDGER_EVENT_CONFLICT: PAYMENT_CREDITED para ${payment.id} tem netValue diferente do original.`);
                        }
                    } else {
                        throw err;
                    }
                }
            }
        });
    }

    static async syncNegativePaymentToLedger(eventType, payment) {
        const isRefund = eventType === 'PAYMENT_REFUNDED' || eventType === 'PAYMENT_REFUND_IN_PROGRESS' || eventType === 'PAYMENT_REVERSED' || payment.status === 'REFUNDED' || payment.status === 'REFUND_IN_PROGRESS';
        const isChargeback = eventType.includes('CHARGEBACK') || ['CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'].includes(payment.status);

        if (!isRefund && !isChargeback) return;

        const existingEvents = await db.PaymentFinancialEvent.findAll({
            where: { paymentId: payment.id }
        });

        // Resolve reconciliation status
        let isDuplicatePrincipalLoss = false;
        if ((isRefund && existingEvents.some(e => e.eventType === 'CHARGEBACK')) || 
            (isChargeback && existingEvents.some(e => e.eventType === 'REFUND')) ||
            (isRefund && isChargeback)) {
            isDuplicatePrincipalLoss = true;
        }

        const recStatus = isDuplicatePrincipalLoss ? 'POTENTIAL_DUPLICATE_PRINCIPAL_LOSS' : null;

        await db.sequelize.transaction(async (t) => {
            if (isRefund && payment.refunds && payment.refunds.length > 0) {
                for (const refund of payment.refunds) {
                    const extId = refund.id || `ref_${payment.id}_${refund.dateCreated}_${refund.value}`;
                    const hasEvent = existingEvents.some(e => e.eventType === 'REFUND' && e.externalEventId === extId);
                    
                    if (!hasEvent) {
                        try {
                            await db.PaymentFinancialEvent.create({
                                paymentId: payment.id,
                                externalEventId: extId,
                                eventType: 'REFUND',
                                grossAmount: refund.value,
                                feeAmount: null,
                                netCashAmount: null,
                                cashDeltaAmount: null, // CONSERVADOR: sem caixa fabricado
                                eventDate: refund.dateCreated ? refund.dateCreated.substring(0, 10) : new Date().toISOString().substring(0, 10),
                                eventOccurredAt: refund.dateCreated || null,
                                sourceMetadata: {
                                    id: payment.id,
                                    status: payment.status,
                                    billingType: payment.billingType,
                                    refundId: refund.id,
                                    reason: refund.reason,
                                    value: refund.value,
                                    originalPaymentId: payment.id,
                                    reconciliationStatus: recStatus,
                                    sourceEventName: eventType
                                }
                            }, { transaction: t });
                        } catch (err) {
                            if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                        }
                    }
                }
            }

            if (isChargeback && payment.chargeback) {
                const cb = payment.chargeback;
                const extId = cb.id || `cb_${payment.id}`;
                const hasEvent = existingEvents.some(e => e.eventType === 'CHARGEBACK' && e.externalEventId === extId);
                
                if (!hasEvent) {
                    try {
                        await db.PaymentFinancialEvent.create({
                            paymentId: payment.id,
                            externalEventId: extId,
                            eventType: 'CHARGEBACK',
                            grossAmount: cb.amount || payment.value, // se chargeback n tiver amount, usa total
                            feeAmount: null,
                            netCashAmount: null,
                            cashDeltaAmount: null, // CONSERVADOR
                            eventDate: (cb.date || new Date().toISOString()).substring(0, 10),
                            eventOccurredAt: cb.date || null,
                            sourceMetadata: {
                                id: payment.id,
                                status: payment.status,
                                billingType: payment.billingType,
                                chargebackId: cb.id,
                                reason: cb.reason,
                                value: cb.amount || payment.value,
                                originalPaymentId: payment.id,
                                reconciliationStatus: recStatus,
                                sourceEventName: eventType
                            }
                        }, { transaction: t });
                    } catch (err) {
                        if (err.name !== 'SequelizeUniqueConstraintError') throw err;
                    }
                }
            }
        });
        
        // Asynchronous investigation of Cash Impact
        this.investigateCashImpact(payment.id).catch(e => console.error(e));
    }

    static async investigateCashImpact(paymentId) {
        try {
            let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
            if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
                ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
            }
            
            const fetch = require('node-fetch');
            const res = await fetch(`${ASAAS_API_URL}/financialTransactions?paymentId=${paymentId}`, {
                headers: { 'access_token': process.env.ASAAS_API_KEY, 'Content-Type': 'application/json' }
            });
            
            if (!res.ok) return null;
            const data = await res.json();
            
            if (data && data.data && data.data.length > 0) {
                const INCLUDED_AS_ADJUSTMENT = ['PAYMENT_REFUND', 'CHARGEBACK', 'PAYMENT_FEE_REFUND', 'PAYMENT_REVERSAL', 'PAYMENT_REFUND_CANCELLED'];
                const EXCLUDED_ALREADY_REPRESENTED = ['PAYMENT_RECEIVED', 'PAYMENT_FEE', 'PAYMENT_MESSAGING_NOTIFICATION_FEE'];
                
                await db.sequelize.transaction(async (t) => {
                    for (const tx of data.data) {
                        if (tx.paymentId !== paymentId) continue;
                        
                        if (INCLUDED_AS_ADJUSTMENT.includes(tx.type)) {
                            try {
                                await db.PaymentFinancialEvent.create({
                                    paymentId: paymentId,
                                    externalEventId: tx.id,
                                    eventType: 'GATEWAY_CASH_MOVEMENT',
                                    grossAmount: Math.abs(tx.value), // Magnificude
                                    feeAmount: null,
                                    netCashAmount: null,
                                    cashDeltaAmount: tx.value, // Signed value
                                    eventDate: tx.date,
                                    eventOccurredAt: null, // Asaas doesn't give timestamp here
                                    sourceMetadata: {
                                        id: paymentId,
                                        transactionId: tx.id,
                                        transactionType: tx.type,
                                        value: tx.value,
                                        balance: tx.balance
                                    }
                                }, { transaction: t });
                                console.log(`[LEDGER] GATEWAY_CASH_MOVEMENT gerado para transação ${tx.id} do tipo ${tx.type}.`);
                            } catch (err) {
                                if (err.name === 'SequelizeUniqueConstraintError') {
                                    // Verifica se houve mudança de valor
                                    const existing = await db.PaymentFinancialEvent.findOne({ where: { paymentId: paymentId, externalEventId: tx.id, eventType: 'GATEWAY_CASH_MOVEMENT' }, transaction: t });
                                    if (parseFloat(existing.cashDeltaAmount) !== parseFloat(tx.value)) {
                                        console.error(`🚨 LEDGER_EVENT_CONFLICT: GATEWAY_CASH_MOVEMENT para ${tx.id} tem valor diferente do original.`);
                                    }
                                } else {
                                    throw err;
                                }
                            }
                        } else if (!EXCLUDED_ALREADY_REPRESENTED.includes(tx.type)) {
                            console.warn(`[LEDGER] UNKNOWN_FINANCIAL_TRANSACTION_TYPE encontrado: ${tx.type}. Não importado automaticamente.`);
                        }
                    }
                });
            }
            return true;
        } catch (e) {
            console.error(`[LEDGER] Erro ao investigar cash impact:`, e);
            return null;
        }
    }

    static async syncPaymentToDatabase(psi, payment) {
        try {
            const dueDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
            let paymentDate = null;
            
            if (payment.clientPaymentDate) {
                paymentDate = new Date(payment.clientPaymentDate);
            } else if (payment.confirmedDate) {
                paymentDate = new Date(payment.confirmedDate);
            } else if (payment.paymentDate) {
                paymentDate = new Date(payment.paymentDate);
            }

            // Garante que o status salvo reflita a realidade
            await db.Payment.upsert({
                id: payment.id,
                subscriptionId: null, // Evita foreign key violation com tabela legado
                psychologistId: psi.id,
                status: payment.status,
                value: payment.value,
                billingType: payment.billingType,
                dueDate: dueDate,
                paymentDate: paymentDate,
                createdAt: payment.dateCreated ? new Date(payment.dateCreated) : new Date()
            });
            console.log(`[ASAAS] Pagamento ${payment.id} sincronizado no banco local com sucesso.`);
        } catch (err) {
            console.error(`[ASAAS] Erro ao sincronizar pagamento ${payment.id}:`, err.message);
        }
    }

    static async processPaymentSuccess(psi, payment) {
        const description = payment.description || "";
        let planType = 'ESSENTIAL';
        if (description.includes('CLINICAL')) planType = 'CLINICAL';
        if (description.includes('REFERENCE')) planType = 'REFERENCE';

        await db.sequelize.transaction(async (t) => {
            const lockedPsi = await db.Psychologist.findOne({
                where: { id: psi.id },
                lock: t.LOCK.UPDATE,
                transaction: t
            });

            // Proteção contra webhook de assinatura antiga
            if (lockedPsi.status === 'active' && payment.subscription && lockedPsi.subscriptionId && lockedPsi.subscriptionId !== payment.subscription) {
                console.log(`[ASAAS] Ignorando sucesso de assinatura legada ${payment.subscription} (Atual: ${lockedPsi.subscriptionId})`);
                return;
            }

            // Contagem idempotente e exata de pagamentos confirmados
            const confirmedPaymentsCount = await db.Payment.count({
                where: {
                    psychologistId: lockedPsi.id,
                    status: { [db.Sequelize.Op.in]: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'] }
                },
                transaction: t
            });
            const currentPayments = Math.max(confirmedPaymentsCount, 1);
            
            // Cada fatura do Asaas corresponde a um ciclo de cobrança.
            // O pagamento cobre até 1 mês após o dueDate (ou paymentDate se dueDate ausente).
            const payDueDateStr = payment.dueDate || payment.paymentDate || payment.clientPaymentDate;
            const payDueDate = payDueDateStr ? new Date(payDueDateStr + (String(payDueDateStr).includes('T') ? '' : 'T12:00:00Z')) : new Date();
            
            let cycleExpiry = new Date(payDueDate.getTime());
            const targetMonth = cycleExpiry.getMonth() + 1;
            cycleExpiry.setMonth(targetMonth);
            if (cycleExpiry.getMonth() !== targetMonth % 12) {
                cycleExpiry.setDate(0); // Recua para o último dia do mês correto
            }

            // Garante no mínimo 30 dias a partir da data em que o pagamento foi EFETIVAMENTE realizado pelo cliente
            // (evita usar Date.now() para que webhooks processados em atraso não distorçam o calendário)
            const payEffectiveDateStr = payment.clientPaymentDate || payment.confirmedDate || payment.paymentDate || payDueDateStr;
            const payEffectiveDate = payEffectiveDateStr ? new Date(payEffectiveDateStr + (String(payEffectiveDateStr).includes('T') ? '' : 'T12:00:00Z')) : new Date();
            const minExpiry = new Date(payEffectiveDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (cycleExpiry < minExpiry) {
                cycleExpiry = minExpiry;
            }

            // Se houver fatura(s) anterior(es) OVERDUE para este psicólogo com vencimento anterior a esta fatura:
            // Isso previne que o usuário burle ou pule meses gerados antecipadamente pelo Asaas
            const olderOverduePayments = await db.Payment.findAll({
                where: {
                    psychologistId: lockedPsi.id,
                    status: 'OVERDUE',
                    dueDate: { [db.Sequelize.Op.lt]: payDueDateStr }
                },
                transaction: t
            });

            if (olderOverduePayments.length > 0) {
                console.log(`[ASAAS] Identificadas ${olderOverduePayments.length} faturas OVERDUE anteriores para ${lockedPsi.email}. Regularizando ciclo...`);
                const ASAAS_API_URL = PaymentStateService.getAsaasApiUrl();
                const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

                for (const oldOverdue of olderOverduePayments) {
                    try {
                        await fetch(`${ASAAS_API_URL}/payments/${oldOverdue.id}`, {
                            method: 'DELETE',
                            headers: { 'access_token': ASAAS_API_KEY }
                        });
                    } catch (delErr) {
                        console.error(`[ASAAS] Falha ao deletar fatura overdue ${oldOverdue.id} no Asaas:`, delErr);
                    }
                    await oldOverdue.update({ status: 'CANCELED' }, { transaction: t });
                }

                // O pagamento feito cobre o ciclo que estava em aberto
                const sortedOverdue = olderOverduePayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                const oldestDueDateStr = sortedOverdue[0].dueDate;
                const oldestDueDate = new Date(oldestDueDateStr + (String(oldestDueDateStr).includes('T') ? '' : 'T12:00:00Z'));

                let correctedExpiry = new Date(oldestDueDate.getTime());
                const targetCorrectedMonth = correctedExpiry.getMonth() + 1;
                correctedExpiry.setMonth(targetCorrectedMonth);
                if (correctedExpiry.getMonth() !== targetCorrectedMonth % 12) {
                    correctedExpiry.setDate(0);
                }
                if (correctedExpiry < minExpiry) {
                    correctedExpiry = minExpiry;
                }
                cycleExpiry = correctedExpiry;

                if (payment.subscription) {
                    const nextDueDateStr = cycleExpiry.toISOString().split('T')[0];
                    try {
                        await fetch(`${ASAAS_API_URL}/subscriptions/${payment.subscription}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                            body: JSON.stringify({ nextDueDate: nextDueDateStr })
                        });
                    } catch (subErr) {
                        console.error(`[ASAAS] Falha ao sincronizar nextDueDate da assinatura ${payment.subscription}:`, subErr);
                    }
                }
            }

            // IDEMPOTÊNCIA: Se o psicólogo já tem validade igual ou superior a esta fatura,
            // NÃO incrementamos outro mês (evita que webhooks repetidos ou fluxo síncrono + assíncrono pulem meses)
            let novaValidade = cycleExpiry;
            if (olderOverduePayments.length === 0 && lockedPsi.planExpiresAt && new Date(lockedPsi.planExpiresAt) > cycleExpiry) {
                novaValidade = new Date(lockedPsi.planExpiresAt);
            }

            const isNewSubscription = !lockedPsi.subscriptionId || (payment.subscription && lockedPsi.subscriptionId !== payment.subscription);

            const updatePayload = {
                status: 'active',
                planExpiresAt: novaValidade,
                plano: planType,
                subscriptionId: payment.subscription,
                subscription_payments_count: currentPayments
            };

            // Só reativa cancelAtPeriodEnd se for uma nova assinatura contratada
            // Se o psicólogo já havia agendado o cancelamento desta assinatura, seu cancelamento é estritamente preservado
            if (isNewSubscription) {
                updatePayload.cancelAtPeriodEnd = false;
                updatePayload.canceledAt = null;
            }

            if (!lockedPsi.subscribedAt) {
                updatePayload.subscribedAt = new Date();
            }
            if (!lockedPsi.profileActivatedAt) {
                updatePayload.profileActivatedAt = new Date();
            }

            if (!lockedPsi.firstPaidAt) {
                // Se é o primeiro pagamento confirmado, registramos a data
                let paymentDate = new Date();
                if (payment.clientPaymentDate) paymentDate = new Date(payment.clientPaymentDate);
                else if (payment.confirmedDate) paymentDate = new Date(payment.confirmedDate);
                else if (payment.paymentDate) paymentDate = new Date(payment.paymentDate);
                
                updatePayload.firstPaidAt = paymentDate;
            }

            await lockedPsi.update(updatePayload, { transaction: t });

            if (payment.subscription) {
                await db.Subscription.update({
                    status: 'ACTIVE',
                    currentPeriodStart: payDueDate,
                    currentPeriodEnd: novaValidade
                }, {
                    where: { id: payment.subscription },
                    transaction: t
                }).catch(() => {});
            }

            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'info',
                    message: `[ASAAS] Pagamento Confirmado: ${lockedPsi.email} (Plano ${planType})`,
                    meta: { userEmail: lockedPsi.email, psychologistId: lockedPsi.id, paymentId: payment.id }
                }, { transaction: t });
            }
        });

        // Background / Gamification
        gamificationService.assignPioneerBadge(psi.id).catch(() => {});
        emailService.sendPaymentConfirmationEmail(psi, planType, payment.value).catch(() => {});

        // Evento GA4 Server-Side para Compra Confirmada (ROAS)
        const MeasurementProtocolService = require('./MeasurementProtocolService');
        const userProps = {
            utm_source: psi.utm_source,
            utm_medium: psi.utm_medium,
            utm_campaign: psi.utm_campaign,
            utm_content: psi.utm_content
        };
        const eventParams = {
            transaction_id: payment.id,
            value: payment.value,
            currency: "BRL",
            items: [{ item_id: planType, item_name: `Plano ${planType}` }]
        };
        MeasurementProtocolService.sendEvent(psi.email, 'purchase', eventParams, userProps).catch(() => {});
    }

    static async processPaymentFailure(psi, payment, eventType) {
        await db.sequelize.transaction(async (t) => {
            const lockedPsi = await db.Psychologist.findOne({
                where: { id: psi.id },
                lock: t.LOCK.UPDATE,
                transaction: t
            });

            // PROTEÇÃO: Verificar se este estorno/falha pertence à assinatura ATUAL.
            // Se ele for um Refund de uma assinatura antiga, e o usuário JÁ assinou uma nova, NÃO suspendemos.
            if (lockedPsi.subscriptionId && payment.subscription && lockedPsi.subscriptionId !== payment.subscription) {
                console.log(`[ASAAS] Ignorando falha/refund de assinatura legada ${payment.subscription} (Atual: ${lockedPsi.subscriptionId})`);
                return;
            }

            // O estorno/falha é da assinatura atual.
            // Para eventos como DELETED (ex: cancelamento da assinatura remove faturas futuras) 
            // ou OVERDUE, NÃO devemos remover o acesso se o usuário ainda tem dias pagos (planExpiresAt no futuro).
            const isRefundOrChargeback = ['PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_REFUND_IN_PROGRESS'].includes(eventType) ||
                (eventType === 'PAYMENT_UPDATED' && ['REFUNDED', 'REFUND_IN_PROGRESS'].includes(payment.status));
            
            const now = new Date();
            const hasValidPlan = lockedPsi.planExpiresAt && new Date(lockedPsi.planExpiresAt) > now;

            if (isRefundOrChargeback) {
                // Se o dinheiro foi devolvido, removemos o acesso imediatamente
                await lockedPsi.update({
                    status: 'inactive',
                    planExpiresAt: now
                }, { transaction: t });
                if (payment.subscription) {
                    await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: payment.subscription }, transaction: t }).catch(() => {});
                }
            } else {
                // Para OVERDUE, DELETED, REFUSED, só inativamos se não tiver plano válido vigente
                if (!hasValidPlan) {
                    await lockedPsi.update({
                        status: 'inactive'
                    }, { transaction: t });
                    if (payment.subscription && ['PAYMENT_DELETED', 'PAYMENT_OVERDUE'].includes(eventType)) {
                        await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: payment.subscription }, transaction: t }).catch(() => {});
                    }
                } else {
                    console.log(`[ASAAS] Evento ${eventType} ignorado para inativação: psicólogo ${psi.email} ainda tem plano válido até ${lockedPsi.planExpiresAt}`);
                }
            }

            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'warning',
                    message: `[ASAAS] Evento Negativo processado (${eventType}): ${lockedPsi.email} - Status mantido/alterado conforme validade.`,
                    meta: { event: eventType, psychologistId: lockedPsi.id, paymentId: payment.id, isRefundOrChargeback, hasValidPlan }
                }, { transaction: t });
            }
        });
    }
}

module.exports = PaymentStateService;
