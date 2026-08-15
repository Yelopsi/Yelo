const assert = require('assert');
const { limiterInstance, checkConnectionRateLimit, checkEventRateLimit } = require('../../../backend/utils/socketRateLimiter');

console.log('🔴 INICIANDO RED TEAM: SOCKET FLOOD & RATE LIMITING 🔴\n');

const mockSocket = (userId) => ({
    id: `socket_${Math.random()}`,
    user: { id: userId },
    handshake: { headers: {}, address: '192.168.0.1' }
});

const runTests = () => {
    try {
        console.log('[RED TEAM] Teste A: Connection Flood (Handshake limits)');
        let failures = 0;
        const fakeNext = (err) => { if (err) failures++; };

        // Simulando 35 conexões do mesmo IP em menos de 10s (Limite: 30)
        for (let i = 0; i < 35; i++) {
            checkConnectionRateLimit('192.168.0.99', fakeNext);
        }

        assert.strictEqual(failures, 5, `FALHA: O Rate Limiter deveria ter bloqueado exatamente 5 conexões (35 - 30 permitidas), mas bloqueou ${failures}`);
        console.log('   ✅ PASSOU: Flood de conexão contido após estourar a cota.');

        console.log('[RED TEAM] Teste B: Admin Action Event Limiter');
        const adminSocket = mockSocket(1);
        let adminAllowed = 0;
        
        // Simulando 10 disparos de admin_sent_message (Limite: 5)
        for (let i = 0; i < 10; i++) {
            if (checkEventRateLimit(adminSocket, 'admin_sent_message')) adminAllowed++;
        }
        
        assert.strictEqual(adminAllowed, 5, `FALHA: O Rate limiter de Admin permitiu ${adminAllowed} eventos em vez de 5.`);
        console.log('   ✅ PASSOU: Rate Limiter bloqueou disparos administrativos agressivos.');

        console.log('[RED TEAM] Teste C: Memory Leak Defense (TTL Cleanup)');
        // Simulamos milhares de conexões
        for (let i = 0; i < 5000; i++) {
            checkConnectionRateLimit(`ip_${i}`, fakeNext);
        }
        assert.strictEqual(limiterInstance.limiters.get('connection_ip').size, 5001, 'Tamanho do mapa de IPs falhou');
        
        // Forçamos o Reset Time de todas para o passado
        const store = limiterInstance.limiters.get('connection_ip');
        for (const record of store.values()) {
            record.resetTime = Date.now() - 1000; 
        }
        
        // Rodamos a limpeza de memória
        limiterInstance.cleanup();
        assert.strictEqual(limiterInstance.limiters.get('connection_ip').size, 0, 'Memory Leak Encontrado! Limpeza falhou.');
        console.log('   ✅ PASSOU: Coleta de lixo em memória varreu chaves expiradas corretamente.');

        console.log('[RED TEAM] Teste D: Reconnect Testing');
        // Se um usuário desconecta e conecta, não deve estar bloqueado permanentemente
        const normalSocket = mockSocket(99);
        const isAllowedBefore = checkEventRateLimit(normalSocket, 'messages_read'); // Permite 30
        assert.strictEqual(isAllowedBefore, true);
        
        // Forçamos expiração manual de 5s simulando que ele demorou a reconectar
        limiterInstance.limiters.get('event_messages_read').get(`user_99`).resetTime = Date.now() - 1000;
        
        // Simula reconnect
        const isAllowedAfterReconnect = checkEventRateLimit(normalSocket, 'messages_read');
        assert.strictEqual(isAllowedAfterReconnect, true, 'Reconexão legítima foi bloqueada indevidamente.');
        console.log('   ✅ PASSOU: Reconnect não é punido indevidamente.');


        console.log('\n✅ SOCKET RATE LIMITING: PASS (Memory-safe e Bounded State).');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
