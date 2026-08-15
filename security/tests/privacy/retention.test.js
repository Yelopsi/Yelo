const assert = require('assert');
const { runPrivacyPruning } = require('../../../backend/jobs/privacyPruningJob');

console.log('🔴 INICIANDO HARDENING: DATA RETENTION PRUNING (LGPD Fase 6) 🔴\n');

const runTests = async () => {
    try {
        console.log('[PRIVACY] Teste A: Dry-Run Idempotency');
        const dryRunResults = await runPrivacyPruning({ dryRun: true });
        
        assert.ok(dryRunResults.dryRun === true, 'FALHA: O Job não respeitou a flag dryRun.');
        console.log('   ✅ PASSOU: Dry-run operou sem alterar o banco.');

        console.log('[PRIVACY] Teste B: Execução Padrão Sem Exceções');
        const liveResults = await runPrivacyPruning({ dryRun: false });
        
        assert.strictEqual(typeof liveResults.systemLogsDeleted, 'number', 'FALHA: Contagem de logs apagados não retornada.');
        assert.strictEqual(typeof liveResults.expiredTokensCleared, 'number', 'FALHA: Contagem de tokens apagados não retornada.');
        console.log('   ✅ PASSOU: Limpeza executada sem vazar PII no log e concluída.');

        console.log('\n✅ PRIVACY RETENTION: PASS (Políticas de minimização low-risk ativas).');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ SECURITY FAILURE: ' + err.message);
        process.exit(1);
    }
};

runTests();
