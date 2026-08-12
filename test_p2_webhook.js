require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');
const WebhookProcessor = require('/Users/andehrson/Yelo/backend/workers/webhookProcessor');
const PaymentStateService = require('/Users/andehrson/Yelo/backend/services/paymentStateService');
const asaasWebhook = require('/Users/andehrson/Yelo/backend/webhooks/asaasWebhook');

async function testPhase2() {
    console.log("=== INICIANDO TESTES DA FASE 2: WEBHOOK INBOX & WORKER ===\n");

    const buildReq = (eventId, eventType, paymentId, subscriptionId) => ({
        headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN },
        body: {
            id: eventId,
            event: eventType,
            payment: {
                id: paymentId,
                subscription: subscriptionId,
                externalReference: '128' // mock psi id
            }
        }
    });

    const buildRes = () => {
        let status = 200;
        let responseJson = null;
        return {
            status: function(s) { status = s; return this; },
            json: function(j) { responseJson = j; return this; },
            getStatus: () => status,
            getJson: () => responseJson
        };
    };

    console.log("1. Limpando WebhookInbox...");
    await db.WebhookInbox.destroy({ where: {} });

    // --- TESTE 1: EVENTO DUPLICADO ---
    console.log("\n[TESTE 1] - Evento Duplicado");
    const event1 = 'evt_duplicate_123';
    const req1 = buildReq(event1, 'PAYMENT_CREATED', 'pay_1', 'sub_1');
    const res1a = buildRes();
    const res1b = buildRes();
    const res1c = buildRes();

    // Mock para não bater na API do Asaas nos testes
    const originalFetchRealPayment = PaymentStateService.fetchRealPayment;
    PaymentStateService.fetchRealPayment = async (paymentId) => {
        if (paymentId === 'pay_error') throw new Error('API Error Mock');
        return {
            id: paymentId,
            status: paymentId === 'pay_refund' ? 'REFUNDED' : 'CONFIRMED',
            subscription: paymentId.includes('old') ? 'sub_old' : 'sub_new',
            externalReference: '128'
        };
    };

    await Promise.all([
        asaasWebhook.handleWebhook(req1, res1a),
        asaasWebhook.handleWebhook(req1, res1b),
        asaasWebhook.handleWebhook(req1, res1c)
    ]);

    console.log(`Res 1: ${res1a.getStatus()} | Res 2: ${res1b.getStatus()} | Res 3: ${res1c.getStatus()}`);
    const inboxCount1 = await db.WebhookInbox.count({ where: { eventId: event1 } });
    console.log(`Eventos persistidos na Inbox: ${inboxCount1} (Esperado: 1)`);

    // --- TESTE 2: DOIS WORKERS ---
    console.log("\n[TESTE 2] - Dois Workers (SKIP LOCKED)");
    // Inserimos 3 eventos pendentes
    for (let i = 1; i <= 3; i++) {
        await asaasWebhook.handleWebhook(buildReq(`evt_worker_${i}`, 'PAYMENT_CREATED', 'pay_1', 'sub_1'), buildRes());
    }
    
    // Rodamos dois workers simuladamente paralelos
    const [workerA, workerB] = await Promise.all([
        WebhookProcessor.processPendingWebhooks(),
        WebhookProcessor.processPendingWebhooks()
    ]);
    
    console.log(`Worker A processou: ${workerA}`);
    console.log(`Worker B processou: ${workerB}`);
    console.log(`Total processado: ${workerA + workerB} (Esperado: 4 = 1 do Teste 1 + 3 deste)`);

    // --- TESTE 3: WORKER CRASH ---
    console.log("\n[TESTE 3] - Worker Crash (Recovery)");
    await asaasWebhook.handleWebhook(buildReq(`evt_crash`, 'PAYMENT_CREATED', 'pay_1', 'sub_1'), buildRes());
    
    // Forçamos o evento a ficar "preso" no passado
    await db.WebhookInbox.update({
        status: 'PROCESSING',
        processingStartedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 min atrás
    }, { where: { eventId: 'evt_crash' } });

    await WebhookProcessor.recoverStalledWebhooks();
    const crashEvent = await db.WebhookInbox.findByPk('evt_crash');
    console.log(`Status do evento travado após recover: ${crashEvent.status} (Esperado: PENDING)`);

    // --- TESTE 4: ERRO TRANSITÓRIO (RETRY) ---
    console.log("\n[TESTE 4] - Erro Transitório (Retry)");
    await asaasWebhook.handleWebhook(buildReq(`evt_error`, 'PAYMENT_CONFIRMED', 'pay_error', 'sub_1'), buildRes());
    
    // Processa a 1ª vez (vai falhar devido ao mock)
    await WebhookProcessor.processPendingWebhooks();
    
    let errEvent = await db.WebhookInbox.findByPk('evt_error');
    console.log(`Tentativa 1 - Status: ${errEvent.status}, Attempts: ${errEvent.attempts}, NextRetry: ${errEvent.nextRetryAt !== null}`);
    
    // Avançamos no tempo para testar a 2ª tentativa (bypass do tempo de espera)
    await db.WebhookInbox.update({ nextRetryAt: new Date() }, { where: { eventId: 'evt_error' } });
    
    await WebhookProcessor.processPendingWebhooks();
    errEvent = await db.WebhookInbox.findByPk('evt_error');
    console.log(`Tentativa 2 - Status: ${errEvent.status}, Attempts: ${errEvent.attempts}`);

    // --- TESTE 6: REFUND ANTIGO ---
    console.log("\n[TESTE 6] - Refund Antigo vs Assinatura Nova");
    
    // Preparando estado: Psicólogo tem "sub_new" ativa
    await db.Psychologist.update({ status: 'active', subscriptionId: 'sub_new' }, { where: { id: 128 } });
    
    // Chega refund da "sub_old"
    await asaasWebhook.handleWebhook(buildReq(`evt_refund_old`, 'PAYMENT_REFUNDED', 'pay_refund_old', 'sub_old'), buildRes());
    await WebhookProcessor.processPendingWebhooks(); // Processa
    
    const psiCurrent = await db.Psychologist.findByPk(128);
    console.log(`Status do psicólogo após refund da sub_old: ${psiCurrent.status}, sub: ${psiCurrent.subscriptionId} (Esperado: active, sub_new)`);


    // Restaura mock
    PaymentStateService.fetchRealPayment = originalFetchRealPayment;

    console.log("\nLimpeza de testes...");
    await db.WebhookInbox.destroy({ where: {} });
    console.log("=== FIM DOS TESTES ===");
}

testPhase2().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
