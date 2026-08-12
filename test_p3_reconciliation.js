require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');
const ReconciliationService = require('/Users/andehrson/Yelo/backend/services/reconciliationService');

async function runTests() {
    console.log("=== INICIANDO TESTES DA FASE 3: RECONCILIAÇÃO ===\n");

    // Limpeza Prévia
    await db.ReconciliationAudit.destroy({ where: {} });
    await db.SubscriptionIntent.destroy({ where: { psychologistId: 128 } });

    // --- MOCKS ---
    const originalFetchAsaas = ReconciliationService.fetchAsaas;
    
    ReconciliationService.fetchAsaas = async (endpoint) => {
        if (endpoint.includes('/subscriptions?status=ACTIVE')) {
            return {
                data: [
                    { id: 'sub_orphan_critical', externalReference: '999', status: 'ACTIVE' }, // Teste A
                    { id: 'sub_yelo_divergent', externalReference: '128', status: 'ACTIVE' } // Psi ativo, mas subDivergent
                ]
            };
        }
        if (endpoint.includes('/subscriptions/')) {
            // Se Yelo buscar a assinatura dele
            if (endpoint.includes('sub_canceled')) return { status: 'CANCELED' }; // Teste H
            if (endpoint.includes('sub_active')) return { status: 'ACTIVE' };
            throw new Error('404');
        }
        if (endpoint.includes('/payments?')) {
            return {
                data: [
                    { id: 'pay_missing', status: 'CONFIRMED' }, // Teste B
                    { id: 'pay_mismatch', status: 'REFUNDED' }  // Teste C
                ]
            };
        }
        return { data: [] };
    };

    // --- PREPARANDO BANCO LOCAL PARA O TESTE ---
    // Teste C: Mock Payment divergente
    if (!(await db.Payment.findByPk('pay_mismatch'))) {
        await db.Payment.create({
            id: 'pay_mismatch', asaasPaymentId: 'pay_mismatch', status: 'CONFIRMED', value: 99,
            psychologistId: 128, billingType: 'CREDIT_CARD', dueDate: new Date()
        });
    }

    // Teste D/E: Intents antigos
    const d = new Date(Date.now() - 30 * 60 * 1000); // 30 min atrás
    await db.SubscriptionIntent.create({
        idempotencyKey: 'intent_stale_1', psychologistId: 128, status: 'SENT_TO_ASAAS', planId: 'ESSEN', billingType: 'CREDIT_CARD', updatedAt: d, expiresAt: d
    });
    
    // --- TESTE F: Concorrência (Lock) ---
    console.log("[TESTE F] - Concorrência (Dois Jobs Simultâneos)");
    const [res1, res2] = await Promise.all([
        ReconciliationService.runFullAudit(),
        ReconciliationService.runFullAudit()
    ]);
    
    console.log(`Job 1: ${res1.success ? 'EXECUTADO' : res1.reason}`);
    console.log(`Job 2: ${res2.success ? 'EXECUTADO' : res2.reason}`);
    console.log("Esperado: Um EXECUTADO e um LOCKED");

    // --- RESULTADOS DO TESTE F E DEMAIS (A, B, C, D) ---
    console.log("\n--- AVALIANDO ANOMALIAS REPORTADAS ---");
    const audits = await db.ReconciliationAudit.findAll({ order: [['createdAt', 'ASC']] });
    
    const countType = (type) => audits.filter(a => a.differenceType === type).length;

    console.log(`- CRITICAL_ORPHAN (Teste A): Encontrado? ${countType('CRITICAL_ORPHAN') > 0}`);
    console.log(`- MISSING_PAYMENT (Teste B): Encontrado? ${countType('MISSING_PAYMENT') > 0}`);
    console.log(`- PAYMENT_STATUS_MISMATCH (Teste C): Encontrado? ${countType('PAYMENT_STATUS_MISMATCH') > 0}`);
    console.log(`- STALE_INTENT (Teste D/E): Encontrado? ${countType('STALE_INTENT') > 0}`);
    console.log(`Total de auditorias abertas: ${audits.length}`);

    // --- TESTE G: Idempotência (Duas execuções não duplicam anomalias abertas) ---
    console.log("\n[TESTE G] - Idempotência (Rodando novamente)");
    await ReconciliationService.runFullAudit();
    const auditsT2 = await db.ReconciliationAudit.count();
    console.log(`Total de auditorias após 2ª rodada: ${auditsT2} (Esperado: ${audits.length}, sem duplicação)`);

    // --- RESTAURA MOCK E LIMPEZA ---
    ReconciliationService.fetchAsaas = originalFetchAsaas;
    await db.ReconciliationAudit.destroy({ where: {} });
    await db.SubscriptionIntent.destroy({ where: { psychologistId: 128 } });
    await db.Payment.destroy({ where: { id: 'pay_mismatch' } });

    console.log("\n=== FIM DOS TESTES ===");
}

runTests().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
