require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');
const { v4: uuidv4 } = require('uuid');

async function testConcurrency() {
    console.log("=== INICIANDO TESTE P0: CONCORRÊNCIA E IDEMPOTÊNCIA ===");

    const psi = await db.Psychologist.findByPk(128);
    console.log("Psychologist no inicio do teste:", psi ? psi.nome : "NULL");

    // Mock Express Req/Res
    const buildReq = (key, override = {}) => ({
        headers: { 'idempotency-key': key },
        psychologist: { id: 128 },
        body: {
            planType: 'ESSENTIAL',
            billingType: 'CREDIT_CARD',
            creditCard: {
                holderName: 'Teste P0',
                holderCpf: '11111111111',
                holderPhone: '11999999999',
                number: '0000000000000000',
                expiry: '12/28',
                ccv: '123'
            },
            ...override
        }
    });

    const buildRes = () => {
        let status = 200;
        let responseJson = null;
        let sent = false;
        
        return {
            status: function(s) { status = s; return this; },
            json: function(j) { responseJson = j; sent = true; return this; },
            getStatus: () => status,
            getJson: () => responseJson,
            isSent: () => sent
        };
    };

    const { createPreference } = require('/Users/andehrson/Yelo/backend/controllers/paymentController');

    // TESTE F: Mesma Idempotency-Key
    console.log("\n[TESTE F] - 2 requests simulando duplo-clique orgânico (mesma key)");
    const keyF = uuidv4();
    const reqF1 = buildReq(keyF);
    const reqF2 = buildReq(keyF);
    
    const resF1 = buildRes();
    const resF2 = buildRes();

    // Vamos dar mock no db.SubscriptionIntent.create só para controlar o fluxo localmente se precisarmos
    // Mas o teste real usa o banco. E vamos rodar no banco real!
    
    const promiseF1 = createPreference(reqF1, resF1);
    const promiseF2 = createPreference(reqF2, resF2);

    await Promise.all([promiseF1, promiseF2]);

    console.log("Res1:", resF1.getStatus(), resF1.getJson());
    console.log("Res2:", resF2.getStatus(), resF2.getJson());

    // TESTE E: Multi-Browser Attack (Keys diferentes, mesmo usuário)
    console.log("\n[TESTE E] - 5 requests simultâneos com Keys diferentes para o MESMO Psicólogo");
    const promisesE = [];
    const responsesE = [];
    for (let i = 0; i < 5; i++) {
        const resE = buildRes();
        responsesE.push(resE);
        promisesE.push(createPreference(buildReq(uuidv4()), resE));
    }

    await Promise.allSettled(promisesE);

    let successCount = 0;
    let conflictCount = 0;
    
    responsesE.forEach((r, idx) => {
        const s = r.getStatus();
        if (s === 200 || s === 400 || s === 500) successCount++; // Se chegou até o fim do controller e processou
        if (s === 409) conflictCount++; // Se foi barrado pela constraint do DB
        console.log(`Req ${idx}: Status ${s}`, r.getJson()?.error ? `(${r.getJson().error})` : '');
    });

    console.log(`\nResultados do Teste E: ${successCount} processados, ${conflictCount} barrados (Expected: 1 processado, 4 barrados)`);

    // Inspecionando o banco
    const intents = await db.SubscriptionIntent.findAll({ where: { psychologistId: 128 } });
    console.log(`\nTotal de intents para psicólogo 128: ${intents.length}`);
    intents.forEach(i => console.log(`- ${i.idempotencyKey} | Status: ${i.status}`));

    console.log("\nLimpeza de testes...");
    await db.SubscriptionIntent.destroy({ where: { psychologistId: 128 } });
    
    console.log("\n=== FIM DOS TESTES ===");
}

testConcurrency().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
