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

    static async fetchRealPayment(paymentId) {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }

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

        // SINCRONIZAÇÃO EM TEMPO REAL COM O BANCO DE DADOS LOCAL
        await this.syncPaymentToDatabase(psi, payment);

        // Eventos Positivos
        if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(event.event)) {
            await this.processPaymentSuccess(psi, payment);
        }
        
        // Eventos Negativos
        const negativeEvents = [
            'PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 
            'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS', 'PAYMENT_OVERDUE', 
            'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'
        ];
        
        if (negativeEvents.includes(event.event) || 
           (event.event === 'PAYMENT_UPDATED' && ['REFUNDED', 'REFUND_IN_PROGRESS'].includes(payment.status))) {
            await this.processPaymentFailure(psi, payment, event.event);
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

            const currentPayments = (lockedPsi.subscription_payments_count || 0) + 1;
            
            // Calcula nova validade baseada no dueDate da fatura que acabou de ser paga
            let novaValidade;
            if (payment.dueDate) {
                const parts = payment.dueDate.split('-'); 
                novaValidade = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999-03:00`);
            } else {
                // Fallback de segurança caso dueDate não venha no payload
                novaValidade = (lockedPsi.planExpiresAt && new Date(lockedPsi.planExpiresAt) > new Date()) 
                    ? new Date(lockedPsi.planExpiresAt) 
                    : new Date();
            }

            // Adiciona 1 mês de forma segura (previne bug do Javascript de pular meses curtos ex: 31 Jan -> 03 Mar)
            const targetMonth = novaValidade.getMonth() + 1;
            novaValidade.setMonth(targetMonth);
            if (novaValidade.getMonth() !== targetMonth % 12) {
                novaValidade.setDate(0); // Recua para o último dia do mês correto
            }

            const updatePayload = {
                status: 'active',
                planExpiresAt: novaValidade,
                plano: planType,
                subscriptionId: payment.subscription,
                subscription_payments_count: currentPayments
            };

            if (!lockedPsi.subscribedAt) {
                updatePayload.subscribedAt = new Date();
            }

            await lockedPsi.update(updatePayload, { transaction: t });

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

            // O estorno/falha é da assinatura atual. Removendo acesso.
            await lockedPsi.update({
                status: 'pending',
                subscriptionId: null
            }, { transaction: t });

            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'warning',
                    message: `[ASAAS] Acesso Suspenso via Evento Negativo (${eventType}): ${lockedPsi.email}`,
                    meta: { event: eventType, psychologistId: lockedPsi.id, paymentId: payment.id }
                }, { transaction: t });
            }
        });
    }
}

module.exports = PaymentStateService;
