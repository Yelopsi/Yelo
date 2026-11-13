const db = require('../models');
const { Op } = require('sequelize');
const {
    LOGGED_NON_PATIENT_TYPES,
    UNLOGGED_NON_PATIENT_TYPES,
    B2B_OR_PRO_PAGE_SQL
} = require('../utils/actorClassifier');

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
            db.WaitingList.findAll({ where: { status: 'pending' }, raw: true }).catch(() => []),
            db.Review.count({ where: { status: 'pending' } }).catch(() => 0),
            db.Psychologist.findAll({
                attributes: ['plano', 'is_exempt', 'subscriptionId', 'subscription_payments_count'],
                where: { 
                    status: 'active', 
                    plano: { [Op.ne]: null },
                    [Op.or]: [ { is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } } ]
                }
            }).catch(() => []),
            db.SystemLog.count({ where: { message: { [Op.iLike]: '%[EMAIL_FAIL]%' }, createdAt: { [Op.gte]: oneDayAgo } } }).catch(() => 0),
            db.sequelize.query(`SELECT COUNT(DISTINCT COALESCE("patientId"::varchar, "guestName", "id"::varchar)) as count FROM "WhatsAppClickLogs"`, { type: db.sequelize.QueryTypes.SELECT }).catch(e => { return [{ count: 0 }]; })
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
        let payingCount = 0;
        let vipCount = 0;
        let trialsCount = 0;
        
        psisByPlan.forEach(p => {
            const plano = p.plano;
            const isExempt = p.is_exempt;
            const hasSubscription = !!p.subscriptionId || (p.subscription_payments_count && p.subscription_payments_count > 0);
            
            if (isExempt) {
                vipCount++;
            } else if (hasSubscription) {
                payingCount++;
            } else {
                trialsCount++;
            }

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

        const activePsis = psychologistStatsResult[0] ? await db.Psychologist.findAll({ attributes: ['email', 'telefone'], raw: true }).catch(()=>[]) : [];
        const registeredEmails = new Set(activePsis.map(p => p.email ? p.email.toLowerCase().trim() : ''));
        const registeredPhones = new Set(activePsis.map(p => p.telefone ? p.telefone.replace(/\D/g, '') : ''));
        
        let validWaitingListCount = 0;
        for (const entry of waitingListCount) {
            const entryEmail = entry.email ? entry.email.toLowerCase().trim() : '';
            const entryPhone = entry.telefone ? entry.telefone.replace(/\D/g, '') : '';
            
            if ((entryEmail && registeredEmails.has(entryEmail)) || (entryPhone && entryPhone.length > 8 && registeredPhones.has(entryPhone))) {
                db.WaitingList.destroy({ where: { id: entry.id } }).catch(()=>{});
                continue;
            }
            validWaitingListCount++;
        }

        // --- EASTER EGG: RECORDE DE ASSINANTES PAGANTES ---
        let maxRecord = 16;
        let isNewRecord = false;
        let easterEggDebug = null;
        try {
            const settings = await db.SystemSetting.findOne();
            maxRecord = settings ? (settings.max_subscribers_record || 16) : 16;
            if (payingCount > maxRecord) {
                maxRecord = payingCount;
                if (settings) {
                    await settings.update({ max_subscribers_record: maxRecord });
                }
                isNewRecord = true;
            }
            easterEggDebug = { status: 'success', maxRecord, isNewRecord, settingsFound: !!settings };
        } catch (easterEggError) {
            console.error('Erro ao acessar SystemSettings para easter egg:', easterEggError);
            easterEggDebug = {
                status: 'error',
                message: easterEggError.message,
                stack: easterEggError.stack,
                name: easterEggError.name,
                sql: easterEggError.sql || 'N/A'
            };
        }

        let netGrowth90d = 0;
        try {
            const [newPaying90dRes] = await db.sequelize.query(`
                SELECT COUNT(*) as count 
                FROM "Psychologists" 
                WHERE "createdAt" >= NOW() - INTERVAL '90 days' 
                AND status = 'active' 
                AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0) 
                AND (is_exempt IS NULL OR is_exempt = false)
            `, { type: db.sequelize.QueryTypes.SELECT });
            
            const [churnedPaying90dRes] = await db.sequelize.query(`
                SELECT COUNT(*) as count 
                FROM "Psychologists" p
                WHERE p."deletedAt" IS NULL
                AND (p."is_exempt" IS NULL OR p."is_exempt" = false)
                AND NOT (p.status = 'active' AND (p."planExpiresAt" IS NULL OR p."planExpiresAt" > NOW()))
                AND (p."subscriptionId" IS NOT NULL OR p."subscription_payments_count" > 0 OR p."firstPaidAt" IS NOT NULL)
                AND COALESCE(
                    p."canceledAt",
                    CASE WHEN p."planExpiresAt" >= '2000-01-01' AND p."planExpiresAt" <= NOW() THEN p."planExpiresAt" ELSE NULL END,
                    (SELECT MAX(COALESCE(pay."paymentDate", pay."createdAt")) + INTERVAL '30 days' FROM "Payments" pay WHERE pay."psychologistId" = p.id AND pay.status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'))
                ) >= NOW() - INTERVAL '90 days'
            `, { type: db.sequelize.QueryTypes.SELECT });

            const new90d = parseInt(newPaying90dRes?.count || 0, 10);
            const churned90d = parseInt(churnedPaying90dRes?.count || 0, 10);
            netGrowth90d = new90d - churned90d;
        } catch (err) {
            console.error('Erro ao calcular netGrowth90d:', err);
        }

        console.timeEnd('⏱️ Dashboard Stats Load');
        res.status(200).json({
            mrr: parseFloat(mrr.toFixed(2)),
            newPatients30d: parseInt(patientStats?.new30d || 0, 10),
            newPsis30d: parseInt(psychologistStats?.new30d || 0, 10),
            questToday: parseInt(demandStats?.today || 0, 10),
            patients: { total: parseInt(patientStats?.total || 0, 10), active: parseInt(patientStats?.active || 0, 10), deleted: parseInt(patientStats?.deleted || 0, 10) },
            psychologists: { total: parseInt(psychologistStats?.total || 0, 10), active: parseInt(psychologistStats?.active || 0, 10), deleted: parseInt(psychologistStats?.deleted || 0, 10), byPlan: plansCount, paying: payingCount, vip: vipCount, trials: trialsCount },
            questionnaires: { total: parseInt(demandStats?.total || 0, 10), deleted: parseInt(demandStats?.abandoned || 0, 10) },
            waitingListCount: validWaitingListCount,
            pendingReviewsCount: pendingReviewsCount,
            emailHealth: { status: emailStatus, errors: emailErrors },
            overallConversionRate: parseFloat(overallConversionRate),
            totalMatches: totalMatches,
            totalClicks: totalClicks,
            isNewRecord: isNewRecord,
            netGrowth90d: netGrowth90d,
            _debugEasterEgg: easterEggDebug
        });

    } catch (error) {
        console.error('Erro crítico no dashboard:', error);
        res.status(500).json({ 
            error: 'Erro ao calcular métricas.', 
            debugMessage: error.message,
            debugStack: error.stack,
            debugName: error.name
        });
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
        if (startDate && startDate < new Date(2026, 4, 1)) startDate.setTime(new Date(2026, 4, 1).getTime());
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
                attributes: ['plano', 'is_exempt', 'subscriptionId', 'subscription_payments_count'] 
            }),
            db.Psychologist.count({ where: { status: 'inactive', updatedAt: { [Op.between]: [startDate, endDate] } }, paranoid: false }),
            db.sequelize.query(`SELECT COUNT(DISTINCT COALESCE("patientId"::varchar, "guestName", "id"::varchar)) as count FROM "WhatsAppClickLogs" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: { start: startDate, end: endDate }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ count: 0 }]),
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
            let mrr = activePsychologists.reduce((acc, psy) => {
                if (psy.is_exempt) return acc;
                const hasSub = !!psy.subscriptionId || (psy.subscription_payments_count && psy.subscription_payments_count > 0);
                if (!hasSub) return acc;
                const planoKey = (psy.plano || '').toLowerCase();
                return acc + (planPrices[planoKey] || 0);
            }, 0);

            const payingCondition = {
                [Op.or]: [{ subscriptionId: { [Op.ne]: null } }, { subscription_payments_count: { [Op.gt]: 0 } }]
            };
            const churnedPayingCount = await db.Psychologist.count({
                where: { status: 'inactive', updatedAt: { [Op.between]: [startDate, endDate] }, ...payingCondition }
            });
            const newPayingCount = await db.Psychologist.count({
                where: { status: 'active', createdAt: { [Op.between]: [startDate, endDate] }, ...payingCondition }
            });

            const payingActiveCount = activePsychologists.filter(psy => !psy.is_exempt && !!(psy.subscriptionId)).length;
            const totalStart = payingActiveCount + churnedPayingCount - newPayingCount;
            const baseForChurn = totalStart > 0 ? totalStart : 1;
            const churnRate = (churnedPayingCount / baseForChurn) * 100;

            const arpu = payingActiveCount > 0 ? mrr / payingActiveCount : 0;
            const ltv = (churnRate > 0 && churnedPayingCount >= 3 && payingActiveCount >= 10) ? arpu / (churnRate / 100) : 0;

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
        const systemLogs = await db.SystemLog.findAll({
            limit: 100,
            order: [['createdAt', 'DESC']]
        });

        const paymentLogs = await db.SystemLog.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { message: { [db.Sequelize.Op.iLike]: '%asaas%' } },
                    { message: { [db.Sequelize.Op.iLike]: '%pagamento%' } }
                ]
            },
            limit: 50,
            order: [['createdAt', 'DESC']]
        });

        let webhooks = [];
        try {
            webhooks = await db.WebhookInbox.findAll({
                limit: 50,
                order: [['receivedAt', 'DESC']]
            });
        } catch(e) {} // Fallback se tabela não existir

        const formattedWebhooks = webhooks.map(wh => {
            const payloadObj = typeof wh.payload === 'string' ? JSON.parse(wh.payload) : (wh.payload || {});
            const customerStr = payloadObj.payment?.customer || payloadObj.customer || 'Sistema Asaas';
            return {
                id: 'wh_' + wh.id,
                level: wh.status === 'ERROR' || wh.status === 'FAILED' ? 'error' : (wh.status === 'PENDING' ? 'warning' : 'info'),
                message: `[ASAAS WEBHOOK] ${payloadObj.event || 'Atualização'} - Proc: ${wh.status}`,
                createdAt: wh.receivedAt || wh.createdAt,
                meta: {
                    userEmail: customerStr,
                    error: wh.lastError
                }
            };
        });

        // Mesclar e ordenar removendo duplicatas
        const logMap = new Map();
        systemLogs.forEach(l => logMap.set(l.id, l.toJSON()));
        paymentLogs.forEach(l => logMap.set(l.id, l.toJSON()));
        
        let logs = [...Array.from(logMap.values()), ...formattedWebhooks];
        logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Garante que o frontend receba os logs recentes E os de pagamento
        logs = logs.slice(0, 150);

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
                db.SystemLog.count({ 
                    where: { 
                        level: 'error', 
                        createdAt: { [Op.gte]: oneDayAgo },
                        message: { [Op.notILike]: '%Falha de login%' }
                    } 
                }),
                db.SystemLog.count({ where: { level: 'error', message: { [Op.iLike]: '%asaas%' }, createdAt: { [Op.gte]: oneDayAgo } } }),
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
        const sixMonthsAgo = new Date(2026, 4, 1); // 1 de Maio de 2026 (Mês 4)
        
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
        
        const today = new Date();
        const totalMonths = (today.getFullYear() - sixMonthsAgo.getFullYear()) * 12 + (today.getMonth() - sixMonthsAgo.getMonth());
        const monthsToIterate = Math.max(0, totalMonths);
        
        const labels = Array.from({ length: monthsToIterate + 1 }, (_, i) => {
            const d = new Date(today.getFullYear(), today.getMonth() - monthsToIterate + i, 1);
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
        const { startDate, endDate } = req.query; // capture query params
        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const allPaidCandidates = await db.Psychologist.findAll({
            where: {
                plano: { [Op.ne]: null },
                [Op.or]: [
                    { subscriptionId: { [Op.ne]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } },
                    { firstPaidAt: { [Op.ne]: null } }
                ]
            },
            attributes: ['id', 'nome', 'plano', 'status', 'updatedAt', 'is_exempt', 'planExpiresAt', 'subscriptionId', 'createdAt', 'subscribedAt', 'firstPaidAt', 'canceledAt', 'reactivatedAt', 'subscription_payments_count', 'deletedAt'],
            paranoid: false
        });

        const MetricsService = require('../services/metricsService');

        const now = new Date();
        let start, end, prevStart, prevEnd;
        if (startDate && endDate) {
            start = new Date(`${startDate}T00:00:00-03:00`);
            const requestedEnd = new Date(`${endDate}T23:59:59-03:00`);
            end = (start <= now && requestedEnd > now) ? now : requestedEnd;
            const msDiff = Math.max(86400000, end.getTime() - start.getTime());
            prevStart = new Date(start.getTime() - msDiff);
            prevEnd = new Date(start.getTime() - 1);
        } else {
            end = now;
            start = new Date(now.getTime() - 30 * 86400000);
            prevStart = new Date(now.getTime() - 60 * 86400000);
            prevEnd = new Date(start.getTime() - 1);
        }

        const metrics = await MetricsService.getMetrics(start, end);
        const prevMetrics = await MetricsService.getMetrics(prevStart, prevEnd);

        const resolvePlanKey = (plano) => {
            if (!plano) return null;
            const raw = plano.toLowerCase();
            if (['essencial', 'essential'].includes(raw)) return 'essential';
            if (['clínico', 'clinical'].includes(raw)) return 'clinical';
            if (['sol', 'reference'].includes(raw)) return 'reference';
            return null;
        };

        let mrr = 0;
        let prevMrr = 0;
        let prevTotalActive = 0;
        allPaidCandidates.forEach(p => {
            const isExempt = !!p.is_exempt;
            const hasSubscription = !!p.subscriptionId || (p.subscription_payments_count && p.subscription_payments_count > 0);
            const planKey = resolvePlanKey(p.plano);
            if (isExempt || !hasSubscription || !planKey || !planPrices[planKey]) return;

            const isActiveNow = p.deletedAt === null && p.status === 'active' && (!p.planExpiresAt || new Date(p.planExpiresAt) > now);
            if (isActiveNow) {
                mrr += planPrices[planKey];
            }

            // Base e MRR históricos no fechamento do período anterior (prevEnd)
            const startedAt = p.firstPaidAt || p.subscribedAt || p.createdAt;
            if (!startedAt || new Date(startedAt) > prevEnd) return;
            if (p.deletedAt && new Date(p.deletedAt) <= prevEnd) return;

            const isDeactivatedByPrevEnd = (() => {
                if (isActiveNow) return false;
                const expObj = p.planExpiresAt ? new Date(p.planExpiresAt) : null;
                const validExp = expObj && !isNaN(expObj.getTime()) && expObj.getFullYear() >= 2000 && expObj <= now ? expObj : null;
                const deactDate = p.canceledAt ? new Date(p.canceledAt) : (validExp || (p.updatedAt ? new Date(p.updatedAt) : null));
                if (!deactDate || deactDate > prevEnd) return false;
                if (p.reactivatedAt && new Date(p.reactivatedAt) <= prevEnd && new Date(p.reactivatedAt) > deactDate) {
                    return false;
                }
                return true;
            })();

            if (!isDeactivatedByPrevEnd) {
                prevMrr += planPrices[planKey];
                prevTotalActive++;
            }
        });
        const activePsychologists = allPaidCandidates.filter(p => p.status === 'active' && !p.deletedAt);
        const dateStart = start.toISOString();
        const nextDayStr = end.toISOString();
        const prevDateStart = prevStart.toISOString();
        const prevNextDayStr = prevEnd.toISOString();

        const cmoActiveQuery = `
            SELECT COUNT(*) as active
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND "planExpiresAt" > NOW()
            AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
        `;
        const [cmoActiveRes] = await db.sequelize.query(cmoActiveQuery, { type: db.sequelize.QueryTypes.SELECT });
        const cmoTotalActive = parseInt(cmoActiveRes.active || 0);

        const cmoPaidChurnQuery = `
            SELECT COUNT(*) as churned
            FROM "Psychologists" p
            WHERE p."deletedAt" IS NULL
            AND (p."is_exempt" IS NULL OR p."is_exempt" = false)
            AND NOT (p.status = 'active' AND (p."planExpiresAt" IS NULL OR p."planExpiresAt" > NOW()))
            AND (p.status = 'inactive' OR (p."planExpiresAt" IS NOT NULL AND p."planExpiresAt" <= NOW()))
            AND p."plano" IS NOT NULL
            AND (
                p."subscription_payments_count" > 0
                OR p."firstPaidAt" IS NOT NULL
                OR EXISTS (SELECT 1 FROM "Payments" pay WHERE pay."psychologistId" = p.id AND pay.status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'))
            )
            AND COALESCE(
                p."canceledAt",
                CASE WHEN p."planExpiresAt" >= '2000-01-01' AND p."planExpiresAt" <= NOW() THEN p."planExpiresAt" ELSE NULL END,
                (SELECT MAX(COALESCE(pay."paymentDate", pay."createdAt")) + INTERVAL '30 days' FROM "Payments" pay WHERE pay."psychologistId" = p.id AND pay.status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'))
            ) >= :dateStart
            AND COALESCE(
                p."canceledAt",
                CASE WHEN p."planExpiresAt" >= '2000-01-01' AND p."planExpiresAt" <= NOW() THEN p."planExpiresAt" ELSE NULL END,
                (SELECT MAX(COALESCE(pay."paymentDate", pay."createdAt")) + INTERVAL '30 days' FROM "Payments" pay WHERE pay."psychologistId" = p.id AND pay.status IN ('RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'))
            ) < :nextDayStr
        `;
        const [cmoChurnRes] = await db.sequelize.query(cmoPaidChurnQuery, { replacements: { dateStart, nextDayStr }, type: db.sequelize.QueryTypes.SELECT });
        const cmoPaidChurnCount = parseInt(cmoChurnRes.churned || 0);

        const [cmoPrevChurnRes] = await db.sequelize.query(cmoPaidChurnQuery, { replacements: { dateStart: prevDateStart, nextDayStr: prevNextDayStr }, type: db.sequelize.QueryTypes.SELECT });
        const cmoPrevPaidChurnCount = parseInt(cmoPrevChurnRes.churned || 0);

        const paidChurnRate = (cmoTotalActive + cmoPaidChurnCount) > 0 ? (cmoPaidChurnCount / (cmoTotalActive + cmoPaidChurnCount)) * 100 : 0;
        const prevChurnBase = prevTotalActive > 0 ? prevTotalActive : cmoTotalActive;
        const prevPaidChurnRate = (prevChurnBase + cmoPrevPaidChurnCount) > 0 ? (cmoPrevPaidChurnCount / (prevChurnBase + cmoPrevPaidChurnCount)) * 100 : 0;
        
        const cmoTrialChurnQuery = `
            SELECT COUNT(*) as churned
            FROM "Psychologists"
            WHERE ("subscriptionId" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0) AND "firstPaidAt" IS NULL)
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND "planExpiresAt" >= '2000-01-01'
            AND "planExpiresAt" <= NOW()
            AND "planExpiresAt" >= :dateStart AND "planExpiresAt" < :nextDayStr
            AND "deletedAt" IS NULL
        `;
        const [cmoTrialChurnRes] = await db.sequelize.query(cmoTrialChurnQuery, { replacements: { dateStart, nextDayStr }, type: db.sequelize.QueryTypes.SELECT });
        const trialChurnCount = parseInt(cmoTrialChurnRes.churned || 0);
        
        const [cmoPrevTrialChurnRes] = await db.sequelize.query(cmoTrialChurnQuery, { replacements: { dateStart: prevDateStart, nextDayStr: prevNextDayStr }, type: db.sequelize.QueryTypes.SELECT });
        const prevTrialChurnCount = parseInt(cmoPrevTrialChurnRes.churned || 0);

        const paidChurnCount = cmoPaidChurnCount;
        const inadimplentesCount = metrics.inadimplentesCount;
        const ltv = metrics.ltvObservado;
        const ltvNet = metrics.ltvObservadoLiquido;
        const prevLtv = prevMetrics.ltvObservado;
        const arpu = metrics.arpu;

        const cmoNovosQuery = `
            SELECT COUNT(*) as novos
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND ("firstPaidAt" >= :dateStart AND "firstPaidAt" < :nextDayStr)
        `;
        const [cmoNovosRes] = await db.sequelize.query(cmoNovosQuery, { replacements: { dateStart, nextDayStr }, type: db.sequelize.QueryTypes.SELECT });
        const cmoNovosCount = parseInt(cmoNovosRes.novos || 0);
        metrics.novosCount = cmoNovosCount; // Override for insights and sparklines below

        // MRR Projections Linear Math
        const periodDays = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const netMrrGrowth = (cmoNovosCount * arpu) - (paidChurnCount * arpu);
        const dailyMrrGrowth = netMrrGrowth / periodDays;
        
        const proj30 = Math.max(0, mrr + (dailyMrrGrowth * 30));
        const proj60 = Math.max(0, mrr + (dailyMrrGrowth * 60));
        const proj90 = Math.max(0, mrr + (dailyMrrGrowth * 90));

        // For backwards compatibility with sparklines
        const sparkPaidNewUsers = Array(10).fill(metrics.novosCount / 10);
        const sparkPaidChurns = Array(10).fill(paidChurnCount / 10);
        const sparkTrialChurns = Array(10).fill(trialChurnCount / 10);
        const sparkMrr = Array(10).fill(mrr);

        const currentPaidChurnDecimal = paidChurnRate / 100;
        const currentProjectedLifetime = currentPaidChurnDecimal > 0 ? Math.min(1 / currentPaidChurnDecimal, 24) : 24;
        const currentLtvProjetado = arpu * currentProjectedLifetime;

        const prevArpu = prevTotalActive > 0 ? (prevMrr / prevTotalActive) : prevMetrics.arpu;
        const prevPaidChurnDecimal = prevPaidChurnRate / 100;
        const prevProjectedLifetime = prevPaidChurnDecimal > 0 ? Math.min(1 / prevPaidChurnDecimal, 24) : 24;
        const prevLtvProjetado = prevArpu * prevProjectedLifetime;

        const kpis = {
            mrr: { current: mrr, previous: prevMrr },
            paidChurnRate: { current: paidChurnRate, previous: prevPaidChurnRate },
            trialChurnCount: { current: trialChurnCount, previous: prevTrialChurnCount },
            paidChurnCount: { current: paidChurnCount, previous: cmoPrevPaidChurnCount },
            inadimplentesCount: { current: inadimplentesCount, previous: prevMetrics.inadimplentesCount },
            ltv: { current: ltv, net: ltvNet, previous: prevLtv, projected: currentLtvProjetado, projectedPrevious: prevLtvProjetado },
            arpu: { current: arpu, previous: prevArpu },
            proj30, proj60, proj90,
            cacPayback: { current: metrics.cacPaybackMonths },
            periodDays: Math.max(1, Math.round(periodDays))
        };

        // Insights Generator
        const insights = [];
        const mrrGrowth = mrr > prevMrr ? ((mrr - prevMrr)/prevMrr*100) : (prevMrr > 0 ? ((mrr - prevMrr)/prevMrr*100) : 0);
        if (mrrGrowth > 0) insights.push({ type: 'positive', text: `Receita MRR cresceu ${mrrGrowth.toFixed(1)}% no período.` });
        else if (mrrGrowth < 0) insights.push({ type: 'negative', text: `Receita MRR retraiu ${Math.abs(mrrGrowth).toFixed(1)}% no período.` });
        
        if (paidChurnRate > 15) insights.push({ type: 'negative', text: `Churn de pagantes (${paidChurnRate.toFixed(1)}%) está acima da zona aceitável para empresas nascentes (< 15%).` });
        else insights.push({ type: 'positive', text: `Churn de pagantes está controlado e dentro da média inicial.` });

        if (metrics.novosCount > paidChurnCount) insights.push({ type: 'positive', text: `Mais assinantes pagantes entraram (${metrics.novosCount}) do que saíram (${paidChurnCount}).` });
        else if (paidChurnCount > metrics.novosCount) insights.push({ type: 'warning', text: `Alerta: Base de assinantes está encolhendo devido ao churn.` });


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
            const hasSub = !!psy.subscriptionId || (psy.subscription_payments_count && psy.subscription_payments_count > 0);
            const planKey = (psy.plano || '').toLowerCase();
            return {
                psychologistId: psy.id,
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
            planDistribution: activePsychologists.filter(p => {
                const isExempt = p.is_exempt;
                const hasSubscription = !!p.subscriptionId || (p.subscription_payments_count && p.subscription_payments_count > 0);
                return !isExempt && hasSubscription && (!p.planExpiresAt || p.planExpiresAt > new Date());
            }).reduce((acc, p) => {
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
const toSqlInList = (set) => Array.from(set).map((v) => `'${v}'`).join(', ');
const LOGGED_ACTOR_LIST_SQL = toSqlInList(LOGGED_NON_PATIENT_TYPES);
const UNLOGGED_ACTOR_LIST_SQL = toSqlInList(UNLOGGED_NON_PATIENT_TYPES);
const ALL_NON_PATIENT_LIST_SQL = `${LOGGED_ACTOR_LIST_SQL}, ${UNLOGGED_ACTOR_LIST_SQL}`;

const SEARCH_RESPONDENT_EXPR = `COALESCE("searchParams"->>'respondent_type', 'patient')`;
const PATIENT_SEARCH_SQL = `${SEARCH_RESPONDENT_EXPR} NOT IN (${ALL_NON_PATIENT_LIST_SQL})`;

const fetchFunnelPeriodMetrics = async (rangeStart, rangeEnd) => {
    const queryOne = (sql) => db.sequelize.query(sql, {
        replacements: { start: rangeStart, end: rangeEnd },
        type: db.sequelize.QueryTypes.SELECT
    }).then((rows) => rows[0] || {});

    const [visitsRow, searchesRow, disqualifiedRow, viewsRow, waRow, waDiscardedRow] = await Promise.all([
        queryOne(`
            SELECT
                COUNT(*) FILTER (
                    WHERE COALESCE("actor_type", 'patient') NOT IN (${ALL_NON_PATIENT_LIST_SQL})
                      AND NOT ${B2B_OR_PRO_PAGE_SQL}
                ) AS patient_count,
                COUNT(*) FILTER (
                    WHERE COALESCE("actor_type", 'patient') IN (${LOGGED_ACTOR_LIST_SQL})
                ) AS logged_count,
                COUNT(*) FILTER (
                    WHERE COALESCE("actor_type", 'patient') IN (${UNLOGGED_ACTOR_LIST_SQL})
                       OR (COALESCE("actor_type", 'patient') NOT IN (${LOGGED_ACTOR_LIST_SQL}) AND ${B2B_OR_PRO_PAGE_SQL})
                ) AS unlogged_count
            FROM "SiteVisits"
            WHERE "createdAt" BETWEEN :start AND :end
        `).catch(() => ({ patient_count: 0, logged_count: 0, unlogged_count: 0 })),

        queryOne(`
            SELECT
                COUNT(*) FILTER (WHERE ${PATIENT_SEARCH_SQL}) AS iniciaram,
                COUNT(*) FILTER (WHERE ${PATIENT_SEARCH_SQL} AND status IN ('completed', 'matched')) AS completaram,
                COUNT(*) FILTER (WHERE ${SEARCH_RESPONDENT_EXPR} IN (${LOGGED_ACTOR_LIST_SQL})) AS init_logged,
                COUNT(*) FILTER (WHERE ${SEARCH_RESPONDENT_EXPR} IN (${UNLOGGED_ACTOR_LIST_SQL})) AS init_unlogged,
                COUNT(*) FILTER (WHERE ${SEARCH_RESPONDENT_EXPR} IN (${LOGGED_ACTOR_LIST_SQL}) AND status IN ('completed', 'matched')) AS comp_logged,
                COUNT(*) FILTER (WHERE ${SEARCH_RESPONDENT_EXPR} IN (${UNLOGGED_ACTOR_LIST_SQL}) AND status IN ('completed', 'matched')) AS comp_unlogged
            FROM "DemandSearches"
            WHERE "deletedAt" IS NULL AND "createdAt" BETWEEN :start AND :end
        `).catch(() => ({})),

        queryOne(`
            SELECT COUNT(*) AS count
            FROM "DemandSearches"
            WHERE "deletedAt" IS NULL AND "createdAt" BETWEEN :start AND :end
              AND ${PATIENT_SEARCH_SQL}
              AND "is_disqualified" = true
        `).catch(() => ({ count: 0 })),

        queryOne(`
            SELECT
                COUNT(*) FILTER (WHERE COALESCE("actor_type", 'patient') NOT IN (${ALL_NON_PATIENT_LIST_SQL})) AS patient_count,
                COUNT(*) FILTER (WHERE COALESCE("actor_type", 'patient') IN (${LOGGED_ACTOR_LIST_SQL})) AS logged_count,
                COUNT(*) FILTER (WHERE COALESCE("actor_type", 'patient') IN (${UNLOGGED_ACTOR_LIST_SQL})) AS unlogged_count
            FROM "ProfileAppearanceLogs"
            WHERE "createdAt" BETWEEN :start AND :end
              AND "source" = 'profile_click_funnel'
        `).catch(() => ({ patient_count: 0, logged_count: 0, unlogged_count: 0 })),

        queryOne(`
            SELECT
                COUNT(*) AS clicks,
                COUNT(DISTINCT COALESCE(CAST("searchId" AS VARCHAR), CAST("id" AS VARCHAR))) AS unique_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" BETWEEN :start AND :end
        `).catch(() => ({ clicks: 0, unique_clicks: 0 })),

        queryOne(`
            SELECT
                COUNT(*) FILTER (WHERE COALESCE("actor_type", 'patient') IN (${LOGGED_ACTOR_LIST_SQL})) AS logged_count,
                COUNT(*) FILTER (WHERE COALESCE("actor_type", 'patient') IN (${UNLOGGED_ACTOR_LIST_SQL})) AS unlogged_count
            FROM "FunnelDiscardedEvents"
            WHERE "createdAt" BETWEEN :start AND :end
              AND "stage" = 'whatsapp'
        `).catch(() => ({ logged_count: 0, unlogged_count: 0 }))
    ]);

    const toInt = (val) => parseInt(val || 0, 10);
    return {
        visitas: toInt(visitsRow.patient_count),
        iniciaram: toInt(searchesRow.iniciaram),
        completaram: toInt(searchesRow.completaram),
        desqualificados: toInt(disqualifiedRow.count),
        profileViews: toInt(viewsRow.patient_count),
        whatsappClicks: toInt(waRow.clicks),
        whatsappUnique: toInt(waRow.unique_clicks),
        discarded: {
            visitas: { logados: toInt(visitsRow.logged_count), naoLogados: toInt(visitsRow.unlogged_count) },
            iniciaram: { logados: toInt(searchesRow.init_logged), naoLogados: toInt(searchesRow.init_unlogged) },
            completaram: { logados: toInt(searchesRow.comp_logged), naoLogados: toInt(searchesRow.comp_unlogged) },
            profileViews: { logados: toInt(viewsRow.logged_count), naoLogados: toInt(viewsRow.unlogged_count) },
            whatsapp: { logados: toInt(waDiscardedRow.logged_count), naoLogados: toInt(waDiscardedRow.unlogged_count) }
        }
    };
};

exports.getFunnelAnalytics = async (req, res) => {
    try {
        const parseDateBRT = (dateString, isEnd = false) => {
            if (!dateString) return null;
            const time = isEnd ? '23:59:59.999' : '00:00:00.000';
            return new Date(`${dateString}T${time}-03:00`);
        };

        const nowFunnel = new Date();
        let start = parseDateBRT(req.query.startDate, false);
        if (start && start < new Date(2026, 4, 1)) start.setTime(new Date(2026, 4, 1).getTime());
        let end = parseDateBRT(req.query.endDate, true);

        if (!start) {
            start = new Date(); start.setHours(start.getHours() - 3); start.setDate(start.getDate() - 30); start.setUTCHours(3, 0, 0, 0);
        }
        if (!end) {
            end = nowFunnel;
        } else if (start <= nowFunnel && end > nowFunnel) {
            // Evita comparar dias incompletos (ex: hoje até 23:59) contra janelas fechadas de 24h completas
            end = nowFunnel;
        }

        const msDiff = Math.max(3600000, end.getTime() - start.getTime());
        const prevStart = new Date(start.getTime() - msDiff);
        const prevEnd = new Date(start.getTime() - 1);

        const [current, prev] = await Promise.all([
            fetchFunnelPeriodMetrics(start, end),
            fetchFunnelPeriodMetrics(prevStart, prevEnd)
        ]);

        const buildStageBreakdown = (stageKey) => {
            const cur = current.discarded[stageKey];
            const prv = prev.discarded[stageKey];
            return {
                total: cur.logados + cur.naoLogados,
                logados: cur.logados,
                naoLogados: cur.naoLogados,
                prevTotal: prv.logados + prv.naoLogados
            };
        };

        const stages = ['visitas', 'iniciaram', 'completaram', 'profileViews', 'whatsapp'];
        const descartadosProfissionais = {};
        let sumTotal = 0;
        let sumLogados = 0;
        let sumNaoLogados = 0;
        let sumPrevTotal = 0;

        for (const stageKey of stages) {
            const item = buildStageBreakdown(stageKey);
            descartadosProfissionais[stageKey] = item;
            sumTotal += item.total;
            sumLogados += item.logados;
            sumNaoLogados += item.naoLogados;
            sumPrevTotal += item.prevTotal;
        }
        descartadosProfissionais.totalEventos = {
            total: sumTotal,
            logados: sumLogados,
            naoLogados: sumNaoLogados,
            prevTotal: sumPrevTotal
        };

        const dropoffQuery = `
            SELECT t.step, COUNT(*) as count
            FROM "TrackingLogs" t
            LEFT JOIN "DemandSearches" d ON t."searchId" = CAST(d.id AS VARCHAR)
            WHERE t."type" = 'questionario_dropoff'
              AND t."createdAt" BETWEEN :start AND :end
              AND (
                d.id IS NULL
                OR (
                  d."deletedAt" IS NULL
                  AND COALESCE(d.status, '') NOT IN ('completed', 'matched')
                  AND COALESCE(d."is_disqualified", false) = false
                  AND COALESCE(d."searchParams"->>'respondent_type', 'patient') NOT IN (${ALL_NON_PATIENT_LIST_SQL})
                )
              )
            GROUP BY t.step ORDER BY count DESC
        `;

        const abandonos = await db.sequelize.query(dropoffQuery, { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);
        const prevAbandonos = await db.sequelize.query(dropoffQuery, { replacements: { start: prevStart, end: prevEnd }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

        // Busca origens a partir dos questionários preenchidos por pacientes
        const jsonColUtm = 'CAST("searchParams" AS JSONB)';
        const origens = await db.sequelize.query(
            `SELECT ${jsonColUtm}->>'utm_source' as source, COUNT(*) as count FROM "DemandSearches" WHERE "deletedAt" IS NULL AND "createdAt" BETWEEN :start AND :end AND ${PATIENT_SEARCH_SQL} AND ${jsonColUtm}->>'utm_source' IS NOT NULL AND ${jsonColUtm}->>'utm_source' != '' GROUP BY source ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const prevOrigens = await db.sequelize.query(
            `SELECT ${jsonColUtm}->>'utm_source' as source, COUNT(*) as count FROM "DemandSearches" WHERE "deletedAt" IS NULL AND "createdAt" BETWEEN :start AND :end AND ${PATIENT_SEARCH_SQL} AND ${jsonColUtm}->>'utm_source' IS NOT NULL AND ${jsonColUtm}->>'utm_source' != '' GROUP BY source ORDER BY count DESC`,
            { replacements: { start: prevStart, end: prevEnd }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        // --- BLOCO DE INTELIGÊNCIA DE DEMANDA ---
        const jsonCol = 'CAST("searchParams" AS JSONB)';
        
        const topTemas = await db.sequelize.query(
            `SELECT value, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text(${jsonCol}->'temas') as value WHERE "deletedAt" IS NULL AND status IN ('completed', 'matched') AND "createdAt" BETWEEN :start AND :end AND ${PATIENT_SEARCH_SQL} AND ${jsonCol}->'temas' IS NOT NULL AND jsonb_typeof(${jsonCol}->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 10`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const faixaValor = await db.sequelize.query(
            `SELECT ${jsonCol}->>'faixa_valor' as value, COUNT(*) as count FROM "DemandSearches" WHERE "deletedAt" IS NULL AND status IN ('completed', 'matched') AND "createdAt" BETWEEN :start AND :end AND ${PATIENT_SEARCH_SQL} AND ${jsonCol}->>'faixa_valor' IS NOT NULL GROUP BY value ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const modalidades = await db.sequelize.query(
            `SELECT ${jsonCol}->>'modalidade_atendimento' as value, COUNT(*) as count FROM "DemandSearches" WHERE "deletedAt" IS NULL AND status IN ('completed', 'matched') AND "createdAt" BETWEEN :start AND :end AND ${PATIENT_SEARCH_SQL} AND ${jsonCol}->>'modalidade_atendimento' IS NOT NULL GROUP BY value ORDER BY count DESC`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        res.json({ 
            visitas: current.visitas, prevVisitas: prev.visitas, 
            iniciaram: current.iniciaram, prevIniciaram: prev.iniciaram, 
            completaram: current.completaram, prevCompletaram: prev.completaram, 
            profileViews: current.profileViews, prevProfileViews: prev.profileViews,
            whatsappClicks: current.whatsappClicks, prevWhatsappClicks: prev.whatsappClicks,
            whatsappUnique: current.whatsappUnique, prevWhatsappUnique: prev.whatsappUnique, 
            abandonos, prevAbandonos, 
            origens, prevOrigens, 
            desqualificados: current.desqualificados, prevDesqualificados: prev.desqualificados,
            psicologosIniciaram: descartadosProfissionais.iniciaram.total,
            prevPsicologosIniciaram: descartadosProfissionais.iniciaram.prevTotal,
            psicologosCompletaram: descartadosProfissionais.completaram.total,
            prevPsicologosCompletaram: descartadosProfissionais.completaram.prevTotal,
            descartadosProfissionais,
            comparisonPeriod: {
                start: start.toISOString(),
                end: end.toISOString(),
                prevStart: prevStart.toISOString(),
                prevEnd: prevEnd.toISOString(),
                days: Math.max(1, Math.round(msDiff / 86400000))
            },
            inteligencia: { topTemas, faixaValor, modalidades } 
        });
    } catch (error) {
        console.error('Erro em getFunnelAnalytics:', error);
        res.status(500).json({ error: 'Erro ao gerar dados do funil' });
    }
};

exports.getWhatsappFeedbacks = async (req, res) => {
    try {
        const db = require('../models');
        
        const { Op } = require('sequelize');
        const { startDate, endDate, includeComparison } = req.query;

        const nowWpp = new Date();
        let start, end;
        if (startDate && endDate) {
            // Aplica o fuso horário correto (Brasília)
            start = new Date(`${startDate}T00:00:00-03:00`);
            const requestedEnd = new Date(`${endDate}T23:59:59.999-03:00`);
            end = (start <= nowWpp && requestedEnd > nowWpp) ? nowWpp : requestedEnd;
        } else {
            // Otimização: Por padrão, carrega apenas os últimos 30 dias para poupar banda do servidor
            end = nowWpp;
            start = new Date();
            start.setDate(start.getDate() - 30);
            start.setHours(0, 0, 0, 0);
        }

        const whereClause = {
            createdAt: {
                [Op.gte]: start.toISOString(),
                [Op.lte]: end.toISOString()
            }
        };

        // Busca todos os logs de cliques, ordenando pelos mais recentes
        const feedbacks = await db.WhatsAppClickLog.findAll({
            where: whereClause,
            include: [{
                model: db.Psychologist,
                as: 'psychologist', // Precisa bater com o alias definido no WhatsAppClickLog.js
                attributes: ['id', 'nome', 'email', 'slug', 'telefone', 'fotoUrl'], // 'id' adicionado para permitir o clique no painel, 'fotoUrl' para avatar
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
        
        if (includeComparison === 'true') {
            const msDiff = end.getTime() - start.getTime();
            const prevStart = new Date(start.getTime() - msDiff);
            const prevEnd = new Date(start.getTime() - 1);
            const days = Math.max(1, Math.round(msDiff / (1000 * 60 * 60 * 24)));

            const prevFeedbacks = await db.WhatsAppClickLog.findAll({
                where: {
                    createdAt: {
                        [Op.gte]: prevStart.toISOString(),
                        [Op.lte]: prevEnd.toISOString()
                    }
                },
                attributes: ['id', 'feedbackGiven', 'contactReceived', 'dealClosed', 'createdAt']
            });

            return res.status(200).json({
                feedbacks,
                prevFeedbacks,
                days
            });
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
        if (dealClosed === 'started' && !log.therapyStartedReportedAt) {
            log.therapyStartedReportedAt = new Date();
        }
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
            attributes: ['id', 'nome', 'telefone', 'plano', 'status', 'subscriptionId', 'subscription_payments_count', 'planExpiresAt', 'cancelAtPeriodEnd', 'createdAt', 'fotoUrl', 'bio', 'whatsapp_clicks', 'profile_appearances', 'admin_billing_sent_at']
        });

        let currentMRR = 0;
        let payingUsers = 0;
        let activeTrialsCount = 0;
        const now = new Date();
        const trialPipeline = [];

        const activeTrialIds = [];

        activePsis.forEach(p => {
            const hasSub = !!(p.subscriptionId) || (p.subscription_payments_count > 0);
            
            let planEndsInFuture = false;
            let hasValidExpDate = false;
            let expiredSundayKeepMonday = false;

            if (p.planExpiresAt) {
                const expDate = new Date(p.planExpiresAt);
                hasValidExpDate = !isNaN(expDate.getTime()) && expDate.getFullYear() >= 2000;
                planEndsInFuture = hasValidExpDate && expDate > now;
                
                // Se expirou ontem e ontem era domingo, hoje é segunda, então mantemos no funil para cobrança no dia útil
                if (!planEndsInFuture && hasValidExpDate && expDate > yesterdayStart && expDate.getDay() === 0 && now.getDay() === 1) {
                    expiredSundayKeepMonday = true;
                }
            }

            const isPayingActiveNow = hasSub && p.status === 'active' && (!p.planExpiresAt || planEndsInFuture);

            if (isPayingActiveNow) {
                // Pagante ativo (alinhado com getDashboardStats)
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
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "PsychologistId" IN (:activeTrialIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);

            profileViewsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:activeTrialIds) 
                GROUP BY "psychologistId"
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "PsychologistId" IN (:activeTrialIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { activeTrialIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);
        }

        // Associa o status de fechamento ao pipeline e corrige a contagem de cliques
        trialPipeline.forEach(tp => {
            const logs = trialWppLogs.filter(l => l.psychologistId === tp.id);
            const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
            tp.dealClosed = closedDeals.length > 0;
            tp.closedDealsCount = closedDeals.length;
            
            tp.whatsapp_clicks = (tp.whatsapp_clicks || 0) + logs.length;
            
            const matchEv = matchEventsCount.find(m => m.psychologistId == tp.id);
            const profView = profileViewsCount.find(m => m.psychologistId == tp.id);
            
            const exactMatches = matchEv ? parseInt(matchEv.count) : 0;
            const exactViews = profView ? parseInt(profView.count) : 0;
            
            tp.profile_appearances = (tp.profile_appearances || 0) + exactMatches;
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
                    { [Op.or]: [{ subscriptionId: { [Op.ne]: null } }, { subscription_payments_count: { [Op.gt]: 0 } }] }
                ]
            }
        });

        const conversionRate = trialsCount > 0 ? (everPaidCount / trialsCount) : 0;

        const churnedUsers = await db.Psychologist.count({
            where: { 
                status: 'inactive',
                [Op.or]: [
                    { subscribedAt: { [Op.not]: null } },
                    { [Op.or]: [{ subscriptionId: { [Op.ne]: null } }, { subscription_payments_count: { [Op.gt]: 0 } }] }
                ]
            }
        });
        
        const totalStart = payingUsers + churnedUsers;
        const churnRate = totalStart > 0 ? (churnedUsers / totalStart) : 0;

        // 4. INDICADORES DE 30 DIAS E COMPARATIVO COM 30 DIAS ANTERIORES
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

        // --- 4.1 ATIVAÇÃO (Últimos 30 dias vs 30 dias anteriores) ---
        // Exclui do denominador atual apenas contas ainda 'pending' com menos de 24h de cadastro (viés de recém-chegados)
        const [actCurrRes] = await db.sequelize.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE
                    status != 'pending'
                    OR is_exempt = true
                    OR "subscriptionId" IS NOT NULL
                    OR "subscription_payments_count" > 0
                    OR "planExpiresAt" IS NOT NULL
                    OR (TRIM(COALESCE("fotoUrl", '')) <> '' AND LENGTH(TRIM(COALESCE(bio, ''))) >= 10)
                ) as activated
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
              AND ("isAdmin" IS NULL OR "isAdmin" = false)
              AND "createdAt" BETWEEN :thirtyDaysAgo AND :now
              AND NOT (status = 'pending' AND "createdAt" > :oneDayAgo)
        `, { replacements: { thirtyDaysAgo, now, oneDayAgo }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ total: 0, activated: 0 }]);

        const actTotal30d = parseInt(actCurrRes?.total || 0, 10);
        const actActive30d = parseInt(actCurrRes?.activated || 0, 10);
        const activationRate30d = actTotal30d > 0 ? (actActive30d / actTotal30d) : 0;

        const [actPrevRes] = await db.sequelize.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE
                    status != 'pending'
                    OR is_exempt = true
                    OR "subscriptionId" IS NOT NULL
                    OR "subscription_payments_count" > 0
                    OR "planExpiresAt" IS NOT NULL
                    OR (TRIM(COALESCE("fotoUrl", '')) <> '' AND LENGTH(TRIM(COALESCE(bio, ''))) >= 10)
                ) as activated
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
              AND ("isAdmin" IS NULL OR "isAdmin" = false)
              AND "createdAt" >= :sixtyDaysAgo AND "createdAt" < :thirtyDaysAgo
        `, { replacements: { sixtyDaysAgo, thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }).catch(() => [{ total: 0, activated: 0 }]);

        const actTotalPrev = parseInt(actPrevRes?.total || 0, 10);
        const actActivePrev = parseInt(actPrevRes?.activated || 0, 10);
        const activationRatePrev = actTotalPrev > 0 ? (actActivePrev / actTotalPrev) : 0;
        const activationDiff = activationRate30d - activationRatePrev;

        // --- DADOS UNIFICADOS DE ASSINANTES & PAGAMENTOS PARA MRR 30D, PÓS-TRIAL E RENOVAÇÃO ---
        const allCandidatePsis = await db.Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                isAdmin: { [Op.or]: [false, null] },
                [Op.or]: [
                    { subscriptionId: { [Op.ne]: null } },
                    { subscription_payments_count: { [Op.gt]: 0 } },
                    { firstPaidAt: { [Op.ne]: null } }
                ]
            },
            attributes: ['id', 'plano', 'status', 'planExpiresAt', 'canceledAt', 'reactivatedAt', 'firstPaidAt', 'subscribedAt', 'createdAt', 'updatedAt', 'deletedAt', 'subscriptionId', 'subscription_payments_count'],
            paranoid: false,
            raw: true
        });

        const validPaymentsRows = await db.Payment.findAll({
            where: { status: { [Op.in]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] } },
            attributes: ['psychologistId', 'paymentDate', 'createdAt'],
            raw: true
        }).catch(() => []);

        const paymentsByPsiMap = new Map();
        for (const pay of validPaymentsRows) {
            if (!pay.psychologistId) continue;
            const d = new Date(pay.paymentDate || pay.createdAt);
            if (isNaN(d.getTime())) continue;
            if (!paymentsByPsiMap.has(pay.psychologistId)) paymentsByPsiMap.set(pay.psychologistId, []);
            paymentsByPsiMap.get(pay.psychologistId).push(d);
        }
        for (const arr of paymentsByPsiMap.values()) {
            arr.sort((a, b) => a.getTime() - b.getTime());
        }

        const getRealDeactivatedDate = (p, payDates) => {
            if (p.canceledAt) {
                const c = new Date(p.canceledAt);
                if (!isNaN(c.getTime())) return c;
            }
            if (p.planExpiresAt) {
                const exp = new Date(p.planExpiresAt);
                if (!isNaN(exp.getTime()) && exp.getFullYear() >= 2000 && exp <= now) {
                    return exp;
                }
            }
            if (payDates && payDates.length > 0) {
                const lastPay = payDates[payDates.length - 1];
                return new Date(lastPay.getTime() + 30 * 24 * 60 * 60 * 1000);
            }
            return p.status === 'inactive' && p.updatedAt ? new Date(p.updatedAt) : null;
        };

        const isPaidAccount = (p, payDates) => {
            return (p.subscription_payments_count && Number(p.subscription_payments_count) > 0) ||
                !!p.firstPaidAt ||
                (payDates && payDates.length > 0);
        };

        const isCurrentlyActivePayingRow = (p) => {
            const hasSub = !!p.subscriptionId || (p.subscription_payments_count && Number(p.subscription_payments_count) > 0);
            const exp = p.planExpiresAt ? new Date(p.planExpiresAt) : null;
            const validFutureExp = !exp || (!isNaN(exp.getTime()) && exp.getFullYear() >= 2000 && exp > now);
            return p.deletedAt === null && p.status === 'active' && hasSub && validFutureExp;
        };

        // --- MRR há 30 dias & Base Pagante há 30 dias ---
        let prevMRR = 0;
        let payingPrev = 0;
        let realChurn30d = 0;
        let realChurnPrev = 0;

        for (const p of allCandidatePsis) {
            const payDates = paymentsByPsiMap.get(p.id) || [];
            const realPaid = isPaidAccount(p, payDates);
            const activeNow = isCurrentlyActivePayingRow(p);
            const deactDate = activeNow ? null : getRealDeactivatedDate(p, payDates);

            // Data real de início da assinatura paga
            const earliestPay = payDates.length > 0 ? payDates[0] : null;
            const candidatesStart = [earliestPay, p.firstPaidAt ? new Date(p.firstPaidAt) : null, p.subscribedAt ? new Date(p.subscribedAt) : null]
                .filter(d => d && !isNaN(d.getTime()));
            const startedAt = candidatesStart.length > 0
                ? new Date(Math.min(...candidatesStart.map(d => d.getTime())))
                : new Date(p.createdAt);

            // Estava ativo e pagante em thirtyDaysAgo?
            const wasDeletedBefore30d = p.deletedAt && new Date(p.deletedAt) <= thirtyDaysAgo;
            if (!wasDeletedBefore30d && startedAt <= thirtyDaysAgo) {
                let wasActive30dAgo = false;
                if (activeNow) {
                    const reactivatedAfter = p.reactivatedAt && new Date(p.reactivatedAt) > thirtyDaysAgo;
                    wasActive30dAgo = !reactivatedAfter;
                } else {
                    const deactivatedBeforeOrAt30d = deactDate && deactDate <= thirtyDaysAgo;
                    const reactivatedBefore30d = p.reactivatedAt && new Date(p.reactivatedAt) <= thirtyDaysAgo && (!deactDate || new Date(p.reactivatedAt) > deactDate);
                    wasActive30dAgo = !deactivatedBeforeOrAt30d || !!reactivatedBefore30d;
                }

                if (wasActive30dAgo && (!!p.subscriptionId || realPaid)) {
                    payingPrev++;
                    const pk = (p.plano || '').toLowerCase();
                    prevMRR += (planPrices[pk] || 0);
                }
            }

            // Churn real de pagantes (sem updatedAt fantasma!)
            if (p.deletedAt === null && realPaid && !activeNow && deactDate) {
                if (deactDate >= thirtyDaysAgo && deactDate <= now) {
                    realChurn30d++;
                } else if (deactDate >= sixtyDaysAgo && deactDate < thirtyDaysAgo) {
                    realChurnPrev++;
                }
            }
        }

        const mrrDiff = currentMRR - prevMRR;
        const mrrDiffRate = prevMRR > 0 ? (mrrDiff / prevMRR) : (currentMRR > 0 ? 1 : 0);

        // --- 4.2 RETENÇÃO PÓS-TRIAL (Últimos 30 dias vs 30 dias anteriores) ---
        const totalBase30d = payingUsers + realChurn30d;
        const postTrialRetentionRate30d = totalBase30d > 0 ? (payingUsers / totalBase30d) : 0;

        const totalBasePrev = payingPrev + realChurnPrev;
        const postTrialRetentionRatePrev = totalBasePrev > 0 ? (payingPrev / totalBasePrev) : 0;
        const postTrialDiff = postTrialRetentionRate30d - postTrialRetentionRatePrev;

        // --- 4.3 RENOVAÇÃO DE MENSALIDADE (Ciclos reais na tabela Payments) ---
        const calcRenewalWindow = (wStart, wEnd) => {
            let eligible = 0;
            let renewed = 0;

            for (const p of allCandidatePsis) {
                if (p.deletedAt && new Date(p.deletedAt) <= wStart) continue;
                const payDates = paymentsByPsiMap.get(p.id) || [];
                if (payDates.length === 0) continue;

                const paysBefore = payDates.filter(d => d < wStart);
                if (paysBefore.length === 0) continue;

                const lastPayBefore = paysBefore[paysBefore.length - 1];
                const paysInWindow = payDates.filter(d => d >= wStart && d <= wEnd);

                // Se houve pagamento confirmado dentro da janela, é elegível e renovado
                if (paysInWindow.length > 0) {
                    eligible++;
                    renewed++;
                    continue;
                }

                // Se já tinha saído antes do início da janela, não é elegível neste ciclo
                const canceledAt = p.canceledAt ? new Date(p.canceledAt) : null;
                if (canceledAt && canceledAt < wStart && (!p.reactivatedAt || new Date(p.reactivatedAt) < canceledAt)) {
                    continue;
                }
                const expDate = p.planExpiresAt ? new Date(p.planExpiresAt) : null;
                const hasValidExp = !!(expDate && !isNaN(expDate.getTime()) && expDate.getFullYear() >= 2000);
                if (hasValidExp && expDate < wStart) {
                    continue;
                }
                // Se já possui cobertura válida após o fim da janela (ex: plano anual/trimestral ou pago adiantado), não falhou renovação
                if (hasValidExp && expDate > wEnd) {
                    continue;
                }

                // Só conta como ciclo vencido (não renovado) se o último pagamento foi recente o bastante para pertencer à base ativa entrando na janela
                // e o vencimento mensal (+32d com folga bancária) ou expiração/cancelamento caiu dentro da janela
                const daysSinceLastPay = (wStart.getTime() - lastPayBefore.getTime()) / (24 * 60 * 60 * 1000);
                if (daysSinceLastPay > 45) continue;

                const expectedDueWithGrace = new Date(lastPayBefore.getTime() + 32 * 24 * 60 * 60 * 1000);
                const canceledInWindow = !!(canceledAt && canceledAt >= wStart && canceledAt <= wEnd);
                const expiredInWindow = !!(hasValidExp && expDate >= wStart && expDate <= wEnd);
                const cycleDueInWindow = expectedDueWithGrace <= wEnd;

                if (canceledInWindow || expiredInWindow || cycleDueInWindow) {
                    eligible++;
                }
            }

            return {
                eligible,
                renewed,
                rate: eligible > 0 ? (renewed / eligible) : 0
            };
        };

        const currRenewal = calcRenewalWindow(thirtyDaysAgo, now);
        const prevRenewal = calcRenewalWindow(sixtyDaysAgo, thirtyDaysAgo);

        const eligibleRenewal30d = currRenewal.eligible;
        const renewed30d = currRenewal.renewed;
        const renewalRate30d = currRenewal.rate;

        const eligibleRenewalPrev = prevRenewal.eligible;
        const renewedPrev = prevRenewal.renewed;
        const renewalRatePrev = prevRenewal.rate;
        const renewalDiff = renewalRate30d - renewalRatePrev;

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
                    { [Op.or]: [{ subscriptionId: { [Op.ne]: null } }, { subscription_payments_count: { [Op.gt]: 0 } }] }
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
                prevMRR,
                mrrDiff,
                mrrDiffRate,
                payingUsers,
                churnedUsers,
                activeTrialsCount,
                conversionRate,
                churnRate,
                projectedMRR,

                // Ativação 30d
                activationRate: activationRate30d,
                activationTotal: actTotal30d,
                activationActive: actActive30d,
                prevActivationRate: activationRatePrev,
                activationDiff,

                // Pós-Trial 30d
                postTrialRetentionRate: postTrialRetentionRate30d,
                postTrialPaying: payingUsers,
                postTrialTotal: totalBase30d,
                postTrialChurn30d: realChurn30d,
                prevPostTrialRetentionRate: postTrialRetentionRatePrev,
                postTrialPrevPaying: payingPrev,
                postTrialPrevTotal: totalBasePrev,
                postTrialDiff,

                // Renovação 30d
                renewalRate: renewalRate30d,
                renewedUsers: renewed30d,
                eligibleForRenewal: eligibleRenewal30d,
                prevRenewalRate: renewalRatePrev,
                prevRenewedUsers: renewedPrev,
                prevEligibleForRenewal: eligibleRenewalPrev,
                renewalDiff,

                // Fallback histórico
                historicalPostTrialRetentionRate: totalStart > 0 ? (payingUsers / totalStart) : 0
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

/**
 * Rota: GET /api/admin/reports/clicks-growth
 * Descrição: Dados para o gráfico B2C (Cliques vs Projeção)
 */
exports.getClicksGrowthChart = async (req, res) => {
    try {
        const db = require('../../backend/models');
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        
        // Vamos pegar a partir de Maio de 2026
        const labels = [];
        const monthKeys = []; // Para buscar no expectedSessionsMap (ex: '2026-09')
        const organicClicksData = [];
        const paidClicksData = [];
        const organicSessionsData = [];
        const expectedClicksData = [];
        const expectedSessionsData = [];
        
        const today = new Date();
        const startMonthObj = new Date(2026, 4, 1); // Maio 2026 (mês 4)
        const totalMonths = (today.getFullYear() - startMonthObj.getFullYear()) * 12 + (today.getMonth() - startMonthObj.getMonth());
        const monthsToIterate = Math.max(0, totalMonths);
        
        for (let i = monthsToIterate; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            labels.push(monthNames[d.getMonth()]);
            
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            monthKeys.push(`${yyyy}-${mm}`);
        }

        const startDate = new Date(2026, 4, 1); // 1 de Maio de 2026


        const endDate = new Date(); // Hoje

        // Projeção Fixa Mensal de SEO
        const expectedSessionsMap = {
            '2026-09': 400, '2026-10': 650, '2026-11': 1100, '2026-12': 1800,
            '2027-01': 2650, '2027-02': 3500, '2027-03': 4500, '2027-04': 5500,
            '2027-05': 6500, '2027-06': 7600, '2027-07': 8800, '2027-08': 10000
        };

        const clicksQuery = `
            SELECT 
                TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') as month,
                "utmSource",
                COUNT(*) as total
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= :start AND "createdAt" <= :end
            GROUP BY month, "utmSource"
            ORDER BY month ASC;
        `;

        const [realClicks] = await db.sequelize.query(clicksQuery, {
            replacements: { start: startDate, end: endDate }
        });

        const visitsQuery = `
            SELECT 
                TO_CHAR("createdAt" AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') as month,
                COUNT(*) as total
            FROM "SiteVisits"
            WHERE "createdAt" >= :start AND "createdAt" <= :end
            GROUP BY month
            ORDER BY month ASC;
        `;

        const [realVisits] = await db.sequelize.query(visitsQuery, {
            replacements: { start: startDate, end: endDate }
        });

        monthKeys.forEach((monthKey) => {
            // Filtra os reais deste mês
            const monthLogs = realClicks.filter(r => r.month === monthKey);
            
            let organic = 0;
            let paid = 0;

            monthLogs.forEach(log => {
                const source = (log.utmSource || '').toLowerCase();
                if (source.includes('google') || source.includes('fb') || source.includes('meta') || source.includes('ads') || source.includes('ig')) {
                    paid += parseInt(log.total, 10);
                } else {
                    organic += parseInt(log.total, 10);
                }
            });

            organicClicksData.push(organic);
            paidClicksData.push(paid);

            const monthVisits = realVisits.find(v => v.month === monthKey);
            organicSessionsData.push(monthVisits ? parseInt(monthVisits.total, 10) : 0);

            const monthlySessions = expectedSessionsMap[monthKey] || 0;
            const monthlyExpectedClicks = Math.round(monthlySessions * 0.04); // 4% de conversão

            expectedSessionsData.push(monthlySessions);
            expectedClicksData.push(monthlyExpectedClicks);
        });

        res.json({
            labels,
            realData: {
                organicClicks: organicClicksData,
                paidClicks: paidClicksData,
                organicSessions: organicSessionsData
            },
            expectedData: {
                sessions: expectedSessionsData,
                clicks: expectedClicksData
            }
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar gráfico de crescimento B2C.' });
    }
};
