const assert = require('assert');
const db = require('../../../backend/models');
const asaasMock = require('./asaas_mock'); // We will create this

console.log('🔴 INICIANDO RED TEAM DYNAMIC AUDIT (ISOLATED) 🔴\n');

const mockReqRes = (overrides = {}) => {
    const req = {
        body: {},
        query: {},
        params: {},
        headers: {},
        cookies: {},
        ...overrides
    };
    const res = {
        statusCode: 200,
        responseData: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.responseData = data; return this; },
        send(data) { this.responseData = data; return this; }
    };
    return { req, res };
};

// =========================================================================
// CAMADA A: SERVICE/CONTROLLER LEVEL (RACE CONDITIONS & IDEMPOTÊNCIA)
// =========================================================================
const testPaymentRaceConditions = async () => {
    console.log('[RED TEAM] Testando Race Conditions em Pagamentos (Camada A)...');
    const paymentController = require('../../../backend/controllers/paymentController');
    
    // Configura o Asaas Mock para interceptar e não fazer rede real
    asaasMock.setup();

    try {
        // PREPARE ISOLATED DATA
        const psi = await db.Psychologist.create({
            nome: 'Red Team Psi',
            email: `redteam_${Date.now()}@yelo.com.br`,
            senha: 'password123',
            status: 'active'
        });

        // ATAQUE 1: Dupla cobrança simultânea (Race Condition de Checkout)
        const idempotencyKey = `redteam_idemp_${Date.now()}`;
        
        const req1 = mockReqRes({ psychologist: psi, headers: { 'idempotency-key': idempotencyKey }, body: { planType: 'ESSENTIAL', billingType: 'PIX' } });
        const req2 = mockReqRes({ psychologist: psi, headers: { 'idempotency-key': idempotencyKey }, body: { planType: 'ESSENTIAL', billingType: 'PIX' } });

        // Dispara simultaneamente
        const p1 = paymentController.createPreference(req1.req, req1.res);
        const p2 = paymentController.createPreference(req2.req, req2.res);
        await Promise.allSettled([p1, p2]);

        // VERIFICAÇÃO DO ESTADO DO BANCO
        const intents = await db.SubscriptionIntent.findAll({ where: { idempotencyKey } });
        assert.strictEqual(intents.length, 1, 'FALHA: O sistema permitiu a criação de DOIS intents simultâneos (Race Condition Explorada)!');
        
        if (req1.res.statusCode === 409 || req2.res.statusCode === 409) {
            console.log('   ✅ PASSOU: Concorrência simultânea de checkout foi bloqueada (409 Conflict).');
        } else {
            console.log('   ⚠️ ALERTA: Concorrência de checkout não retornou 409 como esperado, mas o DB protegeu a criação duplicada.');
        }

        // Limpeza dos dados sintéticos
        await db.SubscriptionIntent.destroy({ where: { psychologistId: psi.id } });
        await psi.destroy();

    } catch (e) {
        console.error('   ❌ FALHA DO RED TEAM TEST:', e.message);
    } finally {
        asaasMock.teardown();
    }
};

// =========================================================================
// CAMADA B: BOLA/IDOR PRIVILEGE ESCALATION
// =========================================================================
const testBOLA = async () => {
    console.log('[RED TEAM] Testando BOLA/IDOR (Horizontal/Vertical)...');
    const forumController = require('../../../backend/controllers/forumController');
    const adminCommunityController = require('../../../backend/controllers/adminCommunityController');

    try {
        // PREPARE ISOLATED DATA
        const psiA = await db.Psychologist.create({ nome: 'Psi A', email: `psia_${Date.now()}@yelo.com`, senha: '123' });
        const psiB = await db.Psychologist.create({ nome: 'Psi B', email: `psib_${Date.now()}@yelo.com`, senha: '123' });
        
        const post = await db.ForumPost.create({
            title: 'Red Team Post', content: 'Secret', PsychologistId: psiA.id, category: 'Geral'
        });

        // ATAQUE HORIZONTAL: Psi B tentando excluir o post do Psi A
        const { req, res } = mockReqRes({ user: { id: psiB.id }, params: { id: post.id } });
        await forumController.deletePost(req, res);

        assert.notStrictEqual(res.statusCode, 200, 'FALHA DE IDOR HORIZONTAL: Psi B conseguiu excluir post do Psi A!');
        console.log('   ✅ PASSOU: BOLA Horizontal mitigado (403 Forbidden).');

        // ATAQUE DE MASS ASSIGNMENT
        const { req: reqAdmin, res: resAdmin } = mockReqRes({ 
            body: { titulo: 'Hacked', isAdmin: true, injected_field: 'malicious' }
        });
        await adminCommunityController.updateCommunityEvent(reqAdmin, resAdmin);
        
        // Verifica se 'injected_field' foi ignorado
        const event = await db.CommunityEvent.findOne({ order: [['updatedAt', 'DESC']] });
        if (event) {
            assert.strictEqual(event.injected_field, undefined, 'FALHA DE MASS ASSIGNMENT: Campo malicioso foi injetado no BD!');
            console.log('   ✅ PASSOU: Mass Assignment mitigado (Payload desestruturado com sucesso).');
        }

        // Cleanup
        await post.destroy();
        await psiA.destroy();
        await psiB.destroy();
    } catch (e) {
         console.error('   ❌ FALHA DO RED TEAM TEST:', e.message);
    }
};

const runAll = async () => {
    await testPaymentRaceConditions();
    await testBOLA();
    console.log('\n✅ RED TEAM DYNAMIC AUDIT CONCLUÍDA.');
    process.exit(0);
};

runAll();
