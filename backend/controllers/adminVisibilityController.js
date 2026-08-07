const db = require('../models');
const { Op } = require('sequelize');

exports.getVisibilityMetrics = async (req, res) => {
    try {
        if (req.userDecoded.role !== 'admin' && req.userDecoded.type !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const parseDateBRT = (dateString, isEnd = false) => {
            if (!dateString) return null;
            const time = isEnd ? '23:59:59.999' : '00:00:00.000';
            return new Date(`${dateString}T${time}-03:00`);
        };

        let start = parseDateBRT(req.query.startDate, false);
        let end = parseDateBRT(req.query.endDate, true);

        if (!start) {
            start = new Date(); 
            start.setHours(start.getHours() - 3); 
            start.setDate(start.getDate() - 30); 
            start.setUTCHours(3, 0, 0, 0);
        }
        if (!end) {
            end = new Date(); 
            end.setHours(end.getHours() - 3); 
            end.setUTCHours(2, 59, 59, 999); 
            end.setDate(end.getDate() + 1);
        }

        // 1. Total System Demand in period
        const totalDemandResult = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" BETWEEN :start AND :end`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]);
        const totalDemand = parseInt(totalDemandResult[0]?.count || 0);

        // 2. Fetch all Active Psychologists with their base metrics
        const psychologists = await db.Psychologist.findAll({
            where: { status: 'active' },
            attributes: ['id', 'nome', 'createdAt', 'profile_appearances', 'whatsapp_clicks']
        });

        const activePsyCount = psychologists.length;

        // 3. Aggregate Clicks, Started, Talking from WhatsAppClickLogs
        const wppLogs = await db.sequelize.query(
            `SELECT "psychologistId", "dealClosed", COUNT(*) as count 
             FROM "WhatsAppClickLogs" 
             WHERE "createdAt" BETWEEN :start AND :end 
             GROUP BY "psychologistId", "dealClosed"`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        );

        // 4. Aggregate Profile Views from ProfileAppearanceLogs
        const profileViews = await db.sequelize.query(
            `SELECT "psychologistId", COUNT(*) as count 
             FROM "ProfileAppearanceLogs" 
             WHERE "createdAt" BETWEEN :start AND :end 
             AND source IN ('profile_click_funnel', 'direct_view')
             GROUP BY "psychologistId"`,
            { replacements: { start, end }, type: db.sequelize.QueryTypes.SELECT }
        );

        const psiMap = {};
        psychologists.forEach(p => {
            const daysActive = Math.max(1, (new Date() - new Date(p.createdAt)) / (1000 * 60 * 60 * 24));
            // matches = total profile_appearances from the model (historic) 
            // OR we could try to filter matches by period, but since appearances are not logged per-event, we use historic for fairness calc
            const matches = p.profile_appearances || 0;
            const velocity = matches / daysActive;

            psiMap[p.id] = {
                id: p.id,
                nome: p.nome,
                diasAtivo: Math.round(daysActive),
                matches: matches,
                velocity: velocity,
                whatsapp_clicks: 0,
                conversando: 0,
                conversoes: 0,
                visualizacoes: 0
            };
        });

        wppLogs.forEach(log => {
            if (psiMap[log.psychologistId]) {
                const count = parseInt(log.count || 0);
                psiMap[log.psychologistId].whatsapp_clicks += count;
                if (log.dealClosed === 'talking') {
                    psiMap[log.psychologistId].conversando += count;
                } else if (log.dealClosed === 'started') {
                    psiMap[log.psychologistId].conversoes += count;
                }
            }
        });

        profileViews.forEach(log => {
            if (psiMap[log.psychologistId]) {
                psiMap[log.psychologistId].visualizacoes += parseInt(log.count || 0);
            }
        });

        // 5. Calculate Average Velocity and Fairness Index
        let totalVelocity = 0;
        const resultList = Object.values(psiMap);
        resultList.forEach(p => totalVelocity += p.velocity);
        
        const avgVelocity = resultList.length > 0 ? (totalVelocity / resultList.length) : 0.1;
        const safeAvg = Math.max(0.1, avgVelocity);

        resultList.forEach(p => {
            // Fairness Index: 100 = average. > 150 = monopolizing. < 50 = underexposed
            p.fairnessScore = Math.round((p.velocity / safeAvg) * 100);
        });

        // 6. Global Suggestion Engine
        let suggestion = "Sistema Equilibrado. Mantenha os investimentos atuais.";
        let alertLevel = "success";
        
        // Cada psicólogo quer idealmente 10-15 contatos. Então capacidade "ideal" = ativos * 10
        const idealCapacity = activePsyCount * 10;

        if (totalDemand < idealCapacity * 0.5) {
            suggestion = "🚨 Aumentar Investimento em Tráfego Pago (Ads). Há mais capacidade na rede do que pacientes buscando no período selecionado.";
            alertLevel = "warning";
        } else if (totalDemand > idealCapacity * 1.5) {
            suggestion = "🔥 Alta Demanda! Captar Mais Psicólogos. A demanda atual excede a capacidade ideal da rede de profissionais ativos.";
            alertLevel = "danger";
        }

        res.json({
            metrics: {
                totalDemand,
                activePsyCount,
                avgVelocity: avgVelocity.toFixed(2),
                idealCapacity
            },
            suggestion,
            alertLevel,
            psychologists: resultList
        });

    } catch (error) {
        console.error("Erro no getVisibilityMetrics:", error);
        res.status(500).json({ error: 'Erro interno' });
    }
};
