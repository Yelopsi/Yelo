const assert = require('assert');
const { 
    dtoMessage, 
    dtoMessageStatus, 
    dtoAnnouncement, 
    dtoScraperResult 
} = require('../../../backend/utils/socketDataMinimization');

console.log('🔴 INICIANDO RED TEAM: SOCKET DATA MINIMIZATION 🔴\n');

const runTests = () => {
    try {
        console.log('[RED TEAM] Teste A: Vazamento em Payload de Mensagem (dtoMessage)');
        const bloatedMessage = {
            id: 1,
            content: 'Hello World',
            senderId: 10,
            senha: 'hash_do_banco', // CAMPO PROIBIDO
            internal_id: '999999', // CAMPO PROIBIDO
            createdAt: new Date()
        };

        const safeMessageOutput = dtoMessage(bloatedMessage);
        assert.ok(!safeMessageOutput.senha, 'Vazamento Crítico: Campo senha passou pelo DTO!');
        assert.ok(!safeMessageOutput.internal_id, 'Vazamento: internal_id vazou no DTO!');
        console.log('   ✅ PASSOU: Allowlist do DTO de Mensagem filtrou os campos perigosos.');

        console.log('[RED TEAM] Teste B: Vazamento em Aviso Administrativo (dtoAnnouncement)');
        const bloatedAviso = {
            id: 1,
            title: 'Manutenção',
            content: 'Server down',
            API_KEY: 'abc123xyz', // CAMPO PROIBIDO
        };

        const safeAvisoOutput = dtoAnnouncement(bloatedAviso);
        assert.ok(!safeAvisoOutput.API_KEY, 'Vazamento Crítico: API_KEY passou no DTO!');
        console.log('   ✅ PASSOU: DTO impediu o vazamento da API_KEY no anúncio global.');

        console.log('[RED TEAM] Teste C: Payload Válido passa intacto');
        const safeMessage = {
            id: 1, content: 'Oi', senderId: 5, senderType: 'patient', conversationId: 10, createdAt: new Date()
        };
        const result = dtoMessage(safeMessage);
        assert.strictEqual(result.id, 1);
        assert.ok(!result.senha);
        console.log('   ✅ PASSOU: Mensagem segura processada sem erros.');

        console.log('\n✅ SOCKET DATA MINIMIZATION: PASS (Allowlist & Filtro Ativos).');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
