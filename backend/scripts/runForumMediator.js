// backend/scripts/runForumMediator.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const forumMediatorService = require('../services/forumMediatorService');

/**
 * CLI do Mediador IA do Fórum Yelo.
 *
 * Modos de uso:
 *   1) Simulação segura nos tópicos abertos atuais (padrão --dry-run, zero alterações):
 *      node backend/scripts/runForumMediator.js --backfill --limit=40 --dry-run
 *
 *   2) Simulação considerando um Tópico Oficial de Apresentações que ainda será criado:
 *      node backend/scripts/runForumMediator.js --backfill --limit=40 --virtual-intro --dry-run
 *
 *   3) Avaliar um post específico:
 *      node backend/scripts/runForumMediator.js --post-id=746 --dry-run
 *
 *   4) Executar mediação real em lote (somente com --send explícito):
 *      node backend/scripts/runForumMediator.js --backfill --limit=30 --send
 */

function parseArgs(argv) {
    const args = {};
    for (const item of argv.slice(2)) {
        if (item.startsWith('--')) {
            const [k, v] = item.slice(2).split('=');
            args[k] = v === undefined ? true : v;
        }
    }
    return args;
}

async function run() {
    const args = parseArgs(process.argv);
    const isLive = Boolean(args.send && !args['dry-run']);
    const limit = args.limit ? Number(args.limit) : (args.backfill ? 40 : 15);
    const postId = args['post-id'] ? Number(args['post-id']) : null;

    const virtualPresentationHub = args['virtual-intro']
        ? {
            id: args['intro-id'] ? Number(args['intro-id']) : 999999,
            title: args['intro-title'] || '👋 Apresente-se aqui! Bem-vindo(a) à Comunidade Yelo',
            category: 'Sala de Café (Off-topic)',
            isPinned: true
        }
        : null;

    try {
        console.log(`\n🛡️ Mediador IA do Fórum (${isLive ? 'EXECUÇÃO REAL' : 'DRY-RUN SOMENTE LEITURA'}) | Limite: ${limit}${postId ? ` | Post #${postId}` : ''}`);
        const res = await forumMediatorService.runMediatorBatch({
            dryRun: !isLive,
            limit,
            postId,
            includeBackfill: Boolean(args.backfill),
            virtualPresentationHub
        });

        console.log(`\n📊 Pool aberto analisado: ${res.scannedPoolCount} tópicos | Avaliados agora: ${res.evaluatedCount}`);

        const tableRows = res.results.map(r => ({
            ID: r.postId,
            Titulo: String(r.title || '').slice(0, 36),
            Categoria: String(r.currentCategory || '').slice(0, 22),
            Comentarios: r.commentCount,
            Acao: r.action,
            Confianca: r.confidence !== undefined ? Number(r.confidence.toFixed(2)) : '-',
            Destino: r.targetPostId ? `#${r.targetPostId}` : (r.targetCategory ? r.targetCategory.slice(0, 22) : '-'),
            Aplicado: r.applied
        }));
        console.table(tableRows);

        const actionable = res.results.filter(r => r.action !== 'APPROVE');
        if (actionable.length > 0) {
            console.log('\n💬 Detalhamento das ações recomendadas/aplicadas:');
            for (const item of actionable) {
                console.log(`\n--- Post #${item.postId}: "${item.title}" (${item.currentCategory}) ---`);
                console.log(`Ação: ${item.action} | Confiança: ${item.confidence ?? '-'} | Motivo: ${item.reasonSummary || item.error || '-'}`);
                if (item.targetPostId) console.log(`Redirecionar para: #${item.targetPostId}`);
                if (item.targetCategory) console.log(`Mover para categoria: ${item.targetCategory}`);
                if (item.commentMessage) console.log(`Comentário sugerido:\n"${item.commentMessage}"`);
            }
        } else {
            console.log('\n✅ Todos os tópicos avaliados foram aprovados sem necessidade de intervenção.');
        }

        process.exit(0);
    } catch (err) {
        console.error('🔥 Erro no Mediador IA do Fórum:', err);
        process.exit(1);
    }
}

run();
