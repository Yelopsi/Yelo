require('dotenv').config();
const db = require('../models');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRealPayment(paymentId, API_URL, API_KEY) {
    const res = await fetch(`${API_URL}/payments/${paymentId}`, {
        headers: {
            'access_token': API_KEY,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) throw new Error(`Falha ao buscar pagamento ${paymentId}`);
    return await res.json();
}

async function syncAllPayments() {
    try {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

        if (!ASAAS_API_KEY) {
            console.error("ASAAS_API_KEY não configurada.");
            process.exit(1);
        }

        console.log("Conectando ao banco de dados...");
        await db.sequelize.authenticate();
        console.log("Conectado com sucesso.");

        let hasMore = true;
        let offset = 0;
        const limit = 100;
        let totalProcessed = 0;
        
        console.log("Iniciando backfill de pagamentos do Asaas...");

        while (hasMore) {
            console.log(`Buscando pagamentos do offset ${offset}...`);
            const res = await fetch(`${ASAAS_API_URL}/payments?limit=${limit}&offset=${offset}`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            
            if (!res.ok) {
                console.error(`Erro na API do Asaas: ${res.status}`);
                break;
            }

            const data = await res.json();
            const payments = data.data || [];
            
            if (payments.length === 0) {
                hasMore = false;
                break;
            }

            for (const payment of payments) {
                try {
                    const externalId = payment.externalReference;
                    let psi = null;
                    if (externalId) psi = await db.Psychologist.findByPk(externalId);
                    if (!psi && payment.subscription) psi = await db.Psychologist.findOne({ where: { subscriptionId: payment.subscription } });

                    if (!psi) {
                        // Não encontrou o psicólogo localmente, pula
                        continue;
                    }

                    const dueDate = payment.dueDate ? new Date(payment.dueDate) : new Date();
                    let paymentDate = null;
                    if (payment.clientPaymentDate) {
                        paymentDate = new Date(payment.clientPaymentDate);
                    } else if (payment.confirmedDate) {
                        paymentDate = new Date(payment.confirmedDate);
                    } else if (payment.paymentDate) {
                        paymentDate = new Date(payment.paymentDate);
                    }

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
                    
                    totalProcessed++;
                } catch (err) {
                    console.error(`Erro ao salvar pagamento ${payment.id}: ${err.message}`);
                }
            }

            offset += limit;
            hasMore = data.hasMore;
            await delay(1000); // Rate limit protection
        }

        console.log(`✅ Concluído! Total de pagamentos sincronizados: ${totalProcessed}`);

    } catch (error) {
        console.error("Erro geral no script:", error);
    } finally {
        await db.sequelize.close();
        process.exit(0);
    }
}

syncAllPayments();
