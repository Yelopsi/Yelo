const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const dateEnd90 = new Date();
        const dateStart90 = new Date();
        dateStart90.setDate(dateStart90.getDate() - 90);
        
        // TTFC (Primeiro contato, independente de conversão)
        const ttfcQuery = await sequelize.query(`
            SELECT 
                EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_first_contact
            FROM "Psychologists" p
            JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
            WHERE w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
            GROUP BY p.id, p."createdAt"
        `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });

        let ttfcMedian = 'N/A';
        let ttfcAvg = 'N/A';
        let ttfcP25 = 'N/A';
        let ttfcP75 = 'N/A';
        if (ttfcQuery.length > 0) {
            const validTtfcs = ttfcQuery.filter(q => q.days_to_first_contact >= 0).map(q => parseFloat(q.days_to_first_contact)).sort((a,b) => a-b);
            if (validTtfcs.length > 0) {
                ttfcAvg = (validTtfcs.reduce((sum, val) => sum + val, 0) / validTtfcs.length).toFixed(1);
                const mid = Math.floor(validTtfcs.length / 2);
                ttfcMedian = validTtfcs.length % 2 !== 0 ? validTtfcs[mid].toFixed(1) : ((validTtfcs[mid - 1] + validTtfcs[mid]) / 2).toFixed(1);
                ttfcP25 = validTtfcs[Math.floor(validTtfcs.length * 0.25)].toFixed(1);
                ttfcP75 = validTtfcs[Math.floor(validTtfcs.length * 0.75)].toFixed(1);
                console.log(`TTFC (Tempo até 1º Contato) - Amostra: ${validTtfcs.length}, Média: ${ttfcAvg}, Mediana: ${ttfcMedian}, P25: ${ttfcP25}, P75: ${ttfcP75}`);
            }
        }
        
        // TTV (Primeiro paciente iniciado) - using 'started' as requested
        const ttvQuery = await sequelize.query(`
            SELECT 
                EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_value
            FROM "Psychologists" p
            JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
            WHERE w."dealClosed" = 'started'
            AND w."createdAt" >= :dateStart AND w."createdAt" <= :dateEnd
            GROUP BY p.id, p."createdAt"
        `, { replacements: { dateStart: dateStart90, dateEnd: dateEnd90 }, type: sequelize.QueryTypes.SELECT });

        let ttvMedian = 'N/A';
        let ttvAvg = 'N/A';
        let ttvP25 = 'N/A';
        let ttvP75 = 'N/A';
        if (ttvQuery.length > 0) {
            const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => parseFloat(q.days_to_value)).sort((a,b) => a-b);
            if (validTtvs.length > 0) {
                ttvAvg = (validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length).toFixed(1);
                const mid = Math.floor(validTtvs.length / 2);
                ttvMedian = validTtvs.length % 2 !== 0 ? validTtvs[mid].toFixed(1) : ((validTtvs[mid - 1] + validTtvs[mid]) / 2).toFixed(1);
                ttvP25 = validTtvs[Math.floor(validTtvs.length * 0.25)].toFixed(1);
                ttvP75 = validTtvs[Math.floor(validTtvs.length * 0.75)].toFixed(1);
                console.log(`TTV (1º paciente iniciado) - Amostra: ${validTtvs.length}, Média: ${ttvAvg}, Mediana: ${ttvMedian}, P25: ${ttvP25}, P75: ${ttvP75}`);
            }
        }
        
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
