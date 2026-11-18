// backend/services/psychologistContextService.js
const crypto = require('crypto');
const db = require('../models');
const { formatDateSaoPaulo } = require('../utils/trialTiming');

const NICKNAMES = {
    fred: 'frederico',
    leo: 'leonardo',
    ze: 'jose',
    bia: 'beatriz',
    dani: 'daniela',
    lu: 'luciana',
    beto: 'roberto',
    chico: 'francisco',
    manu: 'manuela',
    gabi: 'gabriela',
    theo: 'teodoro',
    cadu: 'carlos',
    gui: 'guilherme',
    rafa: 'rafael'
};

const REVERSE_NICKNAMES = Object.entries(NICKNAMES).reduce((acc, [nick, formal]) => {
    acc[formal] = nick;
    return acc;
}, {});

const PLAN_DISPLAY_MAP = {
    ESSENTIAL: 'Essencial',
    ESSENCIAL: 'Essencial',
    CLINICAL: 'Clínico',
    'CLÍNICO': 'Clínico',
    CLINICO: 'Clínico',
    REFERENCE: 'Referência',
    'REFERÊNCIA': 'Referência',
    REFERENCIA: 'Referência',
    SOL: 'Referência'
};

const DOSSIER_CACHE_TTL_MS = 30 * 1000;
const MAX_DOSSIER_CACHE_ENTRIES = 40;
const dossierCache = new Map();

function normalizeStr(s) {
    return String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildNameWhereClause(nameStr, colExpr = "translate(lower(nome), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')") {
    const norm = normalizeStr(nameStr);
    const stopWords = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'psi', 'dr', 'dra']);
    const rawWords = norm.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
    if (rawWords.length === 0) return null;

    const words = rawWords.map(w => NICKNAMES[w] || w);
    const replacements = {};

    if (words.length >= 2) {
        const clauses = rawWords.map((orig, i) => {
            const alt = NICKNAMES[orig] || REVERSE_NICKNAMES[orig];
            replacements[`w${i}`] = `%${words[i]}%`;
            if (alt && alt !== words[i]) {
                replacements[`wa${i}`] = `%${alt}%`;
                return `(${colExpr} LIKE :w${i} OR ${colExpr} LIKE :wa${i})`;
            }
            return `${colExpr} LIKE :w${i}`;
        }).join(' AND ');
        return { clause: clauses, replacements, words };
    }

    const alt = REVERSE_NICKNAMES[words[0]];
    replacements.w = `%${words[0]}%`;
    let clause = `${colExpr} LIKE :w`;
    if (alt && alt !== words[0]) {
        replacements.wa = `%${alt}%`;
        clause = `(${colExpr} LIKE :w OR ${colExpr} LIKE :wa)`;
    }
    return { clause, replacements, words };
}

class PsychologistContextService {
    static clearCache() {
        dossierCache.clear();
    }

    static invalidateCache(entityType, entityKey) {
        if (!entityType || !entityKey) return;
        dossierCache.delete(`${entityType}:${entityKey}`);
    }

    static makeEntityKey(entityType, entityId, phoneDigits = null) {
        if (entityId !== null && entityId !== undefined) {
            return `id:${entityId}`;
        }
        if (phoneDigits) {
            const clean = String(phoneDigits).replace(/\D/g, '').slice(-11);
            return clean ? `phone:${clean}` : null;
        }
        return null;
    }

    static formatDateBRT(dateInput) {
        if (!dateInput) return null;
        const d = new Date(dateInput);
        if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
        return formatDateSaoPaulo(d);
    }

    static formatPlanDisplayName(rawPlano) {
        if (!rawPlano) return null;
        const norm = String(rawPlano).trim().toUpperCase();
        if (!norm || norm === 'NENHUM' || norm === 'NULL' || norm === 'NONE') return null;
        if (PLAN_DISPLAY_MAP[norm]) return PLAN_DISPLAY_MAP[norm];
        const clean = String(rawPlano).trim();
        return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
    }

