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
        let conversionRate = totalDemand > 0 ? (totalLeads / totalDemand) : 0.05;
        if (conversionRate === 0) conversionRate = 0.05; 

        // C) Descobrir a Taxa de Fechamento (WhatsApp -> Paciente Pago) Global Histórica
        const globalWppStats = await db.sequelize.query(
            `SELECT 
                COUNT(*) as total_clicks,
                SUM(CASE WHEN "dealClosed" = 'started' THEN 1 ELSE 0 END) as total_sales
             FROM "WhatsAppClickLogs"`,
             { type: db.sequelize.QueryTypes.SELECT }
        );
        
        const histClicks = parseInt(globalWppStats[0]?.total_clicks || 0);
        const histSales = parseInt(globalWppStats[0]?.total_sales || 0);
        
        let salesConversionRate = histClicks > 0 ? (histSales / histClicks) : 0.10;
        if (salesConversionRate === 0) salesConversionRate = 0.10; // Fallback 10%

        // Quantos cliques são necessários para fechar 1 paciente?
        const clicksForOneSale = 1 / salesConversionRate;
        
        // A META REAL (Sem Achismo): Garantir 1.5 pacientes novos por mês para manter o psicólogo lucrando e retido na Yelo
        const TARGET_NEW_PATIENTS_MONTHLY = 1.5;
        const TARGET_LEADS_PER_PSY_MONTHLY = Math.ceil(clicksForOneSale * TARGET_NEW_PATIENTS_MONTHLY);
        
        const msInDay = 1000 * 60 * 60 * 24;
        const periodDays = Math.max(1, (end - start) / msInDay);
        
        // Ajusta a meta de acordo com o filtro de data
        const periodTargetLeads = (TARGET_LEADS_PER_PSY_MONTHLY / 30) * periodDays;

        // D) Calcular a Necessidade Total do Sistema
        const totalLeadsNeeded = activePsyCount * periodTargetLeads;

        // E) Capacidade Ideal: Quantas "Buscas" são necessárias para bater a meta de leads
        const idealCapacity = Math.ceil(totalLeadsNeeded / conversionRate);

        let suggestion = "Sistema Equilibrado. Mantenha os investimentos atuais.";
        let alertLevel = "success";

        // Margem de tolerância: 20% para mais ou para menos
        if (totalDemand < idealCapacity * 0.8) {
            const missingDemand = idealCapacity - totalDemand;
            suggestion = `🚨 <b>Aumentar Ads (Tráfego Pago).</b> Para garantir a meta de ${TARGET_NEW_PATIENTS_MONTHLY} novos pacientes/mês por profissional (exige ~${TARGET_LEADS_PER_PSY_MONTHLY} cliques), precisamos de aprox. ${idealCapacity} buscas totais. Faltam ${missingDemand} buscas. A taxa de conversão do site é ${(conversionRate * 100).toFixed(1)}%.`;
            alertLevel = "warning";
        } else if (totalDemand > idealCapacity * 1.2) {
            const supportedPsys = Math.floor((totalDemand * conversionRate) / periodTargetLeads);
            const missingPsy = supportedPsys - activePsyCount;
            
            suggestion = `🔥 <b>Captar Mais Profissionais!</b> Com as taxas atuais, as ${totalDemand} buscas sustentam confortavelmente ${supportedPsys} psicólogos lucrando ${TARGET_NEW_PATIENTS_MONTHLY} pacientes/mês. Adicione <b>${missingPsy > 0 ? missingPsy : 1} novos profissionais</b> imediatamente.`;
            alertLevel = "danger";
        } else {
            suggestion = `✅ <b>Sistema Equilibrado.</b> A demanda atual atende os ${activePsyCount} profissionais, entregando a meta de ${TARGET_NEW_PATIENTS_MONTHLY} novos pacientes com base nas conversões reais.`;
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
