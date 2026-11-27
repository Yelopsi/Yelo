// backend/controllers/paymentController.js
const db = require('../models');
const emailService = require('../services/emailService');
const gamificationService = require('../services/gamificationService');
const promoCouponService = require('../services/promoCouponService');
const pricingLaunch = require('../utils/pricingLaunch');
const PaymentStateService = require('../services/paymentStateService');

const getAsaasApiUrl = () => PaymentStateService.getAsaasApiUrl();
const getAsaasApiKey = () => (process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '');

const { v4: uuidv4 } = require('uuid');

let subscriptionPlanColumnWidened = false;
async function ensureSubscriptionPlanTextColumn() {
    if (subscriptionPlanColumnWidened) return;
    try {
        if (db.sequelize.getDialect() === 'postgres') {
            await db.sequelize.query('ALTER TABLE "Subscriptions" ALTER COLUMN "plan" TYPE TEXT;');
        }
        subscriptionPlanColumnWidened = true;
    } catch (err) {
        console.warn('[DB SCHEMA] Aviso ao ampliar Subscriptions.plan:', err.message);
    }
}

// 0. VERIFICA ELEGIBILIDADE DE OFERTA PROMOCIONAL VINCULADA AO E-MAIL DO PROFISSIONAL
exports.getPromoEligibility = async (req, res) => {
    try {
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist) return res.status(404).json({ eligible: false, error: 'Psicólogo não encontrado.' });

        const rawPlan = String(req.query.planType || 'ESSENTIAL').toUpperCase();
        const isIosFee = req.query.isIos === 'true' || req.query.platform === 'ios' || rawPlan === 'ESSENTIAL_IOS';
        const normalizedPlan = (rawPlan === 'ESSENTIAL_IOS' || rawPlan === 'ESSENCIAL') ? 'ESSENTIAL' : rawPlan;

        const result = await promoCouponService.getActiveOfferForPsychologist(psychologist, normalizedPlan, { isIosFee });
        return res.json(result);
    } catch (error) {
        console.error('[PROMO] Erro ao verificar elegibilidade por e-mail:', error);
        return res.status(500).json({ eligible: false, error: 'Não foi possível verificar condições especiais no momento.' });
    }
};

// 0.1 VALIDA CUPOM INTERNO (VIP_COUPON)
exports.validateCoupon = async (req, res) => {
    try {
        const { cupom, planType, isIos, platform } = req.body || {};
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        const rawPlan = String(planType || 'ESSENTIAL').toUpperCase();
        const isIosFee = isIos === true || platform === 'ios' || rawPlan === 'ESSENTIAL_IOS';
        const normalizedPlan = (rawPlan === 'ESSENTIAL_IOS' || rawPlan === 'ESSENCIAL') ? 'ESSENTIAL' : rawPlan;

        const result = await promoCouponService.validateCouponForPsychologist(cupom, psychologist, normalizedPlan, { isIosFee });
        if (!result.valid) {
            return res.status(400).json({ valid: false, error: result.reason });
        }

        return res.json(result);
    } catch (error) {
        console.error('[PROMO] Erro ao validar cupom:', error);
        return res.status(500).json({ valid: false, error: 'Não foi possível validar o cupom no momento.' });
    }
};

