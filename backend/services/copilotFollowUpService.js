// backend/services/copilotFollowUpService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../models');
const { formatForWhatsApp } = require('../utils/whatsappFormatter');
const CopilotOutputGuard = require('./copilotOutputGuard');

const VALID_SUBTYPES = [
    'promessa_retorno',
    'ajuste_perfil',
    'avaliacao_pos_ajuste',
    'negociacao_copilot',
    'aviso_novidade'
];

const SUBTYPE_LABELS = {
    promessa_retorno: 'Retorno Combinado',
    ajuste_perfil: 'Check-in Ajustes',
    avaliacao_pos_ajuste: 'Resultado Pós-Ajuste 📈',
    negociacao_copilot: 'Combinado (Copilot)',
    aviso_novidade: 'Aviso Novidade'
};

const VALID_STATUSES = ['scheduled', 'completed', 'dismissed', 'auto_resolved'];

function toInt(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
}

function clamp(n, min, max, fallback) {
    const num = parseInt(n, 10);
    if (Number.isNaN(num)) return fallback;
    return Math.min(max, Math.max(min, num));
}

function getTodayBrtYmd(date = new Date()) {
    try {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
    } catch (_) {
        return date.toISOString().slice(0, 10);
    }
}

function addDaysBrtYmd(baseDate = new Date(), days = 5) {
    const safeDays = clamp(days, 0, 365, 5);
    const ymd = getTodayBrtYmd(baseDate);
    const [y, m, d] = ymd.split('-').map(Number);
    // 12:00 UTC evita qualquer virada de dia por horario de verao ao formatar em BRT
    const dt = new Date(Date.UTC(y, m - 1, d + safeDays, 12, 0, 0));
    return getTodayBrtYmd(dt);
}

/**
 * Converte string YYYY-MM-DD para 00:00 America/Sao_Paulo (03:00Z), evitando
 * deslocamento de dia na formatacao pt-BR. Tambem aceita ISO completo ou Date.
 */
function parseDueAtToBrtStart(rawDate, fallbackDays = 5) {
    if (!rawDate) {
        const ymd = addDaysBrtYmd(new Date(), fallbackDays);
        return new Date(`${ymd}T03:00:00.000Z`);
    }
    if (rawDate instanceof Date) {
        return Number.isNaN(rawDate.getTime()) ? new Date(`${addDaysBrtYmd(new Date(), fallbackDays)}T03:00:00.000Z`) : rawDate;
    }
    const str = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const candidate = new Date(`${str}T03:00:00.000Z`);
        if (!Number.isNaN(candidate.getTime())) return candidate;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const [dd, mm, yyyy] = str.split('/');
        const candidate = new Date(`${yyyy}-${mm}-${dd}T03:00:00.000Z`);
        if (!Number.isNaN(candidate.getTime())) return candidate;
    }
    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(`${addDaysBrtYmd(new Date(), fallbackDays)}T03:00:00.000Z`);
}

function formatDateBrt(dateInput) {
    if (!dateInput) return '-';
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '-';
    try {
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } catch (_) {
        return d.toISOString().slice(0, 10);
    }
}

function safeParseJson(val, fallback = null) {
    if (val == null) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch (_) {
        return fallback;
    }
}

function formatSignedDelta(num) {
    const n = toInt(num);
    if (n > 0) return `+${n}`;
    return `${n}`;
}

function isPayingActivePsychologist(psi, now = new Date()) {
    if (!psi || psi.status !== 'active' || psi.deletedAt) return false;
    const isExempt = Boolean(psi.is_exempt);
    const hasPaidCycle = Boolean(psi.subscriptionId) || Number(psi.subscription_payments_count || 0) > 0;
    if (!isExempt && !hasPaidCycle) return false;
    if (psi.cancelAtPeriodEnd) return false;
    if (isExempt) return true;
    return Boolean(psi.planExpiresAt && new Date(psi.planExpiresAt) > now);
}

