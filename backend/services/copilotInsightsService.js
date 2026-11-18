// backend/services/copilotInsightsService.js
const db = require('../models');
const PsychologistContextService = require('./psychologistContextService');

let platformBenchmarkCache = { data: null, expiresAt: 0 };
const BENCHMARK_TTL_MS = 60 * 60 * 1000; // 1 hora em memória -> protege o Render

let collectiveInsightsCache = { data: null, expiresAt: 0 };
const INSIGHTS_TTL_MS = 10 * 60 * 1000; // 10 min

class CopilotInsightsService {
    static clearCache() {
        platformBenchmarkCache = { data: null, expiresAt: 0 };
        collectiveInsightsCache = { data: null, expiresAt: 0 };
    }

    /**
     * Benchmark leve agregado dos últimos 7 dias (com cache de 1h para não sobrecarregar Render).
     */
    static async getPlatformBenchmark7d() {
        const now = Date.now();
        if (platformBenchmarkCache.data && platformBenchmarkCache.expiresAt > now) {
            return platformBenchmarkCache.data;
        }

        const [rows] = await db.sequelize.query(`
            SELECT
                COUNT(DISTINCT p.id) AS active_count,
                (SELECT COUNT(*) FROM "MatchEvents" WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS matches_7d,
                (SELECT COUNT(*) FROM "WhatsAppClickLogs" WHERE "createdAt" >= NOW() - INTERVAL '7 days') AS clicks_7d
            FROM "Psychologists" p
            WHERE p.status = 'active'
              AND p."deletedAt" IS NULL
              AND COALESCE(p.profile_paused, false) = false;
        `).catch(() => [[{ active_count: 1, matches_7d: 0, clicks_7d: 0 }]]);

        const row = rows?.[0] || {};
        const activeCount = Math.max(1, parseInt(row.active_count || 1, 10));
        const avgMatches7d = Number((parseInt(row.matches_7d || 0, 10) / activeCount).toFixed(1));
        const avgClicks7d = Number((parseInt(row.clicks_7d || 0, 10) / activeCount).toFixed(1));

        const data = { activeCount, avgMatches7d, avgClicks7d };
        platformBenchmarkCache = { data, expiresAt: now + BENCHMARK_TTL_MS };
        return data;
    }

    /**
     * Fase 4: Diagnóstico CS individual 100% sob demanda (zero custo de IA quando não solicitado).
     * Compara funil 7d/30d contra média da plataforma e verifica se recomendações antigas já foram seguidas.
     */
    static async runOnDemandDiagnosis(psychologistId) {
        const id = parseInt(psychologistId, 10);
        if (Number.isNaN(id)) return null;

        const [dossier, benchmark] = await Promise.all([
            PsychologistContextService.buildDossier({ entityType: 'psychologist', entityId: id }),
            this.getPlatformBenchmark7d()
        ]);
        if (!dossier || !dossier.profile) return null;

        const p = dossier.profile;
        const sub = dossier.subscriptionSummary || {};
        const funnel = dossier.funnel || { total: {}, d30: {}, d7: {} };
        const memory = dossier.memory || {};

        const issues = [];
        const signals = [];

        if (sub.profilePaused) {
            issues.push('Perfil está pausado pelo profissional (não aparece nas buscas do Match).');
        }
        if (sub.isExpired) {
            issues.push(`Conta expirada/inativa (${sub.financialStatus || 'Vencida'}).`);
        } else if (sub.cancelAtPeriodEnd) {
            issues.push('Cancelamento agendado para o fim do ciclo atual.');
        }
        if (!p.bio_length || Number(p.bio_length) < 80) {
            issues.push('Bio muito curta (< 80 caracteres), reduzindo conversão após visualização.');
        }
        if (!p.valor_sessao_numero && p.tipo_cobranca !== 'mensal') {
            issues.push('Valor da sessão não informado explicitamente.');
        }
        if (dossier.exitSurvey?.motivo) {
            signals.push(`ExitSurvey registrado: "${dossier.exitSurvey.motivo}"`);
        }

        const psiMatches7d = Number(funnel.d7?.matches || 0);
        const psiClicks7d = Number(funnel.d7?.whatsappClicks || 0);
        if (benchmark.avgMatches7d > 0 && psiMatches7d < benchmark.avgMatches7d * 0.5 && !sub.profilePaused) {
            signals.push(`Match 7d abaixo da média (${psiMatches7d} vs média ${benchmark.avgMatches7d}).`);
        }
        if (psiMatches7d >= 5 && psiClicks7d === 0) {
            signals.push(`Aparece no Match (${psiMatches7d} em 7d), mas sem cliques no WhatsApp — possível gargalo em foto, bio ou valor.`);
        }

        // Cruza recomendações anteriores com updatedAt do perfil
        const recs = Array.isArray(memory.recommendationsGiven) ? memory.recommendationsGiven : [];
        const memUpdatedAt = memory.lastInteractionAt ? new Date(memory.lastInteractionAt) : null;
        const profileUpdatedAt = p.updatedAt ? new Date(p.updatedAt) : null;
        const profileUpdatedAfterRecommendation = Boolean(
            recs.length > 0 && memUpdatedAt && profileUpdatedAt && profileUpdatedAt > memUpdatedAt
        );

        let riskLevel = 'low';
        if (sub.cancelAtPeriodEnd || sub.isExpired || dossier.exitSurvey || (psiClicks7d === 0 && (funnel.d30?.whatsappClicks || 0) === 0 && Number(p.subscription_payments_count || 0) > 0)) {
            riskLevel = 'high';
        } else if (issues.length >= 2 || signals.length >= 2) {
            riskLevel = 'medium';
        }

        return {
            psychologistId: id,
            nome: p.nome,
            riskLevel,
            issues,
            signals,
            benchmark7d: benchmark,
            psychologist7d: {
                matches: psiMatches7d,
                whatsappClicks: psiClicks7d
            },
            previousRecommendations: recs,
            profileUpdatedAfterRecommendation,
            suggestedAction: issues[0] || signals[0] || 'Perfil saudável; manter acompanhamento padrão.'
        };
    }