// 1. CRIA A ASSINATURA NO ASAAS (Checkout Transparente com Intent e Idempotência)
exports.createPreference = async (req, res) => {
    let intent = null;
    let localPsychologist = null;
    const ASAAS_API_URL = getAsaasApiUrl();
    const ASAAS_API_KEY = getAsaasApiKey();
    
    try {
        const { planType, cupom, creditCard, billingType, billingCycle } = req.body;
        const psychologistId = req.psychologist.id;
        localPsychologist = await db.Psychologist.findByPk(psychologistId);
        if (!localPsychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        const rawPlan = (planType || '').toUpperCase();
        const isIosFee = req.body.isIos === true || req.body.platform === 'ios' || rawPlan === 'ESSENTIAL_IOS';
        const normalizedPlan = (rawPlan === 'ESSENTIAL_IOS' || rawPlan === 'ESSENCIAL') ? 'ESSENTIAL' : rawPlan;

        // --- TRAVA DE INADIMPLÊNCIA / PERMISSÃO DE REASSINATURA ---
        const overduePayments = await db.Payment.findAll({
            where: { psychologistId, status: 'OVERDUE' }
        });
        
        if (overduePayments.length > 0) {
            // Verifica se o psicólogo ainda possui uma assinatura realmente ATIVA no gateway
            let hasActiveOngoingSub = false;
            if (localPsychologist.subscriptionId && String(localPsychologist.subscriptionId).startsWith('sub_') && localPsychologist.status === 'active' && !localPsychologist.cancelAtPeriodEnd) {
                try {
                    const subCheckRes = await fetch(`${ASAAS_API_URL}/subscriptions/${localPsychologist.subscriptionId}`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });
                    if (subCheckRes.ok) {
                        const subCheckData = await subCheckRes.json();
                        if (subCheckData && subCheckData.status === 'ACTIVE' && !subCheckData.deleted) {
                            hasActiveOngoingSub = true;
                        }
                    }
                } catch (subErr) {
                    console.error('[ASAAS] Erro ao verificar assinatura existente:', subErr);
                }
            }

            if (!hasActiveOngoingSub) {
                // Reassinatura limpa: O psicólogo estava inativo ou com renovação cancelada.
                // Limpa as faturas atrasadas antigas no Asaas e no DB para permitir o retorno sem débitos fantasmas.
                try {
                    for (const overdue of overduePayments) {
                        console.log(`[ASAAS] Reassinatura para psi ${psychologistId}. Cancelando fatura antiga ${overdue.id}`);
                        await fetch(`${ASAAS_API_URL}/payments/${overdue.id}`, {
                            method: 'DELETE',
                            headers: { 'access_token': ASAAS_API_KEY }
                        }).catch(() => {});
                        await overdue.update({ status: 'CANCELED' });
                    }
                } catch (err) {
                    console.error('[ASAAS] Erro ao cancelar faturas atrasadas antigas na reassinatura:', err);
                }
            } else {
                return res.status(403).json({ 
                    error: 'Você possui uma fatura em aberto na sua assinatura atual. Por favor, acesse o painel financeiro para regularizar ou alterar a forma de pagamento antes de criar uma nova assinatura.' 
                });
            }
        }

        // --- IDEMPOTÊNCIA: RECUPERAÇÃO DA OPERAÇÃO ---
        const idempotencyKey = req.headers['idempotency-key'] || uuidv4();
        intent = await db.SubscriptionIntent.findOne({ where: { idempotencyKey } });
        
        if (intent) {
            if (['COMPLETED', 'ASAAS_SUCCESS'].includes(intent.status)) {
                return res.json({ success: true, subscriptionId: intent.asaasSubscriptionId, message: 'Operação concluída anteriormente.' });
            }
            if (['CREATING', 'SENT_TO_ASAAS', 'RECONCILIATION_REQUIRED'].includes(intent.status)) {
                return res.status(409).json({ error: 'Operação em andamento. Aguarde a confirmação.' });
            }
            if (['FAILED_LOCAL', 'CANCELED'].includes(intent.status)) {
                return res.status(400).json({ error: 'Chave de transação já falhou. Atualize a página e tente novamente.' });
            }
        }

        // --- IDEMPOTÊNCIA: CRIAÇÃO DO INTENT (Proteção Concorrente via DB Constraint) ---
        try {
            intent = await db.SubscriptionIntent.create({
                psychologistId,
                idempotencyKey,
                planId: planType,
                billingType: billingType || 'CREDIT_CARD',
                status: 'CREATING',
                expiresAt: new Date(Date.now() + 15 * 60000) // Expira em 15 minutos
            });
        } catch (e) {
            if (e.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ error: 'Você já possui um pagamento em andamento. Aguarde alguns instantes.' });
            }
            throw e;
        }

        // 1) Cupom VIP interno (apenas se fornecido explicitamente)
        // 2) Condicao promocional Black Friday vinculada exclusivamente ao e-mail convidado (sem cupom)
        let activePromoCoupon = null;
        if (cupom && String(cupom).trim() !== '') {
            const couponResult = await promoCouponService.validateCouponForPsychologist(cupom, localPsychologist, normalizedPlan, { isIosFee });
            if (!couponResult.valid) {
                await intent.update({ status: 'FAILED_LOCAL' });
                return res.status(400).json({ error: couponResult.reason || 'Cupom inválido ou não elegível.' });
            }
            if (couponResult.isVip) {
                await localPsychologist.update({ 
                      status: 'active',
                      plano: 'VIP',
                      planExpiresAt: new Date('2099-12-31T23:59:59Z'),
                      cancelAtPeriodEnd: false,
                      subscriptionId: null
                  });
                await intent.update({ status: 'CANCELED' }); // Cancela a intenção pois usou cupom VIP
                return res.json({ couponSuccess: true, message: 'Cupom VIP aplicado!' });
            }
        }

        const emailOffer = await promoCouponService.getActiveOfferForPsychologist(localPsychologist, normalizedPlan, { isIosFee });
        if (emailOffer && emailOffer.eligible) {
            activePromoCoupon = emailOffer;
        }

        // Validação de dados do titular e do cartão (Apenas se não for PIX)
        if (billingType !== 'PIX') {
            if (!creditCard || !creditCard.holderName || !creditCard.holderCpf || !creditCard.holderPhone) {
                await intent.update({ status: 'FAILED_LOCAL' });
                return res.status(400).json({ error: 'Dados do titular incompletos.' });
            }
            if (!creditCard.number || !creditCard.expiry || !creditCard.ccv) {
                await intent.update({ status: 'FAILED_LOCAL' });
                return res.status(400).json({ error: 'Dados do cartão incompletos.' });
            }
            if (!creditCard.expiry.includes('/')) {
                await intent.update({ status: 'FAILED_LOCAL' });
                return res.status(400).json({ error: 'Data de validade inválida.' });
            }
        }

        // --- PREÇIFICAÇÃO E MODALIDADE (PRE-2027 R$99 vs JAN/2027+ CICLOS) + PROMO/iOS ---
        const newPricingActive = pricingLaunch.isNewPricingActive();
        const cycle = newPricingActive ? (billingCycle || 'SEMIANNUAL').toUpperCase() : 'MONTHLY';
        let value = newPricingActive ? 159.00 : 99.00;
        let installmentCount = 1;
        let isInstallment = false;

        if (!newPricingActive) {
            switch (normalizedPlan) {
                case 'ESSENTIAL':
                    value = (!isIosFee && activePromoCoupon && Number(activePromoCoupon.chargeToday) > 0)
                        ? Number(activePromoCoupon.chargeToday)
                        : (isIosFee ? 129.90 : 99.00);
                    break;
                case 'CLINICAL': value = 159.00; break;
                case 'REFERENCE': value = 259.00; break;
                default:
                    await intent.update({ status: 'FAILED_LOCAL' });
                    return res.status(400).json({ error: 'Plano inválido: ' + planType });
            }
        } else if (normalizedPlan === 'ESSENTIAL') {
            if (!isIosFee && activePromoCoupon && Number(activePromoCoupon.chargeToday) > 0) {
                value = Number(activePromoCoupon.chargeToday);
                installmentCount = 1;
                isInstallment = false;
            } else if (isIosFee) {
                value = 129.90;
                installmentCount = 1;
                isInstallment = false;
            } else if (cycle === 'SEMIANNUAL') {
                value = 594.00; // 6x de R$ 99
                installmentCount = 6;
                isInstallment = true;
            } else if (cycle === 'QUARTERLY') {
                value = 387.00; // 3x de R$ 129
                installmentCount = 3;
                isInstallment = true;
            } else {
                value = 159.00; // Mensal recorrente
                installmentCount = 1;
                isInstallment = false;
            }
        } else if (normalizedPlan === 'CLINICAL') {
            value = 159.00;
            installmentCount = 1;
            isInstallment = false;
        } else if (normalizedPlan === 'REFERENCE') {
            value = 259.00;
            installmentCount = 1;
            isInstallment = false;
        } else {
            await intent.update({ status: 'FAILED_LOCAL' });
            return res.status(400).json({ error: 'Plano inválido: ' + planType });
        }

        if (billingType === 'PIX' && isInstallment) {
            await intent.update({ status: 'FAILED_LOCAL' });
            return res.status(400).json({ error: 'O parcelamento em ' + installmentCount + 'x é exclusivo para cartão de crédito.' });
        }

        // --- SANITIZAÇÃO DE DADOS DO TITULAR ---
        const postalCode = creditCard && creditCard.postalCode ? creditCard.postalCode.replace(/\D/g, '') : '';
        let phone = creditCard && creditCard.holderPhone ? creditCard.holderPhone.replace(/\D/g, '') : '';
        if (phone.length < 10) {
             const psiPhone = localPsychologist.telefone ? localPsychologist.telefone.replace(/\D/g, '') : '';
             if (psiPhone.length >= 10) phone = psiPhone;
        }
        // Asaas rejeita números com todos os dígitos idênticos (ex: 11999999999) ou menores que 10 dígitos
        if (!phone || phone.length < 10 || /^(\d)\1+$/.test(phone)) {
             phone = '11987654321';
        }

        const cleanCpfCnpj = (creditCard && creditCard.holderCpf) ? creditCard.holderCpf.replace(/\D/g, '') : (localPsychologist.cpf || localPsychologist.cnpj || '');

        if (cleanCpfCnpj && !localPsychologist.cpf) {
            try { await localPsychologist.update({ cpf: cleanCpfCnpj }); } 
            catch (err) { console.warn(`[AVISO] CPF já pertence a outra conta local.`); }
        }

        // --- BUSCA/CRIAÇÃO DE CUSTOMER NO ASAAS ---
        let customerIdAsaas = null;
        
        try {
            const urlCliente = `${ASAAS_API_URL}/customers?email=${encodeURIComponent(localPsychologist.email)}`;
            const customerResponse = await fetch(urlCliente, { headers: { 'access_token': ASAAS_API_KEY } });
            const responseText = await customerResponse.text();
            
            let customerSearch;
            try { customerSearch = JSON.parse(responseText); } 
            catch (e) { throw Object.assign(new Error(`Erro de comunicação (Não JSON)`), { cause: e }); }
            
            if (customerSearch.errors) throw new Error(customerSearch.errors[0].description);

            if (customerSearch.data && customerSearch.data.length > 0) {
                customerIdAsaas = customerSearch.data[0].id;
                const existingCpf = customerSearch.data[0].cpfCnpj;
                const existingPostalCode = customerSearch.data[0].postalCode;
                const existingAddress = customerSearch.data[0].address;

                const updatePayload = {};
                if (!existingCpf && cleanCpfCnpj) updatePayload.cpfCnpj = cleanCpfCnpj;
                if (!existingPostalCode && localPsychologist.cep) updatePayload.postalCode = localPsychologist.cep;
                if (!existingAddress && localPsychologist.rua) {
                    updatePayload.address = localPsychologist.rua;
                    updatePayload.addressNumber = localPsychologist.numero;
                    updatePayload.province = localPsychologist.bairro;
                    if (localPsychologist.complemento) updatePayload.complement = localPsychologist.complemento;
                }

                if (Object.keys(updatePayload).length > 0) {
                    await fetch(`${ASAAS_API_URL}/customers/${customerIdAsaas}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                        body: JSON.stringify(updatePayload)
                    });
                }
            } else {
                const newCustomerReq = await fetch(`${ASAAS_API_URL}/customers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify({
                        name: localPsychologist.nome,
                        email: localPsychologist.email,
                        cpfCnpj: cleanCpfCnpj,
                        mobilePhone: phone,
                        postalCode: localPsychologist.cep,
                        address: localPsychologist.rua,
                        addressNumber: localPsychologist.numero,
                        province: localPsychologist.bairro,
                        complement: localPsychologist.complemento,
                        notificationDisabled: false
                    })
                });
                const newCustomer = await newCustomerReq.json();
                if (newCustomer.errors) {
                    const err = new Error(newCustomer.errors[0].description);
                    err.asaasErrors = newCustomer.errors;
                    throw err;
                }
                customerIdAsaas = newCustomer.id;
            }

            // --- CONFIGURAÇÃO AUTOMÁTICA DE NOTIFICAÇÕES (E-mail e SMS) ---
            try {
                const notifRes = await fetch(`${ASAAS_API_URL}/customers/${customerIdAsaas}/notifications`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const notifData = await notifRes.json();
                if (notifData && notifData.data && notifData.data.length > 0) {
                    const notificationsToUpdate = notifData.data.map(n => ({
                        id: n.id,
                        emailEnabledForCustomer: true, // Notificações automáticas por e-mail no Asaas quando necessário
                        smsEnabledForCustomer: true    // Notificações automáticas por SMS no Asaas quando necessário
                    }));
                    
                    await fetch(`${ASAAS_API_URL}/notifications/batch`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                        body: JSON.stringify({
                            customer: customerIdAsaas,
                            notifications: notificationsToUpdate
                        })
                    });
                }
            } catch (notifErr) {
                console.error("Aviso: Falha ao configurar notificações em lote no Asaas:", notifErr);
            }

        } catch (custError) {
            // Se falhou ao achar/criar customer, Asaas não tem assinatura vinculada.
            await intent.update({ status: 'FAILED_LOCAL' });
            return res.status(400).json({ error: `Erro no Cliente Asaas: ${custError.message}` });
        }

        // --- PREPARAÇÃO DO PAYLOAD DA COBRANÇA, TOKENIZAÇÃO (TRIAL 7D) OU ASSINATURA ---
        const skipTrialWait = Boolean(activePromoCoupon && Number(activePromoCoupon.chargeToday) > 99);
        let trialEndDate = null;
        let nextDueDate = new Date(Date.now() - 10800000).toISOString().split('T')[0];

        if (!newPricingActive) {
            const accountCreatedAt = new Date(localPsychologist.createdAt);
            const legacyTrialEnd = new Date(accountCreatedAt);
            legacyTrialEnd.setDate(legacyTrialEnd.getDate() + 7);

            if (!skipTrialWait && localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > new Date()) {
                nextDueDate = new Date(localPsychologist.planExpiresAt).toISOString().split('T')[0];
            } else if (!skipTrialWait && legacyTrialEnd > new Date()) {
                nextDueDate = legacyTrialEnd.toISOString().split('T')[0];
                const payload = { planExpiresAt: legacyTrialEnd, status: 'active' };
                if (!localPsychologist.profileActivatedAt) payload.profileActivatedAt = new Date();
                await localPsychologist.update(payload);
            }
        } else {
            const isEligibleForTrial = !localPsychologist.firstPaidAt
                && !localPsychologist.subscribedAt
                && !localPsychologist.subscriptionId
                && (!localPsychologist.planExpiresAt || localPsychologist.plano === 'Comunidade');

            if (!skipTrialWait && isEligibleForTrial && billingType !== 'PIX') {
                trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 7);
            }

            if (trialEndDate) {
                nextDueDate = new Date(trialEndDate.getTime() - 10800000).toISOString().split('T')[0];
            } else if (!skipTrialWait && localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > new Date()) {
                nextDueDate = new Date(localPsychologist.planExpiresAt).toISOString().split('T')[0];
            }
        }

        const subDescriptionBase = isIosFee ? `Assinatura Yelo - Plano ${normalizedPlan} (iOS)` : `Assinatura Yelo - Plano ${normalizedPlan}`;
        const subDescriptionCycle = (newPricingActive && !isIosFee && !activePromoCoupon) ? `${subDescriptionBase} - ${cycle}` : subDescriptionBase;
        const subDescription = activePromoCoupon ? `${subDescriptionCycle} [${activePromoCoupon.code}]` : subDescriptionCycle;

        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

        let expiryMonth = '', expiryYear = '';
        if (creditCard && creditCard.expiry) {
            [expiryMonth, expiryYear] = creditCard.expiry.split('/');
            if (expiryYear && expiryYear.length === 2) expiryYear = `20${expiryYear}`;
        }

        const useTokenizedTrial = newPricingActive && isInstallment && Boolean(trialEndDate);
        let asaasPayload;
        let asaasEndpoint;

        if (useTokenizedTrial) {
            // --- TRIMESTRAL / SEMESTRAL COM TRIAL DE 7 DIAS: TOKENIZA CARTÃO SEM COBRAR HOJE ---
            asaasEndpoint = `${ASAAS_API_URL}/creditCard/tokenizeCreditCard`;
            asaasPayload = {
                customer: customerIdAsaas,
                creditCard: {
                    holderName: creditCard.holderName,
                    number: creditCard.number,
                    expiryMonth: expiryMonth,
                    expiryYear: expiryYear,
                    ccv: creditCard.ccv
                },
                creditCardHolderInfo: {
                    name: creditCard.holderName,
                    email: localPsychologist.email,
                    cpfCnpj: creditCard.holderCpf,
                    postalCode: postalCode,
                    addressNumber: creditCard.addressNumber,
                    addressComplement: creditCard.addressComplement || null,
                    phone: phone
                },
                remoteIp
            };
        } else if (isInstallment) {
            // --- PLANOS TRIMESTRAL (3x) E SEMESTRAL (6x) SEM TRIAL: COBRANÇA PARCELADA IMEDIATA ---
            asaasEndpoint = `${ASAAS_API_URL}/payments`;
            asaasPayload = {
                customer: customerIdAsaas,
                billingType: 'CREDIT_CARD',
                dueDate: nextDueDate,
                installmentCount: installmentCount,
                totalValue: value,
                description: subDescription,
                externalReference: String(psychologistId),
                remoteIp,
                creditCard: {
                    holderName: creditCard.holderName,
                    number: creditCard.number,
                    expiryMonth: expiryMonth,
                    expiryYear: expiryYear,
                    ccv: creditCard.ccv
                },
                creditCardHolderInfo: {
                    name: creditCard.holderName,
                    email: localPsychologist.email,
                    cpfCnpj: creditCard.holderCpf,
                    postalCode: postalCode,
                    addressNumber: creditCard.addressNumber,
                    addressComplement: creditCard.addressComplement || null,
                    phone: phone
                }
            };
        } else {
            // --- PLANO MENSAL: ASSINATURA RECORRENTE TRADICIONAL ---
            asaasEndpoint = `${ASAAS_API_URL}/subscriptions`;
            if (billingType === 'PIX') {
                asaasPayload = {
                    customer: customerIdAsaas,
                    billingType: 'PIX',
                    value: value,
                    nextDueDate: nextDueDate,
                    cycle: 'MONTHLY',
                    description: subDescription,
                    externalReference: String(psychologistId),
                    retryPolicy: 'ALLOW_THREE_IN_SEVEN_DAYS',
                };
            } else {
                asaasPayload = {
                    customer: customerIdAsaas,
                    billingType: 'CREDIT_CARD',
                    value: value,
                    nextDueDate: nextDueDate,
                    cycle: 'MONTHLY',
                    description: subDescription,
                    externalReference: String(psychologistId),
                    softDescriptor: 'Yelo Saude',
                    remoteIp,
                    creditCard: {
                        holderName: creditCard.holderName,
                        number: creditCard.number,
                        expiryMonth: expiryMonth,
                        expiryYear: expiryYear,
                        ccv: creditCard.ccv
                    },
                    creditCardHolderInfo: {
                        name: creditCard.holderName,
                        email: localPsychologist.email,
                        cpfCnpj: creditCard.holderCpf,
                        postalCode: postalCode,
                        addressNumber: creditCard.addressNumber,
                        addressComplement: creditCard.addressComplement || null,
                        phone: phone
                    }
                };
            }
        }

        // --- ALTERA O ESTADO PARA AVISAR QUE A REQUISIÇÃO VAI SAIR (PONTO SEM VOLTA) ---
        await intent.update({ status: 'SENT_TO_ASAAS' });

        // --- DISPARO DA REQUISIÇÃO PARA O ASAAS ---
        let subscriptionRes, subscriptionData;
        let subId = localPsychologist.subscriptionId;
        
        try {
            if (subId) {
                let canUpdateExisting = false;
                if (!isInstallment && !useTokenizedTrial && subId.startsWith('sub_') && localPsychologist.status === 'active' && !localPsychologist.cancelAtPeriodEnd) {
                    try {
                        const checkRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                            headers: { 'access_token': ASAAS_API_KEY }
                        });
                        if (checkRes.ok) {
                            const checkText = await checkRes.text();
                            const checkData = checkText ? JSON.parse(checkText) : null;
                            if (checkData && checkData.status === 'ACTIVE' && !checkData.deleted) {
                                canUpdateExisting = true;
                            }
                        }
                    } catch (e) {}
                }

                if (canUpdateExisting) {
                    asaasPayload.updatePendingPayments = true;
                    subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                        body: JSON.stringify(asaasPayload)
                    });
                    const resText = await subscriptionRes.text();
                    subscriptionData = resText ? JSON.parse(resText) : {};
                } else {
                    if (subId.startsWith('sub_')) {
                        try {
                            await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                                method: 'DELETE',
                                headers: { 'access_token': ASAAS_API_KEY }
                            });
                        } catch (e) {}
                    }
                    subId = null;
                }
            }

            if (!subId) {
                subscriptionRes = await fetch(asaasEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(asaasPayload)
                });
                const resText = await subscriptionRes.text();
                subscriptionData = resText ? JSON.parse(resText) : {};
            }

            // Fallback para BOLETO se PIX falhar
            if (!isInstallment && billingType === 'PIX' && subscriptionRes.status === 400 && subscriptionData.errors && subscriptionData.errors[0]?.description?.includes('forma de pagamento')) {
                asaasPayload.billingType = 'BOLETO';
                subscriptionRes = await fetch(asaasEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(asaasPayload)
                });
                const fbText = await subscriptionRes.text();
                subscriptionData = fbText ? JSON.parse(fbText) : {};
            }

        } catch (networkError) {
            await intent.update({ status: 'RECONCILIATION_REQUIRED' });
            return res.status(500).json({ error: 'Erro de comunicação com o gateway. Verificando o estado do pagamento. Aguarde e confira seu plano em instantes.' });
        }

        // --- TRATAMENTO DE RETORNO DO ASAAS ---
        if (!subscriptionRes.ok || subscriptionData.errors) {
            const errCode = subscriptionRes.status;
            if (errCode >= 500) {
                await intent.update({ status: 'RECONCILIATION_REQUIRED' });
                return res.status(500).json({ error: 'Gateway instável. Verificaremos seu pagamento em instantes.' });
            }
            await intent.update({ status: 'FAILED_LOCAL' });
            const errorMsg = subscriptionData.errors ? subscriptionData.errors[0].description : 'Operação recusada pelo cartão/banco.';
            return res.status(400).json({ error: errorMsg });
        }

        // Identificador de referência (Token Trial, ID da assinatura OU ID do parcelamento)
        const asaasRefId = useTokenizedTrial
            ? `trial_tok_${uuidv4().replace(/-/g, '').slice(0, 16)}`
            : (subscriptionData.installment || subscriptionData.id);

        // --- SUCESSO NO ASAAS ---
        try {
            await intent.update({ asaasSubscriptionId: asaasRefId });
        } catch (intentErr) {
            console.error("Erro fatal ao dar update no Intent: ", intentErr);
            throw intentErr; 
        }

        try {
            if (useTokenizedTrial) {
                await ensureSubscriptionPlanTextColumn();
                await db.Subscription.upsert({
                    id: asaasRefId,
                    psychologistId: psychologistId,
                    asaasCustomerId: customerIdAsaas,
                    plan: JSON.stringify({
                        planType: normalizedPlan,
                        cycle,
                        installmentCount,
                        totalValue: value,
                        token: subscriptionData.creditCardToken,
                        last4: subscriptionData.creditCardNumber || null,
                        brand: subscriptionData.creditCardBrand || null
                    }),
                    status: 'TRIAL_CARD_TOKENIZED',
                    currentPeriodStart: new Date(),
                    currentPeriodEnd: trialEndDate
                });
            } else {
                await db.Subscription.upsert({
                    id: asaasRefId,
                    psychologistId: psychologistId,
                    asaasCustomerId: customerIdAsaas,
                    plan: isInstallment ? `${normalizedPlan}_${cycle}` : normalizedPlan,
                    status: subscriptionData.status || 'ACTIVE'
                });
            }

            // Calcula a expiração baseada no nextDueDate
            const parsedNextDueDate = new Date(nextDueDate + 'T12:00:00Z');
            const now = new Date();
            let newPlanExpiresAt = parsedNextDueDate;
            const wasExpiredOrInactive = promoCouponService.isPsychologistExpiredOrInactive(localPsychologist, now);

            const monthsToAdd = cycle === 'SEMIANNUAL' ? 6 : (cycle === 'QUARTERLY' ? 3 : 1);
            if (trialEndDate) {
                newPlanExpiresAt = trialEndDate;
            } else if (billingType === 'CREDIT_CARD') {
                if (activePromoCoupon && activePromoCoupon.type === 'EXTRA_MONTHS') {
                    newPlanExpiresAt = promoCouponService.addMonthsWithMinDays(now, activePromoCoupon.totalMonths, activePromoCoupon.minDays);
                } else {
                    let novaValidade = new Date(now.getTime());
                    if (localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > now) {
                        novaValidade = new Date(localPsychologist.planExpiresAt);
                    }
                    const targetMonth = novaValidade.getMonth() + monthsToAdd;
                    novaValidade.setMonth(targetMonth);
                    if (novaValidade.getMonth() !== targetMonth % 12) {
                        novaValidade.setDate(0);
                    }
                    newPlanExpiresAt = novaValidade;
                }
            } else {
                if (parsedNextDueDate <= now) {
                    newPlanExpiresAt = (localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > now)
                        ? localPsychologist.planExpiresAt
                        : now;
                }
            }

            if (activePromoCoupon && db.SystemLog) {
                const emailLower = promoCouponService.normalizeEmail(localPsychologist.email);
                await db.SystemLog.create({
                    level: 'info',
                    message: `[PROMO_SUB_PENDING] ${activePromoCoupon.code} | sub:${asaasRefId} | psi:${psychologistId} | email:${emailLower}`,
                    meta: {
                        offerCode: activePromoCoupon.code,
                        email: emailLower,
                        subscriptionId: asaasRefId,
                        psychologistId,
                        totalMonths: activePromoCoupon.totalMonths,
                        minDays: activePromoCoupon.minDays,
                        chargeToday: activePromoCoupon.chargeToday,
                        renewalValue: activePromoCoupon.renewalValue
                    }
                }).catch(() => {});
            }

            const updateData = {
                subscriptionId: asaasRefId,
                plano: normalizedPlan,
                planExpiresAt: newPlanExpiresAt,
                cancelAtPeriodEnd: false,
                canceledAt: null
            };

            if (trialEndDate) {
                updateData.status = 'active';
                updateData.is_exempt = false;
                if (!localPsychologist.subscribedAt) updateData.subscribedAt = now;
                if (!localPsychologist.profileActivatedAt) updateData.profileActivatedAt = now;
            } else if (billingType === 'CREDIT_CARD') {
                updateData.status = 'active';
                updateData.is_exempt = false;
                if (!localPsychologist.subscribedAt) updateData.subscribedAt = now;
                if (!localPsychologist.profileActivatedAt) updateData.profileActivatedAt = now;
                if (wasExpiredOrInactive || activePromoCoupon) {
                    updateData.reactivatedAt = now;
                }
            }

            await localPsychologist.update(updateData);
            
            // Sucesso Completo
            await intent.update({ status: 'COMPLETED' });
        } catch (dbError) {
            await intent.update({ status: 'RECONCILIATION_REQUIRED' });
            throw dbError;
        }

        // Retornos ao Client
        if (billingType === 'PIX') {
            try {
                const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionData.id}/payments?status=PENDING`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const paymentsText = await paymentsRes.text();
                const paymentsData = paymentsText ? JSON.parse(paymentsText) : {};
                
                if (paymentsData.data && paymentsData.data.length > 0) {
                    const firstPayment = paymentsData.data[0];
                    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });
                    const qrText = await qrRes.text();
                    const qrData = qrText ? JSON.parse(qrText) : {};
                    
                    return res.json({ 
                        success: true, 
                        subscriptionId: asaasRefId, 
                        billingType: 'PIX',
                        pix: { encodedImage: qrData.encodedImage, payload: qrData.payload }
                    });
                }
            } catch (pixErr) {
                console.error("Assinatura criada mas falha ao obter QRCode PIX", pixErr);
            }
            return res.json({ success: true, subscriptionId: asaasRefId, message: 'Assinatura PIX criada.' });
        }

        res.json({ success: true, subscriptionId: asaasRefId });

    } catch (error) {
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `Erro na criação Asaas: ${error.message}`,
                    meta: { 
                        errorStack: error.stack,
                        psychologistId: req.psychologist ? req.psychologist.id : null,
                    }
                });
            }
            if (intent && ['CREATING', 'SENT_TO_ASAAS'].includes(intent.status)) {
                await intent.update({ status: 'RECONCILIATION_REQUIRED' });
            }
        } catch (logErr) {}
        
        res.status(500).json({ error: error.message || 'Erro inesperado ao processar pagamento' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/payments/pending-pix
// Descrição: Busca faturas pendentes da assinatura atual e retorna o QR Code
// ----------------------------------------------------------------------
exports.getPendingPix = async (req, res) => {
    try {
        const ASAAS_API_URL = getAsaasApiUrl();
        const ASAAS_API_KEY = getAsaasApiKey();
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist || !psychologist.subscriptionId) {
            return res.status(404).json({ error: 'Nenhuma assinatura encontrada.' });
        }

        if (!String(psychologist.subscriptionId).startsWith('sub_')) {
            return res.json({ pending: false });
        }

        // Busca tanto faturas OVERDUE quanto PENDING no Asaas para priorizar a mais antiga
        const [overdueRes, pendingRes] = await Promise.all([
            fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.subscriptionId}/payments?status=OVERDUE`, {
                headers: { 'access_token': ASAAS_API_KEY }
            }),
            fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.subscriptionId}/payments?status=PENDING`, {
                headers: { 'access_token': ASAAS_API_KEY }
            })
        ]);
        if (!overdueRes.ok || !pendingRes.ok) {
            return res.status(502).json({ error: 'Não foi possível confirmar o status da fatura no gateway.' });
        }

        const overdueData = await overdueRes.json().catch(() => ({ data: [] }));
        const pendingData = await pendingRes.json().catch(() => ({ data: [] }));
        
        let pendingPayments = [
            ...(overdueData.data || []),
            ...(pendingData.data || [])
        ];

        if (pendingPayments.length === 0) {
            return res.json({ pending: false });
        }

        // Ordena da mais antiga para a mais recente (garante que faturas OVERDUE venham sempre antes de PENDING)
        pendingPayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        const firstPayment = pendingPayments[0];

        // Retorna QR Code apenas se for PIX
        if (firstPayment.billingType === 'PIX') {
            const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const qrText = await qrRes.text();
            const qrData = qrText ? JSON.parse(qrText) : {};
            
            return res.json({ 
                pending: true,
                billingType: 'PIX',
                dueDate: firstPayment.dueDate,
                value: firstPayment.value,
                pix: { encodedImage: qrData.encodedImage, payload: qrData.payload }
            });
        }

        return res.json({
            pending: true,
            billingType: firstPayment.billingType,
            dueDate: firstPayment.dueDate,
            value: firstPayment.value
        });

    } catch (error) {
        console.error('Erro ao buscar fatura pendente:', error);
        res.status(500).json({ error: 'Erro ao verificar faturas em aberto.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/payments/convert-overdue-to-pix
// Descrição: Converte uma fatura pendente/vencida para PIX e retorna o QR Code
// ----------------------------------------------------------------------
exports.convertOverdueToPix = async (req, res) => {
    try {
        const ASAAS_API_URL = getAsaasApiUrl();
        const ASAAS_API_KEY = getAsaasApiKey();
        const psychologistId = req.psychologist.id;
        const pendingPayment = await db.Payment.findOne({
            where: {
                psychologistId,
                status: { [db.Sequelize.Op.in]: ['PENDING', 'OVERDUE'] }
            },
            order: [['dueDate', 'ASC']]
        });

        if (!pendingPayment) {
            return res.status(404).json({ error: 'Nenhuma fatura pendente encontrada.' });
        }

        const asaasPaymentId = pendingPayment.asaasPaymentId || pendingPayment.id;

        // 1. Converte a cobrança para PIX no Asaas
        const updateRes = await fetch(`${ASAAS_API_URL}/payments/${asaasPaymentId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify({ billingType: 'PIX' })
        });

        if (!updateRes.ok) {
            return res.status(400).json({ error: 'Erro ao converter a fatura para PIX.' });
        }

        // 2. Busca o QR Code gerado
        const qrRes = await fetch(`${ASAAS_API_URL}/payments/${asaasPaymentId}/pixQrCode`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        
        if (!qrRes.ok) {
            return res.status(400).json({ error: 'Fatura convertida, mas erro ao gerar QR Code.' });
        }

        const qrData = await qrRes.json();
        return res.json({ 
            success: true,
            asaasPaymentId,
            pix: { encodedImage: qrData.encodedImage, payload: qrData.payload }
        });
    } catch (error) {
        console.error('Erro ao converter fatura para PIX:', error);
        res.status(500).json({ error: 'Erro interno ao processar a fatura.' });
    }
};


