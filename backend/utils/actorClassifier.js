const jwt = require('jsonwebtoken');

const KNOWN_PRO_COOKIE = 'yelo_known_pro';
const KNOWN_PRO_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 dias

const LOGGED_NON_PATIENT_TYPES = new Set([
    'psychologist_logged',
    'admin_logged',
    'psychologist',
    'psi',
    'admin'
]);

const UNLOGGED_NON_PATIENT_TYPES = new Set([
    'psychologist_unlogged',
    'admin_unlogged'
]);

const B2B_OR_PRO_PAGE_SQL = `(
    COALESCE("page", '') = '/profissionais'
    OR COALESCE("page", '') LIKE '/profissionais/%'
    OR COALESCE("page", '') = '/psi'
    OR COALESCE("page", '') LIKE '/psi/%'
    OR COALESCE("page", '') LIKE '/psi\\_%' ESCAPE '\\'
    OR COALESCE("page", '') = '/admin'
    OR COALESCE("page", '') LIKE '/admin/%'
    OR COALESCE("page", '') LIKE '/admin\\_%' ESCAPE '\\'
)`;

/**
 * Normaliza papel bruto para 'admin', 'psychologist' ou 'patient'.
 */
function normalizeBaseRole(rawRole) {
    const val = String(rawRole || '').trim().toLowerCase();
    if (val === 'admin' || val === 'admin_logged' || val === 'admin_unlogged') return 'admin';
    if (
        val === 'psychologist' ||
        val === 'psi' ||
        val === 'psychologist_logged' ||
        val === 'psychologist_unlogged' ||
        val === '1' ||
        val === 'true'
    ) {
        return 'psychologist';
    }
    return 'patient';
}

/**
 * Verifica se o path pertence exclusivamente a fluxos B2B, portal do psicólogo ou admin.
 * Usa fronteiras explícitas para não confundir slugs públicos como /psicologo-fulano.
 */
function isProOrAdminPath(rawPath) {
    const p = String(rawPath || '').split('?')[0].trim().toLowerCase();
    if (!p) return false;
    return (
        p === '/profissionais' ||
        p.startsWith('/profissionais/') ||
        p === '/psi' ||
        p.startsWith('/psi/') ||
        p.startsWith('/psi_') ||
        p === '/admin' ||
        p.startsWith('/admin/') ||
        p.startsWith('/admin_')
    );
}

/**
 * Grava cookie persistente identificando dispositivo/navegador como profissional ou admin.
 * Não deve ser apagado no logout para continuar distinguindo testes não logados no funil.
 */
function setKnownProCookie(res, role = 'psychologist') {
    if (!res || typeof res.cookie !== 'function') return;
    const normalized = normalizeBaseRole(role);
    if (normalized === 'patient') return;
    res.cookie(KNOWN_PRO_COOKIE, normalized, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        maxAge: KNOWN_PRO_MAX_AGE_MS,
        sameSite: 'lax',
        path: '/'
    });
}

/**
 * Extrai JWT opcional do header Authorization ou cookie HttpOnly.
 */
function extractOptionalToken(req) {
    if (!req) return null;
    let bearerToken = null;
    if (req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
        const candidate = req.headers.authorization.split(' ')[1];
        if (candidate && candidate !== 'cookie_auth_active' && candidate !== 'null' && candidate !== 'undefined') {
            bearerToken = candidate;
        }
    }
    const isMobileClient = req.headers?.['x-yelo-client'] === 'mobile';
    if (isMobileClient && bearerToken) return bearerToken;
    return (req.cookies && req.cookies.token) ? req.cookies.token : bearerToken;
}

/**
 * Classifica o ator atual entre:
 * - 'psychologist_logged' / 'admin_logged'
 * - 'psychologist_unlogged' / 'admin_unlogged'
 * - 'patient'
 */
