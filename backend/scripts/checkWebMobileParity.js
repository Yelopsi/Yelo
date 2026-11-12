// backend/scripts/checkWebMobileParity.js
const { execSync } = require('child_process');

const PARITY_PAIRS = [
    {
        name: 'Assinatura & Promoções',
        web: ['public/psi/psi_assinatura.html', 'public/psi/psi_assinatura.js'],
        mobile: ['mobile/src/app/(tabs)/assinatura.tsx']
    },
    {
        name: 'Blog Clínico',
        web: ['public/psi/psi_blog.html', 'public/psi/psi_blog.js'],
        mobile: ['mobile/src/app/(tabs)/blog.tsx']
    },
    {
        name: 'Fórum da Comunidade',
        web: ['public/psi/psi_forum.html', 'public/psi/psi_forum.js'],
        mobile: ['mobile/src/app/(tabs)/forum.tsx']
    },
    {
        name: 'Jornada & XP',
        web: ['public/psi/psi_jornada.html', 'public/psi/psi_jornada.js'],
        mobile: ['mobile/src/app/(tabs)/jornada.tsx']
    },
    {
        name: 'Novidades da Plataforma',
        web: ['public/psi/psi_novidades.html'],
        mobile: ['mobile/src/app/(tabs)/novidades.tsx']
    },
    {
        name: 'Meu Perfil (Psicólogo)',
        web: ['public/psi/psi_meu_perfil.html', 'public/psi/psi_meu_perfil.js', 'public/psi/psi_perfil_form.js'],
        mobile: ['mobile/src/app/(tabs)/meu_perfil.tsx']
    },
    {
        name: 'Resultados de Match',
        web: ['public/js/resultados.js', 'public/resultados.html'],
        mobile: ['mobile/src/app/resultados.tsx']
    },
    {
        name: 'CRM Psicólogos (Admin)',
        web: ['admin/admin_crm_psicologos.html', 'admin/admin_crm_psicologos.js'],
        mobile: ['mobile/src/app/(admin)/crm-modulo/psicologos.tsx']
    },
    {
        name: 'Dossiê Psicólogo (Admin)',
        web: ['admin/admin_detalhes_psicologo.html', 'admin/admin_detalhes_psicologo.js'],
        mobile: ['mobile/src/app/(admin)/crm-modulo/detalhes-psicologo.tsx']
    }
];

function getChangedFiles(baseRef = 'main') {
    const files = new Set();
    const commands = [
        `git diff --name-only ${baseRef}...HEAD`,
        'git diff --name-only',
        'git diff --name-only --cached'
    ];
    for (const cmd of commands) {
        try {
            const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            out.split('\n').map(s => s.trim()).filter(Boolean).forEach(f => files.add(f));
        } catch (_) {}
    }
    return Array.from(files);
}

function run() {
    const strict = process.argv.includes('--strict');
    const changed = getChangedFiles();

    if (changed.length === 0) {
        console.log('ℹ️ [ParityCheck] Nenhum arquivo modificado comparado à main.');
        process.exit(0);
    }

    const warnings = [];
    for (const pair of PARITY_PAIRS) {
        const webTouched = pair.web.filter(w => changed.includes(w));
        const mobileTouched = pair.mobile.filter(m => changed.includes(m));

        if (webTouched.length > 0 && mobileTouched.length === 0) {
            warnings.push({
                area: pair.name,
                direction: 'Web -> Mobile',
                touched: webTouched.join(', '),
                missingCounterpart: pair.mobile.join(', ')
            });
        } else if (mobileTouched.length > 0 && webTouched.length === 0) {
            warnings.push({
                area: pair.name,
                direction: 'Mobile -> Web',
                touched: mobileTouched.join(', '),
                missingCounterpart: pair.web.join(', ')
            });
        }
    }

    if (warnings.length === 0) {
        console.log('✅ [ParityCheck] Paridade Web ↔ Mobile 100% consistente nas áreas alteradas!');
        process.exit(0);
    }

    console.log('\n⚠️ [ParityCheck] Atenção — alteração detectada em apenas 1 plataforma:');
    console.table(warnings);
    console.log('💡 Confirme se a mudança também precisa ser espelhada na plataforma correspondente acima.');

    if (strict) {
        process.exit(1);
    }
    process.exit(0);
}

run();