class CopilotFollowUpService {
    /**
     * Captura snapshot deterministico de perfil e metricas no Render para comparar
     * evolucao pre e pos-ajuste.
     */
    static async capturePsychologistMetricsSnapshot(psychologistId) {
        const id = parseInt(psychologistId, 10);
        if (Number.isNaN(id) || id <= 0) return null;

        const [psiRows, matchRows, viewRows, wppRows, reviewRows] = await Promise.all([
            db.sequelize.query(`
                SELECT id, nome, status, plano, "updatedAt",
                       LENGTH(COALESCE(bio, '')) AS bio_length,
                       CASE WHEN COALESCE(TRIM("fotoUrl"), '') <> '' THEN true ELSE false END AS has_photo,
                       "valor_sessao_numero",
                       COALESCE("profile_appearances", 0) AS profile_appearances,
                       COALESCE("whatsapp_clicks", 0) AS whatsapp_clicks,
                       "planExpiresAt", "subscriptionId", "subscription_payments_count",
                       "cancelAtPeriodEnd", "is_exempt"
                FROM "Psychologists"
                WHERE id = :id
                LIMIT 1;
            `, { replacements: { id } }).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    COUNT(*) AS total_matches,
                    COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '14 days') AS matches_14d
                FROM "MatchEvents"
                WHERE "psychologistId" = :id;
            `, { replacements: { id } }).catch(() => [[{}]]),

            db.sequelize.query(`
                SELECT
                    COUNT(*) AS total_views,
                    COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '14 days') AS views_14d
                FROM "ProfileAppearanceLogs"
                WHERE "psychologistId" = :id;
            `, { replacements: { id } }).catch(() => [[{}]]),

            db.sequelize.query(`
                SELECT
                    COUNT(*) AS total_clicks,
                    COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '14 days') AS clicks_14d,
                    COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true')) AS closed_total,
                    COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true') AND "createdAt" >= NOW() - INTERVAL '14 days') AS closed_14d,
                    COUNT(*) FILTER (WHERE status = 'negotiating' OR "dealClosed" = 'talking') AS talking_count
                FROM "WhatsAppClickLogs"
                WHERE "psychologistId" = :id;
            `, { replacements: { id } }).catch(() => [[{}]]),

            db.sequelize.query(`
                SELECT COUNT(*) AS approved_reviews
                FROM "Reviews"
                WHERE "psychologistId" = :id
                  AND status = 'approved';
            `, { replacements: { id } }).catch(() => [[{}]])
        ]);

        const psi = psiRows?.[0]?.[0] || {};
        const m = matchRows?.[0]?.[0] || {};
        const v = viewRows?.[0]?.[0] || {};
        const w = wppRows?.[0]?.[0] || {};
        const r = reviewRows?.[0]?.[0] || {};

        return {
            capturedAt: new Date().toISOString(),
            status: psi.status || null,
            plano: psi.plano || null,
            profileUpdatedAt: psi.updatedAt ? new Date(psi.updatedAt).toISOString() : null,
            bioLength: toInt(psi.bio_length),
            hasPhoto: Boolean(psi.has_photo),
            valorSessao: psi.valor_sessao_numero != null ? Number(psi.valor_sessao_numero) : null,
            matchesTotal: Math.max(toInt(m.total_matches), toInt(psi.profile_appearances)),
            matches14d: toInt(m.matches_14d),
            viewsTotal: toInt(v.total_views),
            views14d: toInt(v.views_14d),
            clicksTotal: Math.max(toInt(w.total_clicks), toInt(psi.whatsapp_clicks)),
            clicks14d: toInt(w.clicks_14d),
            closedDealsTotal: toInt(w.closed_total),
            closedDeals14d: toInt(w.closed_14d),
            talkingCount: toInt(w.talking_count),
            reviewsCount: toInt(r.approved_reviews)
        };
    }

    /**
     * Cria (ou atualiza se houver agendamento aberto equivalente) um follow-up estruturado do Copilot.
     */
    static async createFollowUp({
        psychologistId,
        conversationId = null,
        parentFollowUpId = null,
        subType = 'negociacao_copilot',
        reason,
        contextSummary = null,
        dueAt = null,
        dueInDays = null,
        autoSchedulePerformanceEval = undefined,
        evaluationDelayDays = 14,
        adminId = null
    }) {
        const psiId = parseInt(psychologistId, 10);
        if (Number.isNaN(psiId) || psiId <= 0) {
            const err = new Error('psychologistId inválido.');
            err.statusCode = 400;
            throw err;
        }
        if (!VALID_SUBTYPES.includes(subType)) {
            const err = new Error('subType de follow-up inválido.');
            err.statusCode = 400;
            throw err;
        }
        const cleanReason = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 280);
        if (!cleanReason) {
            const err = new Error('Motivo do follow-up é obrigatório.');
            err.statusCode = 400;
            throw err;
        }

        const [psiCheck] = await db.sequelize.query(`
            SELECT id, nome
            FROM "Psychologists"
            WHERE id = :id
              AND "deletedAt" IS NULL
            LIMIT 1;
        `, { replacements: { id: psiId } });

        if (!psiCheck || psiCheck.length === 0) {
            const err = new Error('Psicólogo não encontrado para agendamento.');
            err.statusCode = 404;
            throw err;
        }

        const convId = conversationId ? parseInt(conversationId, 10) : null;
        const parentId = parentFollowUpId ? parseInt(parentFollowUpId, 10) : null;
        const cleanContext = contextSummary ? String(contextSummary).trim().slice(0, 3000) : null;

        const defaultDaysMap = {
            ajuste_perfil: 5,
            negociacao_copilot: 4,
            promessa_retorno: 15,
            avaliacao_pos_ajuste: 14,
            aviso_novidade: 30
        };
        const fallbackDays = clamp(dueInDays, 1, 365, defaultDaysMap[subType] || 5);
        const resolvedDueAt = dueAt
            ? parseDueAtToBrtStart(dueAt, fallbackDays)
            : new Date(`${addDaysBrtYmd(new Date(), fallbackDays)}T03:00:00.000Z`);

        const shouldAutoEval = subType === 'ajuste_perfil'
            ? (autoSchedulePerformanceEval !== false)
            : false;
        const safeEvalDelay = clamp(evaluationDelayDays, 7, 45, 14);
        const safeAdminId = adminId ? parseInt(adminId, 10) : null;

        // Deduplicacao: evita duplicar agendamento aberto da mesma conversa ou mesmo parentFollowUpId
        let existingRow = null;
        if (convId && !parentId) {
            const [dupConvRows] = await db.sequelize.query(`
                SELECT id
                FROM "AdminCopilotFollowUps"
                WHERE "psychologistId" = :psiId
                  AND "subType" = :subType
                  AND "conversationId" = :convId
                  AND status = 'scheduled'
                ORDER BY id DESC
                LIMIT 1;
            `, { replacements: { psiId, subType, convId } }).catch(() => [[]]);
            existingRow = dupConvRows?.[0] || null;
        } else if (parentId) {
            const [dupParentRows] = await db.sequelize.query(`
                SELECT id
                FROM "AdminCopilotFollowUps"
                WHERE "parentFollowUpId" = :parentId
                  AND status = 'scheduled'
                ORDER BY id DESC
                LIMIT 1;
            `, { replacements: { parentId } }).catch(() => [[]]);
            existingRow = dupParentRows?.[0] || null;
        }

        if (existingRow?.id) {
            const [updatedRows] = await db.sequelize.query(`
                UPDATE "AdminCopilotFollowUps"
                SET reason = :reason,
                    "contextSummary" = COALESCE(:contextSummary, "contextSummary"),
                    "dueAt" = :dueAt,
                    "autoSchedulePerformanceEval" = :autoEval,
                    "evaluationDelayDays" = :evalDelay,
                    "updatedAt" = NOW()
                WHERE id = :id
                RETURNING *;
            `, {
                replacements: {
                    id: existingRow.id,
                    reason: cleanReason,
                    contextSummary: cleanContext,
                    dueAt: resolvedDueAt,
                    autoEval: shouldAutoEval,
                    evalDelay: safeEvalDelay
                }
            });
            return {
                followUp: updatedRows?.[0] || existingRow,
                deduped: true
            };
        }

        const baselineMetrics = await this.capturePsychologistMetricsSnapshot(psiId);

        const [insertedRows] = await db.sequelize.query(`
            INSERT INTO "AdminCopilotFollowUps"
                ("psychologistId", "conversationId", "parentFollowUpId", "subType", reason, "contextSummary",
                 "dueAt", status, "autoSchedulePerformanceEval", "evaluationDelayDays", "baselineMetrics", "adminId",
                 "createdAt", "updatedAt")
            VALUES
                (:psiId, :convId, :parentId, :subType, :reason, :contextSummary,
                 :dueAt, 'scheduled', :autoEval, :evalDelay, CAST(:baseline AS jsonb), :adminId,
                 NOW(), NOW())
            RETURNING *;
        `, {
            replacements: {
                psiId,
                convId: Number.isNaN(convId) ? null : convId,
                parentId: Number.isNaN(parentId) ? null : parentId,
                subType,
                reason: cleanReason,
                contextSummary: cleanContext,
                dueAt: resolvedDueAt,
                autoEval: shouldAutoEval,
                evalDelay: safeEvalDelay,
                baseline: JSON.stringify(baselineMetrics || {}),
                adminId: Number.isNaN(safeAdminId) ? null : safeAdminId
            }
        });

        return {
            followUp: insertedRows?.[0] || null,
            deduped: false
        };
    }

    /**
     * Detecta se o perfil recebeu edicoes reais desde o combinado de ajuste_perfil.
     */
    static computeAdjustmentDiff(baseline = {}, current = {}, followUpCreatedAt = null) {
        const b = safeParseJson(baseline, {}) || {};
        const c = current || {};
        const changesList = [];

        if (c.profileUpdatedAt && followUpCreatedAt) {
            const updMs = new Date(c.profileUpdatedAt).getTime();
            const refMs = new Date(b.profileUpdatedAt || followUpCreatedAt).getTime();
            if (!Number.isNaN(updMs) && !Number.isNaN(refMs) && updMs > refMs + 60 * 1000) {
                changesList.push('perfil atualizado na plataforma');
            }
        }
        if (b.bioLength != null && c.bioLength != null && c.bioLength !== b.bioLength) {
            const diffChars = c.bioLength - b.bioLength;
            changesList.push(diffChars > 0 ? `bio ampliada (+${diffChars} chars)` : 'bio revisada');
        }
        if (!b.hasPhoto && c.hasPhoto) {
            changesList.push('foto de perfil adicionada');
        }
        if (b.valorSessao != null && c.valorSessao != null && Number(c.valorSessao) !== Number(b.valorSessao)) {
            changesList.push(`valor da sessão ajustado (R$ ${b.valorSessao} → R$ ${c.valorSessao})`);
        }
        if (b.reviewsCount != null && c.reviewsCount != null && c.reviewsCount > b.reviewsCount) {
            changesList.push(`+${c.reviewsCount - b.reviewsCount} avaliação(ões) aprovada(s)`);
        }

        const hasChanges = changesList.length > 0;
        const summaryText = hasChanges
            ? `Alterações detectadas no banco: ${changesList.join(', ')}`
            : 'Nenhuma alteração estrutural detectada no perfil desde o combinado';

        return {
            hasChanges,
            changesList,
            summaryText
        };
    }

    /**
     * Compara metricas pos-ajuste com o baseline capturado na epoca do check-in e antes do ajuste.
     */
    static computePerformanceDelta(baseline = {}, current = {}, followUpCreatedAt = null) {
        const b = safeParseJson(baseline, {}) || {};
        const orig = safeParseJson(b.originalBaseline, null);
        const ref = b;
        const c = current || {};

        const startDate = new Date(b.capturedAt || followUpCreatedAt || Date.now());
        const daysSince = Math.max(1, Math.round((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

        const matchesDelta = toInt(c.matchesTotal) - toInt(ref.matchesTotal);
        const viewsDelta = toInt(c.viewsTotal) - toInt(ref.viewsTotal);
        const clicksDelta = toInt(c.clicksTotal) - toInt(ref.clicksTotal);
        const closedDealsDelta = toInt(c.closedDealsTotal) - toInt(ref.closedDealsTotal);
        const reviewsDelta = toInt(c.reviewsCount) - toInt(ref.reviewsCount);

        const matches14dDiff = toInt(c.matches14d) - toInt(ref.matches14d);
        const views14dDiff = toInt(c.views14d) - toInt(ref.views14d);
        const clicks14dDiff = toInt(c.clicks14d) - toInt(ref.clicks14d);

        let verdict = 'estagnado';
        if (clicksDelta > 0 || closedDealsDelta > 0 || toInt(c.clicks14d) > toInt(ref.clicks14d)) {
            verdict = 'melhorou';
        } else if (viewsDelta > 0 || toInt(c.views14d) > toInt(ref.views14d) || toInt(c.matches14d) > toInt(ref.matches14d)) {
            verdict = 'visibilidade_subiu';
        }

        const verdictLabel = verdict === 'melhorou'
            ? '✅ Ajustes deram frutos!'
            : (verdict === 'visibilidade_subiu'
                ? '📈 Visibilidade subiu; falta converter em cliques'
                : '⚠️ Desempenho ainda estável/estagnado — propor novo refino');

        const summaryLine = `Avaliação pós-ajuste (${daysSince}d): ${formatSignedDelta(matchesDelta)} aparições, ${formatSignedDelta(viewsDelta)} visitas, ${formatSignedDelta(clicksDelta)} cliques WPP, ${formatSignedDelta(closedDealsDelta)} fechamentos • ${verdictLabel}`;

        return {
            daysSince,
            verdict,
            verdictLabel,
            matchesDelta,
            viewsDelta,
            clicksDelta,
            closedDealsDelta,
            reviewsDelta,
            matches14dCurrent: toInt(c.matches14d),
            matches14dBefore: toInt(ref.matches14d),
            matches14dDiff,
            views14dCurrent: toInt(c.views14d),
            views14dBefore: toInt(ref.views14d),
            views14dDiff,
            clicks14dCurrent: toInt(c.clicks14d),
            clicks14dBefore: toInt(ref.clicks14d),
            clicks14dDiff,
            baselineCapturedAt: ref.capturedAt || null,
            originalBaseline: orig,
            summaryLine
        };
    }

    /**
     * Retorna os follow-ups agendados e vencidos (dueAt <= now) no formato da fila pending_actions,
     * realizando auto-resolucao inteligente (ex.: promessa_retorno ja virou pagante ativo).
     */
    static async getDuePendingActions(now = new Date()) {
        try {
            const [rows] = await db.sequelize.query(`
                SELECT
                    f.id AS "followUpId",
                    f."psychologistId",
                    f."conversationId",
                    f."parentFollowUpId",
                    f."subType" AS "followUpSubType",
                    f.reason AS "followUpReason",
                    f."contextSummary",
                    f."dueAt",
                    f."autoSchedulePerformanceEval",
                    f."evaluationDelayDays",
                    f."baselineMetrics",
                    f."createdAt" AS "followUpCreatedAt",
                    p.id, p.nome, p.telefone, p."fotoUrl", p.plano, p.status,
                    p."planExpiresAt", p."subscriptionId", p."subscription_payments_count",
                    p."cancelAtPeriodEnd", p."is_exempt", p."deletedAt",
                    p."valor_sessao_numero", p."abordagens_tecnicas", p."aiOptimizationHistory"
                FROM "AdminCopilotFollowUps" f
                LEFT JOIN "Psychologists" p ON p.id = f."psychologistId"
                WHERE f.status = 'scheduled'
                  AND f."dueAt" <= :now
                ORDER BY f."dueAt" ASC, f.id ASC;
            `, { replacements: { now } });

            if (!Array.isArray(rows) || rows.length === 0) return [];

            const actions = [];
            for (const row of rows) {
                if (!row.id || row.deletedAt) {
                    await db.sequelize.query(`
                        UPDATE "AdminCopilotFollowUps"
                        SET status = 'auto_resolved',
                            "resolvedReason" = 'Perfil excluído ou inexistente',
                            "completedAt" = NOW(),
                            "updatedAt" = NOW()
                        WHERE id = :followUpId;
                    `, { replacements: { followUpId: row.followUpId } }).catch(() => {});
                    continue;
                }

                if (row.followUpSubType === 'promessa_retorno' && isPayingActivePsychologist(row, now)) {
                    await db.sequelize.query(`
                        UPDATE "AdminCopilotFollowUps"
                        SET status = 'auto_resolved',
                            "resolvedReason" = 'Profissional já está com assinatura ativa antes da data combinada',
                            "completedAt" = NOW(),
                            "updatedAt" = NOW()
                        WHERE id = :followUpId;
                    `, { replacements: { followUpId: row.followUpId } }).catch(() => {});
                    continue;
                }

                const parsedBaseline = safeParseJson(row.baselineMetrics, {}) || {};
                let liveComparison = null;
                let enrichedReason = row.followUpReason;

                if (row.followUpSubType === 'ajuste_perfil' || row.followUpSubType === 'avaliacao_pos_ajuste') {
                    const liveSnapshot = await this.capturePsychologistMetricsSnapshot(row.id).catch(() => null);
                    if (liveSnapshot) {
                        if (row.followUpSubType === 'ajuste_perfil') {
                            liveComparison = this.computeAdjustmentDiff(parsedBaseline, liveSnapshot, row.followUpCreatedAt);
                            enrichedReason = `${row.followUpReason} (${liveComparison.summaryText})`;
                        } else {
                            liveComparison = this.computePerformanceDelta(parsedBaseline, liveSnapshot, row.followUpCreatedAt);
                            enrichedReason = liveComparison.summaryLine;
                        }
                    }
                }

                actions.push({
                    id: row.id,
                    nome: row.nome,
                    telefone: row.telefone,
                    fotoUrl: row.fotoUrl,
                    plano: row.plano,
                    status: row.status,
                    planExpiresAt: row.planExpiresAt,
                    valor_sessao_numero: row.valor_sessao_numero,
                    abordagens_tecnicas: row.abordagens_tecnicas,
                    aiOptimizationHistory: row.aiOptimizationHistory,
                    createdAt: row.dueAt,
                    dueAt: row.dueAt,
                    actionType: 'copilot_followup',
                    followUpId: row.followUpId,
                    followUpSubType: row.followUpSubType,
                    reason: enrichedReason,
                    metrics: {
                        followUpId: row.followUpId,
                        subType: row.followUpSubType,
                        subTypeLabel: SUBTYPE_LABELS[row.followUpSubType] || 'Combinado (Copilot)',
                        originalReason: row.followUpReason,
                        contextSummary: row.contextSummary,
                        conversationId: row.conversationId,
                        parentFollowUpId: row.parentFollowUpId,
                        dueAt: row.dueAt,
                        autoSchedulePerformanceEval: Boolean(row.autoSchedulePerformanceEval),
                        evaluationDelayDays: toInt(row.evaluationDelayDays) || 14,
                        baselineMetrics: parsedBaseline,
                        liveComparison
                    }
                });
            }

            return actions;
        } catch (err) {
            // Se a tabela ainda nao existir em ambiente de teste/transicao, falha de forma isolada e nao quebra pending-actions
            console.warn('[CopilotFollowUpService] Aviso em getDuePendingActions:', err.message);
            return [];
        }
    }

    /**
     * Marca um follow-up do Copilot como completed ou dismissed.
     * Se for ajuste_perfil concluido (nao ignorado) e autoSchedulePerformanceEval=true, agenda automaticamente Etapa 2.
     */
    static async completeOrDismissFollowUp({ psychologistId, followUpId = null, dismissed = false, messageContent = null }) {
        const psiId = parseInt(psychologistId, 10);
        const parsedFuId = followUpId ? parseInt(followUpId, 10) : null;

        let targetRow = null;
        if (parsedFuId && !Number.isNaN(parsedFuId)) {
            const [rows] = await db.sequelize.query(`
                SELECT *
                FROM "AdminCopilotFollowUps"
                WHERE id = :followUpId
                  AND status = 'scheduled'
                LIMIT 1;
            `, { replacements: { followUpId: parsedFuId } });
            targetRow = rows?.[0] || null;
            if (targetRow && !Number.isNaN(psiId) && Number(targetRow.psychologistId) !== psiId) {
                const err = new Error('Follow-up não pertence ao psicólogo informado.');
                err.statusCode = 400;
                throw err;
            }
        } else if (!Number.isNaN(psiId) && psiId > 0) {
            const [rows] = await db.sequelize.query(`
                SELECT *
                FROM "AdminCopilotFollowUps"
                WHERE "psychologistId" = :psiId
                  AND status = 'scheduled'
                  AND "dueAt" <= NOW()
                ORDER BY "dueAt" ASC, id ASC
                LIMIT 1;
            `, { replacements: { psiId } });
            targetRow = rows?.[0] || null;
        }

        if (!targetRow) {
            return { updated: false, followUp: null, scheduledNextEvaluation: null };
        }

        const isDismissed = Boolean(dismissed) || /ação ignorada\/descartada/i.test(String(messageContent || ''));
        const outcomeMetrics = await this.capturePsychologistMetricsSnapshot(targetRow.psychologistId).catch(() => null);
        const now = new Date();

        const [updatedRows] = await db.sequelize.query(`
            UPDATE "AdminCopilotFollowUps"
            SET status = :newStatus,
                "completedAt" = :completedAt,
                "sentMessage" = :sentMessage,
                "resolvedReason" = :resolvedReason,
                "outcomeMetrics" = CAST(:outcome AS jsonb),
                "updatedAt" = NOW()
            WHERE id = :id
            RETURNING *;
        `, {
            replacements: {
                id: targetRow.id,
                newStatus: isDismissed ? 'dismissed' : 'completed',
                completedAt: now,
                sentMessage: isDismissed ? null : (messageContent ? String(messageContent).slice(0, 4000) : null),
                resolvedReason: isDismissed ? 'Ignorado pelo Admin' : null,
                outcome: JSON.stringify(outcomeMetrics || {})
            }
        });

        const updatedFollowUp = updatedRows?.[0] || targetRow;
        let scheduledNextEvaluation = null;

        // Etapa 2 automatica somente quando ajuste_perfil foi enviado (completed), nunca quando ignorado (dismissed)
        if (!isDismissed && targetRow.subType === 'ajuste_perfil' && targetRow.autoSchedulePerformanceEval) {
            const [existingChild] = await db.sequelize.query(`
                SELECT id, "dueAt", reason
                FROM "AdminCopilotFollowUps"
                WHERE "parentFollowUpId" = :parentId
                LIMIT 1;
            `, { replacements: { parentId: targetRow.id } }).catch(() => [[]]);

            if (!existingChild || existingChild.length === 0) {
                const delayDays = clamp(targetRow.evaluationDelayDays, 7, 45, 14);
                const evalYmd = addDaysBrtYmd(now, delayDays);
                const evalDueAt = new Date(`${evalYmd}T03:00:00.000Z`);
                const origBase = safeParseJson(targetRow.baselineMetrics, null);
                const evalBaseline = {
                    ...(outcomeMetrics || origBase || {}),
                    originalBaseline: origBase || null
                };
                const evalReason = `Avaliação de desempenho pós-ajuste: ${targetRow.reason}`.slice(0, 260);

                const [insertedEval] = await db.sequelize.query(`
                    INSERT INTO "AdminCopilotFollowUps"
                        ("psychologistId", "conversationId", "parentFollowUpId", "subType", reason, "contextSummary",
                         "dueAt", status, "autoSchedulePerformanceEval", "evaluationDelayDays", "baselineMetrics", "adminId",
                         "createdAt", "updatedAt")
                    VALUES
                        (:psiId, :convId, :parentId, 'avaliacao_pos_ajuste', :reason, :contextSummary,
                         :dueAt, 'scheduled', false, :delayDays, CAST(:baseline AS jsonb), :adminId,
                         NOW(), NOW())
                    RETURNING id, "psychologistId", "parentFollowUpId", "subType", reason, "dueAt", status;
                `, {
                    replacements: {
                        psiId: targetRow.psychologistId,
                        convId: targetRow.conversationId || null,
                        parentId: targetRow.id,
                        reason: evalReason,
                        contextSummary: targetRow.contextSummary || null,
                        dueAt: evalDueAt,
                        delayDays,
                        baseline: JSON.stringify(evalBaseline),
                        adminId: targetRow.adminId || null
                    }
                });

                scheduledNextEvaluation = insertedEval?.[0] || {
                    parentFollowUpId: targetRow.id,
                    subType: 'avaliacao_pos_ajuste',
                    dueAt: evalDueAt,
                    delayDays
                };
            }
        }

        return {
            updated: true,
            followUp: updatedFollowUp,
            scheduledNextEvaluation
        };
    }

    /**
     * Lista follow-ups do Copilot (ex.: agendamentos futuros para exibicao no CRM).
     */
    static async listFollowUps({ psychologistId = null, status = 'scheduled', futureOnly = false, limit = 30 } = {}) {
        try {
            const safeLimit = clamp(limit, 1, 100, 30);
            const safeStatus = VALID_STATUSES.includes(status) ? status : 'scheduled';
            const psiId = psychologistId ? parseInt(psychologistId, 10) : null;

            let rows = [];
            if (psiId && !Number.isNaN(psiId)) {
                if (futureOnly) {
                    const [resRows] = await db.sequelize.query(`
                        SELECT f.*, p.nome AS "psychologistName", p.telefone AS "psychologistPhone", p.plano AS "psychologistPlano"
                        FROM "AdminCopilotFollowUps" f
                        LEFT JOIN "Psychologists" p ON p.id = f."psychologistId"
                        WHERE f.status = :status
                          AND f."psychologistId" = :psiId
                          AND f."dueAt" > NOW()
                        ORDER BY f."dueAt" ASC, f.id ASC
                        LIMIT :limit;
                    `, { replacements: { status: safeStatus, psiId, limit: safeLimit } });
                    rows = resRows || [];
                } else {
                    const [resRows] = await db.sequelize.query(`
                        SELECT f.*, p.nome AS "psychologistName", p.telefone AS "psychologistPhone", p.plano AS "psychologistPlano"
                        FROM "AdminCopilotFollowUps" f
                        LEFT JOIN "Psychologists" p ON p.id = f."psychologistId"
                        WHERE f.status = :status
                          AND f."psychologistId" = :psiId
                        ORDER BY f."dueAt" ASC, f.id DESC
                        LIMIT :limit;
                    `, { replacements: { status: safeStatus, psiId, limit: safeLimit } });
                    rows = resRows || [];
                }
            } else if (futureOnly) {
                const [resRows] = await db.sequelize.query(`
                    SELECT f.*, p.nome AS "psychologistName", p.telefone AS "psychologistPhone", p.plano AS "psychologistPlano"
                    FROM "AdminCopilotFollowUps" f
                    LEFT JOIN "Psychologists" p ON p.id = f."psychologistId"
                    WHERE f.status = :status
                      AND f."dueAt" > NOW()
                    ORDER BY f."dueAt" ASC, f.id ASC
                    LIMIT :limit;
                `, { replacements: { status: safeStatus, limit: safeLimit } });
                rows = resRows || [];
            } else {
                const [resRows] = await db.sequelize.query(`
                    SELECT f.*, p.nome AS "psychologistName", p.telefone AS "psychologistPhone", p.plano AS "psychologistPlano"
                    FROM "AdminCopilotFollowUps" f
                    LEFT JOIN "Psychologists" p ON p.id = f."psychologistId"
                    WHERE f.status = :status
                    ORDER BY f."dueAt" ASC, f.id DESC
                    LIMIT :limit;
                `, { replacements: { status: safeStatus, limit: safeLimit } });
                rows = resRows || [];
            }

            return rows.map(r => ({
                ...r,
                subTypeLabel: SUBTYPE_LABELS[r.subType] || 'Combinado (Copilot)'
            }));
        } catch (err) {
            console.warn('[CopilotFollowUpService] Aviso em listFollowUps:', err.message);
            return [];
        }
    }

    /**
     * Atualiza campos permitidos (data prevista, motivo, status ou config de reavaliacao).
     */
    static async updateFollowUp({ id, dueAt, reason, status, evaluationDelayDays, autoSchedulePerformanceEval }) {
        const fuId = parseInt(id, 10);
        if (Number.isNaN(fuId) || fuId <= 0) {
            const err = new Error('ID de follow-up inválido.');
            err.statusCode = 400;
            throw err;
        }

        const [existingRows] = await db.sequelize.query(`
            SELECT * FROM "AdminCopilotFollowUps" WHERE id = :id LIMIT 1;
        `, { replacements: { id: fuId } });
        const existing = existingRows?.[0];
        if (!existing) {
            const err = new Error('Follow-up não encontrado.');
            err.statusCode = 404;
            throw err;
        }

        const nextStatus = status && VALID_STATUSES.includes(status) ? status : existing.status;
        const nextReason = reason !== undefined
            ? String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 280) || existing.reason
            : existing.reason;
        const nextDueAt = dueAt !== undefined ? parseDueAtToBrtStart(dueAt, 5) : existing.dueAt;
        const nextAutoEval = autoSchedulePerformanceEval !== undefined
            ? (existing.subType === 'ajuste_perfil' ? Boolean(autoSchedulePerformanceEval) : false)
            : existing.autoSchedulePerformanceEval;
        const nextDelay = evaluationDelayDays !== undefined
            ? clamp(evaluationDelayDays, 7, 45, 14)
            : existing.evaluationDelayDays;
        const nextCompletedAt = (nextStatus === 'dismissed' || nextStatus === 'completed')
            ? (existing.completedAt || new Date())
            : null;

        const [updatedRows] = await db.sequelize.query(`
            UPDATE "AdminCopilotFollowUps"
            SET status = :status,
                reason = :reason,
                "dueAt" = :dueAt,
                "autoSchedulePerformanceEval" = :autoEval,
                "evaluationDelayDays" = :evalDelay,
                "completedAt" = :completedAt,
                "updatedAt" = NOW()
            WHERE id = :id
            RETURNING *;
        `, {
            replacements: {
                id: fuId,
                status: nextStatus,
                reason: nextReason,
                dueAt: nextDueAt,
                autoEval: nextAutoEval,
                evalDelay: nextDelay,
                completedAt: nextCompletedAt
            }
        });

        return updatedRows?.[0] || existing;
    }

    static buildDeterministicFallbackMessage({ firstName, followUp, dossier, liveSnapshot, adjustmentDiff, performanceDelta }) {
        const name = firstName || 'Colega';
        const subType = followUp.subType;
        const bioLen = toInt(liveSnapshot?.bioLength);
        const matches30d = toInt(dossier?.funnel?.last30d?.appearances || liveSnapshot?.matches14d);
        const clicks30d = toInt(dossier?.funnel?.last30d?.whatsappClicks || liveSnapshot?.clicks14d);

        if (subType === 'promessa_retorno') {
            return formatForWhatsApp(
                `Oi, ${name}! Tudo bem por aí?\n\nLembrei da nossa última conversa em que você comentou que avaliaria retomar na Yelo neste momento (${followUp.reason}).\n\nNos últimos 30 dias, o movimento de pacientes buscando atendimento por aqui seguiu ativo — e se fizer sentido para a sua agenda agora, consigo te passar rapidinho como está a procura na sua faixa de valor e abordagem.\n\nComo está sua rotina de atendimentos neste início de mês?`,
                { preserveDashBullets: true }
            );
        }

        if (subType === 'ajuste_perfil') {
            if (adjustmentDiff?.hasChanges) {
                return formatForWhatsApp(
                    `Oi, ${name}! Tudo bem?\n\nPassando por aqui como combinamos! Vi no sistema que você já fez atualizações no seu perfil (${adjustmentDiff.changesList.join(', ')}).\n\nAgora vou acompanhar sua visibilidade nas próximas semanas para vermos na prática como os pacientes reagem a essas melhorias.\n\nVocê sentiu facilidade para ajustar ou ficou algum detalhe em que eu possa te ajudar?`,
                    { preserveDashBullets: true }
                );
            }
            const missingHint = bioLen < 120
                ? 'sua bio ainda está bem enxuta'
                : 'vale revisar os pontos que conversamos';
            return formatForWhatsApp(
                `Oi, ${name}! Tudo bem?\n\nPassando para fazer aquele check-in rápido dos ajustes de perfil que combinamos na nossa conversa.\n\nVi aqui que ${missingHint} e queria saber se a rotina acabou apertando ou se você precisa de uma ajuda prática minha para estruturar o texto em poucos minutos.\n\nSe quiser, me responde por aqui mesmo e deixamos tudo redondo!`,
                { preserveDashBullets: true }
            );
        }

        if (subType === 'avaliacao_pos_ajuste') {
            const delta = performanceDelta || {
                daysSince: 14,
                verdict: 'estagnado',
                matchesDelta: 0,
                viewsDelta: 0,
                clicksDelta: 0,
                closedDealsDelta: 0
            };
            if (delta.verdict === 'melhorou') {
                return formatForWhatsApp(
                    `Oi, ${name}! Tudo bem?\n\nVoltei após *${delta.daysSince} dias* dos ajustes que fizemos no seu perfil para acompanharmos os frutos na prática:\n\n- *Aparições no Match:* ${formatSignedDelta(delta.matchesDelta)}\n- *Visitas no perfil:* ${formatSignedDelta(delta.viewsDelta)}\n- *Cliques no WhatsApp:* ${formatSignedDelta(delta.clicksDelta)}\n\nQue bom ver o perfil ganhando tração! Como você sentiu os últimos contatos que chegaram por aí?`,
                    { preserveDashBullets: true }
                );
            }
            if (delta.verdict === 'visibilidade_subiu') {
                return formatForWhatsApp(
                    `Oi, ${name}! Tudo bem?\n\nDei uma olhada no seu perfil *${delta.daysSince} dias* após os ajustes e já vimos um bom avanço de visibilidade:\n\n- *Aparições no Match:* ${formatSignedDelta(delta.matchesDelta)}\n- *Visitas no perfil:* ${formatSignedDelta(delta.viewsDelta)}\n- *Cliques no WhatsApp:* ${formatSignedDelta(delta.clicksDelta)}\n\nOu seja, mais pacientes passaram a abrir sua página! O próximo micro-ajuste agora costuma ser deixar a primeira frase da bio e a chamada para contato ainda mais claras. Quer que a gente dê uma lapidada rápida nisso juntos?`,
                    { preserveDashBullets: true }
                );
            }
            return formatForWhatsApp(
                `Oi, ${name}! Tudo bem?\n\nVoltei como combinado para avaliar os resultados depois de *${delta.daysSince} dias* dos ajustes no seu perfil (hoje com *${matches30d} aparições* e *${clicks30d} cliques* recentes).\n\nComo o movimento ainda ficou bem parecido com o período anterior, queria revisar com você dois pontos práticos — como posicionamento inicial da bio, faixa de valor e avaliações — para destravarmos esses cliques.\n\nPrefere que eu te mande 2 sugestões objetivas por aqui agora?`,
                { preserveDashBullets: true }
            );
        }

        if (subType === 'aviso_novidade') {
            return formatForWhatsApp(
                `Oi, ${name}! Tudo bem?\n\nLembrei da nossa conversa sobre "${followUp.reason}" e passei para atualizar você sobre as novidades e evoluções mais recentes da Yelo.\n\nSe quiser, te explico rapidinho o que já está no ar hoje e como isso pode apoiar sua rotina clínica. Faz sentido conversar sobre isso esta semana?`,
                { preserveDashBullets: true }
            );
        }

        return formatForWhatsApp(
            `Oi, ${name}! Tudo bem?\n\nRetomando o que conversamos recentemente (${followUp.reason}) para saber como você avaliou a ideia por aí.\n\nConseguiu pensar no que combinamos ou surgiu alguma dúvida que eu possa esclarecer por aqui?`,
            { preserveDashBullets: true }
        );
    }

    /**
     * Gera mensagem de WhatsApp via Gemini cruzando combinado original + banco vivo no Render,
     * com fallback deterministico garantido.
     */
    static async generateFollowUpWhatsAppMessage({ followUpId, psychologistId = null }) {
        const fuId = parseInt(followUpId, 10);
        if (Number.isNaN(fuId) || fuId <= 0) {
            const err = new Error('followUpId inválido.');
            err.statusCode = 400;
            throw err;
        }

        const [rows] = await db.sequelize.query(`
            SELECT * FROM "AdminCopilotFollowUps" WHERE id = :id LIMIT 1;
        `, { replacements: { id: fuId } });
        const followUp = rows?.[0];
        if (!followUp) {
            const err = new Error('Follow-up não encontrado.');
            err.statusCode = 404;
            throw err;
        }
        if (psychologistId && Number(followUp.psychologistId) !== parseInt(psychologistId, 10)) {
            const err = new Error('Follow-up não pertence a este profissional.');
            err.statusCode = 400;
            throw err;
        }

        const AdminCopilotService = require('./adminCopilotService');
        const [dossier, liveSnapshot, convRows] = await Promise.all([
            AdminCopilotService.buildDossier({ entityType: 'psychologist', entityId: followUp.psychologistId }).catch(() => null),
            this.capturePsychologistMetricsSnapshot(followUp.psychologistId).catch(() => null),
            followUp.conversationId
                ? db.sequelize.query(`
                    SELECT "rawPastedChat", "aiResponse", "finalReply", "createdAt"
                    FROM "AdminCopilotConversations"
                    WHERE id = :convId
                    LIMIT 1;
                `, { replacements: { convId: followUp.conversationId } }).catch(() => [[]])
                : Promise.resolve([[]])
        ]);

        const fullName = dossier?.profile?.nome || 'Colega';
        const firstName = String(fullName).trim().split(/\s+/)[0] || 'Colega';
        const parsedBaseline = safeParseJson(followUp.baselineMetrics, {}) || {};
        const adjustmentDiff = followUp.subType === 'ajuste_perfil' && liveSnapshot
            ? this.computeAdjustmentDiff(parsedBaseline, liveSnapshot, followUp.createdAt)
            : null;
        const performanceDelta = followUp.subType === 'avaliacao_pos_ajuste' && liveSnapshot
            ? this.computePerformanceDelta(parsedBaseline, liveSnapshot, followUp.createdAt)
            : null;

        const fallbackCopy = this.buildDeterministicFallbackMessage({
            firstName,
            followUp,
            dossier,
            liveSnapshot,
            adjustmentDiff,
            performanceDelta
        });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || process.env.NODE_ENV === 'test') {
            return {
                whatsappCopy: fallbackCopy,
                usedFallback: true,
                followUpId: fuId,
                subType: followUp.subType,
                adjustmentDiff,
                performanceDelta
            };
        }

        const convRow = convRows?.[0]?.[0] || null;
        const dossierBlock = dossier
            ? AdminCopilotService.formatDossierForPrompt(dossier)
            : `PSICÓLOGO ID ${followUp.psychologistId} (${fullName})`;

        let subTypeDirective = '';
        if (followUp.subType === 'promessa_retorno') {
            subTypeDirective = 'OBJETIVO: retomar com leveza e naturalidade uma promessa/interesse de retorno combinado anteriormente, usando demanda real atual do nicho/plataforma sem soar cobrança fria.';
        } else if (followUp.subType === 'ajuste_perfil') {
            subTypeDirective = adjustmentDiff?.hasChanges
                ? `OBJETIVO: reconhecer que o profissional já fez alterações (${adjustmentDiff.changesList.join(', ')}), parabenizar de forma breve e avisar que seguiremos acompanhando os frutos nas próximas semanas.`
                : 'OBJETIVO: fazer check-in acolhedor sobre os ajustes de perfil combinados e oferecer ajuda prática rápida caso a rotina tenha apertado.';
        } else if (followUp.subType === 'avaliacao_pos_ajuste') {
            subTypeDirective = `OBJETIVO: apresentar a avaliação de desempenho ${performanceDelta?.daysSince || 14} dias após o ajuste comparando números reais (${performanceDelta?.summaryLine || ''}). Se melhorou, celebre com os números; se só visibilidade subiu, proponha micro-ajuste na bio/CTA; se estagnou, ofereça revisão conjunta sem tom negativo.`;
        } else if (followUp.subType === 'aviso_novidade') {
            subTypeDirective = 'OBJETIVO: avisar o profissional sobre a novidade/assunto combinado com tom consultivo e direto.';
        } else {
            subTypeDirective = 'OBJETIVO: dar continuidade humana ao combinado registrado na conversa anterior.';
        }

        const prompt = `Você é Anderson Costa, psicólogo clínico e fundador da Yelo. Escreva UMA mensagem curta e humana pronta para envio no WhatsApp.

REGRAS:
- Use *negrito* simples (nunca **duplo**). Use listas com "- " em linhas separadas quando citar métricas antes/depois.
- Separe blocos com linha em branco (\\n\\n).
- Máximo 1 emoji discreto.
- Nunca use jargão interno ("churn", "score", nome de tabela, SQL).
- Baseie números SOMENTE no contexto abaixo. Termine com 1 pergunta aberta natural.

${subTypeDirective}

FOLLOW-UP REGISTRADO:
- Subtipo: ${SUBTYPE_LABELS[followUp.subType] || followUp.subType}
- Data prevista: ${formatDateBrt(followUp.dueAt)}
- Motivo registrado: ${followUp.reason}
- Resumo de contexto: ${followUp.contextSummary || 'Não informado'}
${adjustmentDiff ? `- Estado do perfil agora: ${adjustmentDiff.summaryText}` : ''}
${performanceDelta ? `- Delta de desempenho pós-ajuste: ${JSON.stringify(performanceDelta)}` : ''}
${convRow?.finalReply || convRow?.aiResponse ? `- Última resposta enviada antes: ${String(convRow.finalReply || convRow.aiResponse).slice(0, 500)}` : ''}

DADOS VIVOS DO BANCO:
${dossierBlock}

Retorne APENAS o texto da mensagem de WhatsApp, sem aspas externas:`;

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const candidateModels = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
            let generated = null;

            for (const modelName of candidateModels) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 14000);
                try {
                    const model = genAI.getGenerativeModel({
                        model: modelName,
                        generationConfig: { temperature: 0.5, maxOutputTokens: 700 }
                    });
                    const res = await model.generateContent(prompt, {
                        timeout: 14000,
                        signal: controller.signal
                    });
                    const raw = res?.response?.text?.();
                    if (raw && raw.trim()) {
                        const formatted = formatForWhatsApp(raw.trim(), { preserveDashBullets: true });
                        const guard = CopilotOutputGuard.validatePlainReplyText(formatted);
                        if (guard.ok) {
                            generated = formatted;
                            break;
                        }
                    }
                } catch (_) {
                    // tenta proximo modelo
                } finally {
                    clearTimeout(timer);
                }
            }

            return {
                whatsappCopy: generated || fallbackCopy,
                usedFallback: !generated,
                followUpId: fuId,
                subType: followUp.subType,
                adjustmentDiff,
                performanceDelta
            };
        } catch (_) {
            return {
                whatsappCopy: fallbackCopy,
                usedFallback: true,
                followUpId: fuId,
                subType: followUp.subType,
                adjustmentDiff,
                performanceDelta
            };
        }
    }
}

CopilotFollowUpService.VALID_SUBTYPES = VALID_SUBTYPES;
CopilotFollowUpService.SUBTYPE_LABELS = SUBTYPE_LABELS;
CopilotFollowUpService.VALID_STATUSES = VALID_STATUSES;
CopilotFollowUpService.parseDueAtToBrtStart = parseDueAtToBrtStart;
CopilotFollowUpService.addDaysBrtYmd = addDaysBrtYmd;

module.exports = CopilotFollowUpService;