    static computeSubscriptionSummary(psy, extras = {}) {
        if (!psy) return null;
        const now = new Date();
        const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true';
        const isPaused = psy.profile_paused === true || String(psy.profile_paused).toLowerCase() === 'true';
        const planLabel = this.formatPlanDisplayName(psy.plano);
        const rawExp = psy.planExpiresAt || null;
        const expDate = rawExp ? new Date(rawExp) : null;
        const isEpochExpired = Boolean(expDate && !Number.isNaN(expDate.getTime()) && expDate.getFullYear() < 2000);
        const hasValidExp = Boolean(expDate && !Number.isNaN(expDate.getTime()) && !isEpochExpired);
        const formattedExpDate = hasValidExp ? this.formatDateBRT(expDate) : null;

        const latestPayment = extras.latestPayment || null;
        const latestPayStatus = String(latestPayment?.status || '').toUpperCase();
        const subscription = extras.subscription || null;
        const subStatus = String(subscription?.status || '').toUpperCase();

        const hasPaidHistory = Boolean(
            psy.subscriptionId ||
            (psy.subscription_payments_count && Number(psy.subscription_payments_count) > 0) ||
            psy.firstPaidAt ||
            ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(latestPayStatus)
        );

        const isExpiredByDate = hasValidExp && expDate <= now;
        const isExpired = psy.status === 'inactive' || psy.status === 'vencido' || isExpiredByDate || isEpochExpired;
        const isCanceledEffective = Boolean(
            (psy.canceledAt || (psy.cancelAtPeriodEnd && isExpired)) && psy.status !== 'active'
        );

        let visibilityStatus = 'Oculto nas buscas';
        if (isPaused) {
            visibilityStatus = 'Pausado pelo profissional (profile_paused)';
        } else if (psy.status === 'active' && (isVip || !isExpired)) {
            visibilityStatus = 'Visível nas buscas';
        }

        if (isVip) {
            return {
                planText: planLabel ? `${planLabel} (VIP)` : 'VIP (Isento)',
                badgeLabel: isPaused ? 'VIP (Perfil Pausado)' : 'VIP (Isento)',
                cadastreStatus: psy.status || 'active',
                financialStatus: 'VIP Isento',
                visibilityStatus,
                expireLabel: 'Vencimento',
                expireText: 'Vitalício (VIP)',
                isVip: true,
                isExpired: false,
                isTrial: false,
                profilePaused: isPaused,
                cancelAtPeriodEnd: false,
                latestPaymentStatus: latestPayStatus || null
            };
        }

        if (psy.status === 'pending' && !hasPaidHistory && !hasValidExp && !isEpochExpired) {
            return {
                planText: 'Pendente',
                badgeLabel: 'Cadastro Pendente',
                cadastreStatus: 'pending',
                financialStatus: 'Pendente de Ativação',
                visibilityStatus,
                expireLabel: 'Vencimento',
                expireText: '-',
                isVip: false,
                isExpired: false,
                isTrial: false,
                profilePaused: isPaused,
                cancelAtPeriodEnd: false,
                latestPaymentStatus: latestPayStatus || null
            };
        }

        if (isExpired) {
            let badge = hasPaidHistory ? 'Expirado' : 'Trial Expirado';
            let finStatus = hasPaidHistory ? 'Assinatura Vencida' : 'Trial Expirado';
            if (latestPayStatus === 'REFUNDED') {
                badge = 'Estornado / Inativo';
                finStatus = 'Estornado / Chargeback';
            } else if (isCanceledEffective) {
                badge = 'Cancelamento Efetivado';
                finStatus = 'Cancelamento Efetivado';
            } else if (latestPayStatus === 'OVERDUE') {
                badge = 'Assinatura Vencida (OVERDUE)';
                finStatus = 'Pagamento Atrasado (OVERDUE)';
            }

            return {
                planText: planLabel ? `${badge} (${planLabel})` : badge,
                badgeLabel: badge,
                cadastreStatus: psy.status || 'inactive',
                financialStatus: finStatus,
                visibilityStatus,
                expireLabel: formattedExpDate ? 'Expirou em' : 'Expiração',
                expireText: formattedExpDate || 'Expirado',
                isVip: false,
                isExpired: true,
                isTrial: !hasPaidHistory,
                profilePaused: isPaused,
                cancelAtPeriodEnd: Boolean(psy.cancelAtPeriodEnd),
                latestPaymentStatus: latestPayStatus || null
            };
        }

        if (psy.status === 'active' && !hasPaidHistory) {
            return {
                planText: planLabel ? `Trial (${planLabel})` : 'Em Trial',
                badgeLabel: isPaused ? 'Em Trial (Pausado)' : 'Em Trial',
                cadastreStatus: 'active',
                financialStatus: 'Trial Ativo',
                visibilityStatus,
                expireLabel: 'Trial até',
                expireText: formattedExpDate || 'Em Trial',
                isVip: false,
                isExpired: false,
                isTrial: true,
                profilePaused: isPaused,
                cancelAtPeriodEnd: Boolean(psy.cancelAtPeriodEnd),
                latestPaymentStatus: latestPayStatus || null
            };
        }

        let finStatus = 'Pagante em Dia';
        let badge = isPaused ? 'Pagante (Pausado)' : 'Pagante Ativo';
        if (psy.cancelAtPeriodEnd) {
            finStatus = 'Cancelamento Agendado (Ativo até fim do ciclo)';
            badge = 'Cancelamento Agendado';
        } else if (latestPayStatus === 'OVERDUE' || subStatus === 'OVERDUE') {
            finStatus = 'Pagamento Pendente/Atrasado (OVERDUE)';
            badge = 'Pagamento Atrasado';
        } else if (latestPayStatus === 'PENDING') {
            finStatus = 'Cobrança Aberta (PENDING)';
        }

        return {
            planText: planLabel || 'Essencial',
            badgeLabel: badge,
            cadastreStatus: psy.status || 'active',
            financialStatus: finStatus,
            visibilityStatus,
            expireLabel: psy.cancelAtPeriodEnd ? 'Ativo até' : 'Renovação',
            expireText: formattedExpDate || 'Recorrente Ativo',
            isVip: false,
            isExpired: false,
            isTrial: false,
            profilePaused: isPaused,
            cancelAtPeriodEnd: Boolean(psy.cancelAtPeriodEnd),
            latestPaymentStatus: latestPayStatus || null
        };
    }

    static async _queryPsychologistsByName(nameStr) {
        const built = buildNameWhereClause(nameStr);
        if (!built) return [];
        const baseSelect = `id, nome, email, telefone, status, plano, "planExpiresAt", "subscriptionId", "subscription_payments_count", "is_exempt", "cancelAtPeriodEnd", "profile_paused", "canceledAt", "firstPaidAt", "whatsapp_clicks", "profile_appearances", "slug", "fotoUrl", "crp", cidade, estado`;

        try {
            const [rows] = await db.sequelize.query(`
                SELECT ${baseSelect}
                FROM "Psychologists"
                WHERE "deletedAt" IS NULL
                  AND ${built.clause}
                ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
                LIMIT 10;
            `, { replacements: built.replacements });
            return rows || [];
        } catch (err) {
            console.warn('[PsychologistContextService] Erro ao buscar psicólogo por nome:', err.message);
            return [];
        }
    }

