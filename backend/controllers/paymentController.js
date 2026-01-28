// backend/controllers/paymentController.js
const db = require('../models');
const { sendPaymentConfirmationEmail, sendSubscriptionCancelledEmail, sendPaymentFailedEmail } = require('../services/emailService');

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

        // Lógica do Cupom VIP
        if (cupom && cupom.toUpperCase() === 'SOLVIP') {
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

        // Validação de dados do titular (comum para ambos)
        if (!creditCard || !creditCard.holderName || !creditCard.holderCpf || !creditCard.holderPhone) {
            return res.status(400).json({ error: 'Dados do titular incompletos.' });
        }
        
        // Validação específica de cartão
        if (billingType !== 'PIX') {
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
        const postalCode = creditCard.postalCode ? creditCard.postalCode.replace(/\D/g, '') : '';
        let phone = creditCard.holderPhone ? creditCard.holderPhone.replace(/\D/g, '') : '';
        // Se o telefone do titular for inválido/curto, tenta usar o do perfil do psicólogo
        if (phone.length < 10) {
             const psiPhone = psychologist.telefone ? psychologist.telefone.replace(/\D/g, '') : '';
             if (psiPhone.length >= 10) phone = psiPhone;
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
            console.error(`[ASAAS FATAL] Resposta inválida (${customerResponse.status}). Conteúdo recebido:\n${responseText.substring(0, 500)}`);
            throw new Error(`Erro de comunicação com Asaas (Resposta não é JSON). Verifique os logs do servidor.`);
        }
        
        // Verifica se a resposta JSON contém erros lógicos da API
        if (customerSearch.errors) throw new Error(customerSearch.errors[0].description);

        if (customerSearch.data && customerSearch.data.length > 0) {
            customerIdAsaas = customerSearch.data[0].id;
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
                    cpfCnpj: creditCard.holderCpf || psychologist.cpf || psychologist.cnpj,
                    mobilePhone: phone, // Usa o telefone sanitizado
                    notificationDisabled: false // <--- ATIVA E-MAILS DO ASAAS (Para o cliente receber a cobrança mensal)
                })
            }).then(r => r.json());

            if (newCustomer.errors) throw new Error(newCustomer.errors[0].description);
            customerIdAsaas = newCustomer.id;
        }

        // --- LÓGICA INTELIGENTE DE DATA DE COBRANÇA ---
        // Padrão: Cobra hoje (UTC-3)
        let nextDueDate = new Date(Date.now() - 10800000).toISOString().split('T')[0];

        // Se for reativação (usuário tem plano pago no futuro), agenda para o fim do ciclo
        if (psychologist.planExpiresAt && new Date(psychologist.planExpiresAt) > new Date()) {
            nextDueDate = new Date(psychologist.planExpiresAt).toISOString().split('T')[0];
            console.log(`[ASAAS] Reativação: Cobrança agendada para ${nextDueDate} (Fim do período pago)`);
        }

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
                discount: {
                    value: 50,
                    type: 'PERCENTAGE'
                },
            };
            
            let subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                body: JSON.stringify(subscriptionPayload)
            });
            
            let subResponseText = await subscriptionRes.text();
            let subscriptionData;
            try { subscriptionData = JSON.parse(subResponseText); } catch(e) { throw new Error("Erro Asaas PIX: " + subResponseText); }
            
            // --- FALLBACK: Se PIX não for permitido para assinatura, tenta BOLETO (que tem PIX embutido) ---
            if (subscriptionRes.status === 400 && subscriptionData.errors && subscriptionData.errors[0].description.includes('forma de pagamento')) {
                console.warn("[ASAAS] PIX direto recusado (Verifique se 'Pix' está ativo para assinaturas no painel Asaas). Tentando fallback para BOLETO.");
                subscriptionPayload.billingType = 'BOLETO';
                
                subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify(subscriptionPayload)
                });
                subResponseText = await subscriptionRes.text();
                try { subscriptionData = JSON.parse(subResponseText); } catch(e) { throw new Error("Erro Asaas Fallback: " + subResponseText); }
            }
            
            if (subscriptionData.errors) throw new Error(subscriptionData.errors[0].description);
            
            // Busca a primeira cobrança para pegar o QR Code
            const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subscriptionData.id}/payments`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const paymentsData = await paymentsRes.json();
            
            if (!paymentsData.data || paymentsData.data.length === 0) {
                throw new Error("Assinatura criada, mas cobrança não gerada imediatamente.");
            }
            
            const firstPayment = paymentsData.data[0];
            
            // Pega o QR Code
            const qrRes = await fetch(`${ASAAS_API_URL}/payments/${firstPayment.id}/pixQrCode`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const qrData = await qrRes.json();
            
            // Salva ID da assinatura (Pendente)
            await psychologist.update({
                stripeSubscriptionId: subscriptionData.id,
                plano: planType.toUpperCase(),
                cancelAtPeriodEnd: false, // <--- Reset do cancelamento
                subscription_payments_count: 0
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
        const [expiryMonth, expiryYear] = creditCard.expiry.split('/');

        const subscriptionPayload = {
            customer: customerIdAsaas,
            billingType: 'CREDIT_CARD',
            value: value,
            nextDueDate: nextDueDate,
            cycle: 'MONTHLY', // Adicionado: Ciclo mensal obrigatório
            description: `Assinatura Yelo - Plano ${planType}`,
            externalReference: String(psychologistId),
            softDescriptor: 'Yelo Saúde Mental', // Texto na fatura (Max 13 chars)
            discount: {
                value: 50,
                type: 'PERCENTAGE'
            },
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

        const subscriptionRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'access_token': ASAAS_API_KEY 
            },
            body: JSON.stringify(subscriptionPayload)
        });

        const subResponseText = await subscriptionRes.text();
        let subscriptionData;
        try {
            subscriptionData = JSON.parse(subResponseText);
        } catch (e) {
            console.error(`[ASAAS FATAL] Erro ao criar assinatura. Conteúdo:\n${subResponseText}`);
            throw new Error("Erro ao processar resposta da assinatura.");
        }

        if (subscriptionData.errors) {
            throw new Error(subscriptionData.errors[0].description);
        }

        // --- FIX: ATUALIZAÇÃO IMEDIATA DO BANCO ---
        // Ativa o plano imediatamente após o sucesso no cartão, sem esperar o Webhook.
        // Se for reativação, mantém a data antiga. Se for novo, soma 30 dias.
        let validade = new Date();
        if (psychologist.planExpiresAt && new Date(psychologist.planExpiresAt) > new Date()) {
            validade = new Date(psychologist.planExpiresAt); // Mantém a data original
        } else {
            validade.setDate(validade.getDate() + 30);
        }

        await psychologist.update({
            status: 'active',
            plano: planType.toUpperCase(),
            stripeSubscriptionId: subscriptionData.id, // Salva o ID do Asaas
            planExpiresAt: validade,
            cancelAtPeriodEnd: false, // <--- Reset do cancelamento
            subscription_payments_count: 0
        });

        res.json({ success: true, subscriptionId: subscriptionData.id });

    } catch (error) {
        console.error('Erro Asaas:', error);
        // GRAVA O ERRO NO SISTEMA PARA O DASHBOARD VER
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `Erro ao criar pagamento Asaas: ${error.message}`
                });
            }
        } catch (logErr) { console.error("Falha ao gravar log:", logErr.message); }
        
        res.status(500).json({ error: error.message || 'Erro ao processar pagamento' });
    }
};

// 2. WEBHOOK ASAAS
exports.handleWebhook = async (req, res) => {
    // O Asaas envia o evento no corpo do request (JSON)
    const event = req.body;
    
    // Validação básica de segurança (Opcional: verificar token no header se configurado no Asaas)
    // const asaasToken = req.headers['asaas-access-token'];
    // if (asaasToken !== process.env.ASAAS_WEBHOOK_TOKEN) return res.status(401).send();

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
                // Garante que temos o status mais recente do banco (caso tenha sido cancelado milissegundos antes)
                await psi.reload();

                // --- PROTEÇÃO CONTRA RACE CONDITION / WEBHOOKS ANTIGOS ---
                // 1. Se já existe uma assinatura NOVA salva no banco, ignora webhooks da VELHA.
                // [CORREÇÃO] Só ignora se o usuário já estiver ATIVO. Se estiver inativo/pendente, 
                // aceitamos o pagamento da assinatura antiga (pois o usuário pode ter pago um boleto gerado anteriormente).
                if (psi.status === 'active' && payment.subscription && psi.stripeSubscriptionId && psi.stripeSubscriptionId !== payment.subscription) {
                     return res.json({received: true});
                }
                
                // 2. PROTEÇÃO CRÍTICA: Se o usuário cancelou (está inativo e sem ID), ignora webhooks de ativação atrasados.
                // Isso impede que o plano volte a ficar ativo sozinho após o cancelamento.
                if (psi.status === 'inactive' && !psi.stripeSubscriptionId) {
                    return res.json({received: true});
                }

                // --- LÓGICA DE DESCONTO ---
                const currentPayments = (psi.subscription_payments_count || 0) + 1;

                // Se for o 3º pagamento, remove o desconto para os próximos.
                if (currentPayments === 3 && payment.subscription) {
                    // [OTIMIZAÇÃO] Não espera a resposta do Asaas para não travar o webhook (Fire & Forget)
                    fetch(`${ASAAS_API_URL}/subscriptions/${payment.subscription}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                        body: JSON.stringify({
                            discount: { value: 0, type: 'FIXED' }
                        })
                    }).catch(asaasError => {
                        console.error(`[ASAAS BACKGROUND] Falha ao remover desconto:`, asaasError.message);
                        // Tenta logar sem await para não bloquear
                        if(db.SystemLog) db.SystemLog.create({ level: 'error', message: `Falha desconto Asaas: ${asaasError.message}` }).catch(() => {});
                    });
                }
                // --- FIM DA LÓGICA DE DESCONTO ---

                const hoje = new Date();
                const novaValidade = new Date(hoje.setDate(hoje.getDate() + 30));

                await psi.update({
                    status: 'active',
                    planExpiresAt: novaValidade, 
                    plano: planType,
                    // Salva o ID da assinatura do Asaas para cancelamentos futuros
                    stripeSubscriptionId: payment.subscription,
                    // cancelAtPeriodEnd: false, // REMOVIDO: Não sobrescreve decisão de cancelamento do usuário
                    subscription_payments_count: currentPayments // Atualiza o contador de pagamentos
                });

                // --- ENVIA E-MAIL PERSONALIZADO YELO ---
                // [OTIMIZAÇÃO] Não espera o envio de e-mail (evita Timeout do Webhook)
                sendPaymentConfirmationEmail(psi, planType, payment.value)
                    .catch(err => console.error("Erro ao enviar email de confirmação (background):", err.message));
            }
        } catch (err) {
            console.error('Erro ao atualizar banco:', err);
            // [CORREÇÃO] Log seguro: Se o banco estiver fora, não quebra o webhook com erro 500
            if (db.SystemLog) {
                db.SystemLog.create({ level: 'error', message: `Falha webhook Asaas (Psi ${psychologistId}): ${err.message}` }).catch(() => {});
            }
            return res.json({received: true}); 
        }
    }
    
    // --- LÓGICA DE ESTORNO / CANCELAMENTO IMEDIATO ---
    // Captura eventos de reembolso ou chargeback para revogar o acesso
    // ADICIONADO: Verifica também PAYMENT_UPDATED com status REFUNDED
    if (['PAYMENT_REFUNDED', 'PAYMENT_REVERSED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_DELETED', 'PAYMENT_REFUND_IN_PROGRESS'].includes(event.event) || 
       (event.event === 'PAYMENT_UPDATED' && event.payment && ['REFUNDED', 'REFUND_IN_PROGRESS'].includes(event.payment.status))) {
        const payment = event.payment;
        let psychologistId = payment.externalReference;

        console.log(`🛑 [ASAAS] Estorno/Cancelamento detectado! Evento: ${event.event}, Status: ${payment.status}, Ref: ${psychologistId}`);

        try {
            let psi = null;

            // 1. Tenta buscar pelo ID direto (externalReference)
            if (psychologistId) {
                psi = await db.Psychologist.findByPk(psychologistId);
            }

            // 2. Fallback: Se não achou (ou não veio ref), tenta pelo ID da assinatura
            if (!psi && payment.subscription) {
                console.log(`🔍 [ASAAS] Buscando psicólogo pela assinatura: ${payment.subscription}`);
                psi = await db.Psychologist.findOne({ where: { stripeSubscriptionId: payment.subscription } });
            }

            if (psi) {
                // Revoga o acesso imediatamente e força status inactive
                await psi.update({
                    status: 'inactive', // Define como inativo para bloquear acesso
                    plano: null,       // Remove o plano
                    planExpiresAt: new Date(0), // Expira imediatamente (define data no passado)
                    cancelAtPeriodEnd: false
                });
                console.log(`✅ [ASAAS] Acesso revogado para Psi ${psi.id} (${psi.email}) devido a estorno.`);
                
                // --- ENVIA E-MAIL DE CANCELAMENTO ---
                // [OTIMIZAÇÃO] Background
                sendSubscriptionCancelledEmail(psi).catch(e => console.error("Erro email cancelamento:", e));
            } else {
                console.warn(`⚠️ [ASAAS] FALHA NO ESTORNO: Psicólogo não encontrado. Ref: ${psychologistId}, Sub: ${payment.subscription}`);
            }
        } catch (err) {
            console.error('❌ [ASAAS] Erro ao processar estorno no banco:', err);
        }
    }

    // --- LÓGICA DE FALHA NO PAGAMENTO (NOVO) ---
    if (['PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'].includes(event.event)) {
        const payment = event.payment;
        let psychologistId = payment.externalReference;
        console.log(`[ASAAS] Falha de Pagamento (${event.event}). Ref: ${psychologistId}`);

        try {
            let psi = null;
            if (psychologistId) {
                psi = await db.Psychologist.findByPk(psychologistId);
            }
            if (!psi && payment.subscription) {
                psi = await db.Psychologist.findOne({ where: { stripeSubscriptionId: payment.subscription } });
            }

            if (psi) {
                // Envia e-mail de falha
                // O Asaas geralmente manda invoiceUrl no objeto payment
                // [OTIMIZAÇÃO] Background
                sendPaymentFailedEmail(psi, payment.invoiceUrl).catch(e => console.error("Erro email falha:", e));
            }
        } catch (err) {
            console.error('Erro ao processar falha de pagamento:', err);
        }
    }

    res.json({received: true});
};