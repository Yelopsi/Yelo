// backend/scripts/syncPsiNovidades.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { autoCuratePsiChangelog, getPsychologistGroupedEditions } = require('../services/changelogSyncService');

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
    const apply = Boolean(args.apply && !args['dry-run']);
    const days = args.days ? Number(args.days) : 25;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const maxNewItems = args.limit ? Number(args.limit) : 12;

    console.log(`\n🚀 Curadoria Automática de Novidades para Psicólogos (${apply ? 'APLICANDO NO JSON' : 'DRY-RUN'})`);
    const res = await autoCuratePsiChangelog({
        dryRun: !apply,
        sinceDate,
        maxNewItems,
        useAi: !args['no-ai']
    });

    console.log(`📌 Itens curados nesta passagem: ${res.curatedCount}`);
    if (res.curated.length > 0) {
        console.table(res.curated.map(c => ({
            Commit: c.commit || c.id,
            SegundaFeira: c.scheduledMonday,
            Categoria: c.psiCategory,
            Titulo: c.psiTitle,
            Selo: c.impactBadge
        })));
    }

    const editions = getPsychologistGroupedEditions();
    console.log(`\n📚 Total de edições semanais visíveis em psi_novidades / app novidades: ${editions.length}`);
    editions.slice(0, 5).forEach(ed => {
        console.log(`  • ${ed.mondayKey} (${ed.formattedDate}): ${ed.totalAdjustments} itens [${ed.categories.join(', ')}]`);
    });
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Erro em syncPsiNovidades:', err);
    process.exit(1);
});

