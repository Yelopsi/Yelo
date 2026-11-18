// backend/services/copilotInsightsService.js
const db = require('../models');
const PsychologistContextService = require('./psychologistContextService');

let platformBenchmarkCache = { data: null, expiresAt: 0 };
const BENCHMARK_TTL_MS = 60 * 60 * 1000; // 1 hora em memória -> protege o Render

let platformFullSnapshotCache = { data: null, expiresAt: 0 };
const FULL_SNAPSHOT_TTL_MS = 15 * 60 * 1000; // 15 min para contexto Copilot sem sobrecarregar Render

let collectiveInsightsCache = { data: null, expiresAt: 0 };
const INSIGHTS_TTL_MS = 10 * 60 * 1000; // 10 min

const KNOWN_APPROACH_TERMS = [
    { label: 'Psicanálise', patterns: ['psicanal', 'lacan', 'freud', 'winnicott'] },
    { label: 'TCC', patterns: ['tcc', 'cognitivo', 'cognitiva'] },
    { label: 'ACT', patterns: ['act', 'aceitacao e compromisso'] },
    { label: 'Análise do Comportamento', patterns: ['comportamental', 'behavior', 'aba'] },
    { label: 'Gestalt', patterns: ['gestalt'] },
    { label: 'Humanista', patterns: ['humanista', 'acp', 'centrada na pessoa', 'fenomenolog'] },
    { label: 'Sistêmica', patterns: ['sistemica', 'familiar'] },
    { label: 'Junguiana', patterns: ['jung'] },
    { label: 'Histórico-Cultural', patterns: ['historico-cultural', 'historico cultural'] }
];

const KNOWN_THEME_TERMS = [
    { label: 'Ansiedade / Estresse / Tristeza', query: 'Ansiedade', patterns: ['ansiedade', 'estresse', 'panico', 'tristeza', 'depress'] },
    { label: 'Relacionamentos / Casal', query: 'Relacionamentos', patterns: ['relacionamento', 'casal', 'amor', 'sexualidade'] },
    { label: 'Autoconhecimento / Autoestima', query: 'Autoconhecimento', patterns: ['autoconhecimento', 'autoestima'] },
    { label: 'Luto / Traumas', query: 'Luto', patterns: ['luto', 'trauma'] },
    { label: 'Carreira / Trabalho', query: 'Carreira', patterns: ['carreira', 'trabalho', 'burnout'] },
    { label: 'Neurodiversidade (TDAH/Autismo)', query: 'Neurodiversidade', patterns: ['tdah', 'autismo', 'tea', 'neurodiversidade'] },
    { label: 'Infantil / Adolescente', query: 'Infantil', patterns: ['infantil', 'crianca', 'adolescente'] }
];

const KNOWN_CITIES_STATES = [
    { label: 'São Paulo (SP)', cityLike: '%sao paulo%', uf: 'SP', patterns: ['sao paulo', 'sp'] },
    { label: 'Rio de Janeiro (RJ)', cityLike: '%rio de janeiro%', uf: 'RJ', patterns: ['rio de janeiro', 'rj'] },
    { label: 'Belo Horizonte (MG)', cityLike: '%belo horizonte%', uf: 'MG', patterns: ['belo horizonte', 'bh', 'mg'] },
    { label: 'Curitiba (PR)', cityLike: '%curitiba%', uf: 'PR', patterns: ['curitiba', 'pr'] },
    { label: 'Porto Alegre (RS)', cityLike: '%porto alegre%', uf: 'RS', patterns: ['porto alegre', 'rs'] },
    { label: 'Brasília (DF)', cityLike: '%brasilia%', uf: 'DF', patterns: ['brasilia', 'df'] },
    { label: 'Campinas (SP)', cityLike: '%campinas%', uf: 'SP', patterns: ['campinas'] },
    { label: 'Salvador (BA)', cityLike: '%salvador%', uf: 'BA', patterns: ['salvador', 'ba'] },
    { label: 'Florianópolis (SC)', cityLike: '%florianopolis%', uf: 'SC', patterns: ['florianopolis', 'sc'] },
    { label: 'Recife (PE)', cityLike: '%recife%', uf: 'PE', patterns: ['recife', 'pe'] },
    { label: 'Fortaleza (CE)', cityLike: '%fortaleza%', uf: 'CE', patterns: ['fortaleza', 'ce'] },
    { label: 'Goiânia (GO)', cityLike: '%goiania%', uf: 'GO', patterns: ['goiania', 'go'] }
];

