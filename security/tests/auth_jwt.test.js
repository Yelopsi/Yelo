const jwt = require('jsonwebtoken');
const assert = require('assert');

console.log('  🔍 Iniciando Testes de Regressão: Autenticação & JWT...');

// Simula a chave que a aplicação possui em runtime (process.env.JWT_SECRET)
const REAL_SECRET = process.env.JWT_SECRET || 'test_secret_key_12345';
const FAKE_SECRET = 'hacked_fake_secret_key';

let hasFailed = false;

// Helpers de validação idênticos ao middleware
const verifyToken = (token) => {
    return jwt.verify(token, REAL_SECRET);
};

try {
    // TESTE 1: Assinatura Inválida (Modificado no trânsito)
    console.log('    [Test] Token adulterado (Assinatura Inválida)');
    const validToken = jwt.sign({ id: 1, type: 'patient' }, REAL_SECRET);
    const tamperedToken = validToken.slice(0, -5) + 'abcde';
    try {
        verifyToken(tamperedToken);
        console.error('    ❌ FALHA: Token adulterado foi aceito!');
        hasFailed = true;
    } catch (e) {
        if (e.name === 'JsonWebTokenError') console.log('    ✅ PASSOU: Token adulterado rejeitado corretamente.');
        else { console.error(e); hasFailed = true; }
    }

    // TESTE 2: Expirado
    console.log('    [Test] Token Expirado');
    const expiredToken = jwt.sign({ id: 1, type: 'patient' }, REAL_SECRET, { expiresIn: '-1h' });
    try {
        verifyToken(expiredToken);
        console.error('    ❌ FALHA: Token expirado foi aceito!');
        hasFailed = true;
    } catch (e) {
        if (e.name === 'TokenExpiredError') console.log('    ✅ PASSOU: Token expirado rejeitado corretamente.');
        else { console.error(e); hasFailed = true; }
    }

    // TESTE 3: Algoritmo None
    console.log('    [Test] Algoritmo none (Bypass JWT)');
    // A biblioteca jsonwebtoken > 8.0 bloqueia alg: none por padrão, mas forçamos para verificar
    const noneToken = jwt.sign({ id: 1, type: 'admin' }, REAL_SECRET, { algorithm: 'none' });
    try {
        verifyToken(noneToken);
        console.error('    ❌ FALHA: Token com alg:none foi aceito!');
        hasFailed = true;
    } catch (e) {
        console.log('    ✅ PASSOU: Token alg:none rejeitado corretamente.');
    }

    // TESTE 4: Secret Incorreto (Cross-Environment)
    console.log('    [Test] Secret Incorreto (Outro Ambiente)');
    const fakeToken = jwt.sign({ id: 1, type: 'admin' }, FAKE_SECRET);
    try {
        verifyToken(fakeToken);
        console.error('    ❌ FALHA: Token assinado com chave errada foi aceito!');
        hasFailed = true;
    } catch (e) {
         console.log('    ✅ PASSOU: Token com secret incorreto rejeitado corretamente.');
    }

} catch (globalErr) {
    console.error('    ❌ Erro fatal durante a suíte de testes de Auth:', globalErr);
    hasFailed = true;
}

if (hasFailed) {
    process.exit(1);
} else {
    process.exit(0);
}
