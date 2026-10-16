#!/usr/bin/env node
const { syncGitToChangelog } = require('../backend/services/changelogSyncService');

console.log('🔄 Executando sincronização do Git com o Histórico de Alterações do Sistema...');
try {
    const result = syncGitToChangelog({ maxCommits: 50 });
    if (result.success) {
        if (result.addedCount > 0) {
            console.log(`✅ Sincronização concluída com sucesso: +${result.addedCount} novas alterações adicionadas ao changelog! (Total: ${result.totalChanges})`);
        } else {
            console.log(`✅ Changelog já está 100% atualizado com os commits do Git. (Total: ${result.totalChanges})`);
        }
    } else {
        console.warn(`⚠️ Aviso na sincronização: ${result.error || 'Erro desconhecido'}`);
    }
} catch (err) {
    console.error('❌ Falha ao sincronizar changelog:', err.message);
}