    static async _queryPsychologistsByPhone(digits) {
        if (!digits || digits.length < 8) return [];
        const suffix = digits.length >= 9 ? digits.slice(-9) : digits.slice(-8);
        const suffix8 = digits.slice(-8);
        const baseSelect = `id, nome, email, telefone, status, plano, "planExpiresAt", "subscriptionId", "subscription_payments_count", "is_exempt", "cancelAtPeriodEnd", "profile_paused", "canceledAt", "firstPaidAt", "whatsapp_clicks", "profile_appearances", "slug", "fotoUrl", "crp", cidade, estado`;

        try {
            const [rows] = await db.sequelize.query(`
                SELECT ${baseSelect}
                FROM "Psychologists"
                WHERE "deletedAt" IS NULL
                  AND (
                    REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') LIKE :suffix
                    OR REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') LIKE :suffix8
                  )
                ORDER BY (CASE WHEN status = 'active' THEN 1 ELSE 0 END) DESC, id DESC
                LIMIT 10;
            `, { replacements: { suffix: `%${suffix}`, suffix8: `%${suffix8}` } });
            return rows || [];
        } catch (err) {
            console.warn('[PsychologistContextService] Erro ao buscar psicólogo por telefone:', err.message);
            return [];
        }
    }

    static async _queryLeadsAndWaitingLists({ cleanName, phoneDigits }) {
        const tasks = [];
        const cleanDigits = String(phoneDigits || '').replace(/\D/g, '');
        const suffix8 = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : null;
        const nameClause = cleanName ? buildNameWhereClause(cleanName) : null;

        if (suffix8 || nameClause) {
            const leadWhereParts = [];
            const leadReps = {};
            if (suffix8) {
                leadWhereParts.push(`REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') LIKE :suffix8`);
                leadReps.suffix8 = `%${suffix8}`;
            } else if (nameClause) {
                leadWhereParts.push(nameClause.clause);
                Object.assign(leadReps, nameClause.replacements);
            }

            tasks.push(
                db.sequelize.query(`
                    SELECT id, nome, telefone, origem_url, status_funil, data_ultimo_contato, data_proximo_followup, "createdAt"
                    FROM "Leads"
                    WHERE ${leadWhereParts.join(' OR ')}
                    ORDER BY id DESC
                    LIMIT 5;
                `, { replacements: leadReps })
                    .then(([rows]) => (rows || []).map(r => ({ ...r, entityType: 'lead' })))
                    .catch(() => [])
            );

            const wlWhereParts = [];
            const wlReps = {};
            if (suffix8) {
                wlWhereParts.push(`REGEXP_REPLACE(COALESCE(telefone, ''), '\\D', '', 'g') LIKE :suffix8`);
                wlReps.suffix8 = `%${suffix8}`;
            } else if (nameClause) {
                wlWhereParts.push(nameClause.clause);
                Object.assign(wlReps, nameClause.replacements);
            }

            tasks.push(
                db.sequelize.query(`
                    SELECT id, nome, email, telefone, crp, status, valor_sessao_faixa, temas_atuacao, abordagens_tecnicas, "createdAt"
                    FROM "WaitingLists"
                    WHERE (${wlWhereParts.join(' OR ')})
                      AND COALESCE(status, 'pending') <> 'registered'
                    ORDER BY id DESC
                    LIMIT 5;
                `, { replacements: wlReps })
                    .then(([rows]) => (rows || []).map(r => ({ ...r, entityType: 'waiting_list' })))
                    .catch(() => [])
            );
        }

        if (tasks.length === 0) return [];
        const results = await Promise.all(tasks);
        return results.flat();
    }

