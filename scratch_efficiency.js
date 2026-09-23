const { sequelize, Psychologist, WhatsAppClickLog, Patient } = require('./backend/models');
const { Op } = require('sequelize');

async function runQueries() {
    try {
        console.log("Conectando ao banco de dados...");
        await sequelize.authenticate();
        console.log("Conectado.");

        // 1. Esforço de Fechamento (Global)
        const totalClicks = await WhatsAppClickLog.count();
        const totalClosed = await WhatsAppClickLog.count({ where: { dealClosed: 'yes' } });
        
        const globalEffort = totalClosed > 0 ? (totalClicks / totalClosed).toFixed(1) : 0;
        console.log(`1. Esforço de Fechamento Global: ${globalEffort} cliques por paciente (${totalClicks} cliques / ${totalClosed} fechados)`);

        // 2. Eficiência por Canal (Ads vs. Orgânico)
        const adsSources = ['google', 'meta', 'facebook', 'instagram', 'ig'];
        const isAdsCondition = {
            [Op.or]: [
                { utmSource: { [Op.iLike]: { [Op.any]: adsSources.map(s => `%${s}%`) } } },
                { source: { [Op.iLike]: { [Op.any]: adsSources.map(s => `%${s}%`) } } }
            ]
        };

        const adsClicks = await WhatsAppClickLog.count({ where: isAdsCondition });
        const adsClosed = await WhatsAppClickLog.count({ where: { ...isAdsCondition, dealClosed: 'yes' } });
        const adsEffort = adsClosed > 0 ? (adsClicks / adsClosed).toFixed(1) : 0;

        const orgClicks = totalClicks - adsClicks;
        const orgClosed = totalClosed - adsClosed;
        const orgEffort = orgClosed > 0 ? (orgClicks / orgClosed).toFixed(1) : 0;

        console.log(`2. Eficiência Ads: ${adsEffort} cliques/paciente (${adsClicks} cliques / ${adsClosed} fechados)`);
        console.log(`   Eficiência Orgânico: ${orgEffort} cliques/paciente (${orgClicks} cliques / ${orgClosed} fechados)`);

        // 3. Ticket Médio dos Top Performers
        const topPerformersQuery = await WhatsAppClickLog.findAll({
            attributes: ['psychologistId', [sequelize.fn('COUNT', sequelize.col('id')), 'closedCount']],
            where: { dealClosed: 'yes', psychologistId: { [Op.not]: null } },
            group: ['psychologistId'],
            order: [[sequelize.literal('"closedCount"'), 'DESC']],
            raw: true
        });

        let topTicket = 0;
        if (topPerformersQuery.length > 0) {
            const top20PercentCount = Math.max(1, Math.ceil(topPerformersQuery.length * 0.20));
            const topPerformersIds = topPerformersQuery.slice(0, top20PercentCount).map(p => p.psychologistId);
            
            const topPsychologists = await Psychologist.findAll({
                attributes: [[sequelize.fn('AVG', sequelize.col('valor_sessao_numero')), 'avgTicket']],
                where: {
                    id: { [Op.in]: topPerformersIds },
                    valor_sessao_numero: { [Op.gt]: 0, [Op.not]: null }
                },
                raw: true
            });
            topTicket = topPsychologists[0].avgTicket ? parseFloat(topPsychologists[0].avgTicket).toFixed(2) : 0;
            console.log(`3. Ticket Médio Top Performers (Top ${top20PercentCount} psis): R$ ${topTicket}`);
        } else {
            console.log(`3. Ticket Médio Top Performers: N/A (sem fechamentos)`);
        }

        // 4. Time to Value (TTV)
        const ttvQuery = await sequelize.query(`
            SELECT 
                p.id as psi_id, 
                p."createdAt" as psi_created_at, 
                MIN(w."createdAt") as first_closed_at,
                EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_value
            FROM "Psychologists" p
            JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
            WHERE w."dealClosed" = 'yes'
            GROUP BY p.id, p."createdAt"
        `, { type: sequelize.QueryTypes.SELECT });

        let ttvAvg = 0;
        if (ttvQuery.length > 0) {
            const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => q.days_to_value);
            if (validTtvs.length > 0) {
                ttvAvg = validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length;
            }
            console.log(`4. Time to Value (TTV): ${ttvAvg.toFixed(1)} dias em média (${validTtvs.length} psicólogos com fechamento)`);
        } else {
            console.log(`4. Time to Value (TTV): N/A`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}

runQueries();
