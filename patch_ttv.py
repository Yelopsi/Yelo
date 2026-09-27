import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

# Replace variables
code = code.replace(
    "let globalEffort = 'N/A', adsEffort = 'N/A', orgEffort = 'N/A', topTicket = 'N/A', ttvAvg = 'N/A';",
    "let globalEffort = 'N/A', adsEffort = 'N/A', orgEffort = 'N/A', topTicket = 'N/A';\n        let ttfcData = { median: 'N/A', mean: 'N/A', sample: 0 };\n        let ttvData = { median: 'N/A', mean: 'N/A', sample: 0 };"
)

# Replace the TTV query block
old_ttv = """            const ttvQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_value
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."dealClosed" IN ('yes', 'started')
                AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });

            if (ttvQuery.length > 0) {
                const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => parseFloat(q.days_to_value));
                if (validTtvs.length > 0) {
                    ttvAvg = (validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length).toFixed(1);
                }
            }"""

new_ttv = """            const ttfcQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_first_contact
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });

            if (ttfcQuery.length > 0) {
                const validTtfcs = ttfcQuery.filter(q => q.days_to_first_contact >= 0).map(q => parseFloat(q.days_to_first_contact)).sort((a,b) => a-b);
                if (validTtfcs.length > 0) {
                    const mean = (validTtfcs.reduce((sum, val) => sum + val, 0) / validTtfcs.length).toFixed(1);
                    const mid = Math.floor(validTtfcs.length / 2);
                    const median = validTtfcs.length % 2 !== 0 ? validTtfcs[mid].toFixed(1) : ((validTtfcs[mid - 1] + validTtfcs[mid]) / 2).toFixed(1);
                    ttfcData = { median, mean, sample: validTtfcs.length };
                }
            }
            
            const ttvQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_value
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."dealClosed" = 'started'
                AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });

            if (ttvQuery.length > 0) {
                const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => parseFloat(q.days_to_value)).sort((a,b) => a-b);
                if (validTtvs.length > 0) {
                    const mean = (validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length).toFixed(1);
                    const mid = Math.floor(validTtvs.length / 2);
                    const median = validTtvs.length % 2 !== 0 ? validTtvs[mid].toFixed(1) : ((validTtvs[mid - 1] + validTtvs[mid]) / 2).toFixed(1);
                    ttvData = { median, mean, sample: validTtvs.length };
                }
            }"""

code = code.replace(old_ttv, new_ttv)

# Replace exports
code = code.replace(
    'ttvAvg',
    'ttfcData,\n                ttvData'
)

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

