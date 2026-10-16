const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CHANGELOG_PATH = path.resolve(__dirname, '../data/system_changelog.json');
const REPO_ROOT = path.resolve(__dirname, '../../');

// Cache em memória para evitar I/O repetitivo e execuções desnecessárias de processos no Render
let cachedData = null;
let cachedETag = null;
let lastSyncTimestamp = 0;
const SYNC_THROTTLE_MS = 15 * 60 * 1000; // 15 minutos de throttle

function getChangelogETag() {
    try {
        if (fs.existsSync(CHANGELOG_PATH)) {
            const stat = fs.statSync(CHANGELOG_PATH);
            return `W/"${stat.size}-${Math.round(stat.mtimeMs)}"`;
        }
    } catch (e) {}
    return null;
}

function parseGitCommitMessage(rawMessage) {
    let clean = rawMessage.trim();
    let type = 'feat';
    let scope = '';
    let description = clean;

    const match = clean.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?:\s*(.+)$/);
    if (match) {
        type = match[1].toLowerCase();
        scope = match[2] ? match[2].trim() : '';
        description = match[3].trim();
    }

    return { type, scope, description, raw: rawMessage };
}

function inferCategoryAndBadge(parsed, files) {
    const text = `${parsed.type} ${parsed.scope} ${parsed.description} ${files.join(' ')}`.toLowerCase();

    if (text.includes('billing') || text.includes('asaas') || text.includes('payment') || text.includes('fatura') || text.includes('pagamento')) {
        return { category: 'Billing & Asaas', badgeColor: '#10b981' };
    }
    if (text.includes('crm') || text.includes('whatsapp') || text.includes('mensageria') || text.includes('follow-up')) {
        return { category: 'CRM & Mensageria', badgeColor: '#8b5cf6' };
    }
    if (text.includes('match') || text.includes('matchengine')) {
        return { category: 'Motor de Match', badgeColor: '#3b82f6' };
    }
    if (text.includes('trial') || text.includes('plano') || text.includes('subscription')) {
        return { category: 'Planos & Trial', badgeColor: '#f59e0b' };
    }
    if (text.includes('refund') || text.includes('estorno') || text.includes('financeiro')) {
        return { category: 'Financeiro & Estornos', badgeColor: '#ef4444' };
    }
    if (text.includes('security') || text.includes('gate') || text.includes('sast') || text.includes('idor') || text.includes('bola')) {
        return { category: 'Segurança & Infra', badgeColor: '#64748b' };
    }
    if (text.includes('auth') || text.includes('jwt') || text.includes('login') || text.includes('token')) {
        return { category: 'Segurança & Autenticação', badgeColor: '#0ea5e9' };
    }
    if (text.includes('cache') || text.includes('perf') || text.includes('performance')) {
        return { category: 'Performance & Cache', badgeColor: '#059669' };
    }
    if (text.includes('analytics') || text.includes('cmo') || text.includes('grafico') || text.includes('chart') || text.includes('metas')) {
        return { category: 'Analytics & Métricas', badgeColor: '#6366f1' };
    }
    if (text.includes('admin') || files.some(f => f.startsWith('admin/'))) {
        return { category: 'Admin & Plataforma', badgeColor: '#0284c7' };
    }

    return { category: 'Melhorias do Sistema', badgeColor: '#1B4332' };
}

function formatTitle(parsed) {
    let prefix = '';
    switch (parsed.type) {
        case 'fix': prefix = 'Correção: '; break;
        case 'feat': prefix = 'Novo: '; break;
        case 'perf': prefix = 'Otimização: '; break;
        case 'refactor': prefix = 'Refatoração: '; break;
        case 'style': prefix = 'Interface: '; break;
        case 'chore': prefix = 'Manutenção: '; break;
        default: prefix = ''; break;
    }

    let desc = parsed.description;
    if (desc) {
        desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    }
    if (parsed.scope && !desc.toLowerCase().includes(parsed.scope.toLowerCase())) {
        return `${prefix}${desc} (${parsed.scope})`;
    }
    return `${prefix}${desc}`;
}

/**
 * Sincroniza commits recentes do Git diretamente para o system_changelog.json
 * Preserva itens cadastrados manualmente e evita qualquer duplicidade.
 */