    /**
     * Resolve identidade para Psicólogos, Leads, Lista de Espera e Interessados não cadastrados.
     * Mantém contrato retrocompatível (`psychologist`, `candidates`, `ambiguous`, `matchReason`, `tokenPsychologistId`)
     * adicionando `entityType`, `entityId`, `entityKey`, `entity`, `status`.
     */
    static async resolveIdentity(cleanName, rawChat, parsedMeta = {}) {
        const empty = {
            psychologist: null,
            entity: null,
            entityType: null,
            entityId: null,
            entityKey: null,
            candidates: [],
            ambiguous: false,
            status: 'not_found',
            matchReason: 'not_found',
            tokenPsychologistId: null
        };
        if (!cleanName && !rawChat && !parsedMeta?.detectedPhone) return empty;

        const cleanRaw = rawChat
            ? rawChat.replace(/[\u200e\u200f\u202a-\u202e\ufeff\u200b-\u200d]/g, '').replace(/[\u00a0\u202f]/g, ' ')
            : '';

        // 0. Múltiplos remetentes no cabeçalho -> ambíguo / identity_review
        const extraSenders = Array.isArray(parsedMeta?.candidateSenders) ? parsedMeta.candidateSenders : [];
        if (extraSenders.length > 1) {
            const merged = new Map();
            for (const s of extraSenders.slice(0, 4)) {
                const list = s.phone
                    ? await this._queryPsychologistsByPhone(s.phone)
                    : await this._queryPsychologistsByName(s.cleanName);
                for (const r of list) merged.set(r.id, { ...r, entityType: 'psychologist' });
            }
            if (merged.size > 0) {
                return {
                    ...empty,
                    candidates: Array.from(merged.values()),
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'multiple_senders_in_chat'
                };
            }
        }

        // 1. Token de feedback no texto
        let tokenPsi = null;
        if (cleanRaw) {
            const tokenMatch = cleanRaw.match(/(?:token=|\/magic-feedback\?token=)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
            if (tokenMatch) {
                try {
                    const [clickRows] = await db.sequelize.query(`
                        SELECT p.id, p.nome, p.email, p.telefone, p.status, p.plano, p."planExpiresAt",
                               p."subscriptionId", p."subscription_payments_count", p."is_exempt", p."cancelAtPeriodEnd",
                               p."profile_paused", p."canceledAt", p."firstPaidAt",
                               p."whatsapp_clicks", p."profile_appearances", p."slug", p."fotoUrl", p."crp", p.cidade, p.estado
                        FROM "WhatsAppClickLogs" w
                        JOIN "Psychologists" p ON p.id = w."psychologistId"
                        WHERE w."feedbackToken" = :token
                          AND p."deletedAt" IS NULL
                        LIMIT 2;
                    `, { replacements: { token: tokenMatch[1] } });
                    if (clickRows && clickRows.length === 1) {
                        tokenPsi = clickRows[0];
                    }
                } catch (tokErr) {
                    console.warn('[PsychologistContextService] Erro ao validar token:', tokErr.message);
                }
            }
        }

        // 2. Telefone direto do cabeçalho do remetente
        if (parsedMeta?.detectedPhone) {
            const phoneRows = await this._queryPsychologistsByPhone(parsedMeta.detectedPhone);
            if (tokenPsi && phoneRows.length > 0 && !phoneRows.some(r => r.id === tokenPsi.id)) {
                return {
                    ...empty,
                    candidates: [tokenPsi, ...phoneRows].map(r => ({ ...r, entityType: 'psychologist' })),
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'token_header_conflict',
                    tokenPsychologistId: tokenPsi.id
                };
            }
            if (phoneRows.length === 1) {
                const psi = phoneRows[0];
                return {
                    ...empty,
                    psychologist: psi,
                    entity: psi,
                    entityType: 'psychologist',
                    entityId: psi.id,
                    entityKey: this.makeEntityKey('psychologist', psi.id),
                    candidates: [psi],
                    status: 'confirmed',
                    matchReason: 'header_phone',
                    tokenPsychologistId: tokenPsi?.id || null
                };
            }
            if (phoneRows.length > 1) {
                return {
                    ...empty,
                    candidates: phoneRows.map(r => ({ ...r, entityType: 'psychologist' })),
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'header_phone_ambiguous',
                    tokenPsychologistId: tokenPsi?.id || null
                };
            }

            // Fallback Fase 1: busca em Leads / WaitingLists por telefone de cabeçalho
            if (!tokenPsi) {
                const prospects = await this._queryLeadsAndWaitingLists({ phoneDigits: parsedMeta.detectedPhone });
                if (prospects.length === 1) {
                    const p = prospects[0];
                    return {
                        ...empty,
                        entity: p,
                        entityType: p.entityType,
                        entityId: p.id,
                        entityKey: this.makeEntityKey(p.entityType, p.id),
                        candidates: [p],
                        status: 'confirmed',
                        matchReason: `${p.entityType}_header_phone`
                    };
                }
                if (prospects.length > 1) {
                    return {
                        ...empty,
                        candidates: prospects,
                        ambiguous: true,
                        status: 'identity_review',
                        matchReason: 'prospect_header_phone_ambiguous'
                    };
                }
            }
        }

        // 3. Token de feedback sem conflito com cabeçalho
        if (tokenPsi) {
            if (cleanName) {
                const senderMatches = await this._queryPsychologistsByName(cleanName);
                if (senderMatches.length > 0 && !senderMatches.some(r => r.id === tokenPsi.id)) {
                    const combined = new Map();
                    combined.set(tokenPsi.id, { ...tokenPsi, entityType: 'psychologist' });
                    senderMatches.forEach(r => combined.set(r.id, { ...r, entityType: 'psychologist' }));
                    return {
                        ...empty,
                        candidates: Array.from(combined.values()),
                        ambiguous: true,
                        status: 'identity_review',
                        matchReason: 'token_sender_conflict',
                        tokenPsychologistId: tokenPsi.id
                    };
                }
            }
            return {
                ...empty,
                psychologist: tokenPsi,
                entity: tokenPsi,
                entityType: 'psychologist',
                entityId: tokenPsi.id,
                entityKey: this.makeEntityKey('psychologist', tokenPsi.id),
                candidates: [tokenPsi],
                status: 'confirmed',
                matchReason: 'feedback_token',
                tokenPsychologistId: tokenPsi.id
            };
        }

        // 4. Nome extraído estritamente do cabeçalho
        if (cleanName) {
            const nameRows = await this._queryPsychologistsByName(cleanName);
            const normTarget = normalizeStr(cleanName);
            if (nameRows.length === 1) {
                if (parsedMeta?.hasForwardedContent) {
                    return {
                        ...empty,
                        candidates: nameRows.map(r => ({ ...r, entityType: 'psychologist' })),
                        ambiguous: true,
                        status: 'identity_review',
                        matchReason: 'forwarded_content_confirmation'
                    };
                }
                const psi = nameRows[0];
                return {
                    ...empty,
                    psychologist: psi,
                    entity: psi,
                    entityType: 'psychologist',
                    entityId: psi.id,
                    entityKey: this.makeEntityKey('psychologist', psi.id),
                    candidates: [psi],
                    status: 'confirmed',
                    matchReason: 'name'
                };
            }
            if (nameRows.length > 1) {
                const exactMatches = nameRows.filter(r => normalizeStr(r.nome) === normTarget);
                if (exactMatches.length === 1 && !parsedMeta?.hasForwardedContent) {
                    const psi = exactMatches[0];
                    return {
                        ...empty,
                        psychologist: psi,
                        entity: psi,
                        entityType: 'psychologist',
                        entityId: psi.id,
                        entityKey: this.makeEntityKey('psychologist', psi.id),
                        candidates: [psi],
                        status: 'confirmed',
                        matchReason: 'name_exact'
                    };
                }
                return {
                    ...empty,
                    candidates: nameRows.map(r => ({ ...r, entityType: 'psychologist' })),
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'name_ambiguous'
                };
            }

            // Fallback Fase 1: busca em Leads / WaitingLists apenas se nome tiver >= 2 palavras ou match exato único
            const prospects = await this._queryLeadsAndWaitingLists({ cleanName });
            if (prospects.length === 1 && !parsedMeta?.hasForwardedContent) {
                const exact = normalizeStr(prospects[0].nome) === normTarget || normTarget.split(/\s+/).length >= 2;
                if (exact) {
                    const p = prospects[0];
                    return {
                        ...empty,
                        entity: p,
                        entityType: p.entityType,
                        entityId: p.id,
                        entityKey: this.makeEntityKey(p.entityType, p.id),
                        candidates: [p],
                        status: 'confirmed',
                        matchReason: `${p.entityType}_name`
                    };
                }
                return {
                    ...empty,
                    candidates: prospects,
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'prospect_single_word_needs_confirmation'
                };
            }
            if (prospects.length > 1) {
                return {
                    ...empty,
                    candidates: prospects,
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'prospect_name_ambiguous'
                };
            }
        }

        // 5. Telefones citados apenas no CORPO das mensagens: nunca auto-confirma!
        if (cleanRaw) {
            const allMatches = cleanRaw.match(/(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})/g) || [];
            const bodyCandidatesMap = new Map();
            const seenDigits = new Set();

            for (const m of allMatches) {
                const digits = m.replace(/\D/g, '');
                if (digits.length >= 8 && !seenDigits.has(digits) && seenDigits.size < 5) {
                    seenDigits.add(digits);
                    const rows = await this._queryPsychologistsByPhone(digits);
                    for (const r of rows) bodyCandidatesMap.set(`psychologist:${r.id}`, { ...r, entityType: 'psychologist' });
                    if (rows.length === 0) {
                        const pRows = await this._queryLeadsAndWaitingLists({ phoneDigits: digits });
                        for (const p of pRows) bodyCandidatesMap.set(`${p.entityType}:${p.id}`, p);
                    }
                }
            }

            if (bodyCandidatesMap.size > 0) {
                return {
                    ...empty,
                    candidates: Array.from(bodyCandidatesMap.values()),
                    ambiguous: true,
                    status: 'identity_review',
                    matchReason: 'phone_in_body_needs_confirmation'
                };
            }
        }

        // 6. Interessado externo não cadastrado com telefone identificado no cabeçalho -> mantém memória por telefone!
        if (parsedMeta?.detectedPhone) {
            const eKey = this.makeEntityKey('unregistered', null, parsedMeta.detectedPhone);
            if (eKey) {
                return {
                    ...empty,
                    entityType: 'unregistered',
                    entityId: null,
                    entityKey: eKey,
                    entity: {
                        id: null,
                        nome: cleanName || 'Interessado (Não Cadastrado)',
                        telefone: parsedMeta.detectedPhone,
                        entityType: 'unregistered'
                    },
                    status: 'unregistered',
                    matchReason: 'unregistered_phone'
                };
            }
        }

        return empty;
    }