function resolveActor(req, fallback = {}) {
    const token = extractOptionalToken(req);
    if (token && process.env.JWT_SECRET) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const role = normalizeBaseRole(decoded.type || decoded.role);
            if (role === 'admin' || role === 'psychologist') {
                return {
                    actorType: `${role}_logged`,
                    isPatient: false,
                    isLogged: true,
                    category: role,
                    userId: decoded.id || null
                };
            }
            if (role === 'patient') {
                return {
                    actorType: 'patient',
                    isPatient: true,
                    isLogged: false,
                    category: 'patient',
                    userId: decoded.id || null
                };
            }
        } catch (_) {
            // Token expirado/inválido: prossegue para sinais persistentes e explícitos
        }
    }

    const explicitLoggedRaw =
        fallback.respondent_type ||
        fallback.user_type ||
        fallback.actor_type ||
        req?.headers?.['x-yelo-user-type'];
    const explicitStr = String(explicitLoggedRaw || '').trim().toLowerCase();
    if (explicitStr && LOGGED_NON_PATIENT_TYPES.has(explicitStr)) {
        const role = normalizeBaseRole(explicitStr);
        return {
            actorType: `${role}_logged`,
            isPatient: false,
            isLogged: true,
            category: role,
            userId: null
        };
    }
    if (explicitStr && UNLOGGED_NON_PATIENT_TYPES.has(explicitStr)) {
        const role = normalizeBaseRole(explicitStr);
        return {
            actorType: `${role}_unlogged`,
            isPatient: false,
            isLogged: false,
            category: role,
            userId: null
        };
    }

    const knownCookie = req?.cookies?.[KNOWN_PRO_COOKIE];
    const knownHeader = req?.headers?.['x-yelo-known-pro'];
    const knownBody = fallback.known_pro;
    const knownRaw = knownCookie || knownHeader || knownBody;

    if (knownRaw) {
        const role = normalizeBaseRole(knownRaw);
        if (role === 'admin' || role === 'psychologist') {
            return {
                actorType: `${role}_unlogged`,
                isPatient: false,
                isLogged: false,
                category: role,
                userId: null
            };
        }
    }

    const targetPath = fallback.page || req?.path || req?.originalUrl || '';
    if (isProOrAdminPath(targetPath)) {
        const role = String(targetPath).toLowerCase().startsWith('/admin') ? 'admin' : 'psychologist';
        return {
            actorType: `${role}_unlogged`,
            isPatient: false,
            isLogged: false,
            category: role,
            userId: null
        };
    }

    return {
        actorType: 'patient',
        isPatient: true,
        isLogged: false,
        category: 'patient',
        userId: null
    };
}

/**
 * Registra evento descartado do funil (ex.: clique no WhatsApp por profissional logado ou não).
 */
async function recordDiscardedEvent(db, { stage, actorType, targetId = null, searchId = null, source = null, page = null }) {
    if (!db?.sequelize || !stage || !actorType || actorType === 'patient') return;
    try {
        await db.sequelize.query(
            `INSERT INTO "FunnelDiscardedEvents" ("stage", "actor_type", "target_id", "search_id", "source", "page", "createdAt")
             VALUES (:stage, :actorType, :targetId, :searchId, :source, :page, NOW())`,
            {
                replacements: {
                    stage: String(stage).slice(0, 50),
                    actorType: String(actorType).slice(0, 50),
                    targetId: targetId ? parseInt(targetId, 10) || null : null,
                    searchId: searchId ? String(searchId).slice(0, 255) : null,
                    source: source ? String(source).slice(0, 100) : null,
                    page: page ? String(page).slice(0, 255) : null
                },
                type: db.sequelize.QueryTypes.INSERT
            }
        );
    } catch (_) {
        // Nunca interrompe fluxo principal caso tabela ainda não exista em ambiente antigo
    }
}

module.exports = {
    KNOWN_PRO_COOKIE,
    LOGGED_NON_PATIENT_TYPES,
    UNLOGGED_NON_PATIENT_TYPES,
    B2B_OR_PRO_PAGE_SQL,
    normalizeBaseRole,
    isProOrAdminPath,
    setKnownProCookie,
    extractOptionalToken,
    resolveActor,
    recordDiscardedEvent
};

