const assert = require('assert');
const {
    computeMonthsFromDates,
    computePsychologistRevenueSummary,
    buildPlanPrices
} = require('../../backend/utils/subscriptionRevenue');

console.log('🧪 INICIANDO SUÍTE DE TESTES: RECEITA MULTI-MÊS E MRR EFETIVO');
console.log('==================================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ FAIL: ${name} -> ${err.message}`);
        failed++;
    }
}

const planPrices = buildPlanPrices();

test('01. computeMonthsFromDates distingue ciclo mensal (mesmo c/ folga) de bimestral/trimestral/semestral', () => {
    assert.strictEqual(computeMonthsFromDates('2026-11-01', '2026-12-01'), 1);
    assert.strictEqual(computeMonthsFromDates('2026-10-23', '2026-12-03'), 1); // 41d (renovação + folga) = 1 mês
    assert.strictEqual(computeMonthsFromDates('2026-11-17', '2027-01-17'), 2); // 61d = 2 meses
    assert.strictEqual(computeMonthsFromDates('2026-11-16', '2027-02-16'), 3); // 92d = 3 meses
    assert.strictEqual(computeMonthsFromDates('2027-01-01', '2027-07-01'), 6); // 181d = 6 meses
});

test('02. Promo "pague 2 (R$ 198), leve 3 meses" calcula MRR efetivo de R$ 66/mês e nominal R$ 99/mês', () => {
    const psi = {
        id: 3090,
        plano: 'ESSENTIAL',
        is_exempt: false,
        subscriptionId: 'sub_larissa',
        subscription_payments_count: 1,
        subscribedAt: '2026-11-16T23:31:25Z',
        planExpiresAt: '2027-02-16T12:00:00Z'
    };
    const context = {
        planPrices,
        subscriptionsById: new Map([
            ['sub_larissa', {
                id: 'sub_larissa',
                psychologistId: 3090,
                plan: 'ESSENTIAL',
                currentPeriodStart: '2026-11-16T12:00:00Z',
                currentPeriodEnd: '2027-02-16T12:00:00Z'
            }]
        ]),
        subscriptionsByPsi: new Map(),
        paymentsByPsi: new Map([
            [3090, [{ id: 'pay_1', status: 'RECEIVED', value: '198.00', paymentDate: '2026-11-16T00:00:00Z' }]]
        ])
    };

    const res = computePsychologistRevenueSummary(psi, context);
    assert.strictEqual(res.monthsCovered, 3);
    assert.strictEqual(res.effectiveMonthly, 66);
    assert.strictEqual(res.nominalMonthly, 99);
    assert.strictEqual(res.isMultiMonthPromo, true);
    assert.ok(res.planDisplayName.includes('Promo 3m'));
    assert.ok(res.planDisplayName.includes('66/mês'));
});

test('03. Promo "pague 1 (R$ 99), leve 2 meses" calcula MRR efetivo de R$ 49,50/mês e preserva histórico anterior à promo', () => {
    const psi = {
        id: 846,
        plano: 'ESSENTIAL',
        is_exempt: false,
        subscriptionId: 'sub_joshua',
        subscription_payments_count: 2,
        subscribedAt: '2026-09-21T12:10:56Z',
        planExpiresAt: '2027-01-26T12:00:00Z'
    };
    const context = {
        planPrices,
        subscriptionsById: new Map([
            ['sub_joshua', {
                id: 'sub_joshua',
                psychologistId: 846,
                plan: 'ESSENTIAL',
                currentPeriodStart: '2026-11-26T12:00:00Z',
                currentPeriodEnd: '2027-01-26T12:00:00Z'
            }]
        ]),
        subscriptionsByPsi: new Map(),
        paymentsByPsi: new Map([
            [846, [
                { id: 'pay_old', status: 'RECEIVED', value: '99.00', paymentDate: '2026-09-21T00:00:00Z' },
                { id: 'pay_bf', status: 'RECEIVED', value: '99.00', paymentDate: '2026-11-26T12:00:00Z' }
            ]]
        ])
    };

    const resNow = computePsychologistRevenueSummary(psi, context);
    assert.strictEqual(resNow.monthsCovered, 2);
    assert.strictEqual(resNow.effectiveMonthly, 49.5);
    assert.strictEqual(resNow.nominalMonthly, 99);

    // No snapshot de outubro (antes da promo de 26/11), valia R$ 99/mês
    const resOct = computePsychologistRevenueSummary(psi, context, { atDate: '2026-10-28T23:59:59Z' });
    assert.strictEqual(resOct.monthsCovered, 1);
    assert.strictEqual(resOct.effectiveMonthly, 99);
});

test('04. Planos estruturados Trimestral/Semestral (2027) e VIP/Trial retornam valores corretos', () => {
    const context = {
        planPrices,
        subscriptionsById: new Map([
            ['sub_q', {
                id: 'sub_q',
                psychologistId: 500,
                plan: JSON.stringify({ planType: 'ESSENTIAL', cycle: 'QUARTERLY', installmentCount: 3, totalValue: 387 })
            }],
            ['sub_s', {
                id: 'sub_s',
                psychologistId: 501,
                plan: JSON.stringify({ planType: 'ESSENTIAL', cycle: 'SEMIANNUAL', installmentCount: 6, totalValue: 594 })
            }]
        ]),
        subscriptionsByPsi: new Map(),
        paymentsByPsi: new Map()
    };

    const qRes = computePsychologistRevenueSummary({ id: 500, plano: 'ESSENTIAL', subscriptionId: 'sub_q' }, context);
    assert.strictEqual(qRes.effectiveMonthly, 129);
    assert.strictEqual(qRes.monthsCovered, 3);

    const sRes = computePsychologistRevenueSummary({ id: 501, plano: 'ESSENTIAL', subscriptionId: 'sub_s' }, context);
    assert.strictEqual(sRes.effectiveMonthly, 99);
    assert.strictEqual(sRes.monthsCovered, 6);

    const vipRes = computePsychologistRevenueSummary({ id: 106, plano: 'ESSENTIAL', is_exempt: true }, context);
    assert.strictEqual(vipRes.effectiveMonthly, 0);

    const trialRes = computePsychologistRevenueSummary({ id: 999, plano: 'ESSENTIAL', is_exempt: false }, context);
    assert.strictEqual(trialRes.effectiveMonthly, 0);
});

console.log('\n==================================================================');
console.log(`Resultado: ${passed} PASS | ${failed} FAIL`);
process.exit(failed > 0 ? 1 : 0);