    static async _fetchMemoryAndPastTurns(entityType, entityKey, entityId) {
        if (!entityType || !entityKey) {
            return { memory: null, pastConversations: [] };
        }

        const [memRows, pastRows] = await Promise.all([
            db.sequelize.query(`
                SELECT "entityType", "entityKey", "entityId", "rollingSummary", "confirmedFacts",
                       "recommendationsGiven", "commitments", "pendingItems", "declaredExpectations",
                       "topicsHistory", "lastInteractionAt", "updatedAt"
                FROM "AdminCopilotMemories"
                WHERE "entityType" = :entityType AND "entityKey" = :entityKey
                LIMIT 1;
            `, { replacements: { entityType, entityKey } }).catch(() => [[]]),

            entityType === 'psychologist' && entityId
                ? db.sequelize.query(`
                    SELECT "detectedName", LEFT("aiResponse", 160) AS "aiResponse", "createdAt", "threadId", "operationMode"
                    FROM "AdminCopilotConversations"
                    WHERE "psychologistId" = :entityId
                       OR ("entityType" = 'psychologist' AND "entityId" = :entityId)
                    ORDER BY "createdAt" DESC
                    LIMIT 2;
                `, { replacements: { entityId } }).catch(() => [[]])
                : db.sequelize.query(`
                    SELECT "detectedName", LEFT("aiResponse", 160) AS "aiResponse", "createdAt", "threadId", "operationMode"
                    FROM "AdminCopilotConversations"
                    WHERE "entityType" = :entityType
                      AND ("entityKey" = :entityKey ${entityId ? 'OR "entityId" = :entityId' : ''})
                    ORDER BY "createdAt" DESC
                    LIMIT 2;
                `, { replacements: { entityType, entityKey, entityId: entityId || null } }).catch(() => [[]])
        ]);

        return {
            memory: memRows?.[0]?.[0] || null,
            pastConversations: pastRows?.[0] || []
        };
    }

