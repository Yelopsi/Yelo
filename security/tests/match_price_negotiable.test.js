const assert = require('assert');
const path = require('path');
const Module = require('module');
const { Op } = require('sequelize');

console.log('🧪 INICIANDO SUÍTE DE TESTES: MATCH NEGOCIÁVEL ("A COMBINAR")');
console.log('===============================================================');

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

function loadMatchServiceWithMock(queryHandler) {
    const servicePath = path.resolve(__dirname, '../../backend/services/matchService.js');
    delete require.cache[servicePath];

    const mockDb = {
        Psychologist: {},
        Sequelize: { Op },
        sequelize: {
            QueryTypes: { SELECT: 'SELECT', INSERT: 'INSERT', UPDATE: 'UPDATE' },
            query: queryHandler
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
    const basePsy = {
        id: 1,
        nome: 'Psi Teste',
        is_exempt: true,
        planExpiresAt: null,
        fotoUrl: 'https://example.com/foto.jpg',
        bio: 'Psicóloga clínica com ampla experiência.',
        temas_atuacao: ['Ansiedade, Estresse ou Tristeza'],
        modalidade: ['Online'],
        abordagens_tecnicas: ['TCC'],
        praticas_inclusivas: [],
        praticas_vivencias: []
    };

    const basePrefs = {
        temas: ['Ansiedade, Estresse ou Tristeza'],
        modalidade_atendimento: 'Online'
    };

    await test('01. parsePriceRange interpreta todas as faixas do questionário incluindo Até R$ 50 e Acima de R$ 150', async () => {
        const ms = loadMatchServiceWithMock(async () => []);
        assert.deepStrictEqual(ms.parsePriceRange('Até R$ 50'), { min: 0, max: 50 });
        assert.deepStrictEqual(ms.parsePriceRange('R$ 51 - R$ 90'), { min: 51, max: 90 });
        assert.deepStrictEqual(ms.parsePriceRange('R$ 91 - R$ 150'), { min: 91, max: 150 });
        assert.deepStrictEqual(ms.parsePriceRange('Acima de R$ 150'), { min: 150, max: 99999 });
    });

    await test('02. Psicólogo transparente a R$ 40 na faixa "Até R$ 50" ganha bônus máximo (+30 sOp) e tag ideal', async () => {
        const ms = loadMatchServiceWithMock(async () => []);
        const psi40 = { ...basePsy, valor_sessao_numero: 40 };
        const psi60 = { ...basePsy, valor_sessao_numero: 60 };
        const range = ms.parsePriceRange('Até R$ 50');

        const r40 = ms.calculateSimilarity(psi40, basePrefs, range, 81);
        const r60 = ms.calculateSimilarity(psi60, basePrefs, range, 81);

        assert.ok(r40.explainability.positives.includes('Dentro do orçamento ideal'));
        assert.ok(!r60.explainability.positives.includes('Dentro do orçamento ideal'));
        // Diferença em sOp = +30 vs -20 => 50 * 0.35 = 17.5 pontos brutos
        assert.strictEqual(Number((r40.rawMatchScore - r60.rawMatchScore).toFixed(2)), 17.5);
    });

    await test('03. "A combinar" com referência R$ 81: +15 sem falso selo em R$ 51-90/91-150/>150 e -20 em Até R$ 50', async () => {
        const ms = loadMatchServiceWithMock(async () => []);
        const psiNeg = { ...basePsy, valor_sessao_numero: null };
        const psi80 = { ...basePsy, valor_sessao_numero: 80 };

        // Em R$ 51 - R$ 90 (com ref 81): A combinar (+15) perde apenas por 5.25 pts para R$ 80 (+30), sem falso selo
        const range51_90 = ms.parsePriceRange('R$ 51 - R$ 90');
        const resNeg51 = ms.calculateSimilarity(psiNeg, basePrefs, range51_90, 81);
        const res80_51 = ms.calculateSimilarity(psi80, basePrefs, range51_90, 81);

        assert.ok(resNeg51.explainability.neutral.includes('Valor a combinar'));
        assert.ok(!resNeg51.explainability.positives.includes('Dentro do orçamento ideal'));
        assert.ok(res80_51.explainability.positives.includes('Dentro do orçamento ideal'));
        assert.strictEqual(Number((res80_51.rawMatchScore - resNeg51.rawMatchScore).toFixed(2)), 5.25);

        // Em R$ 91 - R$ 150 e Acima de R$ 150: ref 81 <= max -> mantém +15 neutro
        const resNeg91 = ms.calculateSimilarity(psiNeg, basePrefs, ms.parsePriceRange('R$ 91 - R$ 150'), 81);
        const resNeg150 = ms.calculateSimilarity(psiNeg, basePrefs, ms.parsePriceRange('Acima de R$ 150'), 81);
        assert.strictEqual(resNeg91.rawMatchScore, resNeg51.rawMatchScore);
        assert.strictEqual(resNeg150.rawMatchScore, resNeg51.rawMatchScore);

        // Em Até R$ 50: ref 81 > 50 -> penalidade -20 (diferença de 35 * 0.35 = 12.25 pts abaixo do R$ 51-90)
        const resNeg50 = ms.calculateSimilarity(psiNeg, basePrefs, ms.parsePriceRange('Até R$ 50'), 81);
        assert.strictEqual(Number((resNeg51.rawMatchScore - resNeg50.rawMatchScore).toFixed(2)), 12.25);
    });

    await test('04. getPlatformReferencePrice segue prioridade, faz clamp [40,300], usa cache de 1h e fallback seguro', async () => {
        let queryCount = 0;
        let currentRow = {
            closed_90d_cnt: 8, closed_90d_avg: 80.72,
            closed_all_cnt: 134, closed_all_avg: 82.0,
            clicked_90d_cnt: 200, clicked_90d_avg: 85.0,
            clicked_all_cnt: 800, clicked_all_avg: 90.0
        };

        const ms = loadMatchServiceWithMock(async () => {
            queryCount++;
            return [currentRow];
        });

        // 1) Prioridade closed_90d + cache 1h
        ms._resetReferencePriceCache();
        const r1 = await ms.getPlatformReferencePrice();
        const r2 = await ms.getPlatformReferencePrice();
        assert.strictEqual(r1.value, 80.72);
        assert.strictEqual(r1.source, 'closed_90d');
        assert.strictEqual(r2.value, 80.72);
        assert.strictEqual(queryCount, 1, 'Segunda chamada dentro de 1h deve usar cache');

        // 2) Fallback na hierarquia: sem 90d fechados suficientes (<5), cai para closed_all
        currentRow = {
            closed_90d_cnt: 3, closed_90d_avg: 120,
            closed_all_cnt: 20, closed_all_avg: 84.5,
            clicked_90d_cnt: 50, clicked_90d_avg: 90,
            clicked_all_cnt: 100, clicked_all_avg: 95
        };
        const rClosedAll = await ms.getPlatformReferencePrice(true);
        assert.strictEqual(rClosedAll.source, 'closed_all');
        assert.strictEqual(rClosedAll.value, 84.5);

        // 3) Clamp inferior (20 -> 40) e superior (500 -> 300)
        currentRow = { closed_90d_cnt: 10, closed_90d_avg: 20 };
        const rClampMin = await ms.getPlatformReferencePrice(true);
        assert.strictEqual(rClampMin.value, 40);

        currentRow = { closed_90d_cnt: 10, closed_90d_avg: 500 };
        const rClampMax = await ms.getPlatformReferencePrice(true);
        assert.strictEqual(rClampMax.value, 300);

        // 4) Erro no banco cai para fallback R$ 80 sem quebrar o match
        const msErr = loadMatchServiceWithMock(async () => {
            throw new Error('DB connection lost');
        });
        msErr._resetReferencePriceCache();
        const rErr = await msErr.getPlatformReferencePrice();
        assert.strictEqual(rErr.value, 80);
        assert.strictEqual(rErr.source, 'fallback');
    });

    console.log('\n===============================================================');
    console.log(`Resultado: ${passed} PASS | ${failed} FAIL`);
    process.exit(failed > 0 ? 1 : 0);
})();
