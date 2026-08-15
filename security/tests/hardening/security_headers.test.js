const request = require('supertest');
const assert = require('assert');
const app = require('../../../backend/server');

console.log('🔴 INICIANDO HARDENING: SECURITY HEADERS 🔴\n');

const runTests = async () => {
    try {
        // Ignorar banco de dados já que testamos apenas middlewares de borda
        // Necessário X-Forwarded-Proto para o Helmet HSTS ser ativado em conexões locais (proxy)
        const res = await request(app).get('/favicon.ico').set('X-Forwarded-Proto', 'https');
        const headers = res.headers;

        console.log('[HARDENING] Teste A: Helmet / Basic Protections');
        assert.ok(headers['strict-transport-security'], 'FALHA: Strict-Transport-Security (HSTS) não encontrado.');
        assert.ok(headers['x-content-type-options'] === 'nosniff', 'FALHA: X-Content-Type-Options não está correto.');
        assert.ok(!headers['x-powered-by'], 'FALHA: X-Powered-By está exposto.');
        console.log('   ✅ PASSOU: Proteções HTTP estritas ativadas.');

        console.log('[HARDENING] Teste B: Proteção contra Clickjacking e Framing');
        const hasXFrame = headers['x-frame-options'] === 'SAMEORIGIN' || headers['x-frame-options'] === 'DENY';
        const csp = headers['content-security-policy'] || '';
        const hasFrameAncestors = csp.includes("frame-ancestors 'self'");
        assert.ok(hasXFrame || hasFrameAncestors, 'FALHA: Nenhuma proteção contra Clickjacking encontrada.');
        console.log('   ✅ PASSOU: Anti-Clickjacking ativado.');

        console.log('[HARDENING] Teste C: CSP Strict Evaluation');
        assert.ok(csp, 'FALHA: Content-Security-Policy inexistente!');
        assert.ok(!csp.includes("'unsafe-eval'"), "FALHA: A CSP ainda permite 'unsafe-eval' (Risco de XSS gravíssimo).");
        assert.ok(csp.includes("'nonce-"), "FALHA: A CSP não possui nonce injetado dinamicamente.");
        console.log('   ✅ PASSOU: CSP implementada, nonce ativado e unsafe-eval isolado.');

        console.log('\n✅ SECURITY HEADERS: PASS (HSTS, CSP, XCTO, Anti-Clickjacking ativos).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