function normalizeSearchText(str) {
    return String(str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

class CopilotInsightsService {
    static clearCache() {
        platformBenchmarkCache = { data: null, expiresAt: 0 };
        platformFullSnapshotCache = { data: null, expiresAt: 0 };
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

    /**
     * Snapshot agregado completo da plataforma (com cache de 15 min) diretamente no banco do Render.
     * Usado pelo Copilot para responder perguntas sobre pacientes/mês, fluxo de demanda, conversão e valores reais.
     */
    static async getPlatformMetricsFull({ forceRefresh = false } = {}) {
        const now = Date.now();
        if (!forceRefresh && platformFullSnapshotCache.data && platformFullSnapshotCache.expiresAt > now) {
            return platformFullSnapshotCache.data;
        }

        const [
            baseRows,
            monthlyWppRows,
            monthlyDemandRows,
            monthlyMatchRows,
            activeDistRows,
            tierPerfRows,
            funnel90dRows,
            demandTemasRows,
            demandFaixaRows,
            demandModRows,
            ecosystemRows,
            observedPaymentsRows
        ] = await Promise.all([
            db.sequelize.query(`
                SELECT
                    COUNT(*) FILTER (WHERE status = 'active' AND "deletedAt" IS NULL AND COALESCE(profile_paused, false) = false)::int AS active_visible,
                    COUNT(*) FILTER (WHERE status = 'active' AND "deletedAt" IS NULL AND COALESCE(profile_paused, false) = true)::int AS active_paused,
                    COUNT(*) FILTER (WHERE status = 'active' AND "deletedAt" IS NULL AND ("subscriptionId" IS NOT NULL OR COALESCE("subscription_payments_count", 0) > 0))::int AS active_paying,
                    COUNT(*) FILTER (WHERE "deletedAt" IS NULL)::int AS total_registered,
                    (SELECT COUNT(*)::int FROM "WaitingLists" WHERE COALESCE(status, 'pending') <> 'registered') AS waiting_list,
                    (SELECT COUNT(*)::int FROM "Leads") AS leads_total
                FROM "Psychologists";
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                    COUNT(*)::int AS clicks,
                    COUNT(*) FILTER (WHERE "feedbackGiven" = true)::int AS feedbacks,
                    COUNT(*) FILTER (WHERE "contactReceived" = true)::int AS contacts,
                    COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true'))::int AS deals,
                    COUNT(*) FILTER (WHERE "dealClosed" = 'talking' OR status = 'negotiating')::int AS talking,
                    COUNT(DISTINCT "psychologistId")::int AS psis_with_clicks
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= NOW() - INTERVAL '3 months'
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 3;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                    COUNT(*)::int AS total_searches,
                    COUNT(*) FILTER (
                        WHERE status = 'completed'
                          AND COALESCE(is_disqualified, false) = false
                          AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                    )::int AS patient_completed
                FROM "DemandSearches"
                WHERE "createdAt" >= NOW() - INTERVAL '3 months'
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 3;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
                    COUNT(*)::int AS matches,
                    COUNT(DISTINCT "psychologistId")::int AS psis_matched
                FROM "MatchEvents"
                WHERE "createdAt" >= NOW() - INTERVAL '3 months'
                GROUP BY 1
                ORDER BY 1 DESC
                LIMIT 3;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    COUNT(*)::int AS total_active_visible,
                    COUNT(*) FILTER (WHERE c30 > 0)::int AS with_clicks_30d,
                    ROUND(AVG(c30)::numeric, 2) AS avg_clicks_all,
                    ROUND(AVG(c30) FILTER (WHERE c30 > 0)::numeric, 2) AS avg_clicks_receiving,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY c30)::numeric, 1) AS median_clicks_30d,
                    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY c30)::numeric, 1) AS p75_clicks_30d,
                    MAX(c30)::int AS max_clicks_30d,
                    COUNT(*) FILTER (WHERE d30 > 0)::int AS with_deals_30d,
                    ROUND(AVG(d30)::numeric, 2) AS avg_deals_all,
                    ROUND(AVG(d30) FILTER (WHERE d30 > 0)::numeric, 2) AS avg_deals_among_closing,
                    MAX(d30)::int AS max_deals_30d
                FROM (
                    SELECT
                        p.id,
                        COUNT(w.id)::int AS c30,
                        COUNT(w.id) FILTER (WHERE w."dealClosed" IN ('yes', 'started', 'true'))::int AS d30
                    FROM "Psychologists" p
                    LEFT JOIN "WhatsAppClickLogs" w
                        ON w."psychologistId" = p.id
                       AND w."createdAt" >= NOW() - INTERVAL '30 days'
                    WHERE p.status = 'active'
                      AND p."deletedAt" IS NULL
                      AND COALESCE(p.profile_paused, false) = false
                    GROUP BY p.id
                ) t;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    CASE
                        WHEN COALESCE(valor_sessao_numero, 0) <= 0 THEN 'a_combinar'
                        WHEN valor_sessao_numero <= 90 THEN 'ate_90'
                        WHEN valor_sessao_numero <= 150 THEN '91_a_150'
                        ELSE 'acima_150'
                    END AS tier,
                    COUNT(DISTINCT p.id)::int AS psis,
                    COUNT(w.id)::int AS clicks_30d,
                    COUNT(w.id) FILTER (WHERE w."contactReceived" = true)::int AS contacts_30d,
                    COUNT(w.id) FILTER (WHERE w."dealClosed" IN ('yes', 'started', 'true'))::int AS deals_30d
                FROM "Psychologists" p
                LEFT JOIN "WhatsAppClickLogs" w
                    ON w."psychologistId" = p.id
                   AND w."createdAt" >= NOW() - INTERVAL '30 days'
                WHERE p.status = 'active'
                  AND p."deletedAt" IS NULL
                  AND COALESCE(p.profile_paused, false) = false
                GROUP BY 1;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    COUNT(*)::int AS clicks_90d,
                    COUNT(*) FILTER (WHERE "feedbackGiven" = true)::int AS feedbacks_90d,
                    COUNT(*) FILTER (WHERE "contactReceived" = true)::int AS contacts_90d,
                    COUNT(*) FILTER (WHERE "dealClosed" IN ('yes', 'started', 'true'))::int AS deals_90d,
                    COUNT(*) FILTER (WHERE "dealClosed" = 'talking' OR status = 'negotiating')::int AS talking_90d
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= NOW() - INTERVAL '90 days';
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT "searchParams"->>'temas' AS tema, COUNT(*)::int AS total
                FROM "DemandSearches"
                WHERE status = 'completed'
                  AND COALESCE(is_disqualified, false) = false
                  AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                  AND "createdAt" >= NOW() - INTERVAL '30 days'
                  AND "searchParams"->>'temas' IS NOT NULL
                GROUP BY 1
                ORDER BY total DESC
                LIMIT 6;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT "searchParams"->>'faixa_valor' AS faixa, COUNT(*)::int AS total
                FROM "DemandSearches"
                WHERE status = 'completed'
                  AND COALESCE(is_disqualified, false) = false
                  AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                  AND "createdAt" >= NOW() - INTERVAL '30 days'
                  AND "searchParams"->>'faixa_valor' IS NOT NULL
                GROUP BY 1
                ORDER BY total DESC;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT "searchParams"->>'modalidade_atendimento' AS mod, COUNT(*)::int AS total
                FROM "DemandSearches"
                WHERE status = 'completed'
                  AND COALESCE(is_disqualified, false) = false
                  AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                  AND "createdAt" >= NOW() - INTERVAL '30 days'
                  AND "searchParams"->>'modalidade_atendimento' IS NOT NULL
                GROUP BY 1
                ORDER BY total DESC;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT
                    (SELECT COUNT(*)::int FROM "Reviews") AS reviews_total,
                    (SELECT ROUND(AVG(rating)::numeric, 2) FROM "Reviews") AS reviews_avg,
                    (SELECT COUNT(*)::int FROM "PlatformReviews") AS platform_reviews_total,
                    (SELECT ROUND(AVG(rating)::numeric, 2) FROM "PlatformReviews") AS platform_reviews_avg,
                    (SELECT COUNT(*)::int FROM questions) AS qna_questions,
                    (SELECT COUNT(*)::int FROM answers) AS qna_answers,
                    (SELECT COUNT(*)::int FROM posts) AS blog_posts,
                    (SELECT COUNT(*)::int FROM "ProfileAppearanceLogs" WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS views_30d,
                    (SELECT COUNT(*)::int FROM "SiteVisits" WHERE "createdAt" >= NOW() - INTERVAL '30 days') AS site_visits_30d;
            `).catch(() => [[]]),

            db.sequelize.query(`
                SELECT p.plano, py.value, COUNT(*)::int AS count
                FROM "Payments" py
                JOIN "Psychologists" p ON p.id = py."psychologistId"
                WHERE py.status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH')
                  AND COALESCE(py.value, 0) > 0
                GROUP BY 1, 2
                ORDER BY count DESC
                LIMIT 3;
            `).catch(() => [[]])
        ]);

        const base = baseRows?.[0]?.[0] || null;
        const activeDist = activeDistRows?.[0]?.[0] || null;
        const funnel90d = funnel90dRows?.[0]?.[0] || null;
        const eco = ecosystemRows?.[0]?.[0] || null;

        const hasRealData = Boolean(
            (base && Number(base.active_visible || 0) > 0) ||
            (monthlyWppRows?.[0] || []).length > 0 ||
            (monthlyDemandRows?.[0] || []).length > 0 ||
            (observedPaymentsRows?.[0] || []).length > 0
        );

        const data = {
            hasRealData,
            base,
            monthlyWpp: monthlyWppRows?.[0] || [],
            monthlyDemand: monthlyDemandRows?.[0] || [],
            monthlyMatch: monthlyMatchRows?.[0] || [],
            activeDist,
            tierPerf: tierPerfRows?.[0] || [],
            funnel90d,
            demandTemas30d: demandTemasRows?.[0] || [],
            demandFaixa30d: demandFaixaRows?.[0] || [],
            demandMod30d: demandModRows?.[0] || [],
            ecosystem: eco,
            observedPayments: observedPaymentsRows?.[0] || []
        };

        platformFullSnapshotCache = { data, expiresAt: now + FULL_SNAPSHOT_TTL_MS };
        return data;
    }

    /**
     * Consultas dinâmicas sob demanda guiadas pelos termos presentes na conversa/pergunta.
     */
    static async _queryDynamicTopics({ text = '', dossier = null } = {}) {
        const norm = normalizeSearchText(text);
        if (!norm) return [];
        const notes = [];

        const matchedApproaches = KNOWN_APPROACH_TERMS.filter(a => a.patterns.some(p => norm.includes(p))).slice(0, 2);
        const matchedThemes = KNOWN_THEME_TERMS.filter(t => t.patterns.some(p => norm.includes(p))).slice(0, 2);
        const matchedCities = KNOWN_CITIES_STATES.filter(c =>
            c.patterns.some(p => (p.length <= 2 ? new RegExp(`\\b${p}\\b`).test(norm) : norm.includes(p)))
        ).slice(0, 2);

        const tasks = [];

        for (const ap of matchedApproaches) {
            tasks.push(
                db.sequelize.query(`
                    SELECT
                        (SELECT COUNT(*)::int FROM "DemandSearches"
                         WHERE status = 'completed'
                           AND COALESCE(is_disqualified, false) = false
                           AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                           AND "createdAt" >= NOW() - INTERVAL '30 days'
                           AND ("searchParams"->>'abordagem_ideal')::text ILIKE :pat) AS searches_30d,
                        (SELECT COUNT(*)::int FROM "Psychologists"
                         WHERE status = 'active' AND "deletedAt" IS NULL AND COALESCE(profile_paused, false) = false
                           AND abordagens_tecnicas::text ILIKE :pat) AS active_psis;
                `, { replacements: { pat: `%${ap.label.split(' ')[0]}%` } })
                    .then(([rows]) => {
                        const r = rows?.[0];
                        if (r && (Number(r.searches_30d) > 0 || Number(r.active_psis) > 0)) {
                            notes.push(`Abordagem *${ap.label}*: ${r.searches_30d} buscas de pacientes nos últimos 30d vs ${r.active_psis} psicólogos ativos nessa abordagem.`);
                        }
                    })
                    .catch(() => {})
            );
        }

        for (const th of matchedThemes) {
            tasks.push(
                db.sequelize.query(`
                    SELECT
                        (SELECT COUNT(*)::int FROM "DemandSearches"
                         WHERE status = 'completed'
                           AND COALESCE(is_disqualified, false) = false
                           AND COALESCE("searchParams"->>'respondent_type', 'patient') = 'patient'
                           AND "createdAt" >= NOW() - INTERVAL '30 days'
                           AND ("searchParams"->>'temas')::text ILIKE :pat) AS searches_30d,
                        (SELECT COUNT(*)::int FROM "Psychologists"
                         WHERE status = 'active' AND "deletedAt" IS NULL AND COALESCE(profile_paused, false) = false
                           AND temas_atuacao::text ILIKE :pat) AS active_psis;
                `, { replacements: { pat: `%${th.query}%` } })
                    .then(([rows]) => {
                        const r = rows?.[0];
                        if (r && (Number(r.searches_30d) > 0 || Number(r.active_psis) > 0)) {
                            notes.push(`Tema *${th.label}*: ${r.searches_30d} buscas de pacientes em 30d vs ${r.active_psis} psicólogos ativos.`);
                        }
                    })
                    .catch(() => {})
            );
        }

        for (const loc of matchedCities) {
            tasks.push(
                db.sequelize.query(`
                    SELECT
                        COUNT(*) FILTER (WHERE status = 'active' AND "deletedAt" IS NULL AND COALESCE(profile_paused, false) = false)::int AS active_psis,
                        COUNT(*) FILTER (WHERE status = 'active' AND "deletedAt" IS NULL AND modalidade::text ILIKE '%Presencial%')::int AS presencial_psis
                    FROM "Psychologists"
                    WHERE translate(lower(COALESCE(cidade, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE :cityLike
                       OR UPPER(COALESCE(estado, '')) = :uf;
                `, { replacements: { cityLike: loc.cityLike, uf: loc.uf } })
                    .then(([rows]) => {
                        const r = rows?.[0];
                        if (r && Number(r.active_psis) > 0) {
                            notes.push(`Região *${loc.label}*: ${r.active_psis} psicólogos ativos cadastrados (${r.presencial_psis} atendem presencialmente).`);
                        }
                    })
                    .catch(() => {})
            );
        }

        await Promise.all(tasks);

        if (dossier?.nicheDemand?.priceBucket) {
            notes.push(`Faixa do profissional (${dossier.nicheDemand.priceBucket}): ${dossier.nicheDemand.bucketSearches30d} buscas completas de pacientes em 30d (${dossier.nicheDemand.sharePct ?? 0}% da demanda total).`);
        }

        return notes;
    }

    /**
     * Constrói blocos completos do banco Render (métricas globais + consultas dinâmicas por tema/cidade)
     * para injeção no Copilot com 0 PII.
     */
    static async getPlatformDatabaseContext({ pastedChat = '', adminInstruction = '', dossier = null } = {}) {
        const [snap, dynamicNotes] = await Promise.all([
            this.getPlatformMetricsFull(),
            this._queryDynamicTopics({ text: `${pastedChat}\n${adminInstruction}`, dossier })
        ]);

        let platformMetricsBlock = '';
        if (snap && snap.hasRealData) {
            const lines = ['PLATFORM_DB_METRICS (dados reais agregados do banco PostgreSQL no Render):'];
            if (snap.base && Number(snap.base.active_visible || 0) > 0) {
                lines.push(`- Base de psicólogos: ${snap.base.active_visible} ativos visíveis nas buscas (${snap.base.active_paying || 0} pagantes ativos, ${snap.base.active_paused || 0} pausados) | Lista de espera: ${snap.base.waiting_list || 0} | Leads CRM: ${snap.base.leads_total || 0}`);
            }

            if (snap.monthlyDemand.length > 0 || snap.monthlyWpp.length > 0 || snap.monthlyMatch.length > 0) {
                const demandMap = new Map(snap.monthlyDemand.map(d => [d.month, d]));
                const wppMap = new Map(snap.monthlyWpp.map(w => [w.month, w]));
                const matchMap = new Map(snap.monthlyMatch.map(m => [m.month, m]));
                const months = Array.from(new Set([...demandMap.keys(), ...wppMap.keys(), ...matchMap.keys()])).sort().reverse().slice(0, 3);
                const monthlyParts = months.map(m => {
                    const d = demandMap.get(m) || {};
                    const w = wppMap.get(m) || {};
                    const mt = matchMap.get(m) || {};
                    return `${m}: ${d.patient_completed || 0} buscas pacientes (${mt.matches || 0} matches) -> ${w.clicks || 0} cliques WPP em ${w.psis_with_clicks || 0} psis -> ${w.contacts || 0} contatos confirmados -> ${w.deals || 0} pacientes fechados (+${w.talking || 0} em negociação)`;
                });
                lines.push(`- Evolução mensal recente:\n  * ${monthlyParts.join('\n  * ')}`);
            }

            const ad = snap.activeDist;
            if (ad && Number(ad.total_active_visible || 0) > 0) {
                const pctReceiving = Math.round((Number(ad.with_clicks_30d || 0) / Math.max(1, Number(ad.total_active_visible))) * 100);
                lines.push(`- Média mensal por psicólogo ativo visível (últimos 30d): ${pctReceiving}% receberam cliques no WPP | Média geral: ${ad.avg_clicks_all || 0} cliques/mês | Entre os que receberam cliques: ${ad.avg_clicks_receiving || 0} cliques/mês (P75: ${ad.p75_clicks_30d || 0}, Máximo: ${ad.max_clicks_30d || 0} cliques/mês) | Fechamentos confirmados por feedback (30d): média ${ad.avg_deals_all || 0}/mês no geral e ${ad.avg_deals_among_closing || 0}/mês entre quem confirmou fechamento (máximo: ${ad.max_deals_30d || 0}/mês, fora contatos sem feedback preenchido).`);
            }

            const f90 = snap.funnel90d;
            if (f90 && Number(f90.clicks_90d || 0) > 0) {
                const feedbacks = Math.max(1, Number(f90.feedbacks_90d || 0));
                const contacts = Number(f90.contacts_90d || 0);
                const deals = Number(f90.deals_90d || 0);
                const contactRate = f90.feedbacks_90d > 0 ? Math.round((contacts / feedbacks) * 100) : Math.round((contacts / Number(f90.clicks_90d)) * 100);
                const closeFromContactRate = contacts > 0 ? Math.round((deals / contacts) * 100) : 0;
                lines.push(`- Taxas de conversão reais (90d, ${f90.clicks_90d} cliques, ${f90.feedbacks_90d} com feedback): ${contactRate}% viraram conversa iniciada no WhatsApp (${contacts}); entre conversas iniciadas, ${closeFromContactRate}% já iniciaram terapia (${deals} pacientes fechados + ${f90.talking_90d || 0} em negociação).`);
            }

            if (snap.tierPerf.length > 0) {
                const tierLabels = { ate_90: 'Até R$90', '91_a_150': 'R$91-150', acima_150: '>R$150', a_combinar: 'A combinar' };
                const tierSummary = snap.tierPerf
                    .filter(t => Number(t.psis || 0) > 0)
                    .map(t => `${tierLabels[t.tier] || t.tier}: ${t.psis} psis, ${t.clicks_30d} cliques/30d, ${t.deals_30d} fechamentos/30d`)
                    .join(' | ');
                if (tierSummary) lines.push(`- Desempenho por faixa de sessão (30d): ${tierSummary}`);
            }

            if (snap.demandFaixa30d.length > 0) {
                const totalF = snap.demandFaixa30d.reduce((a, b) => a + Number(b.total || 0), 0) || 1;
                const faixas = snap.demandFaixa30d.map(f => `${f.faixa}: ${f.total} (${Math.round((Number(f.total) / totalF) * 100)}%)`).join(' | ');
                lines.push(`- Demanda de pacientes por valor (30d): ${faixas}`);
            }

            if (snap.demandMod30d.length > 0) {
                const mods = snap.demandMod30d.map(m => `${m.mod}: ${m.total}`).join(' | ');
                lines.push(`- Modalidade buscada (30d): ${mods}`);
            }

            if (snap.demandTemas30d.length > 0) {
                const temas = snap.demandTemas30d.slice(0, 5).map(t => `${t.tema} (${t.total})`).join(', ');
                lines.push(`- Temas mais buscados (30d): ${temas}`);
            }

            if (snap.ecosystem && (Number(snap.ecosystem.reviews_total || 0) > 0 || Number(snap.ecosystem.qna_answers || 0) > 0)) {
                const e = snap.ecosystem;
                lines.push(`- Ecossistema e provas sociais: ${e.site_visits_30d || 0} visitas no site/30d, ${e.views_30d || 0} visitas em perfis/30d, ${e.reviews_total || 0} avaliações de pacientes (média ${e.reviews_avg || '-'}/5), ${e.qna_questions || 0} perguntas e ${e.qna_answers || 0} respostas públicas no Q&A, ${e.blog_posts || 0} artigos publicados.`);
            }

            if (snap.observedPayments && snap.observedPayments.length > 0) {
                const payText = snap.observedPayments
                    .map(p => `Plano ${PsychologistContextService.formatPlanDisplayName(p.plano) || p.plano}: R$ ${Number(p.value).toFixed(2).replace('.', ',')} (${p.count} cobranças confirmadas)`)
                    .join(' | ');
                lines.push(`- Pagamentos reais confirmados no banco (Payments): ${payText}`);
            }

            lines.push('- Funcionalidades atuais confirmadas na plataforma Yelo: Vitrine + Match inteligente, Gestão de Pacientes, Agenda/Sessões, Controle Financeiro, Blog clínico, Q&A público de pacientes, Avaliações Yelo + sincronização Google Meu Negócio e Comunidade/Fórum. NÃO possui módulo de prontuário eletrônico clínico.');

            platformMetricsBlock = lines.join('\n');
        }

        const dynamicDbBlock = dynamicNotes.length > 0
            ? `DYNAMIC_DB_QUERY_RESULTS (consultas diretas para os tópicos da mensagem):\n- ${dynamicNotes.join('\n- ')}`
            : '';

        return {
            platformMetricsBlock,
            dynamicDbBlock,
            snapshot: snap
        };
    }
}

module.exports = CopilotInsightsService;