function syncGitToChangelog(options = { maxCommits: 30, force: false }) {
    const now = Date.now();
    if (!options.force && (now - lastSyncTimestamp < SYNC_THROTTLE_MS) && cachedData) {
        return { success: true, addedCount: 0, totalChanges: cachedData.changes.length, throttled: true };
    }
    lastSyncTimestamp = now;

    let existingChanges = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            existingChanges = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            console.error('Erro ao ler system_changelog.json para sync:', e);
            existingChanges = [];
        }
    }

    const catalogedCommits = new Set();
    existingChanges.forEach(item => {
        if (item.commit && item.commit !== 'manual') {
            catalogedCommits.add(item.commit.toLowerCase().trim());
        }
        if (item.id && item.id.startsWith('change-git-')) {
            catalogedCommits.add(item.id.replace('change-git-', '').toLowerCase().trim());
        }
    });

    let rawLog = '';
    try {
        rawLog = execSync(`git log -n ${options.maxCommits || 30} --pretty=format:"%h||%an||%ad||%s" --date=iso`, {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 4000
        });
    } catch (gitErr) {
        // Em ambiente Render/container sem .git, utiliza os dados já pré-compilados do JSON
        return { success: true, addedCount: 0, totalChanges: existingChanges.length, note: 'Ambiente de container isolado' };
    }

    const commitLines = rawLog.split('\n').filter(Boolean);
    const newEntries = [];

    for (const line of commitLines) {
        const [hash, author, dateStr, message] = line.split('||');
        if (!hash || !message) continue;

        const cleanHash = hash.trim().toLowerCase();
        if (catalogedCommits.has(cleanHash)) {
            continue;
        }

        if (message.startsWith('Merge branch') || message.startsWith('Merge pull request')) {
            continue;
        }

        let files = [];
        try {
            const filesRaw = execSync(`git show --name-only --format="" ${cleanHash}`, {
                cwd: REPO_ROOT,
                encoding: 'utf8',
                timeout: 2500
            });
            files = filesRaw.split('\n').map(s => s.trim()).filter(Boolean);
        } catch (e) {
            files = [];
        }

        if (files.length === 1 && files[0].includes('system_changelog.json')) {
            continue;
        }

        const parsed = parseGitCommitMessage(message);
        const { category, badgeColor } = inferCategoryAndBadge(parsed, files);
        const title = formatTitle(parsed);

        let isoDate = new Date().toISOString();
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) isoDate = d.toISOString();
        } catch (e) {}

        const entry = {
            id: `change-git-${cleanHash}`,
            date: isoDate,
            commit: cleanHash,
            author: author || 'Anderson',
            title: title,
            category: category,
            badgeColor: badgeColor,
            status: 'Em Produção',
            summary: parsed.description || message,
            description: `Commit registrado no repositório: "${message}". Arquivos modificados: ${files.slice(0, 5).join(', ')}${files.length > 5 ? ` (+${files.length - 5} arquivos)` : ''}.`,
            rationale: `Atualização contínua implementada na branch principal para evolução e estabilidade da plataforma.`,
            before: {
                "estado_anterior": `Versão anterior ao commit #${cleanHash}`
            },
            after: {
                "nova_versao": parsed.description || message
            },
            metricsToCompare: [],
            filesChanged: files
        };

        newEntries.push(entry);
        catalogedCommits.add(cleanHash);
    }

    let finalChanges = existingChanges;
    if (newEntries.length > 0) {
        finalChanges = [...existingChanges, ...newEntries];
        finalChanges.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        try {
            fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(finalChanges, null, 2), 'utf8');
        } catch (writeErr) {
            console.error('Erro ao salvar system_changelog.json após sync:', writeErr);
        }
    }

    // Invalida cache de dados
    cachedData = null;
    cachedETag = null;

    return {
        success: true,
        addedCount: newEntries.length,
        totalChanges: finalChanges.length
    };
}

/**
 * Retorna os dados em memória do changelog com commits recentes
 * Usado pelo controller com ETag para economizar 100% de banda de egress no Render
 */
function getCachedOrFreshChangelog() {
    const currentETag = getChangelogETag();
    if (cachedData && cachedETag === currentETag) {
        return cachedData;
    }

    let changes = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            changes = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            changes = [];
        }
    }

    // Lista enxuta de commits recentes (máximo 15)
    let recentCommits = [];
    try {
        const rawGitLog = execSync('git log -n 15 --pretty=format:"%h||%an||%ad||%s" --date=iso', {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 2500
        });
        recentCommits = rawGitLog.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, message] = line.split('||');
            return { hash, author, date, message };
        });
    } catch (e) {}

    cachedData = {
        success: true,
        changes,
        recentCommits
    };
    cachedETag = currentETag;

    return cachedData;
}

module.exports = {
    syncGitToChangelog,
    getCachedOrFreshChangelog,
    getChangelogETag,
    CHANGELOG_PATH
};
