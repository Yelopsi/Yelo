// backend/controllers/paymentController.js
const db = require('../models');

// Configurações do Asaas
const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3'; // Use 'https://api.asaas.com/v3' para produção
const ASAAS_API_KEY = process.env.ASAAS_API_KEY; // Seu token do Asaas

// 1. CRIA A ASSINATURA NO ASAAS (Checkout Transparente)
exports.createPreference = async (req, res) => {
    try {
        const { planType, cupom, creditCard } = req.body;
        const psychologistId = req.psychologist.id;
        const psychologist = await db.Psychologist.findByPk(psychologistId);

        // Lógica do Cupom VIP
        if (cupom && cupom.toUpperCase() === 'SOLVIP') {
            const psi = await db.Psychologist.findByPk(psychologistId);
            const hoje = new Date();
            const trintaDias = new Date(hoje.setDate(hoje.getDate() + 30));

            await psi.update({
                status: 'active',
                subscription_expires_at: trintaDias,
                plano: 'Sol'
            });
            return res.json({ couponSuccess: true, message: 'Cupom VIP aplicado!' });
        }

        if (!creditCard || !creditCard.number || !creditCard.holderName) {
            return res.status(400).json({ error: 'Dados do cartão incompletos.' });
        }
        
        if (!creditCard.expiry || !creditCard.expiry.includes('/')) {
            return res.status(400).json({ error: 'Data de validade inválida. Use o formato MM/AAAA.' });
        }

        let value;
        switch (planType.toUpperCase()) {
            case 'ESSENTIAL': value = 99.00; break;
            case 'CLINICAL': value = 159.00; break;
            case 'REFERENCE': value = 259.00; break;
            default: return res.status(400).json({ error: 'Plano inválido: ' + planType });
        }

        // 1. Cria ou Recupera o Cliente no Asaas
        // (Simplificação: Cria um novo ou busca por email se a API permitir, aqui vamos tentar criar direto e tratar erro se duplicado ou buscar antes)
        // Para robustez, buscamos primeiro.
        let customerIdAsaas = null;
        
        // --- DEBUG: LOG DA URL ---
        console.log(`[ASAAS] Tentando conectar em: ${ASAAS_API_URL}/customers?email=${psychologist.email}`);
        
        const customerResponse = await fetch(`${ASAAS_API_URL}/customers?email=${psychologist.email}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });

        if (!customerResponse.ok) {
            const errorText = await customerResponse.text();
            console.error(`[ASAAS ERROR] Falha ao buscar cliente. Status: ${customerResponse.status}. Resposta: ${errorText.substring(0, 200)}...`);
            throw new Error(`Erro de conexão com Asaas (${customerResponse.status}). Verifique os logs.`);
        }

        const customerSearch = await customerResponse.json();
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
                    cpfCnpj: creditCard.holderCpf || psychologist.cpf || psychologist.cnpj // Asaas exige documento
                })
            }).then(r => r.json());

            if (newCustomer.errors) throw new Error(newCustomer.errors[0].description);
            customerIdAsaas = newCustomer.id;
        }

        // 2. Cria a Assinatura com Cartão de Crédito
        const [expiryMonth, expiryYear] = creditCard.expiry.split('/');
        
        const subscriptionPayload = {
            customer: customerIdAsaas,
            billingType: 'CREDIT_CARD',
            value: value,
            nextDueDate: new Date().toISOString().split('T')[0], // Cobra hoje
            cycle: 'MONTHLY',
            description: `Assinatura Yelo - Plano ${planType}`,
            externalReference: String(psychologistId), // IMPORTANTE: Para identificar no webhook
            creditCard: {
                holderName: creditCard.holderName,
                number: creditCard.number.replace(/\s/g, ''),
                expiryMonth: expiryMonth,
                expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
                ccv: creditCard.ccv
            },
            creditCardHolderInfo: {
                name: creditCard.holderName,
                email: psychologist.email,
                cpfCnpj: creditCard.holderCpf,
                postalCode: psychologist.cep || '00000-000', // Fallback se não tiver
                addressNumber: '0', // Asaas exige, mas pode ser genérico se não tivermos
                phone: psychologist.telefone || '00000000000'
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

        const subscriptionData = await subscriptionRes.json();

        if (subscriptionData.errors) {
            throw new Error(subscriptionData.errors[0].description);
        }

        // Sucesso!
        // Opcional: Já atualizar o banco localmente como "Pendente" ou "Ativo" dependendo da resposta
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

        console.log(`[ASAAS] Pagamento Confirmado: Psi ${psychologistId} - Plano ${planType}`);

        try {
            const psi = await db.Psychologist.findByPk(psychologistId);
            if (psi) {
                const hoje = new Date();
                const novaValidade = new Date(hoje.setDate(hoje.getDate() + 30));

                await psi.update({
                    status: 'active',
                    planExpiresAt: novaValidade, 
                    plano: planType,
                    // Salva o ID da assinatura do Asaas para cancelamentos futuros
                    stripeSubscriptionId: payment.subscription // Reutilizando a coluna existente
                });
            }
        } catch (err) {
            console.error('Erro ao atualizar banco:', err);
            await db.SystemLog.create({
                level: 'error',
                message: `Falha ao ativar plano Asaas (Psi ID: ${psychologistId}): ${err.message}`
            });
            return res.json({received: true}); 
        }
    }

    res.json({received: true});
};