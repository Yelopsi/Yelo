const assert = require('assert');
const { initLogSanitizer, sanitizeObject } = require('../../../backend/utils/logger');

console.log('🔴 INICIANDO HARDENING: LOG SANITIZATION 🔴\n');

const runTests = () => {
    try {
        console.log('[HARDENING] Teste A: Sanitização de Payload (Objeto JS)');
        
        const dirtyPayload = {
            user: 'test',
            password: 'mySecretPassword123!',
            cpf: '123.456.789-00',
            settings: {
                jwt_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
            }
        };

        const cleanPayload = sanitizeObject(dirtyPayload);

        assert.ok(cleanPayload.password === '[REDACTED_BY_SECURITY_LOGGER]', 'FALHA: A senha não foi ocultada.');
        assert.ok(cleanPayload.cpf === '[REDACTED_BY_SECURITY_LOGGER]', 'FALHA: O CPF não foi ocultado.');
        assert.ok(cleanPayload.settings.jwt_token === '[REDACTED_BY_SECURITY_LOGGER]', 'FALHA: O JWT não foi ocultado.');
        assert.ok(cleanPayload.user === 'test', 'FALHA: Dados inocentes foram apagados.');
        
        console.log('   ✅ PASSOU: PII e Credenciais mascaradas no objeto JSON.');

        console.log('\n✅ LOG SANITIZATION: PASS (Proteção ativa).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
