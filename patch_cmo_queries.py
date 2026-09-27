import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

old_ttfc = """            const ttfcQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_first_contact
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });"""

new_ttfc = """            const ttfcQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - COALESCE(p."profileActivatedAt", p."createdAt"))) / 86400 as days_to_first_contact
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."profileActivatedAt", p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });"""

code = code.replace(old_ttfc, new_ttfc)

old_ttv = """            const ttvQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_value
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."dealClosed" = 'started'
                AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });"""

new_ttv = """            const ttvQuery = await sequelize.query(`
                SELECT 
                    EXTRACT(EPOCH FROM (MIN(COALESCE(w."therapyStartedReportedAt", w."createdAt")) - COALESCE(p."profileActivatedAt", p."createdAt"))) / 86400 as days_to_value
                FROM "Psychologists" p
                JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                WHERE w."dealClosed" = 'started'
                AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
                GROUP BY p.id, p."profileActivatedAt", p."createdAt"
            `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });"""

code = code.replace(old_ttv, new_ttv)

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