    /**
     * Constrói Dossiê 360º unificado, agregado em SQL (sem consultas pesadas ou chamadas externas),
     * com cache de 30s limitado para não onerar o banco do Render entre /identify e /respond.
     */
    static async buildDossier(targetInput, optionalOptions = {}) {
        if (!targetInput) return null;

        let entityType = 'psychologist';
        let entityId = null;
        let entityKey = null;
        let preloadedEntity = null;

        if (typeof targetInput === 'number' || typeof targetInput === 'string') {
            entityId = parseInt(targetInput, 10);
            if (Number.isNaN(entityId)) return null;
            entityKey = this.makeEntityKey('psychologist', entityId);
        } else if (typeof targetInput === 'object') {
            entityType = targetInput.entityType || 'psychologist';
            entityId = targetInput.entityId ?? targetInput.id ?? null;
            preloadedEntity = targetInput.entity || null;
            entityKey = targetInput.entityKey || this.makeEntityKey(entityType, entityId, preloadedEntity?.telefone);
        }

        if (!entityKey) return null;

        const cacheKey = `${entityType}:${entityKey}`;
        if (!optionalOptions.bypassCache) {
            const cached = dossierCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.data;
            }
        }

        let dossier = null;

        if (entityType === 'psychologist') {
            if (!entityId) return null;
            const [psis] = await db.sequelize.query(`
                SELECT
                    id, nome, crp, email, telefone, slug, "fotoUrl", plano, status,
                    "planExpiresAt", "subscriptionId", "subscription_payments_count", "is_exempt",
                    "cancelAtPeriodEnd", "canceledAt", "firstPaidAt", "profile_paused",
                    "valor_sessao_numero", "tipo_cobranca", "valor_mensal_numero", "modalidade",
                    cidade, estado, LEFT(COALESCE(bio, ''), 220) AS bio,
                    LENGTH(COALESCE(bio, '')) AS bio_length,
                    temas_atuacao, abordagens_tecnicas, free_session_active,
                    "whatsapp_clicks", "profile_appearances", "last_shown_match_at", "createdAt", "updatedAt"
                FROM "Psychologists"
                WHERE id = :id AND "deletedAt" IS NULL;
            `, { replacements: { id: entityId } });

            if (!psis || psis.length === 0) return null;
            const psi = psis[0];

            const [
                latestPayRows,
                subRows,
                wppStatsRows,
                topPostsRows,
                postCountRows,
                matchStatsRows,
                viewsStatsRows,
                exitSurveyRows,
                practiceStatsRows,
                featureRows,
                memAndPast
            ] = await Promise.all([
                db.sequelize.query(`
                    SELECT id, status, value, "billingType", "dueDate", "paymentDate"
                    FROM "Payments"
                    WHERE "psychologistId" = :id
                    ORDER BY "dueDate" DESC NULLS LAST, id DESC
                    LIMIT 1;
                `, { replacements: { id: entityId } }).catch(() => [[]]),

                db.sequelize.query(`
                    SELECT id, status, plan, "currentPeriodStart", "currentPeriodEnd"
                    FROM "Subscriptions"
                    WHERE "psychologistId" = :id
                    ORDER BY id DESC
                    LIMIT 1;
                `, { replacements: { id: entityId } }).catch(() => [[]]),

                db.sequelize.query(`
                    SELECT
                        COUNT(*) as total_clicks,
                        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as clicks_7d,
                        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') as clicks_30d,
                        COUNT(*) FILTER (WHERE "contactReceived" = true) as contacts_received,
                        COUNT(*) FILTER (WHERE "contactReceived" = true AND "createdAt" >= NOW() - INTERVAL '30 days') as contacts_received_30d,
                        COUNT(*) FILTER (WHERE "contactReceived" = false) as no_contact,
                        COUNT(*) FILTER (WHERE COALESCE("feedbackGiven", false) = false) as pending_feedback,
                        COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true')) as deals_closed,
                        COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true') AND "createdAt" >= NOW() - INTERVAL '30 days') as deals_closed_30d,
                        COUNT(*) FILTER (WHERE status = 'negotiating') as in_negotiation
                    FROM "WhatsAppClickLogs"
                    WHERE "psychologistId" = :id;
                `, { replacements: { id: entityId } }).catch(() => [[{}]]),

                db.sequelize.query(`
                    SELECT id, titulo, curtidas, created_at
                    FROM "posts"
                    WHERE "psychologist_id" = :id
                    ORDER BY curtidas DESC
                    LIMIT 2;
                `, { replacements: { id: entityId } }).catch(() => [[]]),

                db.sequelize.query(`
                    SELECT COUNT(*) as total FROM "posts" WHERE "psychologist_id" = :id;
                `, { replacements: { id: entityId } }).catch(() => [[{ total: 0 }]]),

                db.sequelize.query(`
                    SELECT
                        COUNT(*) as total_matches,
                        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') as matches_30d,
                        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as matches_7d
                    FROM "MatchEvents"
                    WHERE "psychologistId" = :id;
                `, { replacements: { id: entityId } }).catch(() => [[{}]]),

                db.sequelize.query(`
                    SELECT
                        COUNT(*) as total_views,
                        COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '30 days') as views_30d
                    FROM "ProfileAppearanceLogs"
                    WHERE "psychologistId" = :id;
                `, { replacements: { id: entityId } }).catch(() => [[{}]]),

                db.sequelize.query(`
                    SELECT motivo, avaliacao, LEFT(COALESCE(sugestao, ''), 180) as sugestao, "createdAt"
                    FROM "ExitSurveys"
                    WHERE "psychologistId" = :id
                    ORDER BY id DESC
                    LIMIT 1;
                `, { replacements: { id: entityId } }).catch(() => [[]]),

                db.sequelize.query(`
                    SELECT
                        (SELECT COUNT(*) FROM "Patients" WHERE "psychologistId" = :id AND "deletedAt" IS NULL) as active_patients,
                        (SELECT COUNT(*) FROM "Appointments" WHERE "psychologistId" = :id AND "start" >= NOW() - INTERVAL '30 days') as appointments_30d;
                `, { replacements: { id: entityId } }).catch(() => [[{}]]),

                db.sequelize.query(`
                    SELECT feature, COUNT(*) as uses
                    FROM "FeatureTrackingLogs"
                    WHERE "psychologistId" = :id
                      AND "createdAt" >= NOW() - INTERVAL '30 days'
                    GROUP BY feature
                    ORDER BY uses DESC
                    LIMIT 5;
                `, { replacements: { id: entityId } }).catch(() => [[]]),

                this._fetchMemoryAndPastTurns('psychologist', entityKey, entityId)
            ]);

            const latestPayment = latestPayRows?.[0]?.[0] || null;
            const subscription = subRows?.[0]?.[0] || null;
            const subscriptionSummary = this.computeSubscriptionSummary(psi, { latestPayment, subscription });
            const wpp = wppStatsRows?.[0]?.[0] || {};
            const matchStats = matchStatsRows?.[0]?.[0] || {};
            const viewStats = viewsStatsRows?.[0]?.[0] || {};
            const practice = practiceStatsRows?.[0]?.[0] || {};
            const features = (featureRows?.[0] || []).map(f => `${f.feature}(${Number(f.uses || 0)})`);

            const toInt = (v) => parseInt(v || 0, 10) || 0;
            const totalAppearances = Math.max(toInt(psi.profile_appearances), toInt(matchStats.total_matches));

            dossier = {
                entityType: 'psychologist',
                entityId: psi.id,
                entityKey,
                profile: psi,
                subscriptionSummary,
                latestPayment,
                subscription,
                planExpiresAtFormatted: this.formatDateBRT(psi.planExpiresAt),
                stats: {
                    total_clicks: toInt(wpp.total_clicks),
                    clicks_7d: toInt(wpp.clicks_7d),
                    clicks_30d: toInt(wpp.clicks_30d),
                    contacts_received: toInt(wpp.contacts_received),
                    contacts_received_30d: toInt(wpp.contacts_received_30d),
                    no_contact: toInt(wpp.no_contact),
                    pending_feedback: toInt(wpp.pending_feedback),
                    deals_closed: toInt(wpp.deals_closed),
                    deals_closed_30d: toInt(wpp.deals_closed_30d),
                    in_negotiation: toInt(wpp.in_negotiation)
                },
                funnel: {
                    total: {
                        matches: totalAppearances,
                        profileViews: toInt(viewStats.total_views),
                        whatsappClicks: Math.max(toInt(psi.whatsapp_clicks), toInt(wpp.total_clicks)),
                        contactsConfirmed: toInt(wpp.contacts_received),
                        noContact: toInt(wpp.no_contact),
                        inNegotiation: toInt(wpp.in_negotiation),
                        dealsClosed: toInt(wpp.deals_closed)
                    },
                    d30: {
                        matches: toInt(matchStats.matches_30d),
                        profileViews: toInt(viewStats.views_30d),
                        whatsappClicks: toInt(wpp.clicks_30d),
                        contactsConfirmed: toInt(wpp.contacts_received_30d),
                        dealsClosed: toInt(wpp.deals_closed_30d)
                    },
                    d7: {
                        matches: toInt(matchStats.matches_7d),
                        whatsappClicks: toInt(wpp.clicks_7d)
                    }
                },
                usage: {
                    activePatients: toInt(practice.active_patients),
                    appointments30d: toInt(practice.appointments_30d),
                    recentFeatures: features
                },
                exitSurvey: exitSurveyRows?.[0]?.[0] || null,
                posts: {
                    total: toInt(postCountRows?.[0]?.[0]?.total),
                    top: topPostsRows?.[0] || []
                },
                memory: memAndPast.memory,
                pastConversations: memAndPast.pastConversations
            };
        } else {
            let record = preloadedEntity;
            if (!record && entityType === 'lead' && entityId) {
                const [rows] = await db.sequelize.query(`
                    SELECT id, nome, telefone, origem_url, status_funil, data_ultimo_contato, data_proximo_followup, "createdAt"
                    FROM "Leads" WHERE id = :id LIMIT 1;
                `, { replacements: { id: entityId } }).catch(() => [[]]);
                record = rows?.[0] || null;
            } else if (!record && entityType === 'waiting_list' && entityId) {
                const [rows] = await db.sequelize.query(`
                    SELECT id, nome, email, telefone, crp, status, valor_sessao_faixa, temas_atuacao, abordagens_tecnicas, "createdAt"
                    FROM "WaitingLists" WHERE id = :id LIMIT 1;
                `, { replacements: { id: entityId } }).catch(() => [[]]);
                record = rows?.[0] || null;
            }

            if (!record && entityType !== 'unregistered') return null;
            const memAndPast = await this._fetchMemoryAndPastTurns(entityType, entityKey, entityId);

            const statusBadgeMap = {
                lead: record?.status_funil ? `Lead (${record.status_funil})` : 'Lead Comercial',
                waiting_list: `Lista de Espera (${record?.status || 'pending'})`,
                unregistered: 'Interessado Não Cadastrado'
            };

            dossier = {
                entityType,
                entityId,
                entityKey,
                profile: {
                    id: entityId || null,
                    nome: record?.nome || 'Interessado (Não Cadastrado)',
                    telefone: record?.telefone || null,
                    email: record?.email || null,
                    crp: record?.crp || null,
                    status: entityType,
                    plano: entityType === 'waiting_list' ? 'Lista de Espera' : 'Lead / Pré-cadastro',
                    origem_url: record?.origem_url || null,
                    status_funil: record?.status_funil || null,
                    valor_sessao_faixa: record?.valor_sessao_faixa || null,
                    abordagens_tecnicas: record?.abordagens_tecnicas || null
                },
                subscriptionSummary: {
                    planText: statusBadgeMap[entityType] || 'Pré-cadastro',
                    badgeLabel: statusBadgeMap[entityType] || 'Pré-cadastro',
                    cadastreStatus: entityType,
                    financialStatus: 'Ainda não assinante',
                    visibilityStatus: 'Não cadastrado na vitrine',
                    expireText: 'Pré-cadastro',
                    isVip: false,
                    isExpired: false,
                    isTrial: false
                },
                stats: {},
                funnel: null,
                posts: { total: 0, top: [] },
                memory: memAndPast.memory,
                pastConversations: memAndPast.pastConversations
            };
        }

