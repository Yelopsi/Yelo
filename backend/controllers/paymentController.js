// backend/controllers/paymentController.js
const db = require('../models');
const emailService = require('../services/emailService');
const gamificationService = require('../services/gamificationService');

// Configurações do Asaas
// Limpeza robusta da URL (remove espaços e barras finais)
let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, ''); 

// --- AUTO-FIX: URL DO SANDBOX ---
// Se o usuário configurou 'sandbox.asaas.com/v3' (sem /api), corrigimos automaticamente
if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
    ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
}

const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

const { v4: uuidv4 } = require('uuid');

// 1. CRIA A ASSINATURA NO ASAAS (Checkout Transparente com Intent e Idempotência)
exports.createPreference = async (req, res) => {
    let intent = null;
    let localPsychologist = null;
    
    try {
        const { planType, cupom, creditCard, billingType, billingCycle } = req.body;
        const psychologistId = req.psychologist.id;
        localPsychologist = await db.Psychologist.findByPk(psychologistId);
        if (!localPsychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        // --- TRAVA DE INADIMPLÊNCIA (Evita bypass de dívida) ---
        const hasOverdue = await db.Payment.findOne({
            where: { psychologistId, status: 'OVERDUE' }
        });
        if (hasOverdue) {
            return res.status(403).json({ error: 'Você possui uma fatura em aberto. Por favor, acesse o painel financeiro para regularizar sua situação antes de realizar uma nova assinatura.' });
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

        // Lógica do Cupom VIP (Agora depende do .env para segurança)
        const validCoupon = process.env.VIP_COUPON;
        if (cupom && validCoupon && cupom.toUpperCase() === validCoupon.toUpperCase()) {
            await localPsychologist.update({ 
                  status: 'inactive',
                  plano: null,
                  planExpiresAt: new Date(),
                  cancelAtPeriodEnd: false,
                  subscriptionId: null
              });
            await intent.update({ status: 'CANCELED' }); // Cancela a intenção pois usou cupom
            return res.json({ couponSuccess: true, message: 'Cupom VIP aplicado!' });
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

        // --- PREÇIFICAÇÃO E MODALIDADE (MENSAL, TRIMESTRAL, SEMESTRAL) ---
        const cycle = (billingCycle || 'SEMIANNUAL').toUpperCase();
        let value = 159.00;
        let installmentCount = 1;
        let isInstallment = false;

        if (planType.toUpperCase() === 'ESSENTIAL') {
            if (cycle === 'SEMIANNUAL') {
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
        } else if (planType.toUpperCase() === 'CLINICAL') {
            value = 159.00;
            installmentCount = 1;
            isInstallment = false;
        } else if (planType.toUpperCase() === 'REFERENCE') {
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
                        notificationDisabled: true
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
        } catch (custError) {
            // Se falhou ao achar/criar customer, Asaas não tem assinatura vinculada.
            await intent.update({ status: 'FAILED_LOCAL' });
            return res.status(400).json({ error: `Erro no Cliente Asaas: ${custError.message}` });
        }

        // --- PREPARAÇÃO DO PAYLOAD DA COBRANÇA, TOKENIZAÇÃO (TRIAL 7D) OU ASSINATURA ---
        const isEligibleForTrial = !localPsychologist.firstPaidAt
            && !localPsychologist.subscribedAt
            && !localPsychologist.subscriptionId
            && (!localPsychologist.planExpiresAt || localPsychologist.plano === 'Comunidade');

        let trialEndDate = null;
        if (isEligibleForTrial && billingType !== 'PIX') {
            trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 7);
        }

        let nextDueDate = new Date(Date.now() - 10800000).toISOString().split('T')[0];
        if (trialEndDate) {
            nextDueDate = new Date(trialEndDate.getTime() - 10800000).toISOString().split('T')[0];
        } else if (localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > new Date()) {
            nextDueDate = new Date(localPsychologist.planExpiresAt).toISOString().split('T')[0];
        }

        const remoteIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

        let expiryMonth = '', expiryYear = '';
        if (creditCard && creditCard.expiry) {
            [expiryMonth, expiryYear] = creditCard.expiry.split('/');
            if (expiryYear && expiryYear.length === 2) expiryYear = `20${expiryYear}`;
        }

        const useTokenizedTrial = isInstallment && Boolean(trialEndDate);
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
                description: `Assinatura Yelo - Plano ${planType} - ${cycle}`,
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
                    description: `Assinatura Yelo - Plano ${planType} - MONTHLY`,
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
                    description: `Assinatura Yelo - Plano ${planType} - MONTHLY`,
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
            // Se o psicólogo já tinha assinatura recorrente anterior e está trocando de plano:
            if (subId && subId.startsWith('sub_')) {
                try {
                    await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                        method: 'DELETE',
                        headers: { 'access_token': ASAAS_API_KEY }
                    });
                } catch (asaasError) { /* ignora erro no cancelamento legado */ }
                subId = null;
            }

            subscriptionRes = await fetch(asaasEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                body: JSON.stringify(asaasPayload)
            });
            subscriptionData = await subscriptionRes.json();

            // Fallback para BOLETO se PIX falhar
            if (!isInstallment && billingType === 'PIX' && subscriptionRes.status === 400 && subscriptionData.errors && subscriptionData.errors[0].description.includes('forma de pagamento')) {
                asaasPayload.billingType = 'BOLETO';
                subscriptionRes = await fetch(asaasEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(asaasPayload)
                });
                subscriptionData = await subscriptionRes.json();
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
                await db.Subscription.upsert({
                    id: asaasRefId,
                    psychologistId: psychologistId,
                    asaasCustomerId: customerIdAsaas,
                    plan: JSON.stringify({
                        planType,
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
                    plan: `${planType}_${cycle}`,
                    status: subscriptionData.status || 'ACTIVE'
                });
            }

            // Atualiza o Psychologist
            const updatePsiPayload = {
                subscriptionId: asaasRefId,
                plano: planType,
                cancelAtPeriodEnd: false
            };

            if (trialEndDate) {
                // Ativa imediatamente o período de teste de 7 dias com cartão registrado
                updatePsiPayload.status = 'active';
                updatePsiPayload.planExpiresAt = trialEndDate;
                if (!localPsychologist.subscribedAt) updatePsiPayload.subscribedAt = new Date();
            } else if (['CONFIRMED', 'RECEIVED'].includes(subscriptionData.status)) {
                // Se o pagamento com cartão foi confirmado de imediato (sem trial)
                updatePsiPayload.status = 'active';
                let novaValidade = new Date();
                if (localPsychologist.planExpiresAt && new Date(localPsychologist.planExpiresAt) > new Date()) {
                    novaValidade = new Date(localPsychologist.planExpiresAt);
                }
                const monthsToAdd = cycle === 'SEMIANNUAL' ? 6 : (cycle === 'QUARTERLY' ? 3 : 1);
                const targetMonth = novaValidade.getMonth() + monthsToAdd;
                novaValidade.setMonth(targetMonth);
                if (novaValidade.getMonth() !== targetMonth % 12) {
                    novaValidade.setDate(0);
                }
                updatePsiPayload.planExpiresAt = novaValidade;
                if (!localPsychologist.subscribedAt) updatePsiPayload.subscribedAt = new Date();
            }

            await localPsychologist.update(updatePsiPayload);
            
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
                const paymentsData = await paymentsRes.json();
                
                if (paymentsData.data && paymentsData.data.length > 0) {
                    const firstPayment = paymentsData.data[0];
                    const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                        headers: { 'access_token': ASAAS_API_KEY }
                    });
                    const qrData = await qrRes.json();
                    
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