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
            'ESSENTIAL': 99.00, 'CLINICAL': 159.00, 'REFERENCE': 259.00,
            'Essencial': 99.00, 'Clínico': 159.00, 'Sol': 259.00 
        };
        let mrr = 0;
        
        psisByPlan.forEach(p => {
            const plano = p.plano;
            const isExempt = p.is_exempt;
            const hasSubscription = !!(p.stripeSubscriptionId || p.subscriptionId);
            if (!plano) return;
            
            let planKey = plano;
            if (['ESSENTIAL', 'Essencial'].includes(plano)) planKey = 'Essencial';
            if (['CLINICAL', 'Clínico'].includes(plano)) planKey = 'Clínico';
            if (['REFERENCE', 'Sol', 'Reference'].includes(plano)) planKey = 'Sol';

            plansCount[planKey] = (plansCount[planKey] || 0) + 1;
            
            if (!isExempt && hasSubscription && planPrices[plano]) {
                mrr += planPrices[plano];
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

        const plansQuery = `SELECT plano, COUNT(*) as total FROM "Psychologists" WHERE status = 'active' AND plano IS NOT NULL AND "deletedAt" IS NULL GROUP BY plano;`;

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

            const totalActive = activePsychologists.length;
            const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt).length;
            const totalStart = totalActive + churnedCount;
            const churnRate = totalStart > 0 ? (churnedCount / totalStart) * 100 : 0;

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
        const activePsychologists = await db.Psychologist.findAll({
            where: {
                plano: { [Op.ne]: null },
                status: 'active'
            },
            attributes: ['id', 'nome', 'plano', 'updatedAt', 'is_exempt', 'planExpiresAt', 'stripeSubscriptionId', 'subscriptionId'] 
        });

        const planPrices = { 
            'ESSENTIAL': 99.00, 'CLINICAL': 159.00, 'REFERENCE': 259.00,
            'Essencial': 99.00, 'Clínico': 159.00, 'Sol': 259.00 
        };

        const mrr = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            if (!hasSub) return acc;
            
            return acc + (planPrices[psy.plano ? psy.plano.toUpperCase() : ''] || 0);
        }, 0);
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        const churnedCount = await db.Psychologist.count({
            where: {
                status: 'inactive',
                updatedAt: { [Op.gte]: thirtyDaysAgo }
            }
        });
        const totalActiveCount = activePsychologists.length;
        const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt).length;
        const totalUsersAtStartOfMonth = totalActiveCount + churnedCount;
        const churnRate = totalUsersAtStartOfMonth > 0 ? (churnedCount / totalUsersAtStartOfMonth) * 100 : 0;
        const arpu = payingActiveCount > 0 ? mrr / payingActiveCount : 0;
        const ltv = churnRate > 0 ? arpu / (churnRate / 100) : (arpu * 24);
        const kpis = {
            mrr: mrr, churnRate: churnRate.toFixed(1), ltv: ltv, arpu: arpu
        };

        let recentInvoices = [];
        if (ASAAS_API_KEY) {
            try {
                const response = await fetch(`${ASAAS_API_URL}/payments?status=RECEIVED&limit=10&order=desc`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.data) {
                        recentInvoices = await Promise.all(data.data.map(async (payment) => {
                            let psiName = 'Cliente Externo';
                            if (payment.externalReference) {
                                const psi = await db.Psychologist.findByPk(payment.externalReference, { attributes: ['nome'] });
                                if (psi) psiName = psi.nome;
                            }
                            return {
                                psychologistName: psiName,
                                date: payment.paymentDate || payment.dateCreated,
                                amount: payment.value,
                                status: 'Paga'
                            };
                        }));
                    }
                }
            } catch (err) {}
        }

        const activePlans = activePsychologists.map(psy => {
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
            return {
                psychologistName: psy.nome,
                planName: psy.is_exempt ? `${psy.plano} (VIP)` : (!hasSub ? `${psy.plano} (Trial)` : psy.plano),
                mrr: (psy.is_exempt || !hasSub) ? 0 : (planPrices[psy.plano ? psy.plano.toUpperCase() : ''] || 0),
                nextBilling: psy.is_exempt ? null : (psy.planExpiresAt ? new Date(psy.planExpiresAt) : new Date(new Date(psy.updatedAt).setMonth(new Date(psy.updatedAt).getMonth() + 1))) 
            };
        });
        res.status(200).json({ kpis, recentInvoices, activePlans });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
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
                attributes: ['id', 'nome', 'email', 'slug'] // 'id' adicionado para permitir o clique no painel
            }],
            order: [['createdAt', 'DESC']]
        });
        
        res.status(200).json(feedbacks);
    } catch (error) {
        console.error('Erro ao buscar feedbacks do WhatsApp (Admin):', error);
        res.status(500).json({ error: 'Erro interno ao buscar feedbacks.' });
    }
};