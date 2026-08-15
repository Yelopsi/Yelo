const request = require('supertest');
const assert = require('assert');
const app = require('../../../backend/server');

console.log('🔴 INICIANDO HARDENING: PAYLOAD HARDENING 🔴\n');

const runTests = async () => {
    try {
        console.log('[HARDENING] Teste A: Bloqueio de JSON Bomb (Oversized Payload)');
        
        // Criar um payload de 200kb (Acima do limite de 100kb)
        const massiveString = 'A'.repeat(200 * 1024);
        
        const res = await request(app)
            .post('/api/auth/login') // Endpoint arbitrário com JSON
            .set('X-Test-Bypass', 'true')
            .send({ email: 'test@test.com', data: massiveString });

        // O erro do Express body-parser para tamanho excedido é 413 Payload Too Large
        assert.strictEqual(res.status, 413, `FALHA: O servidor aceitou um payload gigantesco ou retornou status incorreto. Status: ${res.status}`);
        console.log('   ✅ PASSOU: Servidor rejeitou payload com mais de 100kb.');

        console.log('\n✅ PAYLOAD HARDENING: PASS (Bloqueios de Parsing Ativos).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
