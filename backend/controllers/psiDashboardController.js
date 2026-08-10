// Arquivo: backend/controllers/psiDashboardController.js

const db = require('../models');
const { Op } = require('sequelize');
const gamificationService = require('../services/gamificationService');

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/stats (NOVA - OTIMIZADA)
// ----------------------------------------------------------------------
exports.getStats = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;
        const { period } = req.query; 

        const psychologist = await db.Psychologist.findByPk(psychologistId, { attributes: ['temas_atuacao', 'xp', 'profile_appearances', 'whatsapp_clicks'] });
        const psiTemas = psychologist?.temas_atuacao || [];

        let dateCondition = "";
        const replacements = { psiId: psychologistId };

        if (period === 'last30days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '30 days'`;
        } else if (period === 'last7days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '7 days'`;
        } else if (period === 'last90days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '90 days'`;
        }

        if (psiTemas.length > 0) {
            replacements.psiTemas = psiTemas;
        }

        const [
            clicksResult, appearancesResult, favoritesResult, topDemandsResult,
            totalDemandsResult, xpHistoryResult, blogPostCountResult, forumPostCountResult,
            forumCommentCountResult, answerCountResult, matchesResult, blogLikesResult
        ] = await Promise.all([
            db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE source = 'match' OR source = 'profile_click_funnel') as match_clicks, COUNT(*) FILTER (WHERE source = 'direct_view' OR source IS NULL) as direct_clicks, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "WhatsAppClickLogs" WHERE "psychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE source = 'match' OR source = 'profile_click_funnel') as match_clicks, COUNT(*) FILTER (WHERE source = 'direct_view' OR source IS NULL) as direct_clicks, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "WhatsAppClickLogs" WHERE "PsychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(err => [{ total: 0, match_clicks: 0, direct_clicks: 0, today: 0, last_7d: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE source = 'match' OR source = 'profile_click_funnel') as match_views, COUNT(*) FILTER (WHERE source = 'direct_view' OR source IS NULL) as direct_views, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE source = 'match' OR source = 'profile_click_funnel') as match_views, COUNT(*) FILTER (WHERE source = 'direct_view' OR source IS NULL) as direct_views, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "ProfileAppearanceLogs" WHERE "PsychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(err => [{ total: 0, match_views: 0, direct_views: 0, today: 0, last_7d: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "PsychologistId" = :psiId`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "psychologistId" = :psiId`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(err => [{ count: 0 }]),
            db.sequelize.query(`SELECT value as name, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value WHERE status = 'completed' ${dateCondition} AND jsonb_typeof("searchParams"->'temas') = 'array' ${psiTemas.length > 0 ? `AND "searchParams"->'temas' ?| array[:psiTemas]` : ''} GROUP BY value ORDER BY count DESC LIMIT 3`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(err => []),
            db.sequelize.query(`SELECT COUNT(*) as total FROM "DemandSearches" WHERE status = 'completed' ${dateCondition} AND "searchParams"->'temas' IS NOT NULL AND jsonb_typeof("searchParams"->'temas') = 'array' AND jsonb_array_length("searchParams"->'temas') > 0 ${psiTemas.length > 0 ? `AND "searchParams"->'temas' ?| array[:psiTemas]` : ''}`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(err => [{ total: 0 }]),
            db.sequelize.query(`SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, SUM("points") as points FROM "GamificationLogs" WHERE "psychologistId" = :psiId ${dateCondition} GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD') ORDER BY date ASC`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, SUM("points") as points FROM "GamificationLogs" WHERE "PsychologistId" = :psiId ${dateCondition} GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD') ORDER BY date ASC`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(err => []),
            db.sequelize.query(`SELECT COUNT(*) as count FROM posts WHERE psychologist_id = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM posts WHERE "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT })).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as count FROM "ForumPosts" WHERE "PsychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "ForumPosts" WHERE "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT })).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as count FROM "ForumComments" WHERE "PsychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "ForumComments" WHERE "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT })).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as count FROM "answers" WHERE "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "answers" WHERE "PsychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT })).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "MatchEvents" WHERE "psychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE "createdAt" >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date) as today, COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 days') as last_7d FROM "MatchEvents" WHERE "PsychologistId" = :psiId ${dateCondition}`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(err => [{ total: 0, today: 0, last_7d: 0 }]),
            db.sequelize.query(`SELECT SUM(curtidas) as sum FROM "posts" WHERE "psychologist_id" = :psiId`, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT SUM(curtidas) as sum FROM "posts" WHERE "psychologistId" = :psiId`, { replacements, type: db.sequelize.QueryTypes.SELECT })).catch(() => [{ sum: 0 }])
        ]);

        const blogPostCount = parseInt(blogPostCountResult[0]?.count || 0, 10);
        const forumPostCount = parseInt(forumPostCountResult[0]?.count || 0, 10);
        const forumCommentCount = parseInt(forumCommentCountResult[0]?.count || 0, 10);
        const answerCount = parseInt(answerCountResult[0]?.count || 0, 10);

        let whatsappClicks = parseInt(clicksResult[0]?.total || clicksResult[0]?.count || 0, 10);
        if (!period || period === 'all' || period === 'all_time') whatsappClicks += (psychologist?.whatsapp_clicks || 0);
        
        const whatsappMatch = parseInt(clicksResult[0]?.match_clicks || 0, 10);
        const whatsappDirect = parseInt(clicksResult[0]?.direct_clicks || 0, 10);
        const whatsappClicksToday = parseInt(clicksResult[0]?.today || 0, 10);
        const whatsappClicks7d = parseInt(clicksResult[0]?.last_7d || 0, 10);
        
        const profileViews = parseInt(appearancesResult[0]?.total || appearancesResult[0]?.count || 0, 10);
        const profileViewsMatch = parseInt(appearancesResult[0]?.match_views || 0, 10);
        const profileViewsDirect = parseInt(appearancesResult[0]?.direct_views || 0, 10);
        const profileViewsToday = parseInt(appearancesResult[0]?.today || 0, 10);
        const profileViews7d = parseInt(appearancesResult[0]?.last_7d || 0, 10);
        
        let matchImpressions = parseInt(matchesResult[0]?.total || matchesResult[0]?.count || 0, 10);
        if (!period || period === 'all' || period === 'all_time') matchImpressions += (psychologist?.profile_appearances || 0);
        
        const matchImpressionsToday = parseInt(matchesResult[0]?.today || 0, 10);
        const matchImpressions7d = parseInt(matchesResult[0]?.last_7d || 0, 10);
        
        const favoritesCount = parseInt(favoritesResult[0]?.count || 0, 10);
        const blogLikes = parseInt(blogLikesResult[0]?.sum || 0, 10);

        const safeCalc = (numerator, denominator) => (!denominator || denominator <= 0) ? 0 : parseFloat(((numerator / denominator) * 100).toFixed(1));

        const funnelRates = {
            matchToProfileViewRate: safeCalc(profileViewsMatch, matchImpressions),
            directViewToWhatsappRate: safeCalc(whatsappDirect, profileViewsDirect),
            profileConversion: safeCalc(whatsappMatch, profileViewsMatch),
            finalConversion: safeCalc(whatsappClicks, matchImpressions)
        };

        const totalDemands = parseInt(totalDemandsResult[0]?.total || 0, 10);
        const topDemands = topDemandsResult.map(demanda => ({
            name: demanda.name, count: parseInt(demanda.count, 10),
            percentage: totalDemands > 0 ? Math.round((parseInt(demanda.count, 10) / totalDemands) * 100) : 0
        }));

        const myEngagement = psychologist?.xp || 0;
        const [betterThanResult] = await db.sequelize.query(`SELECT COALESCE(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active'), 0), 0) as percentage FROM "Psychologists" WHERE status = 'active' AND xp < :myEngagement`, { replacements: { myEngagement }, type: db.sequelize.QueryTypes.SELECT });
        const betterThanPercentage = Math.round(parseFloat(betterThanResult?.percentage || 0));

        let lastPostDate = null, lastForumDate = null, lastCommentDate = null;
        try { const [postRes] = await db.sequelize.query(`SELECT MAX(COALESCE(created_at, "createdAt")) as last_date FROM posts WHERE psychologist_id = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }); lastPostDate = postRes?.last_date; } catch(e) {}
        try { const [forumRes] = await db.sequelize.query(`SELECT MAX("createdAt") as last_date FROM "ForumPosts" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }); lastForumDate = forumRes?.last_date; } catch(e) {}
        try { const [commentRes] = await db.sequelize.query(`SELECT MAX("createdAt") as last_date FROM "ForumComments" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT }); lastCommentDate = commentRes?.last_date; } catch(e) {}

        res.json({
            whatsappClicks, profileViews, matchImpressions, favoritesCount, funnelRates, topDemands, betterThanPercentage, xpHistory: xpHistoryResult,
            todayStats: { whatsappClicks: whatsappClicksToday, profileViews: profileViewsToday, matchImpressions: matchImpressionsToday },
            last7DaysStats: { whatsappClicks: whatsappClicks7d, profileViews: profileViews7d, matchImpressions: matchImpressions7d },
            profileViewsMatch, profileViewsDirect, whatsappMatch, whatsappDirect,
            lastInteractions: { blog: lastPostDate, forum: lastForumDate, comment: lastCommentDate },
            gamificationProgress: { blogPostCount, forumActivityCount: forumPostCount + forumCommentCount, answerCount, semeador: blogPostCount, vozAtiva: forumPostCount + forumCommentCount, conselheiro: answerCount },
            blogPostCount, forumActivityCount: forumPostCount + forumCommentCount, answerCount, blogLikes, forumPosts: forumPostCount, forumComments: forumCommentCount
        });
    } catch (error) {
        res.json({ whatsappClicks: 0, profileViews: 0, matchImpressions: 0, favoritesCount: 0, topDemands: [], funnelRates: { choiceRate: 'N/A', profileConversion: 'N/A', finalConversion: 'N/A' } });
    }
};

// ----------------------------------------------------------------------
// KPIs: Incremento de Métricas (WhatsApp e Aparições)
// ----------------------------------------------------------------------
exports.incrementWhatsappClick = async (req, res) => {
    try {
        const { slug } = req.params;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });

        if (psychologist) {
            const jwt = require('jsonwebtoken');

            // --- PROTEÇÃO ANTI-AUTO-CLIQUE (Psicólogo clicando em si mesmo) ---
            let token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
            if (token && token !== 'null' && token !== 'cookie_auth_active') {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    if (decoded.id === psychologist.id) {
                        return res.status(200).json({ success: true, message: 'Auto-clique ignorado' });
                    }
                } catch (e) { /* Token inválido, continua como visitante */ }
            }

            // --- PROTEÇÃO DE IDEMPOTÊNCIA (Cookie de 24h) ---
            const cookieName = `clicked_psi_${psychologist.id}`;
            if (req.cookies && req.cookies[cookieName]) {
                return res.status(200).json({ success: true, message: 'Clique duplicado bloqueado' });
            }
            res.cookie(cookieName, 'true', { maxAge: 24 * 60 * 60 * 1000, httpOnly: true });

            gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => {});
            const { patientId, guestPhone, guestName, source } = req.body || {};

            await db.sequelize.query(`CREATE TABLE IF NOT EXISTS "WhatsAppClickLogs" (id SERIAL PRIMARY KEY, "psychologistId" INTEGER, "patientId" INTEGER, "guestPhone" VARCHAR(255), "guestName" VARCHAR(255), status VARCHAR(50) DEFAULT 'pending', message_sent_at TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`).catch(() => {});
            await db.sequelize.query(`ALTER TABLE "WhatsAppClickLogs" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50);`).catch(() => {});

            await db.sequelize.query(
                `INSERT INTO "WhatsAppClickLogs" ("psychologistId", "patientId", "guestPhone", "guestName", "source", "createdAt", "updatedAt") VALUES (:id, :patientId, :guestPhone, :guestName, :source, NOW(), NOW())`,
                { replacements: { id: psychologist.id, patientId: patientId || null, guestPhone: guestPhone || null, guestName: guestName || null, source: source || 'direct_view' }, type: db.sequelize.QueryTypes.INSERT }
            ).catch(e => {});

            try {
                const clicksResult = await db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id AND "createdAt" >= date_trunc('month', CURRENT_DATE)`, { replacements: { id: psychologist.id }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "PsychologistId" = :id AND "createdAt" >= date_trunc('month', CURRENT_DATE)`, { replacements: { id: psychologist.id }, type: db.sequelize.QueryTypes.SELECT }));
                const clicksCount = parseInt(clicksResult[0].count, 10);
                const planLimits = { 'ESSENTIAL': 5, 'ESSENCIAL': 5, 'CLINICAL': 15, 'CLÍNICO': 15, 'REFERENCE': 30, 'REFERÊNCIA': 30, 'SOL': 30 };
                const limit = planLimits[psychologist.plano ? psychologist.plano.toUpperCase() : 'ESSENTIAL'] || 5;

                if (clicksCount === limit + 1) {
                    /* Email de limite atingido desativado a pedido do usuário
                    const emailService = require('../services/emailService');
                    const primeiroNome = psychologist.nome.split(' ')[0];
                    const htmlContent = `<div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;"><h2 style="color: #1B4332;">Seu perfil está bombando! 🚀</h2><p>Olá, ${primeiroNome}!</p><p>Vi aqui que o seu perfil está bombando e você já ultrapassou o limite de conexões do seu plano (<strong>${limit} contatos</strong>).</p><p>Como estamos na fase de lançamento, liberei seu perfil para continuar aparecendo nas buscas <strong>sem custos extras neste mês</strong>, tá?</p><p>Que bom que os pacientes estão gostando do seu perfil! Aproveite os novos contatos.</p><div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;"><p style="margin: 0; color: #6b7280; font-size: 14px;">Com carinho,<br><strong>Equipe Yelo</strong> 💚</p></div></div>`;
                    if (typeof emailService.sendEmail === 'function') emailService.sendEmail(psychologist.email, "Seu perfil está bombando! 🚀", htmlContent).catch(e => {});
                    */
                }
            } catch (err) { }
        }
        res.status(200).json({ success: true });
    } catch (error) { res.status(200).json({ success: false }); }
};

exports.incrementProfileAppearance = async (req, res) => {
    try {
        const { id } = req.params;
        const source = req.body.type || 'direct_view';
        await db.sequelize.query(`ALTER TABLE "ProfileAppearanceLogs" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50);`).catch(() => {});
        await db.Psychologist.increment('profile_appearances', { where: { id } }).catch(() => {});
        await db.sequelize.query(`INSERT INTO "ProfileAppearanceLogs" ("psychologistId", "source", "createdAt", "updatedAt") VALUES (:id, :source, NOW(), NOW())`, { replacements: { id, source }, type: db.sequelize.QueryTypes.INSERT }).catch(e => {});
        res.status(200).json({ success: true });
    } catch (error) { res.status(200).json({ success: false }); }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/analytics (NOVA)
// ----------------------------------------------------------------------
exports.getAnalyticsData = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;
        const psychologist = await db.Psychologist.findByPk(psychologistId);
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        const myPrice = psychologist.valor_sessao_numero || 0;
        const [cityAvgResult] = await db.sequelize.query(`SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE "cidade" = :city AND status = 'active' AND "valor_sessao_numero" > 0`, { replacements: { city: psychologist.cidade }, type: db.sequelize.QueryTypes.SELECT });
        const cityAverage = parseFloat(cityAvgResult?.avg || 0);
        const [platformAvgResult] = await db.sequelize.query(`SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE status = 'active' AND "valor_sessao_numero" > 0`, { type: db.sequelize.QueryTypes.SELECT });
        const platformAverage = parseFloat(platformAvgResult?.avg || 0);

        const [topTopics] = await db.sequelize.query(`SELECT value as topic, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 5;`);

        const [visibilityRaw] = await db.sequelize.query(`SELECT TO_CHAR(d.day, 'DD/MM') as label, COALESCE(COUNT(p.id), 0) as appearances FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS day) d LEFT JOIN "ProfileAppearanceLogs" p ON p."createdAt"::date = d.day AND p."psychologistId" = :psychologistId GROUP BY d.day ORDER BY d.day ASC;`, { replacements: { psychologistId } });
        const visibility = { labels: visibilityRaw.map(v => v.label), appearances: visibilityRaw.map(v => parseInt(v.appearances, 10)) };

        const myReviews = await db.Review.findAll({ where: { psychologistId }, attributes: [[db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating']] });
        let myPostCount = 0;
        if (db.Post) myPostCount = await db.Post.count({ where: { psychologistId } }).catch(async () => await db.Post.count({ where: { psychologist_id: psychologistId } }).catch(() => 0));
        
        const myEngagement = psychologist.xp || 0;
        const myCompletion = (psychologist.badges && psychologist.badges.autentico) ? 10 : 5;
        const myAvgRating = parseFloat(myReviews[0]?.dataValues.avgRating || 0);

        const [platformStrength] = await db.sequelize.query(`SELECT AVG(xp) as avgEngagement, (SELECT AVG(rating) FROM "Reviews") as avgRating, (SELECT CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM "Psychologists" WHERE status='active') FROM posts) as avgPosts FROM "Psychologists" WHERE status = 'active'`);
        const [betterThanResult] = await db.sequelize.query(`SELECT COALESCE(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active'), 0), 0) as percentage FROM "Psychologists" WHERE status = 'active' AND xp < :myEngagement`, { replacements: { myEngagement }, type: db.sequelize.QueryTypes.SELECT });
        const betterThanPercentage = Math.round(parseFloat(betterThanResult?.percentage || 0));
        const normalize = (value, avg, max) => Math.min(10, Math.max(0, (value / (avg * 1.5 || max)) * 10));

        res.json({
            priceComparison: { myPrice, cityAverage, platformAverage },
            topTopics, visibility, betterThanPercentage,
            profileStrength: {
                myScores: [myCompletion, normalize(myAvgRating, parseFloat(platformStrength?.avgRating || 0), 5), normalize(myEngagement, parseFloat(platformStrength?.avgEngagement || 0), 5000), normalize(myPostCount, parseFloat(platformStrength?.avgPosts || 0), 10), 8],
                averageScores: [7, normalize(parseFloat(platformStrength?.avgRating || 0), parseFloat(platformStrength?.avgRating || 0), 5), normalize(parseFloat(platformStrength?.avgEngagement || 0), parseFloat(platformStrength?.avgEngagement || 0), 5000), normalize(parseFloat(platformStrength?.avgPosts || 0), parseFloat(platformStrength?.avgPosts || 0), 10), 7]
            }
        });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao buscar dados de análise.' }); }
};

exports.getAnnouncements = async (req, res) => {
    try {
        const psychologistId = req.psychologist?.id || req.userDecoded?.id || req.user?.id;
        if (db.Aviso) await db.Aviso.sync();
        if (db.AvisoLido) await db.AvisoLido.sync();

        const avisos = await db.Aviso.findAll({
            where: { status: 'published', [Op.or]: [{ psychologistId: null }, { psychologistId: psychologistId }] },
            order: [['createdAt', 'DESC']]
        });
        
        const avisosLidos = await db.AvisoLido.findAll({ where: { psychologistId: psychologistId } });
        const lidosIds = new Set(avisosLidos.map(l => l.avisoId));

        const responseData = avisos.map(aviso => {
            const avisoObj = aviso.toJSON ? aviso.toJSON() : aviso;
            return { ...avisoObj, read: lidosIds.has(avisoObj.id) };
        });
        res.status(200).json(responseData);
    } catch (error) { res.status(500).json({ error: 'Erro interno no servidor.' }); }
};

exports.markAnnouncementAsRead = async (req, res) => {
    try {
        const psychologistId = req.psychologist?.id || req.userDecoded?.id || req.user?.id;
        const { avisoId } = req.params;
        if (db.AvisoLido) await db.AvisoLido.sync();
        await db.AvisoLido.findOrCreate({ where: { avisoId: avisoId, psychologistId: psychologistId } });
        res.status(200).json({ message: 'Aviso marcado como lido.' });
    } catch (error) { res.status(500).json({ error: 'Erro interno no servidor.' }); }
};

exports.savePlatformReview = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;
        const { rating, comment } = req.body;
        if (!rating) return res.status(400).json({ error: 'A nota é obrigatória.' });

        await db.sequelize.query(`CREATE TABLE IF NOT EXISTS "PlatformReviews" (id SERIAL PRIMARY KEY, "psychologistId" INTEGER REFERENCES "Psychologists"(id) ON DELETE CASCADE, rating INTEGER NOT NULL, comment TEXT, "isTestimonial" BOOLEAN DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);`);
        await db.sequelize.query(`INSERT INTO "PlatformReviews" ("psychologistId", rating, comment, "createdAt", "updatedAt") VALUES (:psychologistId, :rating, :comment, NOW(), NOW())`, {
            replacements: { psychologistId, rating: parseInt(rating, 10), comment: comment ? comment.trim() : '' }, type: db.sequelize.QueryTypes.INSERT
        });
        res.status(200).json({ message: 'Avaliação salva com sucesso!' });
    } catch (error) { res.status(500).json({ error: 'Erro interno ao salvar avaliação.' }); }
};

exports.getAiInsights = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;
        const stats = req.body.stats || {};
        
        const psychologist = await db.Psychologist.findByPk(psychologistId);
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        if (psychologist.ai_insights_cache) {
            const cacheData = psychologist.ai_insights_cache;
            const diasPassados = (Date.now() - cacheData.timestamp) / (1000 * 60 * 60 * 24);
            if (diasPassados < 3 && cacheData.tips) {
                console.log("💡 [Growth Coach Backend] Dicas carregadas do cache do banco de dados.");
                return res.status(200).json(cacheData.tips);
            }
        }

        const seoService = require('../services/seoService');
        let insights = await seoService.generateDashboardInsights(stats, psychologist);
        
        // Dicas padrões seguras caso a API do Google caia ou atinja limites de quota
        const fallbackInsights = {
            marketingTip: {
                title: "Deixe seu perfil reluzente",
                impact: "Garantir que as informações como valores, fotos e atuação estejam bem preenchidos atrai as pessoas certas nas buscas da plataforma.",
                url: "/psi/meu-perfil"
            },
            contentIdea: {
                title: "Construa sua autoridade online",
                impact: "Muitos pacientes fecham sessão após lerem dúvidas respondidas de forma acolhedora e empática pelos especialistas na comunidade.",
                url: "/psi/comunidade"
            }
        };
        
        if (!insights || !insights.marketingTip || !insights.contentIdea) {
            console.log("⚠️ [Growth Coach] Google Gemini falhou, devolvendo dicas de Fallback seguras.");
            insights = fallbackInsights;
        }

        // Atualiza cache mesmo se for fallback (previne ficar chamando API que está fora do ar toda hora)
        psychologist.ai_insights_cache = {
            timestamp: Date.now(),
            tips: insights
        };
        await psychologist.save();
        
        res.status(200).json(insights);
    } catch (error) {
        console.error("Erro em getAiInsights:", error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};