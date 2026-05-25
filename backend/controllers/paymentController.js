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

// 1. CRIA A ASSINATURA NO ASAAS (Checkout Transparente)
exports.createPreference = async (req, res) => {
    try {
        const { planType, cupom, creditCard, billingType } = req.body;
        const psychologistId = req.psychologist.id;
        const psychologist = await db.Psychologist.findByPk(psychologistId);

        // Lógica do Cupom VIP (Agora depende do .env para segurança)
        const validCoupon = process.env.VIP_COUPON;
        if (cupom && validCoupon && cupom.toUpperCase() === validCoupon.toUpperCase()) {
            const psi = await db.Psychologist.findByPk(psychologistId);
            const hoje = new Date();
            const trintaDias = new Date(hoje.setDate(hoje.getDate() + 30));

            await psi.update({
                status: 'active',
                planExpiresAt: trintaDias, // FIX: Nome da coluna padronizado
                plano: 'Sol'
            });
            return res.json({ couponSuccess: true, message: 'Cupom VIP aplicado!' });
        }

        // Validação de dados do titular e do cartão (Apenas se não for PIX)
        if (billingType !== 'PIX') {
            if (!creditCard || !creditCard.holderName || !creditCard.holderCpf || !creditCard.holderPhone) {
                return res.status(400).json({ error: 'Dados do titular incompletos.' });
            }
            if (!creditCard.number || !creditCard.expiry || !creditCard.ccv) {
                return res.status(400).json({ error: 'Dados do cartão incompletos.' });
            }
            if (!creditCard.expiry.includes('/')) {
                return res.status(400).json({ error: 'Data de validade inválida.' });
            }
        }

        let value;
        switch (planType.toUpperCase()) {
            case 'ESSENTIAL': value = 99.00; break;
            case 'CLINICAL': value = 159.00; break;
            case 'REFERENCE': value = 259.00; break;
            default: return res.status(400).json({ error: 'Plano inválido: ' + planType });
        }

        // --- FIX: SANITIZAÇÃO DE DADOS DO TITULAR ---
        const postalCode = creditCard && creditCard.postalCode ? creditCard.postalCode.replace(/\D/g, '') : '';
        let phone = creditCard && creditCard.holderPhone ? creditCard.holderPhone.replace(/\D/g, '') : '';
        // Se o telefone do titular for inválido/curto, tenta usar o do perfil do psicólogo
        if (phone.length < 10) {
             const psiPhone = psychologist.telefone ? psychologist.telefone.replace(/\D/g, '') : '';
             if (psiPhone.length >= 10) phone = psiPhone;
        }

        // --- FIX: Limpeza de CPF e Atualização Dinâmica ---
        const cleanCpfCnpj = (creditCard && creditCard.holderCpf) ? creditCard.holderCpf.replace(/\D/g, '') : (psychologist.cpf || psychologist.cnpj || '');

        // Atualiza o banco local se o psicólogo ainda não tinha CPF salvo
        if (cleanCpfCnpj && !psychologist.cpf) {
            try {
                await psychologist.update({ cpf: cleanCpfCnpj });
            } catch (err) {
                console.warn(`[AVISO] CPF ${cleanCpfCnpj} já pertence a outra conta local. Seguindo com o pagamento no Asaas...`);
            }
        }

        // 1. Cria ou Recupera o Cliente no Asaas
        // (Simplificação: Cria um novo ou busca por email se a API permitir, aqui vamos tentar criar direto e tratar erro se duplicado ou buscar antes)
        // Para robustez, buscamos primeiro.
        let customerIdAsaas = null;
        
        // --- DEBUG: LOG DA URL ---
        const urlCliente = `${ASAAS_API_URL}/customers?email=${encodeURIComponent(psychologist.email)}`;
        
        const customerResponse = await fetch(urlCliente, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        // Tenta ler o corpo como texto primeiro para poder logar se der erro no JSON
        const responseText = await customerResponse.text();
        let customerSearch;
        
        try {
            customerSearch = JSON.parse(responseText);
        } catch (e) {
            throw Object.assign(new Error(`Erro de comunicação com Asaas (Resposta não é JSON). Verifique os logs do servidor.`), { cause: e });
        }
        
        // Verifica se a resposta JSON contém erros lógicos da API
        if (customerSearch.errors) {
            const err = new Error(customerSearch.errors[0].description);
            err.asaasErrors = customerSearch.errors;
            throw err;
        }

        if (customerSearch.data && customerSearch.data.length > 0) {
            customerIdAsaas = customerSearch.data[0].id;
            const existingCpf = customerSearch.data[0].cpfCnpj;

            // --- FIX: O Asaas exige CPF para PIX. Se o cliente antigo não tinha, atualizamos agora ---
            if (!existingCpf && cleanCpfCnpj) {
                await fetch(`${ASAAS_API_URL}/customers/${customerIdAsaas}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify({ cpfCnpj: cleanCpfCnpj })
                });
            }
        } else {
            // Cria novo cliente
            const newCustomer = await fetch(`${ASAAS_API_URL}/customers`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'access_token': ASAAS_API_KEY 
                },
                body: JSON.stringify({
                    name: psychologist.nome,
                    email: psychologist.email,
                    cpfCnpj: cleanCpfCnpj,
                    mobilePhone: phone, // Usa o telefone sanitizado
                    notificationDisabled: true // <--- DESATIVA E-MAILS NATIVOS DO ASAAS (Usaremos os da Yelo)
                })
            }).then(r => r.json());

            if (newCustomer.errors) {
                const err = new Error(newCustomer.errors[0].description);
                err.asaasErrors = newCustomer.errors;
                throw err;
            }
            customerIdAsaas = newCustomer.id;
        }

        // --- LÓGICA INTELIGENTE DE DATA DE COBRANÇA ---
        let nextDueDate = new Date(Date.now() - 10800000).toISOString().split('T')[0];

        // Se o psicólogo ainda está dentro do trial ou plano vigente, agenda para quando acabar
        if (psychologist.planExpiresAt && new Date(psychologist.planExpiresAt) > new Date()) {
            nextDueDate = new Date(psychologist.planExpiresAt).toISOString().split('T')[0];
        } else {
        }

        // --- LÓGICA INTELIGENTE DE ATUALIZAÇÃO OU CRIAÇÃO ---
        let existingSubId = psychologist.stripeSubscriptionId || psychologist.subscriptionId;

        const saveAsaasSubscription = async (payload) => {
            payload.updatePendingPayments = true; // Garante que faturas em aberto adotem o novo valor/forma de pagamento
            
            if (existingSubId) {
                let res = await fetch(`${ASAAS_API_URL}/subscriptions/${existingSubId}`, {
                    method: 'POST', // O Asaas usa POST para atualizar assinaturas
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(payload)
                });
                let text = await res.text();
                let data;
                try { data = JSON.parse(text); } catch(e) { throw Object.assign(new Error(`Erro Asaas Update Parse: ${text}`), { cause: e }); }
                
                // Se a assinatura não pode ser atualizada (foi removida, está inativa ou não encontrada)
                if (res.status === 404 || (res.status === 400 && data.errors && data.errors.some(e => e.code === 'invalid_action' || e.code === 'deleted'))) {
                    existingSubId = null; // Reseta o ID para forçar a criação abaixo
                } else {
                    return { res, data };
                }
            }

            // Se não existia ou falhou o update, cria uma nova
            if (!existingSubId) {
                let res = await fetch(`${ASAAS_API_URL}/subscriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(payload)
                });
                let text = await res.text();
                let data;
                try { data = JSON.parse(text); } catch(e) { throw Object.assign(new Error(`Erro Asaas Create Parse: ${text}`), { cause: e }); }
                return { res, data };
            }
        };

        // --- FLUXO PIX ---
        if (billingType === 'PIX') {
            const subscriptionPayload = {
                customer: customerIdAsaas,
                billingType: 'PIX',
                value: value,
                nextDueDate: nextDueDate,
                cycle: 'MONTHLY', // Adicionado: Ciclo mensal obrigatório
                description: `Assinatura Yelo - Plano ${planType}`,
                externalReference: String(psychologistId),
            };
            
            let { res: subscriptionRes, data: subscriptionData } = await saveAsaasSubscription(subscriptionPayload);
            
            // --- FALLBACK: Se PIX não for permitido para assinatura, tenta BOLETO (que tem PIX embutido) ---
            if (subscriptionRes.status === 400 && subscriptionData.errors && subscriptionData.errors[0].description.includes('forma de pagamento')) {
                subscriptionPayload.billingType = 'BOLETO';
                
                const fallbackResult = await saveAsaasSubscription(subscriptionPayload);
                subscriptionRes = fallbackResult.res;
                subscriptionData = fallbackResult.data;
            }
            
            if (subscriptionData.errors) {
                const err = new Error(subscriptionData.errors[0].description);
                err.asaasErrors = subscriptionData.errors;
                throw err;
            }
            
            // Busca a primeira cobrança para pegar o QR Code
            // FIX: Filtro ?status=PENDING garante que estamos pegando a fatura em aberto, e não uma velha já paga (caso seja update)
            const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionData.id}/payments?status=PENDING`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const paymentsData = await paymentsRes.json();
            
            if (!paymentsData.data || paymentsData.data.length === 0) {
                throw new Error("Assinatura criada/atualizada, mas cobrança pendente não encontrada.");
            }
            
            const firstPayment = paymentsData.data[0];
            
            // Pega o QR Code
            const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const qrData = await qrRes.json();
            
            // Salva ID da assinatura (Pendente)
            await psychologist.update({
                stripeSubscriptionId: subscriptionData.id // Salva apenas a referência (Aguardando Webhook)
            });

            return res.json({ 
                success: true, 
                subscriptionId: subscriptionData.id, 
                billingType: 'PIX',
                pix: {
                    encodedImage: qrData.encodedImage,
                    payload: qrData.payload
                }
            });
        }

        // 2. Cria a Assinatura com Cartão de Crédito
        let expiryMonth = '', expiryYear = '';
        if (billingType !== 'PIX') {
            [expiryMonth, expiryYear] = creditCard.expiry.split('/');
        }

        const subscriptionPayload = {
            customer: customerIdAsaas,
            billingType: 'CREDIT_CARD',
            value: value,
            nextDueDate: nextDueDate,
            cycle: 'MONTHLY', // Adicionado: Ciclo mensal obrigatório
            description: `Assinatura Yelo - Plano ${planType}`,
            externalReference: String(psychologistId),
            softDescriptor: 'Yelo Saude', // Texto na fatura (O Asaas permite no máximo 13 caracteres)
            creditCard: {
                holderName: creditCard.holderName,
                number: creditCard.number,
                expiryMonth: expiryMonth,
                expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
                ccv: creditCard.ccv
            },
            creditCardHolderInfo: {
                name: creditCard.holderName,
                email: psychologist.email,
                cpfCnpj: creditCard.holderCpf,
                postalCode: postalCode,
                addressNumber: creditCard.addressNumber,
                addressComplement: creditCard.addressComplement || null,
                phone: phone
            }
        };

        const { res: subscriptionRes, data: subscriptionData } = await saveAsaasSubscription(subscriptionPayload);

        if (subscriptionData.errors) {
            const err = new Error(subscriptionData.errors[0].description);
            err.asaasErrors = subscriptionData.errors;
            throw err;
        }

        // Atualiza salvando a referência da assinatura e o plano selecionado.
        /// a data de expiração não é aumentada aqui; o webhook atualizará o planExpiresAt 
        // quando o pagamento for de fato confirmado (se a cobrança for imediata).
        await psychologist.update({
            stripeSubscriptionId: subscriptionData.id,
            plano: planType
        });

        res.json({ success: true, subscriptionId: subscriptionData.id });

    } catch (error) {
        // GRAVA O ERRO NO SISTEMA PARA O DASHBOARD VER
        try {
            if (db.SystemLog) {
                let logMessage = `Erro ao criar pagamento Asaas: ${error.message}`;
                let logMeta = null;

                if (error.asaasErrors && error.asaasErrors.length > 0) {
                    const firstErr = error.asaasErrors[0];
                    logMessage = `[Asaas] Falha no Pagamento (${firstErr.code || 'unknown'}): ${firstErr.description || error.message}`;
                    logMeta = { 
                        asaasResponse: error.asaasErrors,
                        psychologistId: req.psychologist ? req.psychologist.id : null, // Adiciona o ID do psicólogo
                        userEmail: psychologist ? psychologist.email : null // Adiciona o email para correlação
                    };
                }

                await db.SystemLog.create({
                    level: 'error',
                    message: logMessage,
                    meta: logMeta || { 
                        level: 'error',
                        psychologistId: req.psychologist ? req.psychologist.id : null, 
                        userEmail: psychologist ? psychologist.email : null 
                    }
                });
            }
        } catch (logErr) { console.error("Falha ao gravar log:", logErr.message); }
        
        res.status(500).json({ error: error.message || 'Erro ao processar pagamento' });
    }
};