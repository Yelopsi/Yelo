const assert = require('assert');
const path = require('path');
const Module = require('module');
const { Op } = require('sequelize');

console.log('🧪 INICIANDO SUÍTE DE TESTES: JANELA DE COTA DE PAGANTES (PÓS-TRIAL)');
console.log('===================================================================');

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ FAIL: ${name} -> ${err.message}`);
        failed++;
    }
}

function loadMatchServiceWithMock({ psychologists = [], clickLogs = [], assertLogsSql }) {
    const servicePath = path.resolve(__dirname, '../../backend/services/matchService.js');
    delete require.cache[servicePath];

    const byId = new Map(psychologists.map(p => [p.id, p]));

    const mockDb = {
        Psychologist: {
            async findAll() {
                return psychologists;
            }
        },
        Sequelize: { Op },
        sequelize: {
            QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' },
            async query(sql, opts = {}) {
                if (sql.includes('FROM "WhatsAppClickLogs"') && sql.includes('GROUP BY')) {
                    if (assertLogsSql) assertLogsSql(sql, opts);
                    const thirtyDaysAgo = opts?.replacements?.thirtyDaysAgo
                        ? new Date(opts.replacements.thirtyDaysAgo)
                        : new Date(Date.now() - 30 * 86400000);

                    const grouped = new Map();
                    for (const row of clickLogs) {
                        const createdAt = new Date(row.createdAt);
                        if (createdAt < thirtyDaysAgo) continue;

                        const psi = byId.get(row.psychologistId);
                        if (psi) {
                            const isPaid = Boolean(
                                psi.is_exempt === true ||
                                (psi.subscriptionId && String(psi.subscriptionId).trim() !== '') ||
                                Number(psi.subscription_payments_count || 0) > 0
                            );
                            const paidStart = psi.subscribedAt || psi.firstPaidAt;
                            if (isPaid && paidStart && createdAt < new Date(paidStart)) {
                                continue;
                            }
                        }

                        if (!grouped.has(row.psychologistId)) {
                            grouped.set(row.psychologistId, {
                                psychologistId: row.psychologistId,
                                total_clicks: 0,
                                conversoes: 0,
                                valid_leads: 0
                            });
                        }
                        const acc = grouped.get(row.psychologistId);
                        acc.total_clicks++;
                        if (row.dealClosed === 'yes' || row.dealClosed === 'started') {
                            acc.conversoes++;
                        }
                        const isLost = row.contactReceived === false || ['no_contact', 'ghosted', 'wpp_issue'].includes(row.dealClosed);
                        if (!isLost) {
                            acc.valid_leads++;
                        }
                    }
                    return Array.from(grouped.values());
                }

                if (sql.includes('WITH click_prices')) {
                    return [{ closed_90d_cnt: 0, closed_all_cnt: 0, clicked_90d_cnt: 0, clicked_all_cnt: 0 }];
                }

                return [];
            }
        }
    };

    const originalLoad = Module._load;
    Module._load = function (reqPath, parent, isMain) {
        if (reqPath === '../models') return mockDb;
        if (reqPath === './seoService') return { async generateMatchCopy() { return {}; } };
        return originalLoad.call(this, reqPath, parent, isMain);
    };

    try {
        return require(servicePath);
    } finally {
        Module._load = originalLoad;
    }
}

(async () => {
    const now = Date.now();
    const daysAgo = (d) => new Date(now - d * 86400000);
    const futureDate = new Date(now + 20 * 86400000);

    const makePsi = (id, overrides = {}) => ({
        id,
        nome: `Psi ${id}`,
        status: 'active',
        plano: 'ESSENTIAL',
        bio: 'Psicóloga clínica com atuação consolidada.',
        cpf: '12345678900',
        fotoUrl: 'https://example.com/foto.jpg',
        profile_paused: false,
        planExpiresAt: futureDate,
        valor_sessao_numero: 80,
        temas_atuacao: ['Ansiedade'],
        modalidade: ['Online'],
        abordagens_tecnicas: ['Psicanálise'],
        praticas_inclusivas: [],
        praticas_vivencias: [],
        ...overrides
    });

    await test('01. isPaidSubscriber distingue VIP, assinante recorrente e trial corretamente', async () => {
        const ms = loadMatchServiceWithMock({});
        assert.strictEqual(ms.isPaidSubscriber({ is_exempt: true }), true);
        assert.strictEqual(ms.isPaidSubscriber({ subscriptionId: 'sub_123', subscription_payments_count: 0 }), true);
        assert.strictEqual(ms.isPaidSubscriber({ subscriptionId: null, subscription_payments_count: 1 }), true);
        assert.strictEqual(ms.isPaidSubscriber({ is_exempt: false, subscriptionId: null, subscription_payments_count: 0 }), false);
    });

    await test('02. Conversão durante trial NÃO capa assinante no 1º mês pago e zera cota em subscribedAt', async () => {
        let capturedSql = '';
        const paidFromTrial = makePsi(3289, {
            subscriptionId: 'sub_gerluce',
            subscription_payments_count: 1,
            subscribedAt: daysAgo(12),
            firstPaidAt: daysAgo(12)
        });
        const peerA = makePsi(101, { subscriptionId: 'sub_a', subscription_payments_count: 1, subscribedAt: daysAgo(45) });
        const peerB = makePsi(102, { subscriptionId: 'sub_b', subscription_payments_count: 1, subscribedAt: daysAgo(45) });
        const peerC = makePsi(103, { subscriptionId: 'sub_c', subscription_payments_count: 1, subscribedAt: daysAgo(45) });

        const clickLogs = [
            // Conversão ocorrida no trial (19 dias atrás, antes de subscribedAt há 12 dias)
            { psychologistId: 3289, createdAt: daysAgo(19), contactReceived: true, dealClosed: 'started' },
            // Clique ghosted já no período pago (não gera lead válido)
            { psychologistId: 3289, createdAt: daysAgo(5), contactReceived: true, dealClosed: 'ghosted' },
            // Pares com 1 lead válido no ciclo pago (para dar >= 3 não-cappados caso 3289 fosse cappada)
            { psychologistId: 101, createdAt: daysAgo(3), contactReceived: true, dealClosed: null },
            { psychologistId: 102, createdAt: daysAgo(3), contactReceived: true, dealClosed: null },
            { psychologistId: 103, createdAt: daysAgo(3), contactReceived: true, dealClosed: null }
        ];

        const ms = loadMatchServiceWithMock({
            psychologists: [paidFromTrial, peerA, peerB, peerC],
            clickLogs,
            assertLogsSql: (sql) => { capturedSql = sql; }
        });

        const res = await ms.calculateMatches({
            temas: ['Ansiedade'],
            modalidade_atendimento: 'Online',
            faixa_valor: 'R$ 51 - R$ 90',
            abordagem_ideal: ['Psicanálise']
        });

        assert.ok(capturedSql.includes('COALESCE(p."subscribedAt", p."firstPaidAt")'), 'SQL deve considerar início do ciclo pago');
        assert.ok(res.results.some(r => r.id === 3289), 'Pagante recém-saído do trial deve permanecer elegível e aparecer no match');
        const psiOut = res.results.find(r => r.id === 3289);
        assert.strictEqual(psiOut.conversoes30d, 0, 'Conversão feita no trial não deve contar na cota paga');
        assert.strictEqual(psiOut.leads30d, 0, 'Lead ghosted não conta como lead válido');
        assert.strictEqual(Boolean(psiOut.isCapped), false, 'Pagante não deve ficar cappado por conversão pré-assinatura');
    });

    await test('03. Conversão ocorrida APÓS subscribedAt continua aplicando cap no ciclo pago (e Trial segue em 30d)', async () => {
        const paidWithPostSubConv = makePsi(200, {
            subscriptionId: 'sub_200',
            subscription_payments_count: 1,
            subscribedAt: daysAgo(20)
        });
        const trialWithTrialConv = makePsi(201, {
            subscriptionId: null,
            subscription_payments_count: 0,
            is_exempt: false,
            subscribedAt: null
        });
        const peer1 = makePsi(202, { subscriptionId: 'sub_202', subscription_payments_count: 1, subscribedAt: daysAgo(45) });
        const peer2 = makePsi(203, { subscriptionId: 'sub_203', subscription_payments_count: 1, subscribedAt: daysAgo(45) });
        const peer3 = makePsi(204, { subscriptionId: 'sub_204', subscription_payments_count: 1, subscribedAt: daysAgo(45) });

        const clickLogs = [
            // Fechamento ocorrido DEPOIS de subscribedAt -> deve capar
            { psychologistId: 200, createdAt: daysAgo(10), contactReceived: true, dealClosed: 'started' },
            // Fechamento de trial -> deve continuar capando trial
            { psychologistId: 201, createdAt: daysAgo(4), contactReceived: true, dealClosed: 'started' }
        ];

        const ms = loadMatchServiceWithMock({
            psychologists: [paidWithPostSubConv, trialWithTrialConv, peer1, peer2, peer3],
            clickLogs
        });

        const res = await ms.calculateMatches({
            temas: ['Ansiedade'],
            modalidade_atendimento: 'Online',
            faixa_valor: 'R$ 51 - R$ 90',
            abordagem_ideal: ['Psicanálise']
        });

        const returnedIds = res.results.map(r => r.id);
        assert.ok(!returnedIds.includes(200), 'Pagante com conversão pós-assinatura deve ser cappado quando há >=3 livres');
        assert.ok(!returnedIds.includes(201), 'Trial com conversão continua cappado quando há >=3 livres');
    });

    console.log('\n===================================================================');
    console.log(`Resultado: ${passed} PASS | ${failed} FAIL`);
    process.exit(failed > 0 ? 1 : 0);
})();
