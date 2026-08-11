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
                } else if (log.dealClosed === 'started' || log.dealClosed === 'yes') {
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

        // C) Descobrir a Taxa de Leads Autênticos (Excluir Fantasmas e Sem Resposta) Histórica
        const globalWppStats = await db.sequelize.query(
            `SELECT 
                SUM(CASE WHEN "dealClosed" IS NOT NULL AND "dealClosed" != 'unknown' THEN 1 ELSE 0 END) as total_feedbacks,
                SUM(CASE WHEN "dealClosed" IN ('no_contact', 'wpp_issue') THEN 1 ELSE 0 END) as ghost_leads
             FROM "WhatsAppClickLogs"`,
            { type: db.sequelize.QueryTypes.SELECT }
        );

        const totalFeedbacks = parseInt(globalWppStats[0]?.total_feedbacks || 0);
        const ghostLeads = parseInt(globalWppStats[0]?.ghost_leads || 0);
        const realLeads = totalFeedbacks - ghostLeads;

        let leadAuthenticityRate = totalFeedbacks > 0 ? (realLeads / totalFeedbacks) : 0.80; // Fallback 80%
        if (leadAuthenticityRate === 0) leadAuthenticityRate = 0.80;

        // Quantos cliques totais (com fantasmas) são necessários para garantir 1 lead real/autêntico?
        const clicksForOneRealLead = 1 / leadAuthenticityRate;

        // A META DINÂMICA: Baseada exclusivamente no histórico dos ÚLTIMOS 30 DIAS
        const past30Days = new Date();
        past30Days.setDate(past30Days.getDate() - 30);
        
        const last30ClicksResult = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "createdAt" >= :past30`,
            { replacements: { past30: past30Days }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]);
        const totalWppClicks30 = parseInt(last30ClicksResult[0]?.count || 0);
        
        const avgClicksPerPsy30 = activePsyCount > 0 ? (totalWppClicks30 / activePsyCount) : 10;
        
        // A média já corresponde ao mês
        const TARGET_REAL_LEADS_MONTHLY = Math.max(1, Math.round(avgClicksPerPsy30 * leadAuthenticityRate));
        const TARGET_CLICKS_PER_PSY_MONTHLY = Math.ceil(clicksForOneRealLead * TARGET_REAL_LEADS_MONTHLY);

        const msInDay = 1000 * 60 * 60 * 24;
        const periodDays = Math.max(1, (end - start) / msInDay);
        // Ajusta a meta de cliques brutos de acordo com o filtro de data
        const periodTargetClicks = (TARGET_CLICKS_PER_PSY_MONTHLY / 30) * periodDays;

        // D) Calcular a Necessidade Total do Sistema
        const totalClicksNeeded = activePsyCount * periodTargetClicks;

        // E) Capacidade Ideal: Quantas "Buscas" são necessárias para bater a meta de cliques reais
        const idealCapacity = Math.ceil(totalClicksNeeded / conversionRate);

        let suggestion = "Sistema Equilibrado. Mantenha os investimentos atuais.";
        let alertLevel = "success";

        // Margem de tolerância: 20% para mais ou para menos
        if (totalDemand < idealCapacity * 0.8) {
            const missingDemand = idealCapacity - totalDemand;
            suggestion = `🚨 <b>Aumentar Ads (Tráfego Pago).</b> Para garantir a meta de ${TARGET_REAL_LEADS_MONTHLY} leads reais/mês por profissional (exige ~${TARGET_CLICKS_PER_PSY_MONTHLY} cliques brutos considerando os fantasmas), precisamos de aprox. ${idealCapacity} buscas totais no funil. Faltam ${missingDemand} buscas. A conversão da busca pro WhatsApp está em ${(conversionRate * 100).toFixed(1)}%.`;
            alertLevel = "warning";
        } else if (totalDemand > idealCapacity * 1.2) {
            const supportedPsys = Math.floor((totalDemand * conversionRate) / periodTargetClicks);
            const missingPsy = supportedPsys - activePsyCount;

            suggestion = `🔥 <b>Captar Mais Profissionais!</b> Com as taxas atuais, as ${totalDemand} buscas sustentam confortavelmente ${supportedPsys} psicólogos recebendo ${TARGET_REAL_LEADS_MONTHLY} leads quentes/mês. Adicione <b>${missingPsy > 0 ? missingPsy : 1} novos profissionais</b> imediatamente.`;
            alertLevel = "danger";
        } else {
            suggestion = `✅ <b>Sistema Equilibrado.</b> A demanda atual atende os ${activePsyCount} profissionais, entregando a meta de ${TARGET_REAL_LEADS_MONTHLY} contatos reais no WhatsApp com base nas conversões e feedbacks atuais.`;
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
