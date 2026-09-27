const fs = require('fs');
let code = fs.readFileSync('backend/routes/cmoRoutes.js', 'utf8');

const targetStr = `        try {
            const dateEnd90 = new Date();
            const dateStart90 = new Date();
            dateStart90.setDate(dateStart90.getDate() - 90);`;

const endStr = `        } catch (effError) {
            console.error('[CMO Metrics] Erro calculando Eficiência Comercial:', effError);
        }`;

const startIdx = code.indexOf(targetStr);
const endIdx = code.indexOf(endStr, startIdx) + endStr.length;

if (startIdx === -1 || endIdx === -1) {
    console.error("Could not find the target block.");
    process.exit(1);
}

const replacement = `        let prevEfficiency = null;

        try {
            const dateEnd90 = new Date();
            const dateStart90 = new Date();
            dateStart90.setDate(dateStart90.getDate() - 90);
            
            const dateStart180 = new Date(dateStart90);
            dateStart180.setDate(dateStart180.getDate() - 90);

            const getEfficiencyMetrics = async (startDate, endDate) => {
                const dateCondition = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };
                const closedCondition = { dealClosed: { [Op.in]: ['yes', 'started'] } };

                const totalClicks = await WhatsAppClickLog.count({ where: dateCondition });
                const totalClosed = await WhatsAppClickLog.count({ where: { ...closedCondition, ...dateCondition } });
                const gEffort = totalClosed > 0 ? (totalClicks / totalClosed).toFixed(1) : 'N/A';

                const adsSources = ['google', 'meta', 'facebook', 'instagram', 'ig', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc'];
                const isAdsCondition = {
                    [Op.or]: [
                        { utmSource: { [Op.iLike]: { [Op.any]: adsSources.map(s => \`%\${s}%\`) } } },
                        { source: { [Op.iLike]: { [Op.any]: adsSources.map(s => \`%\${s}%\`) } } }
                    ]
                };
                const adsClicks = await WhatsAppClickLog.count({ where: { ...isAdsCondition, ...dateCondition } });
                const adsClosed = await WhatsAppClickLog.count({ where: { ...isAdsCondition, ...closedCondition, ...dateCondition } });
                const aEffort = adsClosed > 0 ? (adsClicks / adsClosed).toFixed(1) : 'N/A';
                
                const orgClicks = totalClicks - adsClicks;
                const orgClosed = totalClosed - adsClosed;
                const oEffort = orgClosed > 0 ? (orgClicks / orgClosed).toFixed(1) : 'N/A';

                let tTicket = 'N/A';
                const topPerformersQuery = await sequelize.query(\`
                    SELECT "psychologistId", COUNT(id) as "closedCount"
                    FROM "WhatsAppClickLogs"
                    WHERE "dealClosed" IN ('yes', 'started') AND "psychologistId" IS NOT NULL
                    AND "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
                    GROUP BY "psychologistId"
                    ORDER BY "closedCount" DESC
                \`, { replacements: { dateStart: startDate, dateEnd: endDate }, type: sequelize.QueryTypes.SELECT });

                if (topPerformersQuery.length > 0) {
                    const top20PercentCount = Math.max(1, Math.ceil(topPerformersQuery.length * 0.20));
                    const topPerformersIds = topPerformersQuery.slice(0, top20PercentCount).map(p => p.psychologistId);
                    const topPsychologists = await sequelize.query(\`
                        SELECT AVG(valor_sessao_numero) as "avgTicket"
                        FROM "Psychologists"
                        WHERE id IN (:ids) AND valor_sessao_numero > 0 AND valor_sessao_numero IS NOT NULL
                    \`, { replacements: { ids: topPerformersIds }, type: sequelize.QueryTypes.SELECT });
                    tTicket = topPsychologists[0]?.avgTicket ? parseFloat(topPsychologists[0].avgTicket).toFixed(2) : 'N/A';
                }

                let ttfc = { median: 'N/A', mean: 'N/A', sample: 0 };
                const ttfcQuery = await sequelize.query(\`
                    SELECT 
                        EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_first_contact
                    FROM "Psychologists" p
                    JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                    WHERE w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                    GROUP BY p.id, p."createdAt"
                \`, { replacements: { dateStart: startDate, dateEnd: endDate }, type: sequelize.QueryTypes.SELECT });
                if (ttfcQuery.length > 0) {
                    const validTtfcs = ttfcQuery.filter(q => q.days_to_first_contact >= 0).map(q => parseFloat(q.days_to_first_contact)).sort((a,b) => a-b);
                    if (validTtfcs.length > 0) {
                        const mean = (validTtfcs.reduce((sum, val) => sum + val, 0) / validTtfcs.length).toFixed(1);
                        const mid = Math.floor(validTtfcs.length / 2);
                        const median = validTtfcs.length % 2 !== 0 ? validTtfcs[mid].toFixed(1) : ((validTtfcs[mid - 1] + validTtfcs[mid]) / 2).toFixed(1);
                        ttfc = { median, mean, sample: validTtfcs.length };
                    }
                }
                
                let ttv = { median: 'N/A', mean: 'N/A', sample: 0 };
                const ttvQuery = await sequelize.query(\`
                    SELECT 
                        EXTRACT(EPOCH FROM (MIN(COALESCE(w."therapyStartedReportedAt", w."createdAt")) - p."createdAt")) / 86400 as days_to_value
                    FROM "Psychologists" p
                    JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                    WHERE w."dealClosed" IN ('yes', 'started')
                    AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                    GROUP BY p.id, p."createdAt"
                \`, { replacements: { dateStart: startDate, dateEnd: endDate }, type: sequelize.QueryTypes.SELECT });
                if (ttvQuery.length > 0) {
                    const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => parseFloat(q.days_to_value)).sort((a,b) => a-b);
                    if (validTtvs.length > 0) {
                        const mean = (validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length).toFixed(1);
                        const mid = Math.floor(validTtvs.length / 2);
                        const median = validTtvs.length % 2 !== 0 ? validTtvs[mid].toFixed(1) : ((validTtvs[mid - 1] + validTtvs[mid]) / 2).toFixed(1);
                        ttv = { median, mean, sample: validTtvs.length };
                    }
                }

                return { globalEffort: gEffort, adsEffort: aEffort, orgEffort: oEffort, topTicket: tTicket, ttfcData: ttfc, ttvData: ttv };
            };

            const currEff = await getEfficiencyMetrics(dateStart90, dateEnd90);
            globalEffort = currEff.globalEffort;
            adsEffort = currEff.adsEffort;
            orgEffort = currEff.orgEffort;
            topTicket = currEff.topTicket;
            ttfcData = currEff.ttfcData;
            ttvData = currEff.ttvData;

            prevEfficiency = await getEfficiencyMetrics(dateStart180, dateStart90);
        } catch (effError) {
            console.error('[CMO Metrics] Erro calculando Eficiência Comercial:', effError);
        }`;

code = code.substring(0, startIdx) + replacement + code.substring(endIdx);
fs.writeFileSync('backend/routes/cmoRoutes.js', code);
console.log("Patched successfully!");