    /**
     * Fase 6: Inteligência Coletiva agregada via SQL puro (sem custo de tokens por padrão).
     */
    static async getCollectiveInsights({ forceRefresh = false } = {}) {
        const now = Date.now();
        if (!forceRefresh && collectiveInsightsCache.data && collectiveInsightsCache.expiresAt > now) {
            return collectiveInsightsCache.data;
        }

        const [
            copilotStatsRows,
            categoryRows,
            rejectionRows,
            versionRows,
            exitSurveyRows,
            backlogRows
        ] = await Promise.all([
            db.sequelize.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE "feedbackStatus" = 'approved') AS approved,
                    COUNT(*) FILTER (WHERE "feedbackStatus" = 'edited') AS edited,
                    COUNT(*) FILTER (WHERE "feedbackStatus" = 'rejected') AS rejected,
                    COUNT(*) FILTER (WHERE "entityType" = 'lead' OR "entityType" = 'waiting_list') AS prospects
                FROM "AdminCopilotConversations";
            `).catch(() => [[{ total: 0, approved: 0, edited: 0, rejected: 0, prospects: 0 }]]),

            db.sequelize.query(`
                SELECT COALESCE("interactionCategory", 'nao_classificado') AS category, COUNT(*) AS count
                FROM "AdminCopilotConversations"
                GROUP BY 1
                ORDER BY count DESC
                LIMIT 6;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT "rejectionReason" AS reason, COUNT(*) AS count
                FROM "AdminCopilotConversations"
                WHERE "feedbackStatus" = 'rejected' AND "rejectionReason" IS NOT NULL
                GROUP BY 1
                ORDER BY count DESC
                LIMIT 5;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    COALESCE("promptVersion", 'v1-legado') AS version,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE "feedbackStatus" IN ('approved', 'edited')) AS accepted
                FROM "AdminCopilotConversations"
                GROUP BY 1
                ORDER BY total DESC;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT motivo, COUNT(*) AS count
                FROM "ExitSurveys"
                WHERE motivo IS NOT NULL
                GROUP BY 1
                ORDER BY count DESC
                LIMIT 5;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT category, COUNT(*) AS count
                FROM "AdminAdjustments"
                WHERE status <> 'concluido'
                GROUP BY 1
                ORDER BY count DESC
                LIMIT 5;
            `).catch(() => [[]])
        ]);

        const s = copilotStatsRows?.[0]?.[0] || {};
        const total = parseInt(s.total || 0, 10);
        const accepted = parseInt(s.approved || 0, 10) + parseInt(s.edited || 0, 10);
        const evaluated = accepted + parseInt(s.rejected || 0, 10);

        const data = {
            sampleSize: total,
            evaluatedCount: evaluated,
            approvalRate: evaluated > 0 ? Math.round((accepted / evaluated) * 100) : null,
            counts: {
                total,
                approved: parseInt(s.approved || 0, 10),
                edited: parseInt(s.edited || 0, 10),
                rejected: parseInt(s.rejected || 0, 10),
                prospects: parseInt(s.prospects || 0, 10)
            },
            topCategories: (categoryRows?.[0] || []).map(r => ({ category: r.category, count: parseInt(r.count || 0, 10) })),
            topRejectionReasons: (rejectionRows?.[0] || []).map(r => ({ reason: r.reason, count: parseInt(r.count || 0, 10) })),
            promptVersions: (versionRows?.[0] || []).map(r => ({
                version: r.version,
                total: parseInt(r.total || 0, 10),
                accepted: parseInt(r.accepted || 0, 10)
            })),
            topExitSurveyReasons: (exitSurveyRows?.[0] || []).map(r => ({ motivo: r.motivo, count: parseInt(r.count || 0, 10) })),
            openBacklogByCategory: (backlogRows?.[0] || []).map(r => ({ category: r.category, count: parseInt(r.count || 0, 10) }))
        };

        collectiveInsightsCache = { data, expiresAt: now + INSIGHTS_TTL_MS };
        return data;
    }
}

module.exports = CopilotInsightsService;