        while (dossierCache.size >= MAX_DOSSIER_CACHE_ENTRIES) {
            const oldestKey = dossierCache.keys().next().value;
            if (oldestKey === undefined) break;
            dossierCache.delete(oldestKey);
        }
        dossierCache.set(cacheKey, {
            expiresAt: Date.now() + DOSSIER_CACHE_TTL_MS,
            data: dossier
        });

        return dossier;
    }

    /**
     * Calcula hashes determinísticos por turno de conversa para deduplicação incremental.
     */
    static computeMessageHashes(parsedMessages = []) {
        if (!Array.isArray(parsedMessages)) return [];
        return parsedMessages
            .map(m => {
                const raw = `${normalizeStr(m.sender)}|${String(m.timestamp || '').trim()}|${normalizeStr(m.body || '')}`;
                if (!raw.replace(/\|/g, '')) return null;
                return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
            })
            .filter(Boolean);
    }

    /**
     * Atualiza memória contínua de relacionamento em AdminCopilotMemories de forma 100% determinística
     * (ZERO chamadas extras à IA / ZERO custo adicional de tokens).
     */
    static async updateMemoryDeterministic({ entityType, entityId, entityKey, dossier, aiResponse, lastUserSnippet }) {
        if (!entityType || !entityKey || !aiResponse) return null;

        try {
            const [existingRows] = await db.sequelize.query(`
                SELECT id, "rollingSummary", "confirmedFacts", "topicsHistory"
                FROM "AdminCopilotMemories"
                WHERE "entityType" = :entityType AND "entityKey" = :entityKey
                LIMIT 1;
            `, { replacements: { entityType, entityKey } }).catch(() => [[]]);

            const existing = existingRows?.[0] || null;
            const dateLabel = this.formatDateBRT(new Date()) || 'Hoje';
            const cleanTopic = String(lastUserSnippet || '').replace(/\s+/g, ' ').trim().slice(0, 90);
            const cleanReply = String(aiResponse || '').replace(/\s+/g, ' ').trim().slice(0, 110);
            const entryLine = `[${dateLabel}] Assunto: "${cleanTopic || 'atendimento'}" -> Orientação enviada: "${cleanReply}..."`;

            const prevLines = existing?.rollingSummary
                ? String(existing.rollingSummary).split('\n').filter(Boolean)
                : [];
            if (!prevLines.includes(entryLine)) {
                prevLines.push(entryLine);
            }
            // Mantém somente os registros mais recentes até 550 chars para economizar tokens de entrada
            while (prevLines.length > 1 && prevLines.join('\n').length > 550) {
                prevLines.shift();
            }
            const nextSummary = prevLines.join('\n').slice(0, 600);

            const facts = [];
            if (dossier?.subscriptionSummary?.financialStatus) {
                facts.push(`Status: ${dossier.subscriptionSummary.badgeLabel} (${dossier.subscriptionSummary.financialStatus})`);
            }
            if (dossier?.profile?.valor_sessao_numero) {
                facts.push(`Sessão R$ ${dossier.profile.valor_sessao_numero}`);
            }

            if (existing?.id) {
                await db.sequelize.query(`
                    UPDATE "AdminCopilotMemories"
                    SET "rollingSummary" = :summary,
                        "confirmedFacts" = CAST(:facts AS jsonb),
                        "lastInteractionAt" = NOW(),
                        "updatedAt" = NOW()
                    WHERE id = :id;
                `, {
                    replacements: {
                        id: existing.id,
                        summary: nextSummary,
                        facts: JSON.stringify(facts)
                    }
                });
            } else {
                await db.sequelize.query(`
                    INSERT INTO "AdminCopilotMemories"
                        ("entityType", "entityKey", "entityId", "rollingSummary", "confirmedFacts", "lastInteractionAt", "createdAt", "updatedAt")
                    VALUES
                        (:entityType, :entityKey, :entityId, :summary, CAST(:facts AS jsonb), NOW(), NOW(), NOW())
                    ON CONFLICT ("entityType", "entityKey")
                    DO UPDATE SET
                        "rollingSummary" = EXCLUDED."rollingSummary",
                        "confirmedFacts" = EXCLUDED."confirmedFacts",
                        "lastInteractionAt" = NOW(),
                        "updatedAt" = NOW();
                `, {
                    replacements: {
                        entityType,
                        entityKey,
                        entityId: entityId || null,
                        summary: nextSummary,
                        facts: JSON.stringify(facts)
                    }
                });
            }

            this.invalidateCache(entityType, entityKey);
            return nextSummary;
        } catch (err) {
            console.warn('[PsychologistContextService] Falha não-crítica ao atualizar memória:', err.message);
            return null;
        }
    }
}

module.exports = PsychologistContextService;