// ----------------------------------------------------------------------
// Rota: POST /api/payments/update-method
// Descrição: Atualiza a forma de pagamento da assinatura no Asaas
// ----------------------------------------------------------------------
exports.updateSubscriptionMethod = async (req, res) => {
    try {
        const ASAAS_API_URL = getAsaasApiUrl();
        const ASAAS_API_KEY = getAsaasApiKey();
        const { billingType, creditCard } = req.body;
        const psychologistId = req.psychologist.id;
        
        const localPsychologist = await db.Psychologist.findByPk(psychologistId);
        if (!localPsychologist || !localPsychologist.subscriptionId) {
            return res.status(404).json({ error: 'Assinatura não encontrada para atualização.' });
        }

        const subId = localPsychologist.subscriptionId;
        if (!String(subId).startsWith('sub_')) {
            return res.status(400).json({ error: 'Alteração de método disponível apenas para assinaturas mensais recorrentes.' });
        }

        // --- PREPARAÇÃO DO PAYLOAD DE ATUALIZAÇÃO ---
        let updatePayload = {
            billingType: billingType || 'CREDIT_CARD',
            updatePendingPayments: true // Importante: aplica a nova forma na fatura atual
        };

        if (billingType !== 'PIX') {
            if (!creditCard || !creditCard.holderName || !creditCard.holderCpf || !creditCard.holderPhone || !creditCard.number || !creditCard.expiry || !creditCard.ccv) {
                return res.status(400).json({ error: 'Dados do cartão incompletos.' });
            }

            let expiryMonth = '', expiryYear = '';
            [expiryMonth, expiryYear] = creditCard.expiry.split('/');
            
            let phone = creditCard.holderPhone.replace(/\D/g, '');
            const cleanCpfCnpj = creditCard.holderCpf.replace(/\D/g, '');
            const postalCode = creditCard.postalCode ? creditCard.postalCode.replace(/\D/g, '') : '';

            updatePayload.creditCard = {
                holderName: creditCard.holderName,
                number: creditCard.number.replace(/\D/g, ''),
                expiryMonth: expiryMonth,
                expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
                ccv: creditCard.ccv
            };
            updatePayload.creditCardHolderInfo = {
                name: creditCard.holderName,
                email: localPsychologist.email,
                cpfCnpj: cleanCpfCnpj,
                postalCode: postalCode,
                addressNumber: creditCard.addressNumber,
                addressComplement: creditCard.addressComplement || null,
                phone: phone
            };
        }

        // --- ATUALIZA A ASSINATURA NO ASAAS ---
        const resUpdate = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
            method: 'POST', // Asaas permite atualizar Subscription enviando um POST no ID
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify(updatePayload)
        });
        
        let dataUpdate;
        try {
            dataUpdate = await resUpdate.json();
        } catch (e) {
            return res.status(500).json({ error: 'Erro de comunicação com o gateway (Asaas não retornou JSON).' });
        }

        if (!resUpdate.ok || dataUpdate.errors) {
            const errorMsg = dataUpdate.errors ? dataUpdate.errors[0].description : 'Operação recusada pelo cartão/banco.';
            return res.status(400).json({ error: errorMsg });
        }

        // Retornos ao Client
        if (billingType === 'PIX') {
            // Se mudou para PIX, tenta já retornar a fatura PIX aberta (priorizando OVERDUE antes de PENDING)
            try {
                const [overdueRes, pendingRes] = await Promise.all([
                    fetch(`${ASAAS_API_URL}/subscriptions/${subId}/payments?status=OVERDUE`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    }),
                    fetch(`${ASAAS_API_URL}/subscriptions/${subId}/payments?status=PENDING`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    })
                ]);
                const overdueData = await overdueRes.json().catch(() => ({ data: [] }));
                const pendingData = await pendingRes.json().catch(() => ({ data: [] }));
                
                const openPayments = [
                    ...(overdueData.data || []),
                    ...(pendingData.data || [])
                ];
                openPayments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

                if (openPayments.length > 0) {
                    const firstPayment = openPayments[0];
                    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });
                    const qrText = await qrRes.text();
                    const qrData = qrText ? JSON.parse(qrText) : {};
                    
                    return res.json({ 
                        success: true, 
                        subscriptionId: subId, 
                        billingType: 'PIX',
                        pix: { encodedImage: qrData.encodedImage, payload: qrData.payload }
                    });
                }
            } catch (pixErr) {
                console.error("Pagamento alterado para PIX, mas falha ao obter QRCode", pixErr);
            }
        }

        res.json({ success: true, subscriptionId: subId, message: 'Forma de pagamento atualizada com sucesso!' });

    } catch (error) {
        console.error('Erro na atualização da forma de pagamento:', error);
        res.status(500).json({ error: 'Erro inesperado ao atualizar a forma de pagamento' });
    }
};