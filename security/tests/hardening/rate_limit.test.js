const request = require('supertest');
const assert = require('assert');
const app = require('../../../backend/server');

console.log('🔴 INICIANDO HARDENING: HTTP RATE LIMITING 🔴\n');

const runTests = async () => {
    try {
        console.log('[HARDENING] Teste A: Auth Limiter (Brute Force Protection)');
        let authBlocked = false;
        
        // O limite de auth é 10. Disparamos 12.
        for (let i = 0; i < 12; i++) {
            const res = await request(app).post('/api/auth/login').set('X-Test-Bypass', 'true').send({ email: 'test@test.com', password: '123' });
            if (res.status === 429) authBlocked = true;
        }
        
        assert.ok(authBlocked, 'FALHA: O Rate Limiter de Autenticação não bloqueou um ataque de Força Bruta.');
        console.log('   ✅ PASSOU: Auth Limiter conteve o ataque.');

        console.log('[HARDENING] Teste B: Webhook Burst Allowance');
        let webhookBlocked = false;
        
        // O limite de webhook é 100. Disparamos 20 rápidos.
        for (let i = 0; i < 20; i++) {
            // Simulamos um IP diferente para não cruzar com os limites de fallback se o test runner for muito rápido
            const res = await request(app).post('/api/webhooks/asaas').set('X-Test-Bypass', 'true').set('X-Forwarded-For', '10.0.0.1');
            if (res.status === 429) webhookBlocked = true;
        }
        
        assert.ok(!webhookBlocked, 'FALHA: O Rate Limiter de Webhook bloqueou um burst legítimo (Falso Positivo).');
        console.log('   ✅ PASSOU: Webhooks permitem bursts razoáveis sem bloquear.');

        console.log('\n✅ RATE LIMITING HTTP: PASS (Multicamadas ativas).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
