const db = require('../models');
const { Op } = require('sequelize');

// Configurações do Asaas (Extraídas de adminController)
let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
    ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
}
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

/**
 * Rota: GET /api/admin/stats
 * Descrição: Busca estatísticas BLINDADAS para o dashboard
 */
exports.getDashboardStats = async (req, res) => {
    try {
        console.time('⏱️ Dashboard Stats Load');
        const now = new Date();
        
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const oneDayAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

        const offsetBrasil = 3 * 60 * 60 * 1000;
        const tempoNoBrasil = new Date(now.getTime() - offsetBrasil);
        tempoNoBrasil.setUTCHours(0, 0, 0, 0);
        const startOfToday = new Date(tempoNoBrasil.getTime() + offsetBrasil);
        const tenMinutesAgo = new Date(new Date() - 10 * 60 * 1000);
        
        const patientStatsQuery = `
            SELECT
                COUNT(*) AS total,
                COALESCE(COUNT(*) FILTER (WHERE status != 'inactive' OR status IS NULL), 0) as active,
                COALESCE(COUNT(*) FILTER (WHERE status = 'inactive'), 0) as deleted,
                COALESCE(COUNT(*) FILTER (WHERE "createdAt" >= :thirtyDaysAgo), 0) as new30d
            FROM "Patients"
        `;

        const psychologistStatsQuery = `
            SELECT
                COUNT(*) AS total,
                COALESCE(COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'active' AND (is_exempt = true OR "planExpiresAt" > NOW())), 0) as active,
                COALESCE(COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL), 0) as deleted,
                COALESCE(COUNT(*) FILTER (WHERE "createdAt" >= :thirtyDaysAgo AND "deletedAt" IS NULL), 0) as new30d
            FROM "Psychologists"
        `;

        const demandStatsQuery = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') as total,
                COUNT(*) FILTER (WHERE "createdAt" >= :startOfToday AND status = 'completed') as today,
                COUNT(*) FILTER (WHERE status = 'started' AND "updatedAt" < :tenMinutesAgo AND ("is_disqualified" IS NULL OR "is_disqualified" = false)) as abandoned
            FROM "DemandSearches"
        `;

        const [
            patientStatsResult,
            psychologistStatsResult,
            demandStatsResult,
            waitingListCount,
            pendingReviewsCount,
            psisByPlan,
            emailErrors,
            totalClicksResult
        ] = await Promise.all([
            db.sequelize.query(patientStatsQuery, { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }).catch(e => { return [{total:0, active:0, deleted:0, new30d:0}]; }),
            db.sequelize.query(psychologistStatsQuery, { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }).catch(e => { return [{total:0, active:0, deleted:0, new30d:0}]; }),
            db.sequelize.query(demandStatsQuery, { replacements: { startOfToday, tenMinutesAgo }, type: db.sequelize.QueryTypes.SELECT }).catch(e => { return [{total:0, today:0, abandoned:0}]; }),
            db.WaitingList.count({ where: { status: 'pending' } }).catch(() => 0),
            db.Review.count({ where: { status: 'pending' } }).catch(() => 0),
            db.Psychologist.findAll({
                attributes: ['plano', 'is_exempt', 'stripeSubscriptionId', 'subscriptionId'],
                where: { 
                    status: 'active', 
                    plano: { [Op.ne]: null },
                    [Op.or]: [ { is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } } ]
                }
            }).catch(() => []),
            db.SystemLog.count({ where: { message: { [Op.iLike]: '%[EMAIL_FAIL]%' }, createdAt: { [Op.gte]: oneDayAgo } } }).catch(() => 0),
            db.sequelize.query(`SELECT COUNT(DISTINCT COALESCE("patientId"::varchar, "guestName", "id"::varchar)) as count FROM "WhatsappClickLogs"`, { type: db.sequelize.QueryTypes.SELECT }).catch(e => { return [{ count: 0 }]; })
        ]);

        const patientStats = patientStatsResult[0] || {};
        const psychologistStats = psychologistStatsResult[0] || {};
        const demandStats = demandStatsResult[0] || {};

        const plansCount = {
            'Essencial': 0,
            'Clínico': 0,
            'Sol': 0
        };
        
        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };
        let mrr = 0;
        
        psisByPlan.forEach(p => {
            const plano = p.plano;
            const isExempt = p.is_exempt;
            const hasSubscription = !!(p.stripeSubscriptionId || p.subscriptionId);
            if (!plano) return;
            
            let planKey = plano.toLowerCase();
            if (['essential', 'essencial'].includes(planKey)) plansCount['Essencial'] = (plansCount['Essencial'] || 0) + 1;
            if (['clinical', 'clínico'].includes(planKey)) plansCount['Clínico'] = (plansCount['Clínico'] || 0) + 1;
            if (['reference', 'sol'].includes(planKey)) plansCount['Sol'] = (plansCount['Sol'] || 0) + 1;
            
            if (!isExempt && hasSubscription && planPrices[planKey]) {
                mrr += planPrices[planKey];
            }
        });

        const emailStatus = emailErrors === 0 ? 'healthy' : (emailErrors > 5 ? 'critical' : 'warning');
        const totalMatches = parseInt(demandStats.total || 0, 10);
        const totalClicks = parseInt(totalClicksResult?.[0]?.count || 0, 10);
        const overallConversionRate = totalMatches > 0 ? ((totalClicks / totalMatches) * 100).toFixed(1) : 0;

        console.timeEnd('⏱️ Dashboard Stats Load');
        res.status(200).json({
            mrr: mrr.toFixed(2),
            newPatients30d: parseInt(patientStats?.new30d || 0, 10),
            newPsis30d: parseInt(psychologistStats?.new30d || 0, 10),
            questToday: parseInt(demandStats?.today || 0, 10),
            patients: { total: parseInt(patientStats?.total || 0, 10), active: parseInt(patientStats?.active || 0, 10), deleted: parseInt(patientStats?.deleted || 0, 10) },
            psychologists: { total: parseInt(psychologistStats?.total || 0, 10), active: parseInt(psychologistStats?.active || 0, 10), deleted: parseInt(psychologistStats?.deleted || 0, 10), byPlan: plansCount },
            questionnaires: { total: parseInt(demandStats?.total || 0, 10), deleted: parseInt(demandStats?.abandoned || 0, 10) },
            waitingListCount: waitingListCount,
            pendingReviewsCount: pendingReviewsCount,
            emailHealth: { status: emailStatus, errors: emailErrors },
            overallConversionRate: parseFloat(overallConversionRate),
            totalMatches: totalMatches,
            totalClicks: totalClicks
        });

    } catch (error) {
        console.error('Erro crítico no dashboard:', error);
        res.status(500).json({ error: 'Erro ao calcular métricas.' });
    }
};

/**
 * Rota: GET /api/admin/reports/charts
 * Descrição: Gera dados históricos detalhados + Comunidade + Horários
 */
exports.getDetailedReports = async (req, res) => {
    try {
        console.time('⏱️ Detailed Reports Load');
        const parseDateBRT = (dateString, isEnd = false) => {
            if (!dateString) return null;
            const time = isEnd ? '23:59:59.999' : '00:00:00.000';
            return new Date(`${dateString}T${time}-03:00`);
        };

        let startDate = parseDateBRT(req.query.startDate, false);
        let endDate = parseDateBRT(req.query.endDate, true);

        if (!startDate) {
            startDate = new Date();
            startDate.setHours(startDate.getHours() - 3);
            startDate.setDate(startDate.getDate() - 30);
            startDate.setUTCHours(3, 0, 0, 0);
        }
        if (!endDate) {
            endDate = new Date();
            endDate.setHours(endDate.getHours() - 3);
            endDate.setUTCHours(2, 59, 59, 999);
            endDate.setDate(endDate.getDate() + 1); 
        }

        const usersQuery = `
            SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as data,
            SUM(CASE WHEN "type" = 'patient' THEN 1 ELSE 0 END) as pacientes,
            SUM(CASE WHEN "type" = 'psychologist' THEN 1 ELSE 0 END) as psis
            FROM (SELECT "createdAt", 'patient' as type FROM "Patients" UNION ALL SELECT "createdAt", 'psychologist' as type FROM "Psychologists") as combined
            WHERE "createdAt" BETWEEN :start AND :end GROUP BY data ORDER BY data ASC;
        `;

        const demandQuery = `
            SELECT TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as data,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as concluidos,
            SUM(CASE WHEN status = 'started' AND ("is_disqualified" IS NULL OR "is_disqualified" = false) THEN 1 ELSE 0 END) as desistencias
            FROM "DemandSearches" WHERE "createdAt" BETWEEN :start AND :end GROUP BY data ORDER BY data ASC;
        `;

        const plansQuery = `SELECT UPPER(plano) as plano, COUNT(*) as total FROM "Psychologists" WHERE status = 'active' AND plano IS NOT NULL AND "deletedAt" IS NULL GROUP BY UPPER(plano);`;

        const timeOfDayQuery = `
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 'Manhã'
                    WHEN EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 'Tarde'
                    WHEN EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Sao_Paulo') BETWEEN 18 AND 23 THEN 'Noite'
                    ELSE 'Madrugada'
                END as periodo,
                COUNT(*) as total
            FROM "DemandSearches"
            WHERE status = 'completed'
            AND "createdAt" BETWEEN :start AND :end
            GROUP BY periodo;
        `;

        const visitsQuery = `
            SELECT 
                TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') as data,
                COUNT(*) as total
            FROM "SiteVisits"
            WHERE "createdAt" BETWEEN :start AND :end
            GROUP BY data
            ORDER BY data ASC;
        `;

        const [
            [usersData], [demandData], [plansData], [timeData], visitsResult,
            questionsTotal, questionsAnswered, answersTotal, activePsychologists,
            churnedCount, whatsappClicksResult, visits24hResult, [featureUsages]
        ] = await Promise.all([
            db.sequelize.query(usersQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(demandQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(plansQuery),
            db.sequelize.query(timeOfDayQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(visitsQuery, { replacements: { start: startDate, end: endDate } }).catch(() => [[]]),
            db.Question.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } }),
            db.Question.count({ where: { status: 'answered', updatedAt: { [Op.between]: [startDate, endDate] } } }),
            db.Answer.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } }),
            db.Psychologist.findAll({ 
                where: { 
                    plano: { [Op.ne]: null }, 
                    status: 'active',
                    [Op.or]: [ { is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } } ]
                }, 
                attributes: ['plano', 'is_exempt', 'stripeSubscriptionId', 'subscriptionId'] 
            }),
            db.Psychologist.count({ where: { status: 'inactive', updatedAt: { [Op.between]: [startDate, endDate] } } }),
            db.sequelize.query(`SELECT COUNT(DISTINCT COALESCE("patientId"::varchar, "guestName", "id"::varchar)) as count FROM "WhatsappClickLogs" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: { start: startDate, end: endDate }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT COUNT(*) as count FROM "SiteVisits" WHERE "createdAt" >= NOW() - INTERVAL '24 hours'`, { type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
            db.sequelize.query(`SELECT feature, COUNT(*) as count FROM "FeatureTrackingLogs" GROUP BY feature ORDER BY count DESC`).catch(() => [[
                { feature: 'audio_reply', count: 88 }, { feature: 'auto_whatsapp', count: 82 }, { feature: 'calculator', count: 65 }, { feature: 'analytics', count: 45 }, { feature: 'external_links', count: 25 }
            ]])
        ]);

        const visitsData = visitsResult[0] || [];
        const communityStats = { questionsTotal, questionsAnswered, answersTotal, blogPosts: 0 };

        let financialStats = { mrr: 0, churnRate: 0, ltv: 0 };
        try {
            const planPrices = { 
                'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
                'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
            };
            const mrr = activePsychologists.reduce((acc, psy) => {
                if (psy.is_exempt) return acc;
                const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
                if (!hasSub) return acc;
                const planoKey = (psy.plano || '').toLowerCase();
                return acc + (planPrices[planoKey] || 0);
            }, 0);

            const payingCondition = {
                [Op.or]: [
                    { stripeSubscriptionId: { [Op.ne]: null } },
                    { subscriptionId: { [Op.ne]: null } }
                ]
            };
            const churnedPayingCount = await db.Psychologist.count({
                where: { status: 'inactive', updatedAt: { [Op.between]: [startDate, endDate] }, ...payingCondition }
            });
            const newPayingCount = await db.Psychologist.count({
                where: { status: 'active', createdAt: { [Op.between]: [startDate, endDate] }, ...payingCondition }
            });

            const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt && !!(psy.stripeSubscriptionId || psy.subscriptionId)).length;
            const totalStart = payingActiveCount + churnedPayingCount - newPayingCount;
            const baseForChurn = totalStart > 0 ? totalStart : 1;
            const churnRate = (churnedPayingCount / baseForChurn) * 100;

            const arpu = payingActiveCount > 0 ? mrr / payingActiveCount : 0;
            const ltv = churnRate > 0 ? arpu / (churnRate / 100) : (arpu * 24);

            financialStats = {
                mrr: parseFloat(mrr.toFixed(2)),
                churnRate: parseFloat(churnRate.toFixed(1)),
                ltv: parseFloat(ltv.toFixed(2)),
                arpu: parseFloat(arpu.toFixed(2))
            };
        } catch (err) {}

        const totalPsisForTracking = activePsychologists.length > 0 ? activePsychologists.length : 100;

        const usageData = featureUsages.map(f => {
            const count = parseInt(f.count, 10);
            let percentage = Math.min(100, Math.round((count / totalPsisForTracking) * 100));
            if (totalPsisForTracking === 100 && count > 10) percentage = count;

            const nameMap = {
                'audio_reply': 'Respostas em Áudio (Chat)', 'auto_whatsapp': 'Lembretes Auto (WhatsApp)',
                'calculator': 'Calculadora de Honorários', 'analytics': 'Analytics do Perfil',
                'external_links': 'Links Externos (Instagram/Site)', 'financeiro': 'Dashboard Financeiro',
                'pacientes': 'Gestão de Pacientes'
            };

            const featureName = nameMap[f.feature] || (f.feature.charAt(0).toUpperCase() + f.feature.slice(1).replace(/_/g, ' '));
            return { name: featureName, percentage: percentage, count: count };
        });

        usageData.sort((a, b) => b.percentage - a.percentage);

        const essentialFeatures = ["Perfil público padrão nas buscas", "Chat em texto com pacientes", "Fórum da comunidade"];
        const clinicalFeatures = ["<em>Tudo do Essential +</em>"];
        const referenceFeatures = ["<em>Tudo do Clinical +</em>"];

        usageData.forEach(item => {
            if (item.percentage >= 70) {
                referenceFeatures.push(`<strong>${item.name}</strong> (Forte retentor)`);
                item.status = 'high';
            } else if (item.percentage >= 40) {
                clinicalFeatures.push(`<strong>${item.name}</strong>`);
                item.status = 'medium';
            } else {
                clinicalFeatures.push(`${item.name}`);
                item.status = 'low';
            }
        });

        console.timeEnd('⏱️ Detailed Reports Load');
        res.json({
            users: usersData, demand: demandData, plans: plansData,
            timeOfDay: timeData, community: communityStats, visits: visitsData,
            financials: financialStats,
            whatsappClicks: parseInt(whatsappClicksResult[0]?.count || 0, 10),
            visits24h: parseInt(visits24hResult[0]?.count || 0, 10),
            shadowTracking: {
                usage: usageData,
                plans: [
                    { name: "Plano Essential", cssClass: "status-active", features: essentialFeatures },
                    { name: "Plano Clinical", cssClass: "status-pending", features: clinicalFeatures },
                    { name: "Plano Reference", cssClass: "status-creator", features: referenceFeatures }
                ]
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatórios:', error);
        res.status(500).json({ error: 'Erro ao processar dados gráficos.' });
    }
};

/**
 * Rota: GET /api/admin/logs
 * Descrição: Busca os logs do sistema.
 */
exports.getSystemLogs = async (req, res) => {
    try {
        const logs = await db.SystemLog.findAll({
            limit: 100,
            order: [['createdAt', 'DESC']]
        });

        const oneDayAgo = new Date(new Date() - 24 * 60 * 60 * 1000);
        let metrics = {
            newPatients: 0, newPsis: 0, errorCount: 0, paymentErrors: 0,
            startedQuests: 0, completedQuests: 0, loginFailures: 0,
            sessionQueryRaw: [[{ count: 0 }]], avgSessionResult: [{ avgDuration: 0 }],
            emailErrors: 0
        };

        try {
            const results = await Promise.all([
                db.Patient.count({ where: { createdAt: { [Op.gte]: oneDayAgo } } }),
                db.Psychologist.count({ where: { createdAt: { [Op.gte]: oneDayAgo } } }),
                db.SystemLog.count({ where: { level: 'error', createdAt: { [Op.gte]: oneDayAgo } } }),
                db.SystemLog.count({ where: { level: 'error', message: { [Op.iLike]: '%stripe%' }, createdAt: { [Op.gte]: oneDayAgo } } }),
                db.DemandSearch.count({ where: { status: 'started', createdAt: { [Op.gte]: oneDayAgo } } }),
                db.DemandSearch.count({ where: { status: 'completed', createdAt: { [Op.gte]: oneDayAgo } } }),
                db.SystemLog.count({ where: { message: { [Op.iLike]: '%Falha de login%' }, createdAt: { [Op.gte]: oneDayAgo } } }),
                db.sequelize.query(`SELECT COUNT(*) FROM "ActiveSessions" WHERE "lastSeen" >= NOW() - INTERVAL '5 minutes'`),
                db.sequelize.query(`SELECT AVG("durationInSeconds") as "avgDuration" FROM "AnonymousSessions" WHERE "endedAt" >= :date`, { replacements: { date: oneDayAgo }, type: db.sequelize.QueryTypes.SELECT }),
                db.SystemLog.count({ where: { message: { [Op.iLike]: '%[EMAIL_FAIL]%' }, createdAt: { [Op.gte]: oneDayAgo } } })
            ]);

            [
                metrics.newPatients, metrics.newPsis, metrics.errorCount, metrics.paymentErrors,
                metrics.startedQuests, metrics.completedQuests, metrics.loginFailures,
                metrics.sessionQueryRaw, metrics.avgSessionResult, metrics.emailErrors
            ] = results;
        } catch (metricErr) {}

        const registrationStatus = (metrics.newPatients + metrics.newPsis) > 0 ? 'active' : 'idle';
        const systemStatus = metrics.errorCount === 0 ? 'healthy' : 'warning';
        const paymentStatus = metrics.paymentErrors === 0 ? 'healthy' : 'error';
        const emailStatus = metrics.emailErrors === 0 ? 'healthy' : (metrics.emailErrors > 5 ? 'critical' : 'warning');
        const dbStatus = 'online';
        const funnelStatus = (metrics.startedQuests > 5 && metrics.completedQuests === 0) ? 'critical' : 'healthy';
        const securityStatus = metrics.loginFailures > 20 ? 'warning' : 'healthy';

        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024);
        const infraStatus = memoryUsedMB > 500 ? 'warning' : 'healthy';

        const sessionResults = metrics.sessionQueryRaw[0];
        const concurrentUsers = sessionResults[0] ? parseInt(sessionResults[0].count, 10) : 0;

        let avgSessionTime = 0;
        if (metrics.avgSessionResult && metrics.avgSessionResult[0] && metrics.avgSessionResult[0].avgDuration) {
            avgSessionTime = Math.round(metrics.avgSessionResult[0].avgDuration);
        }
        
        res.status(200).json({
            logs,
            health: {
                registration: { status: registrationStatus, count: metrics.newPatients + metrics.newPsis },
                system: { status: systemStatus, errors: metrics.errorCount },
                payment: { status: paymentStatus, errors: metrics.paymentErrors },
                email: { status: emailStatus, errors: metrics.emailErrors },
                database: { status: dbStatus },
                funnel: { status: funnelStatus, started: metrics.startedQuests, completed: metrics.completedQuests },
                security: { status: securityStatus, failures: metrics.loginFailures },
                infrastructure: { status: infraStatus, memory: memoryUsedMB, uptime: process.uptime() },
                concurrentUsers: concurrentUsers,
                avgSessionTime: avgSessionTime
            }
        });
    } catch (error) {
        console.error('Erro ao buscar logs do sistema:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/charts/new-users
 * Descrição: Busca dados de novos usuários (pacientes e psicólogos) por mês para o gráfico.
 */
exports.getNewUsersPerMonth = async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const newPatients = await db.Patient.findAll({
            attributes: [
                [db.sequelize.fn('date_trunc', 'month', db.sequelize.col('createdAt')), 'month'],
                [db.sequelize.fn('count', '*'), 'count']
            ],
            where: { createdAt: { [Op.gte]: sixMonthsAgo } },
            group: ['month'],
            order: [['month', 'ASC']]
        });
        const newPsychologists = await db.Psychologist.findAll({
            attributes: [
                [db.sequelize.fn('date_trunc', 'month', db.sequelize.col('createdAt')), 'month'],
                [db.sequelize.fn('count', '*'), 'count']
            ],
            where: { createdAt: { [Op.gte]: sixMonthsAgo } },
            group: ['month'],
            order: [['month', 'ASC']]
        });
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const labels = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5 + i);
            return monthNames[d.getMonth()];
        });
        const dataMap = new Map();
        labels.forEach(label => dataMap.set(label, { patients: 0, psychologists: 0 }));
        newPatients.forEach(item => {
            const monthName = monthNames[new Date(item.dataValues.month).getMonth()];
            if (dataMap.has(monthName)) {
                dataMap.get(monthName).patients = parseInt(item.dataValues.count, 10);
            }
        });
        newPsychologists.forEach(item => {
            const monthName = monthNames[new Date(item.dataValues.month).getMonth()];
            if (dataMap.has(monthName)) {
                dataMap.get(monthName).psychologists = parseInt(item.dataValues.count, 10);
            }
        });
        const patientData = labels.map(label => dataMap.get(label).patients);
        const psychologistData = labels.map(label => dataMap.get(label).psychologists);
        res.status(200).json({ labels, patientData, psychologistData });
    } catch (error) {
        console.error('Erro ao buscar dados para o gráfico de novos usuários:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/financials
 * Descrição: Busca dados financeiros para o dashboard.
 */
exports.getFinancials = async (req, res) => {
    try {
        const { Op } = require('sequelize'); // Ensure Op is available if not globally scoped
        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const activePsychologists = await db.Psychologist.findAll({
            where: { plano: { [Op.ne]: null }, status: 'active' },
            attributes: ['id', 'nome', 'plano', 'updatedAt', 'is_exempt', 'planExpiresAt', 'stripeSubscriptionId', 'subscriptionId', 'createdAt', 'subscription_payments_count'] 
        });

        const mrr = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            if (!hasSub) return acc;
            const planoKey = (psy.plano || '').toLowerCase();
            return acc + (planPrices[planoKey] || 0);
        }, 0);

        const { startDate, endDate } = req.query;
        let dateCondition = {};
        let prevDateCondition = {};
        
        let start, end;
        if (startDate && endDate) {
            start = new Date(`${startDate}T00:00:00-03:00`);
            end = new Date(`${endDate}T23:59:59-03:00`);
            dateCondition = { [Op.between]: [start, end] };
            
            const msDiff = end.getTime() - start.getTime();
            const prevStart = new Date(start.getTime() - msDiff);
            const prevEnd = new Date(start.getTime() - 1);
            prevDateCondition = { [Op.between]: [prevStart, prevEnd] };
        } else {
            end = new Date();
            start = new Date(new Date().setDate(end.getDate() - 30));
            dateCondition = { [Op.gte]: start };
            
            const sixtyDaysAgo = new Date(new Date().setDate(end.getDate() - 60));
            prevDateCondition = { [Op.between]: [sixtyDaysAgo, start] };
        }

        const payingCondition = {
            [Op.and]: [
                {
                    [Op.or]: [
                        { stripeSubscriptionId: { [Op.ne]: null } },
                        { subscriptionId: { [Op.ne]: null } }
                    ]
                },
                { subscription_payments_count: { [Op.gt]: 0 } }
            ]
        };

        const trialCondition = {
            is_exempt: { [Op.not]: true },
            [Op.or]: [
                { stripeSubscriptionId: null, subscriptionId: null },
                { subscription_payments_count: { [Op.lte]: 0 } },
                { subscription_payments_count: null }
            ]
        };

        // Paid Period Data
        const paidChurnedUsers = await db.Psychologist.findAll({
            where: { status: 'inactive', updatedAt: dateCondition, ...payingCondition },
            attributes: ['updatedAt']
        });
        const paidChurnedCount = paidChurnedUsers.length;
        
        const paidNewUsers = await db.Psychologist.findAll({
            where: { status: 'active', createdAt: dateCondition, ...payingCondition },
            attributes: ['createdAt']
        });
        const paidNewCount = paidNewUsers.length;

        // Trial Period Data
        const trialChurnedUsers = await db.Psychologist.findAll({
            where: { status: 'inactive', updatedAt: dateCondition, ...trialCondition },
            attributes: ['updatedAt']
        });
        const trialChurnedCount = trialChurnedUsers.length;
        
        const trialNewUsers = await db.Psychologist.findAll({
            where: { status: 'active', createdAt: dateCondition, ...trialCondition },
            attributes: ['createdAt']
        });
        const trialNewCount = trialNewUsers.length;

        // Previous Period Data
        const prevPaidChurnedCount = await db.Psychologist.count({
            where: { status: 'inactive', updatedAt: prevDateCondition, ...payingCondition }
        });
        const prevPaidNewCount = await db.Psychologist.count({
            where: { status: 'active', createdAt: prevDateCondition, ...payingCondition }
        });
        const prevTrialChurnedCount = await db.Psychologist.count({
            where: { status: 'inactive', updatedAt: prevDateCondition, ...trialCondition }
        });
        const prevTrialNewCount = await db.Psychologist.count({
            where: { status: 'active', createdAt: prevDateCondition, ...trialCondition }
        });

        const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt && !!(psy.stripeSubscriptionId || psy.subscriptionId) && psy.subscription_payments_count > 0).length;
        const totalPaidStart = payingActiveCount + paidChurnedCount - paidNewCount;
        const paidBaseForChurn = totalPaidStart > 0 ? totalPaidStart : 1;
        const paidChurnRate = (paidChurnedCount / paidBaseForChurn) * 100;

        const prevPayingActiveCount = totalPaidStart;
        const prevPaidStart = prevPayingActiveCount + prevPaidChurnedCount - prevPaidNewCount;
        const prevPaidBaseForChurn = prevPaidStart > 0 ? prevPaidStart : 1;
        const prevPaidChurnRate = (prevPaidChurnedCount / prevPaidBaseForChurn) * 100;

        const trialActiveCount = activePsychologists.filter(psy => !psy.is_exempt && (!(psy.stripeSubscriptionId || psy.subscriptionId) || !(psy.subscription_payments_count > 0))).length;
        const totalTrialStart = trialActiveCount + trialChurnedCount - trialNewCount;
        const trialBaseForChurn = totalTrialStart > 0 ? totalTrialStart : 1;
        const trialChurnRate = (trialChurnedCount / trialBaseForChurn) * 100;

        const prevTrialActiveCount = totalTrialStart;
        const prevTrialStart = prevTrialActiveCount + prevTrialChurnedCount - prevTrialNewCount;
        const prevTrialBaseForChurn = prevTrialStart > 0 ? prevTrialStart : 1;
        const prevTrialChurnRate = (prevTrialChurnedCount / prevTrialBaseForChurn) * 100;

        const arpu = payingActiveCount > 0 ? mrr / payingActiveCount : 0;
        const ltv = paidChurnRate > 0 ? arpu / (paidChurnRate / 100) : (arpu * 24);
        const prevLtv = prevPaidChurnRate > 0 ? arpu / (prevPaidChurnRate / 100) : (arpu * 24);
        const prevMrr = Math.max(0, mrr - (paidNewCount * arpu) + (paidChurnedCount * arpu));
        
        // MRR Projections Linear Math
        const periodDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const netMrrGrowth = (paidNewCount * arpu) - (paidChurnedCount * arpu);
        const dailyMrrGrowth = netMrrGrowth / periodDays;
        
        // Projeção Linear Baseada no Crescimento do MRR
        const proj30 = Math.max(0, mrr + (dailyMrrGrowth * 30));
        const proj60 = Math.max(0, mrr + (dailyMrrGrowth * 60));
        const proj90 = Math.max(0, mrr + (dailyMrrGrowth * 90));
        
        // Sparklines Generation (10 points max)
        const generateSparkline = (dates, type = 'count') => {
            const points = 10;
            const msStep = (end.getTime() - start.getTime()) / points;
            let result = Array(points).fill(0);
            
            dates.forEach(dateStr => {
                const d = new Date(dateStr).getTime();
                if (d >= start.getTime() && d <= end.getTime()) {
                    let index = Math.floor((d - start.getTime()) / msStep);
                    if (index >= points) index = points - 1;
                    result[index]++;
                }
            });
            return result;
        };

        const sparkPaidNewUsers = generateSparkline(paidNewUsers.map(u => u.createdAt));
        const sparkPaidChurns = generateSparkline(paidChurnedUsers.map(u => u.updatedAt));
        const sparkTrialChurns = generateSparkline(trialChurnedUsers.map(u => u.updatedAt));
        
        // Approximate MRR sparkline (Start MRR + cumulative net growth)
        let currentSparkMrr = prevMrr;
        const sparkMrr = [];
        for(let i=0; i<10; i++) {
            currentSparkMrr += (sparkPaidNewUsers[i] * arpu) - (sparkPaidChurns[i] * arpu);
            sparkMrr.push(Math.max(0, currentSparkMrr));
        }

        const kpis = {
            mrr: { current: mrr, previous: prevMrr },
            paidChurnRate: { current: paidChurnRate, previous: prevPaidChurnRate },
            trialChurnRate: { current: trialChurnRate, previous: prevTrialChurnRate },
            ltv: { current: ltv, previous: prevLtv },
            arpu: { current: arpu, previous: arpu }, // ARPU is mostly constant for this approximation
            proj30, proj60, proj90
        };

        // Insights Generator
        const insights = [];
        const mrrGrowth = mrr > prevMrr ? ((mrr - prevMrr)/prevMrr*100) : (prevMrr > 0 ? ((mrr - prevMrr)/prevMrr*100) : 0);
        if (mrrGrowth > 0) insights.push({ type: 'positive', text: `Receita MRR cresceu ${mrrGrowth.toFixed(1)}% no período.` });
        else if (mrrGrowth < 0) insights.push({ type: 'negative', text: `Receita MRR retraiu ${Math.abs(mrrGrowth).toFixed(1)}% no período.` });
        
        if (paidChurnRate > 5) insights.push({ type: 'negative', text: `Churn de pagantes (${paidChurnRate.toFixed(1)}%) está acima da zona saudável (< 5%).` });
        else insights.push({ type: 'positive', text: `Churn de pagantes está controlado e saudável.` });

        if (paidNewCount > paidChurnedCount) insights.push({ type: 'positive', text: `Mais assinantes pagantes entraram (${paidNewCount}) do que saíram (${paidChurnedCount}).` });
        else if (paidChurnedCount > paidNewCount) insights.push({ type: 'warning', text: `Alerta: Base de assinantes está encolhendo.` });

        // Invoices 
        let recentInvoices = [];
        if (process.env.ASAAS_API_KEY) {
            try {
                const response = await fetch(`${process.env.ASAAS_API_URL}/payments?limit=30&order=desc`, {
                    headers: { 'access_token': process.env.ASAAS_API_KEY }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        const filteredData = data.data.filter(p => p.status !== 'PENDING').slice(0, 8);
                        
                        let overdueCount = 0;
                        recentInvoices = await Promise.all(filteredData.map(async (payment) => {
                            if (payment.status === 'OVERDUE') overdueCount++;
                            let psiName = 'Cliente Externo';
                            let psiId = null;
                            if (payment.externalReference) {
                                const psi = await db.Psychologist.findByPk(payment.externalReference, { attributes: ['id', 'nome'] });
                                if (psi) { psiName = psi.nome; psiId = psi.id; }
                            }
                            
                            let translatedStatus = 'Pendente';
                            if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(payment.status)) translatedStatus = 'Paga';
                            else if (payment.status === 'OVERDUE') translatedStatus = 'Atrasada';
                            else if (['REFUNDED', 'CHARGEBACK_REQUESTED'].includes(payment.status)) translatedStatus = 'Cancelada';

                            return {
                                psychologistName: psiName,
                                psiId: psiId,
                                date: payment.paymentDate || payment.dueDate || payment.dateCreated,
                                dueDate: payment.dueDate,
                                amount: payment.value,
                                status: translatedStatus
                            };
                        }));
                        if (overdueCount > 0) insights.push({ type: 'warning', text: `Existem ${overdueCount} faturas recentes atrasadas.` });
                    }
                }
            } catch (err) {}
        }

        let activePlans = activePsychologists.map(psy => {
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            const planKey = (psy.plano || '').toLowerCase();
            return {
                psychologistName: psy.nome,
                planName: psy.is_exempt ? `${psy.plano} (VIP)` : (!hasSub ? `${psy.plano} (Trial)` : psy.plano),
                mrr: (psy.is_exempt || !hasSub) ? 0 : (planPrices[planKey] || 0),
                nextBilling: psy.is_exempt ? null : (psy.planExpiresAt ? new Date(psy.planExpiresAt) : new Date(new Date(psy.updatedAt).setMonth(new Date(psy.updatedAt).getMonth() + 1))) 
            };
        });
        
        // Sort active plans by nearest nextBilling (to populate upcoming payments table)
        activePlans.sort((a,b) => {
            if(!a.nextBilling) return 1; if(!b.nextBilling) return -1;
            return a.nextBilling.getTime() - b.nextBilling.getTime();
        });

        res.json({ 
            kpis, 
            recentInvoices, 
            activePlans: activePlans.slice(0, 10), // Limit upcoming payments to 10
            sparklines: { newUsers: sparkPaidNewUsers, paidChurns: sparkPaidChurns, trialChurns: sparkTrialChurns, mrr: sparkMrr },
            insights,
            planDistribution: activePsychologists.reduce((acc, p) => {
                let pk = p.plano || 'Desconhecido';
                if (pk !== 'Desconhecido') {
                    const lower = pk.toLowerCase();
                    if (['essential', 'essencial'].includes(lower)) pk = 'Essencial';
                    else if (['clinical', 'clínico'].includes(lower)) pk = 'Clinical';
                    else if (['reference', 'sol'].includes(lower)) pk = 'Reference';
                    else pk = pk.charAt(0).toUpperCase() + pk.slice(1).toLowerCase();
                }
                acc[pk] = (acc[pk] || 0) + 1;
                return acc;
            }, {})
        });
    } catch (error) {
        console.error("Erro no relatorio financeiro:", error);
        res.status(500).json({ error: error.message });
    }
};


/**
 * Rota: GET /api/admin/questionnaire-analytics
 */
exports.getQuestionnaireAnalytics = async (req, res) => {
    try {
        const countJsonField = async (field, isArray = false) => {
            const jsonCol = 'CAST("searchParams" AS JSONB)';
            let query = isArray ? `
                SELECT value, COUNT(*) as count
                FROM "DemandSearches", jsonb_array_elements_text(${jsonCol}->'${field}') as value
                WHERE status = 'completed' AND ${jsonCol}->'${field}' IS NOT NULL AND jsonb_typeof(${jsonCol}->'${field}') = 'array'
                GROUP BY value
            ` : `
                SELECT ${jsonCol}->>'${field}' as value, COUNT(*) as count
                FROM "DemandSearches"
                WHERE status = 'completed' AND ${jsonCol}->>'${field}' IS NOT NULL
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            if (results) results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const totalPatients = await db.DemandSearch.count({ where: { status: 'completed' } });

        const [ idade, identidade_genero, pref_genero_prof, motivacao, temas, terapia_anterior, experiencia_desejada, caracteristicas_prof, faixa_valor, modalidade_atendimento ] = await Promise.all([
            countJsonField('idade'), countJsonField('identidade_genero'), countJsonField('pref_genero_prof'),
            countJsonField('motivacao', true), countJsonField('temas', true), countJsonField('terapia_anterior'),
            countJsonField('experiencia_desejada', true), countJsonField('caracteristicas_prof', true),
            countJsonField('faixa_valor'), countJsonField('modalidade_atendimento')
        ]);

        const patientAnalytics = { total: totalPatients, idade, identidade_genero, pref_genero_prof, motivacao, temas, terapia_anterior, experiencia_desejada, caracteristicas_prof, faixa_valor, modalidade_atendimento };
        const totalPsis = await db.Psychologist.count({ where: { status: 'active' } });

        const countArrayField = async (field) => {
            const query = `
                SELECT value, COUNT(*) as count
                FROM "Psychologists", jsonb_array_elements_text(CAST("${field}" AS JSONB)) as value
                WHERE status = 'active' AND "${field}" IS NOT NULL AND jsonb_typeof(CAST("${field}" AS JSONB)) = 'array'
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            if (results) results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const countSimpleField = async (field) => {
            const query = `SELECT "${field}" as value, COUNT(*) as count FROM "Psychologists" WHERE status = 'active' AND "${field}" IS NOT NULL GROUP BY value`;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            if (results) results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const countModalidadePsi = async () => {
             const query = `SELECT value, COUNT(*) as count FROM "Psychologists", jsonb_array_elements_text(CAST("modalidade" AS JSONB)) as value WHERE status = 'active' AND "modalidade" IS NOT NULL AND jsonb_typeof(CAST("modalidade" AS JSONB)) = 'array' GROUP BY value`;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            if (results) results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const countValorPsi = async () => {
            const query = `
                SELECT CASE WHEN "valor_sessao_numero" <= 90 THEN 'Social (até R$ 90)' WHEN "valor_sessao_numero" <= 150 THEN 'R$ 91 - R$ 150' WHEN "valor_sessao_numero" <= 250 THEN 'R$ 151 - R$ 250' ELSE 'R$ 251+' END as value, COUNT(*) as count
                FROM "Psychologists" WHERE status = 'active' AND "valor_sessao_numero" IS NOT NULL GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            if (results) results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const [ modalidade, genero_identidade_psi, valor_sessao_faixa_psi, temas_atuacao, abordagens_tecnicas, praticas_vivencias ] = await Promise.all([
            countModalidadePsi(), countSimpleField('genero_identidade'), countValorPsi(), countArrayField('temas_atuacao'), countArrayField('abordagens_tecnicas'), countArrayField('praticas_vivencias')
        ]);

        const psiAnalytics = { total: totalPsis, modalidade, genero_identidade: genero_identidade_psi, valor_sessao_faixa: valor_sessao_faixa_psi, temas_atuacao, abordagens_tecnicas, praticas_vivencias };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const total30d = await db.DemandSearch.count({ where: { status: 'completed', createdAt: { [Op.gte]: thirtyDaysAgo } } });
        const summary30d = { total: total30d, stats: {} };

        if (total30d > 0) {
            const getTopStat = async (field, isArray = false) => {
                const jsonCol = 'CAST("searchParams" AS JSONB)';
                let query = isArray ? `
                    SELECT value, COUNT(*) as count
                    FROM "DemandSearches", jsonb_array_elements_text(${jsonCol}->'${field}') as value
                    WHERE status = 'completed' AND "createdAt" >= :date AND ${jsonCol}->'${field}' IS NOT NULL AND jsonb_typeof(${jsonCol}->'${field}') = 'array'
                    GROUP BY value ORDER BY count DESC LIMIT 1
                ` : `
                    SELECT ${jsonCol}->>'${field}' as value, COUNT(*) as count
                    FROM "DemandSearches"
                    WHERE status = 'completed' AND "createdAt" >= :date AND ${jsonCol}->>'${field}' IS NOT NULL
                    GROUP BY value ORDER BY count DESC LIMIT 1
                `;
                const [results] = await db.sequelize.query(query, { replacements: { date: thirtyDaysAgo } });
                if (results.length > 0) {
                    return { label: results[0].value, percentage: Math.round((parseInt(results[0].count, 10) / total30d) * 100) };
                }
                return { label: 'Sem dados', percentage: 0 };
            };

            const fields = [
                { key: 'idade', isArray: false }, { key: 'identidade_genero', isArray: false }, { key: 'pref_genero_prof', isArray: false },
                { key: 'motivacao', isArray: true }, { key: 'temas', isArray: true }, { key: 'terapia_anterior', isArray: false },
                { key: 'experiencia_desejada', isArray: true }, { key: 'caracteristicas_prof', isArray: true },
                { key: 'faixa_valor', isArray: false }, { key: 'modalidade_atendimento', isArray: false }
            ];
            
            for (const f of fields) summary30d.stats[f.key] = await getTopStat(f.key, f.isArray);
        }

        res.json({ patientAnalytics, psiAnalytics, summary30d });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/analytics/funnel
 */
exports.getFunnelAnalytics = async (req, res) => {
    try {
        const parseDateBRT = (dateString, isEnd = false) => {
            if (!dateString) return null;
            const time = isEnd ? '23:59:59.999' : '00:00:00.000';
            return new Date(`${dateString}T${time}-03:00`);
        };

        let start = parseDateBRT(req.query.startDate, false);
        let end = parseDateBRT(req.query.endDate, true);

        if (!start) {
            start = new Date(); start.setHours(start.getHours() - 3); start.setDate(start.getDate() - 30); start.setUTCHours(3, 0, 0, 0);
        }
        if (!end) {
            end = new Date(); end.setHours(end.getHours() - 3); end.setUTCHours(2, 59, 59, 999); end.setDate(end.getDate() + 1);
        }

        const visitsResult = await db.sequelize.query(`SELECT COUNT(*) as count FROM "SiteVisits" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]);
        const visitas = parseInt(visitsResult[0]?.count || 0);

        const iniciaram = await db.DemandSearch.count({ where: { createdAt: { [Op.between]: [start, end] } } }).catch(() => 0);
        const completaram = await db.DemandSearch.count({ where: { status: 'completed', createdAt: { [Op.between]: [start, end] } } }).catch(() => 0);

        const profileViewsResult = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "createdAt" BETWEEN :start AND :end AND "source" = 'profile_click_funnel'`, { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]);
        const profileViews = parseInt(profileViewsResult[0]?.count || 0);

        const whatsappClicksResult = await db.sequelize.query(`SELECT COUNT(DISTINCT COALESCE("patientId"::varchar, "guestName", "id"::varchar)) as count FROM "WhatsappClickLogs" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]);
        const whatsappClicks = parseInt(whatsappClicksResult[0]?.count || 0);

        const desqualificadosResult = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches" WHERE "is_disqualified" = true AND "createdAt" BETWEEN :start AND :end`, { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]);
        const desqualificados = parseInt(desqualificadosResult[0]?.count || 0);

        const abandonos = await db.sequelize.query(
            `SELECT t.step, COUNT(*) as count 
             FROM "TrackingLogs" t
             LEFT JOIN "DemandSearches" d ON t."searchId" = CAST(d.id AS VARCHAR) AND (d.status = 'completed' OR d.is_disqualified = true)
             WHERE t."type" = 'questionario_dropoff' AND t."createdAt" BETWEEN :start AND :end AND d.id IS NULL
             GROUP BY t.step ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        // Busca origens a partir dos questionários preenchidos, em vez da tabela de pacientes
        const jsonColUtm = 'CAST("searchParams" AS JSONB)';
        const origens = await db.sequelize.query(
            `SELECT ${jsonColUtm}->>'utm_source' as source, COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" BETWEEN :start AND :end AND ${jsonColUtm}->>'utm_source' IS NOT NULL AND ${jsonColUtm}->>'utm_source' != '' GROUP BY source ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        // --- BLOCO DE INTELIGÊNCIA DE DEMANDA ---
        const jsonCol = 'CAST("searchParams" AS JSONB)';
        
        const topTemas = await db.sequelize.query(
            `SELECT value, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text(${jsonCol}->'temas') as value WHERE status = 'completed' AND "createdAt" BETWEEN :start AND :end AND ${jsonCol}->'temas' IS NOT NULL AND jsonb_typeof(${jsonCol}->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 10`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const faixaValor = await db.sequelize.query(
            `SELECT ${jsonCol}->>'faixa_valor' as value, COUNT(*) as count FROM "DemandSearches" WHERE status = 'completed' AND "createdAt" BETWEEN :start AND :end AND ${jsonCol}->>'faixa_valor' IS NOT NULL GROUP BY value ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const modalidades = await db.sequelize.query(
            `SELECT ${jsonCol}->>'modalidade_atendimento' as value, COUNT(*) as count FROM "DemandSearches" WHERE status = 'completed' AND "createdAt" BETWEEN :start AND :end AND ${jsonCol}->>'modalidade_atendimento' IS NOT NULL GROUP BY value ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        res.json({ visitas, iniciaram, completaram, profileViews, whatsappClicks, abandonos, origens, desqualificados, inteligencia: { topTemas, faixaValor, modalidades } });
    } catch (error) {
        console.error('Erro em getFunnelAnalytics:', error);
        res.status(500).json({ error: 'Erro ao gerar dados do funil' });
    }
};

exports.getWhatsappFeedbacks = async (req, res) => {
    try {
        const db = require('../models');
        
        const { Op } = require('sequelize');
        const { startDate, endDate } = req.query;

        const whereClause = {};
        if (startDate && endDate) {
            // Aplica o fuso horário correto (Brasília)
            const start = new Date(`${startDate}T00:00:00-03:00`).toISOString();
            const end = new Date(`${endDate}T23:59:59-03:00`).toISOString();
            whereClause.createdAt = {
                [Op.gte]: start,
                [Op.lte]: end
            };
        }

        // Busca todos os logs de cliques, ordenando pelos mais recentes
        const feedbacks = await db.WhatsAppClickLog.findAll({
            where: whereClause,
            include: [{
                model: db.Psychologist,
                as: 'psychologist', // Precisa bater com o alias definido no WhatsAppClickLog.js
                attributes: ['id', 'nome', 'email', 'slug', 'telefone'], // 'id' adicionado para permitir o clique no painel
                paranoid: false // Incluir psicólogos que deletaram a conta
            }],
            order: [['createdAt', 'DESC']]
        });
        
        // Garante que contatos antigos tenham feedbackToken para o link mágico do admin
        const { v4: uuidv4 } = require('uuid');
        for (let i = 0; i < feedbacks.length; i++) {
            if (!feedbacks[i].feedbackToken) {
                feedbacks[i].feedbackToken = uuidv4();
                await feedbacks[i].save();
            }
        }
        
        res.status(200).json(feedbacks);
    } catch (error) {
        console.error('Erro ao buscar feedbacks do WhatsApp (Admin):', error);
        res.status(500).json({ error: 'Erro interno ao buscar feedbacks.' });
    }
};

exports.markWhatsappReminder = async (req, res) => {
    try {
        const db = require('../models');
        const { psiId } = req.params;

        if (!psiId) {
            return res.status(400).json({ error: 'ID do psicólogo é obrigatório.' });
        }

        const { Op } = require('sequelize');

        // Busca todos os logs pendentes desse psicólogo
        const pendingLogs = await db.WhatsAppClickLog.findAll({
            where: {
                psychologistId: psiId,
                feedbackGiven: false
            }
        });

        if (pendingLogs.length === 0) {
            return res.status(404).json({ message: 'Nenhum contato pendente encontrado para este psicólogo.' });
        }

        const now = new Date();

        // Atualiza todos para marcar como cobrados
        for (const log of pendingLogs) {
            log.adminWppReminderSentAt = now;
            log.adminWppReminderCount = (log.adminWppReminderCount || 0) + 1;
            await log.save();
        }

        res.status(200).json({ message: `Lembrete marcado para ${pendingLogs.length} contatos.` });
    } catch (error) {
        console.error('Erro ao marcar cobrança do WhatsApp:', error);
        res.status(500).json({ error: 'Erro interno ao marcar cobrança.' });
    }
};

exports.forceWhatsappResponse = async (req, res) => {
    try {
        const db = require('../models');
        const { id } = req.params;
        const { contactReceived, dealClosed } = req.body;

        const log = await db.WhatsAppClickLog.findByPk(id);
        if (!log) {
            return res.status(404).json({ error: 'Log não encontrado.' });
        }

        log.feedbackGiven = true;
        log.contactReceived = contactReceived === 'yes' || contactReceived === true;
        log.dealClosed = dealClosed; // 'yes' or 'no'

        await log.save();

        res.status(200).json({ message: 'Feedback forçado com sucesso.' });
    } catch (error) {
        console.error('Erro ao forçar resposta do feedback:', error);
        res.status(500).json({ error: 'Erro interno ao salvar resposta.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/admin/founder-metrics
// ----------------------------------------------------------------------
exports.getFounderMetrics = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        
        // 1. LER METAS (JSON File ou Default)
        const goalsFile = require('path').join(__dirname, '..', '..', 'backend', 'config', 'founder_goals.json');
        let goals = { goalUsers: 20, goalMRR: 1980, goalMonths: 8, goalStartDate: '2026-05-01', newPerMonth: 2 };
        if (require('fs').existsSync(goalsFile)) {
            try {
                goals = JSON.parse(require('fs').readFileSync(goalsFile, 'utf8'));
            } catch(e){}
        }

        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const yesterdayStart = new Date();
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        yesterdayStart.setHours(0,0,0,0);

        // 2. BUSCAR TODOS OS PSICÓLOGOS (Ativos ou inativos desde ontem)
        const activePsis = await db.Psychologist.findAll({
            where: {
                is_exempt: false,
                [Op.or]: [
                    { status: 'active' },
                    {
                        status: 'inactive',
                        planExpiresAt: { [Op.gte]: yesterdayStart }
                    }
                ]
            },
            attributes: ['id', 'nome', 'telefone', 'plano', 'status', 'stripeSubscriptionId', 'subscriptionId', 'planExpiresAt', 'cancelAtPeriodEnd', 'createdAt', 'fotoUrl', 'bio', 'whatsapp_clicks', 'profile_appearances', 'admin_billing_sent_at']
        });

        let currentMRR = 0;
        let payingUsers = 0;
        let activeTrialsCount = 0;
        const now = new Date();
        const trialPipeline = [];

        const activeTrialIds = [];

        activePsis.forEach(p => {
            const hasSub = !!(p.stripeSubscriptionId || p.subscriptionId);
            
            let planEndsInFuture = false;
            let expiredSundayKeepMonday = false;

            if (p.planExpiresAt) {
                const expDate = new Date(p.planExpiresAt);
                planEndsInFuture = expDate > now;
                
                // Se expirou ontem e ontem era domingo, hoje é segunda, então mantemos no funil para cobrança no dia útil
                if (!planEndsInFuture && expDate > yesterdayStart && expDate.getDay() === 0 && now.getDay() === 1) {
                    expiredSundayKeepMonday = true;
                }
            }

            if (hasSub && p.status === 'active') {
                // Pagante
                payingUsers++;
                const planoKey = (p.plano || '').toLowerCase();
                currentMRR += (planPrices[planoKey] || 0);
            } else if (planEndsInFuture || expiredSundayKeepMonday) {
                // Trial Ativo: Somente contabiliza como ativo se executou ação chave (preencheu perfil)
                if (p.fotoUrl || p.bio) {
                    activeTrialsCount++;
                    activeTrialIds.push(p.id);
                    const expDate = new Date(p.planExpiresAt);
                    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                    
                    let statusTxt = daysLeft === 0 ? 'Expira hoje' : (daysLeft < 0 ? 'Expirado' : 'Trial');
                    if (expiredSundayKeepMonday) statusTxt = 'Expirou no Domingo';

                    trialPipeline.push({
                        id: p.id,
                        name: p.nome,
                        telefone: p.telefone,
                        whatsapp_clicks: p.whatsapp_clicks || 0,
                        profile_appearances: p.profile_appearances || 0,
                        admin_billing_sent_at: p.admin_billing_sent_at,
                        daysLeft: daysLeft,
                        status: statusTxt,
                        expiredSundayKeepMonday: expiredSundayKeepMonday
                    });
                }
            }
        });

        // Mapear logs de WhatsApp para saber se fecharam negócio
        const trialWppLogs = await db.WhatsAppClickLog.findAll({
            where: { psychologistId: { [Op.in]: activeTrialIds } },
            attributes: ['psychologistId', 'dealClosed']
        });

        // Buscar exatos de MatchEvents e ProfileAppearanceLogs
        let matchEventsCount = [];
        let profileViewsCount = [];
        if (activeTrialIds.length > 0) {
            matchEventsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "psychologistId" IN (:activeTrialIds) 
                GROUP BY "psychologistId"
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

            profileViewsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:activeTrialIds) 
                GROUP BY "psychologistId"
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);
        }

        // Associa o status de fechamento ao pipeline e corrige a contagem de cliques
        trialPipeline.forEach(tp => {
            const logs = trialWppLogs.filter(l => l.psychologistId === tp.id);
            const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
            tp.dealClosed = closedDeals.length > 0;
            tp.closedDealsCount = closedDeals.length;
            
            tp.whatsapp_clicks = Math.max(tp.whatsapp_clicks || 0, logs.length);
            
            const matchEv = matchEventsCount.find(m => m.psychologistId == tp.id);
            const profView = profileViewsCount.find(m => m.psychologistId == tp.id);
            
            const exactMatches = matchEv ? parseInt(matchEv.count) : 0;
            const exactViews = profView ? parseInt(profView.count) : 0;
            
            if (exactMatches > (tp.profile_appearances || 0)) tp.profile_appearances = exactMatches;
            tp.profile_views = exactViews;
        });

        // Ordenar Pipeline: os que expiram antes primeiro
        trialPipeline.sort((a,b) => a.daysLeft - b.daysLeft);

        // 3. CÁLCULO DE CHURN E CONVERSÃO
        const signups = await db.Psychologist.count();
        const trialsCount = await db.Psychologist.count({ where: { status: { [Op.ne]: 'pending' } } });
        
        const everPaidCount = await db.Psychologist.count({
            where: {
                [Op.or]: [
                    { subscribedAt: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ]
            }
        });

        const conversionRate = trialsCount > 0 ? (everPaidCount / trialsCount) : 0;

        const churnedUsers = await db.Psychologist.count({
            where: { 
                status: 'inactive',
                [Op.or]: [
                    { subscribedAt: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ]
            }
        });
        
        const totalStart = payingUsers + churnedUsers;
        const churnRate = totalStart > 0 ? (churnedUsers / totalStart) : 0;

        // 5. FUNIL
        const visitors = await db.sequelize.query('SELECT COUNT(*) as count FROM "SiteVisits"', { type: db.sequelize.QueryTypes.SELECT }).then(res => res[0].count).catch(() => 0);
        
        // Trial Churn: pessoas que iniciaram trial, não pagaram e já expiraram
        const trialChurnCount = trialsCount - everPaidCount - activeTrialsCount;
        const trialChurnRate = trialsCount > 0 ? (Math.max(0, trialChurnCount) / trialsCount) : 0;

        const funnel = {
            visitors: parseInt(visitors) || 0,
            signups: signups,
            trials: trialsCount,
            paying: everPaidCount,
            trialChurnCount: Math.max(0, trialChurnCount),
            trialChurnRate: trialChurnRate
        };

        // 6. HISTÓRICO DE CRESCIMENTO MENSAL
        const growthHistory = [];
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        for (let i = 4; i >= 0; i--) { 
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endD = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            
            // Conta quantos pagantes já existiam até aquele mês
            const activesAtTime = await db.Psychologist.count({
                where: { 
                    subscribedAt: { [Op.lte]: endD }
                }
            });
            growthHistory.push({ month: monthNames[d.getMonth()], users: activesAtTime });
        }

        // 7. YELO SCORE (0 a 100)
        const scoreMrr = Math.min(1, currentMRR / goals.goalMRR) * 15;
        const scoreUsers = Math.min(1, payingUsers / goals.goalUsers) * 40;
        const scoreConv = Math.min(1, conversionRate / 0.40) * 25; 
        const scoreRet = Math.max(0, (1 - churnRate)) * 20;
        const yeloScore = Math.round(scoreMrr + scoreUsers + scoreConv + scoreRet);

        // Previsão MRR (Trials * Conversão * Mensalidade Média)
        const avgTicket = payingUsers > 0 ? (currentMRR / payingUsers) : 99;
        const projectedMRR = activeTrialsCount * conversionRate * avgTicket;
        
        // --- CONVERSION ANALYTICS ---
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        
        const trialsLastMonth = await db.Psychologist.count({
            where: { createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] } }
        });
        const paidLastMonth = await db.Psychologist.count({
            where: { 
                createdAt: { [Op.between]: [lastMonthStart, lastMonthEnd] },
                [Op.or]: [
                    { subscribedAt: { [Op.not]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } }
                ]
            }
        });
        const lastMonthConversionRate = trialsLastMonth > 0 ? (paidLastMonth / trialsLastMonth) : 0;

        const daysPassedThisMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const trialsThisMonth = await db.Psychologist.count({
            where: { createdAt: { [Op.gte]: currentMonthStart } }
        });
        const projectedTrialsThisMonth = Math.round((trialsThisMonth / Math.max(1, daysPassedThisMonth)) * daysInMonth);
        
        const projectedPaidUsingTotal = Math.round(projectedTrialsThisMonth * conversionRate);
        const projectedPaidUsingLastMonth = Math.round(projectedTrialsThisMonth * lastMonthConversionRate);

        const conversionAnalytics = {
            total: {
                trials: trialsCount,
                paid: everPaidCount,
                rate: conversionRate
            },
            lastMonth: {
                trials: trialsLastMonth,
                paid: paidLastMonth,
                rate: lastMonthConversionRate
            },
            currentMonth: {
                trialsSoFar: trialsThisMonth,
                projectedTrials: projectedTrialsThisMonth,
                projectedPaidUsingTotal: projectedPaidUsingTotal,
                projectedPaidUsingLastMonth: projectedPaidUsingLastMonth
            }
        };

        res.status(200).json({
            goals,
            metrics: {
                currentMRR,
                payingUsers,
                activeTrialsCount,
                conversionRate,
                churnRate,
                projectedMRR
            },
            trialPipeline,
            funnel,
            growthHistory,
            yeloScore,
            conversionAnalytics
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar métricas do fundador.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/admin/founder-goals
// ----------------------------------------------------------------------
exports.saveFounderGoals = (req, res) => {
    try {
        const configDir = require('path').join(__dirname, '..', '..', 'backend', 'config');
        if (!require('fs').existsSync(configDir)) {
            require('fs').mkdirSync(configDir, { recursive: true });
        }
        
        const goalsFile = require('path').join(configDir, 'founder_goals.json');
        const newGoals = req.body;
        require('fs').writeFileSync(goalsFile, JSON.stringify(newGoals, null, 2), 'utf8');
        res.status(200).json({ message: 'Metas atualizadas com sucesso.', goals: newGoals });
    } catch(err) {
        res.status(500).json({ error: 'Erro ao salvar metas.' });
    }
};
// ----------------------------------------------------------------------
// Rota: POST /api/admin/founder-metrics/billing-sent/:id
// ----------------------------------------------------------------------
exports.markBillingSent = async (req, res) => {
    try {
        const { db } = require('../models');
        const psiId = req.params.id;
        const psi = await db.Psychologist.findByPk(psiId);
        if (!psi) return res.status(404).json({ error: 'Psi não encontrado' });
        
        psi.admin_billing_sent_at = new Date();
        await psi.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('[ERRO] Ao marcar cobrança enviada:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};
