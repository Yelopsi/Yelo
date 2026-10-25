const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PRIMARY_CHANGELOG_PATH = path.resolve(__dirname, '../.data/system_changelog.json');
const FALLBACK_CHANGELOG_PATH = path.resolve(__dirname, '../data/system_changelog.json');

// Garante que o diretório .data existe
const DATA_DIR = path.resolve(__dirname, '../.data');
if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

// Se o arquivo em .data ainda não existe, inicializa a partir de ../data/system_changelog.json
if (!fs.existsSync(PRIMARY_CHANGELOG_PATH) && fs.existsSync(FALLBACK_CHANGELOG_PATH)) {
    try {
        fs.copyFileSync(FALLBACK_CHANGELOG_PATH, PRIMARY_CHANGELOG_PATH);
    } catch (e) {}
}

// Em desenvolvimento, o arquivo em .data evita reinicializações indesejadas pelo nodemon
const CHANGELOG_PATH = PRIMARY_CHANGELOG_PATH;
const REPO_ROOT = path.resolve(__dirname, '../../');

function saveChangelogFile(changes) {
    try {
        fs.writeFileSync(PRIMARY_CHANGELOG_PATH, JSON.stringify(changes, null, 2), 'utf8');
        if (process.env.NODE_ENV === 'production') {
            try {
                fs.writeFileSync(FALLBACK_CHANGELOG_PATH, JSON.stringify(changes, null, 2), 'utf8');
            } catch (e) {}
        }
    } catch (err) {
        console.error('Erro ao salvar system_changelog.json:', err);
        throw err;
    }

    // Persiste também no PostgreSQL (garante sobrevivência a redeploys e resets no Render)
    try {
        const db = require('../models');
        if (db && db.SystemSetting) {
            db.SystemSetting.findOne().then(setting => {
                if (setting) {
                    setting.update({ system_changelog_data: JSON.stringify(changes) }).catch(() => {});
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

let dbSyncAttempted = false;
function syncFromDatabaseIfAvailable() {
    if (dbSyncAttempted) return;
    try {
        const db = require('../models');
        if (db && db.SystemSetting) {
            dbSyncAttempted = true;
            db.SystemSetting.findOne().then(setting => {
                if (setting && setting.system_changelog_data) {
                    try {
                        const dbChanges = JSON.parse(setting.system_changelog_data);
                        if (Array.isArray(dbChanges) && dbChanges.length > 0) {
                            let localChanges = [];
                            if (fs.existsSync(CHANGELOG_PATH)) {
                                try { localChanges = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8')); } catch (e) {}
                            }
                            const dbMap = new Map(dbChanges.map(c => [String(c.id), c]));
                            let modified = false;
                            localChanges.forEach(item => {
                                const dbItem = dbMap.get(String(item.id));
                                if (dbItem && dbItem.publishedToPsi !== undefined && dbItem.publishedToPsi !== item.publishedToPsi) {
                                    item.publishedToPsi = dbItem.publishedToPsi;
                                    if (dbItem.scheduledFriday) item.scheduledFriday = dbItem.scheduledFriday;
                                    if (dbItem.psiTitle) item.psiTitle = dbItem.psiTitle;
                                    if (dbItem.psiSummary) item.psiSummary = dbItem.psiSummary;
                                    if (dbItem.psiCategory) item.psiCategory = dbItem.psiCategory;
                                    if (dbItem.impactBadge) item.impactBadge = dbItem.impactBadge;
                                    modified = true;
                                }
                            });
                            if (modified) {
                                fs.writeFileSync(PRIMARY_CHANGELOG_PATH, JSON.stringify(localChanges, null, 2), 'utf8');
                                cachedData = null;
                                cachedETag = null;
                            }
                        }
                    } catch (parseErr) {}
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

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
            saveChangelogFile(finalChanges);
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
    syncFromDatabaseIfAvailable();
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

/**
 * Atualiza um item do changelog existente pelo ID
 */
function updateChangelogEntry(id, updates = {}) {
    if (!id) throw new Error('ID do item de changelog é obrigatório.');

    let changes = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            changes = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            changes = [];
        }
    }

    const index = changes.findIndex(item => String(item.id) === String(id));
    if (index === -1) {
        return null;
    }

    const current = changes[index];
    const updated = {
        ...current,
        title: updates.title !== undefined ? String(updates.title).trim() : current.title,
        category: updates.category !== undefined ? String(updates.category).trim() : current.category,
        summary: updates.summary !== undefined ? String(updates.summary).trim() : current.summary,
        description: updates.description !== undefined ? String(updates.description).trim() : current.description,
        rationale: updates.rationale !== undefined ? String(updates.rationale).trim() : current.rationale,
        before: updates.before !== undefined ? updates.before : current.before,
        after: updates.after !== undefined ? updates.after : current.after,
        badgeColor: updates.badgeColor || current.badgeColor || '#1B4332',
        // Campos de exibição pública para Psicólogos
        publishedToPsi: updates.publishedToPsi !== undefined ? Boolean(updates.publishedToPsi) : Boolean(current.publishedToPsi),
        psiTitle: updates.psiTitle !== undefined ? (updates.psiTitle ? String(updates.psiTitle).trim() : null) : (current.psiTitle || null),
        psiSummary: updates.psiSummary !== undefined ? (updates.psiSummary ? String(updates.psiSummary).trim() : null) : (current.psiSummary || null),
        psiCategory: updates.psiCategory !== undefined ? (updates.psiCategory ? String(updates.psiCategory).trim() : null) : (current.psiCategory || null),
        impactBadge: updates.impactBadge !== undefined ? (updates.impactBadge ? String(updates.impactBadge).trim() : null) : (current.impactBadge || null),
        updatedAt: new Date().toISOString()
    };

    changes[index] = updated;

    try {
        saveChangelogFile(changes);
    } catch (err) {
        console.error('Erro ao salvar system_changelog.json na atualização:', err);
        throw err;
    }

    // Invalida cache em memória
    cachedData = null;
    cachedETag = null;

    return updated;
}

/**
 * Remove um item do changelog existente
 */
function deleteChangelogEntry(id) {
    if (!id) throw new Error('ID do item de changelog é obrigatório.');

    let changes = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            changes = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            changes = [];
        }
    }

    const initialLength = changes.length;
    changes = changes.filter(item => String(item.id) !== String(id));

    if (changes.length === initialLength) {
        return false;
    }

    try {
        saveChangelogFile(changes);
    } catch (err) {
        console.error('Erro ao salvar system_changelog.json na exclusão:', err);
        throw err;
    }

    cachedData = null;
    cachedETag = null;

    return true;
}

/**
 * Alterna a visibilidade do item para os psicólogos (publicar/ocultar)
 */
function togglePsiVisibility(id, forceValue = null) {
    let changes = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            changes = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            changes = [];
        }
    }

    const item = changes.find(c => String(c.id) === String(id));
    if (!item) return null;

    const newValue = forceValue !== null ? Boolean(forceValue) : !item.publishedToPsi;
    item.publishedToPsi = newValue;
    item.updatedAt = new Date().toISOString();

    if (newValue) {
        // Ao autorizar, agenda para a segunda-feira de lançamento (ou hoje se for segunda)
        if (!item.scheduledMonday && !item.scheduledFriday) {
            item.scheduledMonday = getWeeklyMondayReleaseDate();
        }
        item.authorizedAt = new Date().toISOString();

        // Garante que tenha título amigável de melhoria se ainda for cru/técnico
        if (!item.psiTitle || item.psiTitle.toLowerCase().startsWith('correção:') || item.psiTitle.toLowerCase().startsWith('fix:')) {
            const friendly = getFriendlyPsiCopyForFix(item);
            item.psiTitle = friendly.psiTitle;
            item.psiSummary = item.psiSummary || friendly.psiSummary;
            item.psiCategory = item.psiCategory || friendly.psiCategory;
            item.impactBadge = item.impactBadge || friendly.impactBadge;
        }
    }

    try {
        saveChangelogFile(changes);
    } catch (err) {
        console.error('Erro ao alternar visibilidade no changelog:', err);
        throw err;
    }

    cachedData = null;
    cachedETag = null;

    return item;
}

/**
 * Calcula a data da próxima (ou atual) segunda-feira para o lote de lançamentos da semana
 */
function getWeeklyMondayReleaseDate(baseDate = new Date()) {
    const d = new Date(baseDate);
    const day = d.getDay(); // 0: Dom, 1: Seg, 2: Ter, 3: Qua, 4: Qui, 5: Sex, 6: Sab
    let diffDays = 0;
    if (day === 1) {
        diffDays = 0; // Se hoje é segunda, o lote é hoje!
    } else if (day === 0) {
        diffDays = 1; // Domingo: amanhã é segunda
    } else {
        diffDays = 8 - day; // Terça a sábado: próxima segunda
    }
    d.setDate(d.getDate() + diffDays);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
}

function getWeeklyFridayReleaseDate(baseDate = new Date()) {
    return getWeeklyMondayReleaseDate(baseDate);
}

/**
 * Converte fixes técnicos e ajustes de bugs em melhorias amigáveis de usabilidade
 */
function getFriendlyPsiCopyForFix(entry) {
    const text = `${entry.title || ''} ${entry.summary || ''} ${entry.category || ''} ${(entry.filesChanged || []).join(' ')}`.toLowerCase();
    
    if (text.includes('match') || text.includes('distribui')) {
        return {
            psiTitle: "Melhorias no algoritmo de match",
            psiCategory: "Match & Pacientes",
            impactBadge: "Otimização ⚡",
            psiSummary: "Aprimoramos o direcionamento e a distribuição de pacientes para garantir conexões clínicas ainda mais assertivas com sua disponibilidade."
        };
    }
    if (text.includes('mobile') || text.includes('safari') || text.includes('iphone') || text.includes('android') || text.includes('scroll') || text.includes('touch')) {
        return {
            psiTitle: "Aprimoramentos na experiência mobile",
            psiCategory: "Usabilidade & Plataforma",
            impactBadge: "Usabilidade 🚀",
            psiSummary: "Ajustes contínuos de navegação, visualização e responsividade para tornar o uso do painel ainda mais rápido e fluido no celular."
        };
    }
    if (text.includes('forum') || text.includes('comunidade')) {
        return {
            psiTitle: "Ajustes finos no Fórum da Comunidade",
            psiCategory: "Fórum & Comunidade",
            impactBadge: "Usabilidade 🚀",
            psiSummary: "Melhorias contínuas na leitura, formatação e interação entre colegas dentro do fórum."
        };
    }
    if (text.includes('review') || text.includes('avali')) {
        return {
            psiTitle: "Aprimoramentos nas avaliações do perfil",
            psiCategory: "Perfil & Pacientes",
            impactBadge: "Aprimoramento 🚀",
            psiSummary: "Aprimoramos a experiência e a estabilidade do envio de avaliações e depoimentos no perfil público, garantindo funcionamento fluido e intuitivo para os pacientes em qualquer smartphone."
        };
    }
    if (text.includes('perfil') || text.includes('foto') || text.includes('slug')) {
        return {
            psiTitle: "Melhorias visuais no perfil profissional",
            psiCategory: "Perfil & Pacientes",
            impactBadge: "Aprimoramento 🚀",
            psiSummary: "Ajustes na apresentação e no carregamento da sua página pública para os pacientes."
        };
    }
    if (text.includes('crm') || text.includes('whatsapp') || text.includes('paciente') || text.includes('contato')) {
        return {
            psiTitle: "Ajustes de usabilidade no consultório",
            psiCategory: "Consultório & Gestão",
            impactBadge: "Aprimoramento 🚀",
            psiSummary: "Aprimoramentos práticos no acompanhamento de contatos e na organização da sua rotina clínica."
        };
    }

    return {
        psiTitle: "Outros ajustes de usabilidade",
        psiCategory: "Novidades da Plataforma",
        impactBadge: "Melhoria Contínua 🌟",
        psiSummary: "Ajustes contínuos de estabilidade, usabilidade e navegação para manter sua experiência impecável na Yelo."
    };
}

/**
 * Gera texto acolhedor e atrativo para psicólogos a partir de dados técnicos usando IA
 */
async function generateAiPsiCopy(entry) {
    if (!process.env.GEMINI_API_KEY) {
        // Fallback inteligente sem IA usando o conversor de fixes em melhorias
        return getFriendlyPsiCopyForFix(entry);
    }

    try {
        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        const prompt = `Você é o Redator de Produto (UX Writer) da Yelo, uma plataforma voltada a psicólogos clínicos.
Sua missão é transformar um commit/ajuste técnico em uma NOTA DE ATUALIZAÇÃO amigável, acolhedora e que encante os psicólogos assinantes da plataforma, mostrando que a equipe está constantemente trabalhando e ouvindo os profissionais.

REGRA DE OURO 1 (NUNCA DIGA BUG/CORREÇÃO): NUNCA diga que algo era um bug, erro, pane, quebra ou conserto de problema.
Se a alteração técnica for uma correção de bug ou ajuste de elemento existente, transforme SEMPRE em melhoria positiva, usando títulos acolhedores como:
- "Outros ajustes de usabilidade"
- "Melhorias no algoritmo de match"
- "Aprimoramentos na experiência mobile"
- "Ajustes finos no Fórum da Comunidade"
- "Ajustes de usabilidade no consultório"

REGRA DE OURO 2 (NÃO FINJA QUE ALGO EXISTENTE É NOVO): 
- NUNCA trate um ajuste ou melhoria de uma funcionalidade que JÁ EXISTIA como se fosse algo totalmente novo ("Novo Recurso ✨").
- Por exemplo: avaliações de pacientes, links no fórum, botões ou telas mobile já existiam. Se receberam melhorias ou correções, use o selo "Aprimoramento 🚀" ou "Melhoria de Usabilidade 📱".
- No resumo, diga "Aprimoramos...", "Refinamos...", "Melhoramos a estabilidade de..." em vez de "Agora você pode...".
- Reserve o selo "Novo Recurso ✨" ESTRITAMENTE para funcionalidades inéditas criadas do zero.

DADOS TÉCNICOS DA MODIFICAÇÃO:
- Título técnico: "${entry.title || ''}"
- Categoria técnica: "${entry.category || ''}"
- Resumo técnico: "${entry.summary || ''}"
- Racional / Motivo: "${entry.rationale || ''}"
- Descrição: "${entry.description || ''}"

DIRETRIZES DO TEXTO PARA OS PSICÓLOGOS:
1. "psiTitle": Um título cativante, profissional e simples (ex: "Outros ajustes de usabilidade", "Melhorias no algoritmo de match", "Aprimoramentos nas avaliações do perfil"). Máximo 60 caracteres.
2. "psiSummary": Um parágrafo curto (2 a 3 frases) explicando de forma clara e acolhedora O BENEFÍCIO prático para o psicólogo. Nunca use jargões técnicos de desenvolvedor.
3. "psiCategory": Escolha a melhor opção entre: "Fórum & Comunidade", "Perfil & Pacientes", "Consultório & Gestão", "Novidades da Plataforma".
4. "impactBadge": Escolha entre: "Aprimoramento 🚀", "Melhoria de Usabilidade 📱", "Otimização ⚡", "Gestão Clínica 💼", "Inteligência Artificial 🧠", "Melhoria Contínua 🌟" (Use "Novo Recurso ✨" apenas se for algo 100% inédito).

Responda ESTRITAMENTE em formato JSON puro, sem markdown nem crases:
{
  "psiTitle": "...",
  "psiSummary": "...",
  "psiCategory": "...",
  "impactBadge": "..."
}`;

        const candidateModels = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash"];
        let rawText = '';
        for (const modelName of candidateModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName, safetySettings });
                const res = await model.generateContent(prompt);
                rawText = res.response.text();
                if (rawText) break;
            } catch (err) {
                console.warn(`[Changelog AI] Modelo ${modelName} falhou: ${err.message}`);
            }
        }

        const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
            psiTitle: parsed.psiTitle || entry.title,
            psiSummary: parsed.psiSummary || entry.summary,
            psiCategory: parsed.psiCategory || 'Novidades da Plataforma',
            impactBadge: parsed.impactBadge || 'Novo Recurso ✨'
        };
    } catch (e) {
        console.warn('Falha na geração com IA do changelog para psicólogos, usando fallback:', e.message);
        return {
            psiTitle: (entry.title || '').replace(/^(Novo|Correção|Otimização|Refatoração|Interface|Manutenção):\s*/i, ''),
            psiSummary: entry.summary || 'Realizamos melhorias na plataforma para aperfeiçoar sua experiência.',
            psiCategory: 'Novidades da Plataforma',
            impactBadge: 'Melhoria Contínua 🚀'
        };
    }
}

/**
 * Retorna exclusivamente os registros aprovados para exibição aos psicólogos
 */
function getPsychologistChangelog() {
    syncFromDatabaseIfAvailable();
    let changes = [];
    if (fs.existsSync(CHANGELOG_PATH)) {
        try {
            changes = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
        } catch (e) {
            changes = [];
        }
    }

    const now = new Date();

    const psiList = changes
        .filter(item => {
            if (!item || !(item.publishedToPsi === true || item.publishedToPsi === 'true')) {
                return false;
            }

            // Regra: Disponibilizado apenas na data agendada com os ajustes da semana
            const scheduledDate = item.scheduledMonday || item.scheduledFriday;
            if (scheduledDate) {
                const releaseDate = new Date(scheduledDate);
                if (releaseDate > now) {
                    return false; // Permanece oculto até a data agendada
                }
            }

            // Regra estrita: nunca exibe com título cru de bugfix técnico não tratado
            const title = (item.psiTitle || item.title || '').toLowerCase();
            if (title.startsWith('correção:') || title.startsWith('fix:') || title.startsWith('chore:') || title.startsWith('manutenção:')) {
                return false;
            }

            return true;
        })
        .map(item => ({
            id: item.id,
            date: item.scheduledMonday || item.scheduledFriday || item.date,
            title: item.psiTitle || item.title,
            summary: item.psiSummary || item.summary,
            category: item.psiCategory || item.category || 'Novidades da Plataforma',
            impactBadge: item.impactBadge || 'Melhoria Contínua 🚀',
            badgeColor: item.badgeColor || '#1B4332',
            ctaLink: item.ctaLink || null,
            ctaText: item.ctaText || null,
            releaseBatch: (item.scheduledMonday || item.scheduledFriday) ? `Ajustes da Semana • Segunda-feira` : 'Melhorias Recentes'
        }))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    return psiList;
}

/**
 * Retorna as melhorias agrupadas por edição semanal (Segunda-feira)
 * Cada segunda-feira gera um post único compilado com todas as melhorias daquele ciclo
 */
function getPsychologistGroupedEditions() {
    const rawList = getPsychologistChangelog();
    if (!rawList || rawList.length === 0) return [];

    const editionsMap = new Map();

    rawList.forEach(item => {
        let baseDateStr = item.scheduledMonday || item.scheduledFriday || item.date;
        let dateObj = new Date(baseDateStr);
        if (isNaN(dateObj.getTime())) dateObj = new Date();

        // Determina a segunda-feira correspondente àquela semana (YYYY-MM-DD)
        const dayOfWeek = dateObj.getDay(); // 0 domingo ... 1 segunda ... 6 sabado
        let diffToMonday = 0;
        if (dayOfWeek === 1) {
            diffToMonday = 0;
        } else if (dayOfWeek === 0) {
            diffToMonday = 1;
        } else {
            diffToMonday = 8 - dayOfWeek;
        }

        const mondayDate = new Date(dateObj);
        mondayDate.setDate(dateObj.getDate() + diffToMonday);
        mondayDate.setHours(12, 0, 0, 0);

        const mondayKey = mondayDate.toISOString().slice(0, 10);

        if (!editionsMap.has(mondayKey)) {
            editionsMap.set(mondayKey, {
                mondayKey,
                mondayDate: mondayDate.toISOString(),
                items: []
            });
        }

        editionsMap.get(mondayKey).items.push(item);
    });

    const editions = Array.from(editionsMap.values())
        .sort((a, b) => new Date(b.mondayDate) - new Date(a.mondayDate))
        .map(ed => {
            const dateObj = new Date(ed.mondayDate);
            const formattedDate = dateObj.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });

            const categoriesSet = new Set(ed.items.map(i => i.category || 'Geral'));

            return {
                id: `edition-${ed.mondayKey}`,
                mondayKey: ed.mondayKey,
                fridayKey: ed.mondayKey, // Compatibilidade com marcadores legados
                date: ed.mondayDate,
                formattedDate: formattedDate,
                title: `Compilado de Ajustes da Semana 🚀`,
                subtitle: `Lançamentos de Segunda-feira • ${formattedDate}`,
                summary: `Confira todos os aprimoramentos e novos recursos liberados nesta edição para o seu consultório e rotina na Yelo.`,
                totalAdjustments: ed.items.length,
                categories: Array.from(categoriesSet),
                items: ed.items
            };
        });

    return editions;
}

module.exports = {
    syncGitToChangelog,
    getCachedOrFreshChangelog,
    getChangelogETag,
    updateChangelogEntry,
    deleteChangelogEntry,
    togglePsiVisibility,
    generateAiPsiCopy,
    getPsychologistChangelog,
    getPsychologistGroupedEditions,
    saveChangelogFile,
    CHANGELOG_PATH
};

