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

        // 6. Global Suggestion Engine (Refatorado Baseado em Conversão Real)
        
        // A) Calcular total de Leads Reais (Cliques no WPP) gerados no período
        let totalLeads = 0;
        wppLogs.forEach(log => {
            totalLeads += parseInt(log.count || 0);
        });

        // B) Calcular a Taxa de Conversão do Funil (Buscas -> WhatsApp)
        // Fallback seguro de 5% (0.05) para evitar divisões por zero ou sistemas muito novos
        let conversionRate = totalDemand > 0 ? (totalLeads / totalDemand) : 0.05;
        if (conversionRate === 0) conversionRate = 0.05; 

        // C) Definir meta e proporcionalidade de dias
        const TARGET_LEADS_PER_PSY_MONTHLY = 10; // Ideal de contatos no WPP por mês
        
        const msInDay = 1000 * 60 * 60 * 24;
        const periodDays = Math.max(1, (end - start) / msInDay);
        
        // Ajusta a meta de acordo com o filtro de data (ex: filtro de 15 dias = meta de 5 leads)
        const periodTargetLeads = (TARGET_LEADS_PER_PSY_MONTHLY / 30) * periodDays;

        // D) Calcular a Necessidade Total do Sistema
        const totalLeadsNeeded = activePsyCount * periodTargetLeads;

        // E) Capacidade Ideal: Quantas "Buscas" são necessárias para bater a meta de leads
        const idealCapacity = Math.ceil(totalLeadsNeeded / conversionRate);

        let suggestion = "Sistema Equilibrado. Mantenha os investimentos atuais.";
        let alertLevel = "success";

        // Margem de tolerância: 20% para mais ou para menos, para evitar flutuações agressivas
        if (totalDemand < idealCapacity * 0.8) {
            const missingDemand = idealCapacity - totalDemand;
            suggestion = `🚨 <b>Aumentar Ads (Tráfego Pago).</b> Para gerar leads suficientes (${TARGET_LEADS_PER_PSY_MONTHLY}/mês por psicólogo), precisamos de aprox. ${idealCapacity} buscas totais. Faltam ${missingDemand} buscas. A taxa de conversão atual é de ${(conversionRate * 100).toFixed(1)}%.`;
            alertLevel = "warning";
        } else if (totalDemand > idealCapacity * 1.2) {
            // Quantos psicólogos a demanda atual consegue sustentar com a conversão de hoje?
            const supportedPsys = Math.floor((totalDemand * conversionRate) / periodTargetLeads);
            const missingPsy = supportedPsys - activePsyCount;
            
            suggestion = `🔥 <b>Captar Mais Profissionais!</b> A demanda está superaquecida. Com a conversão atual de ${(conversionRate * 100).toFixed(1)}%, as ${totalDemand} buscas sustentam confortavelmente ${supportedPsys} psicólogos. Adicione <b>${missingPsy > 0 ? missingPsy : 1} novos profissionais</b> imediatamente.`;
            alertLevel = "danger";
        } else {
            suggestion = `✅ <b>Sistema Equilibrado.</b> A demanda atual atende os ${activePsyCount} profissionais de forma justa, entregando a meta de leads com uma conversão de ${(conversionRate * 100).toFixed(1)}%.`;
            alertLevel = "success";
        }

        res.json({
            metrics: {
                totalDemand,
                activePsyCount,
                avgVelocity: avgVelocity.toFixed(2),
                idealCapacity, // Agora exporta a capacidade com base na matemática real
                conversionRate: (conversionRate * 100).toFixed(1) + '%'
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
