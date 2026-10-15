const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Client } = require('pg');

const ASAAS_API_URL = 'https://api.asaas.com/v3';
const ASAAS_API_KEY = (process.env.ASAAS_API_KEY || '').trim();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBatchNotificationUpdate() {
    console.log(`[${new Date().toISOString()}] Iniciando configuração de notificações em lote no Asaas...`);

    if (!ASAAS_API_KEY) {
        throw new Error('ASAAS_API_KEY não encontrada no .env');
    }

    // 1. Obter clientes ativos diretamente do Asaas
    console.log('Consultando assinaturas ativas no Asaas...');
    const subsRes = await fetch(`${ASAAS_API_URL}/subscriptions?status=ACTIVE&limit=100`, {
        headers: { 'access_token': ASAAS_API_KEY }
    });
    const subsData = await subsRes.json();
    const activeSubs = subsData.data || [];
    console.log(`Total de assinaturas ativas no Asaas: ${activeSubs.length}`);

    // 2. Obter psicólogos do banco que possuem subscriptionId
    const pgClient = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    await pgClient.connect();
    const dbPsisRes = await pgClient.query(`
        SELECT id, nome, email, "subscriptionId", plano, status
        FROM "Psychologists"
        WHERE "subscriptionId" IS NOT NULL
    `);
    await pgClient.end();
    console.log(`Total de psicólogos no banco com subscriptionId: ${dbPsisRes.rows.length}`);

    // Mapeamento de subscriptionId para dados locais do psicólogo
    const psiMapBySub = new Map();
    for (const psi of dbPsisRes.rows) {
        psiMapBySub.set(psi.subscriptionId, psi);
    }

    // 3. Consolidar lista de Customer IDs únicos
    const customerIdsToProcess = new Set();
    for (const sub of activeSubs) {
        if (sub.customer) customerIdsToProcess.add(sub.customer);
    }

    // Adicionar também customers das assinaturas do banco que possam não estar na query de active do Asaas
    for (const psi of dbPsisRes.rows) {
        if (psi.subscriptionId && !activeSubs.find(s => s.id === psi.subscriptionId)) {
            try {
                const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                if (subRes.ok) {
                    const subData = await subRes.json();
                    if (subData.customer) customerIdsToProcess.add(subData.customer);
                }
            } catch (err) {
                console.warn(`Aviso ao buscar sub ${psi.subscriptionId}:`, err.message);
            }
        }
    }

    console.log(`Total de clientes Asaas únicos identificados para atualização: ${customerIdsToProcess.size}`);

    let unblockedNotificationCount = 0;
    let updatedRulesCount = 0;
    let unchangedCount = 0;
    const updateLog = [];

    for (const customerId of customerIdsToProcess) {
        await sleep(150); // Evitar rate limit

        // a) Obter detalhes do cliente
        const custRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        if (!custRes.ok) {
            console.error(`Erro ao buscar dados do cliente ${customerId}: status ${custRes.status}`);
            continue;
        }
        const custData = await custRes.json();
        const clientName = custData.name || custData.email || customerId;

        let customerWasUnblocked = false;
        // Se notificationDisabled estiver true, desbloquear
        if (custData.notificationDisabled) {
            const unblockRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': ASAAS_API_KEY
                },
                body: JSON.stringify({ notificationDisabled: false })
            });
            if (unblockRes.ok) {
                customerWasUnblocked = true;
                unblockedNotificationCount++;
            } else {
                console.error(`Falha ao desbloquear notificações para ${clientName} (${customerId})`);
            }
        }

        // b) Obter regras de notificação
        const notifRes = await fetch(`${ASAAS_API_URL}/customers/${customerId}/notifications`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        if (!notifRes.ok) {
            console.error(`Erro ao buscar notificações do cliente ${customerId}`);
            continue;
        }
        const notifData = await notifRes.json();
        const rules = notifData.data || [];

        // Verificar se precisa atualizar e-mail ou sms
        const needsUpdate = rules.some(r => !r.emailEnabledForCustomer || !r.smsEnabledForCustomer);

        let rulesUpdated = false;
        if (needsUpdate && rules.length > 0) {
            const notificationsPayload = rules.map(r => ({
                id: r.id,
                emailEnabledForCustomer: true,
                smsEnabledForCustomer: true
            }));

            const batchRes = await fetch(`${ASAAS_API_URL}/notifications/batch`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': ASAAS_API_KEY
                },
                body: JSON.stringify({
                    customer: customerId,
                    notifications: notificationsPayload
                })
            });

            if (batchRes.ok) {
                rulesUpdated = true;
                updatedRulesCount++;
            } else {
                const errJson = await batchRes.json();
                console.error(`Erro no batch de notificações de ${clientName}:`, errJson);
            }
        } else {
            unchangedCount++;
        }

        updateLog.push({
            customerId,
            name: clientName,
            email: custData.email,
            unblockedNotification: customerWasUnblocked,
            rulesUpdated,
            alreadyActive: !needsUpdate && !customerWasUnblocked
        });

        if (customerWasUnblocked || rulesUpdated) {
            console.log(`✅ [${clientName}] - Desbloqueado: ${customerWasUnblocked ? 'SIM' : 'NÃO'}, Regras ativadas (E-mail + SMS): ${rulesUpdated ? 'SIM' : 'NÃO'}`);
        }
    }

    console.log('\n=================================================');
    console.log('RELATÓRIO FINAL DA ATUALIZAÇÃO EM LOTE NO ASAAS:');
    console.log(`- Clientes com notificações totalmente desbloqueadas (estavam com notificationDisabled = true): ${unblockedNotificationCount}`);
    console.log(`- Clientes com regras de E-mail/SMS ajustadas para ativo: ${updatedRulesCount}`);
    console.log(`- Clientes que já estavam totalmente configurados: ${unchangedCount}`);
    console.log(`- Total de clientes verificados: ${customerIdsToProcess.size}`);
    console.log('=================================================\n');

    return {
        unblockedNotificationCount,
        updatedRulesCount,
        unchangedCount,
        totalProcessed: customerIdsToProcess.size,
        updateLog
    };
}

if (require.main === module) {
    runBatchNotificationUpdate().then(() => {
        console.log('Processo concluído.');
        process.exit(0);
    }).catch(err => {
        console.error('Erro na execução do lote:', err);
        process.exit(1);
    });
}

module.exports = { runBatchNotificationUpdate };
