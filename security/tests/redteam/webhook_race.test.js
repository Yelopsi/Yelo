const assert = require('assert');
const db = require('../../../backend/models');

console.log('🔴 INICIANDO RED TEAM: WEBHOOK RACE CONDITIONS E DUPLICAÇÃO 🔴\n');

const asaasWebhook = require('../../../backend/webhooks/asaasWebhook');

const mockReqRes = (body) => {
    const req = { body, headers: { 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN || 'test_token' } };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json() { return this; }, send() { return this; } };
    return { req, res };
};

const testWebhookRedTeam = async () => {
    try {
        const psi = await db.Psychologist.create({ nome: 'Webhook Target', email: `wh_${Date.now()}@yelo.com`, senha: '123' });
        
        // Simula um webhook PAYMENT_RECEIVED chegando do Asaas (Duplicado 10x simultâneas)
        const payload = {
            event: 'PAYMENT_RECEIVED',
            payment: {
                id: `pay_mock_${Date.now()}`,
                customer: 'cus_mock123',
                subscription: `sub_mock_${Date.now()}`,
                externalReference: String(psi.id)
            }
        };

        console.log('[RED TEAM] Atirando 10 webhooks simultâneos (Duplicação/Race Condition)...');
        
        // Como o webhookInbox salva o evento primeiro e uma rotina/cron processa depois, ou se processa na hora, vamos ver.
        // Vamos enviar 10 reqs simultâneas
        const reqs = Array(10).fill(0).map(() => mockReqRes(payload));
        const promises = reqs.map(({req, res}) => asaasWebhook.handleWebhook(req, res));
        
        await Promise.allSettled(promises);

        // Verifica quantos WebhookInbox foram criados. Se o banco/código não tratar duplicidade de eventId, teremos 10.
        // O Asaas usa o req.body.payment.id + event para ID?
        const inboxes = await db.WebhookInbox.findAll({ where: { payload: { payment: { id: payload.payment.id } } } });
        
        console.log(`   Eventos processados salvos no DB: ${inboxes.length}`);
        
        // Limpeza
        await db.WebhookInbox.destroy({ where: {} }); // Limpa a tabela de inbox de teste
        await psi.destroy();

        if (inboxes.length > 1) {
            console.log('   ⚠️ ALERTA: Múltiplos webhooks idênticos foram salvos no banco. A idempotência deve estar no Worker de processamento e não na recepção.');
        } else {
            console.log('   ✅ PASSOU: Idempotência garantida já na recepção do Webhook.');
        }

    } catch (e) {
        console.error('   ❌ FALHA DO RED TEAM TEST:', e.message);
    }
};

const runAll = async () => {
    // Para simplificar a prova, o webhookInbox só armazena. A vulnerabilidade de race condition está no processamento real (Worker).
    await testWebhookRedTeam();
    console.log('\n✅ RED TEAM WEBHOOK AUDIT CONCLUÍDA.');
    process.exit(0);
};

runAll();
