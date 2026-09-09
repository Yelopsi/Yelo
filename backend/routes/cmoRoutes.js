const express = require('express');
const router = express.Router();
const metaAdsService = require('../services/metaAdsService');
const googleAdsService = require('../services/googleAdsService');
const { sequelize } = require('../models');

// Rota de dashboard principal do CMO
router.get('/dashboard', async (req, res) => {
    try {
        // Data default para o mes atual
        const dateStart = req.query.dateStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const dateEnd = req.query.dateEnd || new Date().toISOString().split('T')[0];

        // 1. Fetch de Ads Services
        const metaSpend = await metaAdsService.getAccountSpend(dateStart, dateEnd);
        const googleSpend = await googleAdsService.getAccountSpend(dateStart, dateEnd);
        
        const metaCampaigns = await metaAdsService.getCampaignInsights(dateStart, dateEnd);
        const googleCampaigns = await googleAdsService.getCampaignInsights(dateStart, dateEnd);

        // 2. Fetch de Dados da Plataforma (Cruzar as métricas)
        // Usamos raw query aqui para simplificar a agregação com sequelize, já que são dados consolidados
        const conversionsQuery = `
            SELECT 
                COUNT(*) as total_cadastros,
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NULL THEN 1 ELSE 0 END) as trials,
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN status = 'inactive' OR "deletedAt" IS NOT NULL THEN 1 ELSE 0 END) as churned
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        `;
        
        const platformMetricsResult = await sequelize.query(conversionsQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' },
            type: sequelize.QueryTypes.SELECT
        });
        
        const pMetrics = platformMetricsResult[0];

        const totalSpend = metaSpend.spend + googleSpend.spend;
        const totalTrials = parseInt(pMetrics.trials || 0);
        const totalPagantes = parseInt(pMetrics.pagantes || 0);
        const totalChurned = parseInt(pMetrics.churned || 0);
        
        const cac = totalPagantes > 0 ? (totalSpend / totalPagantes).toFixed(2) : 0;
        const cpl = totalTrials > 0 ? (totalSpend / totalTrials).toFixed(2) : 0;

        // Fetch Whatsapp Clicks and Deals (Feedback do Funil)
        const clicksQuery = `
            SELECT 
                COUNT(*) as total_clicks,
                SUM(CASE WHEN "dealClosed" IN ('yes', 'started') THEN 1 ELSE 0 END) as total_deals
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        `;
        
        const clicksResult = await sequelize.query(clicksQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' },
            type: sequelize.QueryTypes.SELECT
        });
        
        const wppMetrics = clicksResult[0];
        const whatsappClicks = parseInt(wppMetrics.total_clicks || 0);
        const closedDeals = parseInt(wppMetrics.total_deals || 0);

        // LTV e LTV:CAC Ratio
        const arpu = 99; // Ticket médio base
        const churnRate = totalPagantes > 0 ? (totalChurned / (totalPagantes + totalChurned)) : 0.05; // 5% default se não houver dados reais suficientes
        const ltv = arpu / (churnRate > 0 ? churnRate : 0.05);
        const ltvCacRatio = cac > 0 ? (ltv / cac) : 0;
        const trialToPaid = totalTrials > 0 ? ((totalPagantes / totalTrials) * 100).toFixed(1) : 0;

        // 3. Motor de Decisão Simples
        // 3. Motor de Decisão Simples
        const hasMetaError = metaSpend.error ? true : false;
        const hasGoogleError = googleSpend.error ? true : false;

        let decisionEngine = {
            action: 'MÉTRICAS INDIRETAS',
            reason: 'As APIs de anúncios não foram plugadas, analisando apenas KPIs nativos.'
        };

        if (hasMetaError || hasGoogleError) {
            decisionEngine = {
                action: 'DADOS INCOMPLETOS — INVESTIGAR INTEGRAÇÃO',
                reason: `Não foi possível consultar a conta de anúncios (${hasMetaError ? 'Meta' : ''}${hasMetaError && hasGoogleError ? ' e ' : ''}${hasGoogleError ? 'Google' : ''}). A decisão de orçamento está temporariamente suspensa até a integração ser corrigida.`
            };
        } else if (totalSpend > 0) {
            if (parseFloat(cac) > 0 && parseFloat(cac) < (parseFloat(cpl) * 1.5)) {
                decisionEngine = {
                    action: 'AUMENTAR ORÇAMENTO (SCALING) 🚀',
                    reason: `Custo de aquisição (R$ ${cac}) excelente frente ao CPL.`
                };
            } else if (totalPagantes === 0 && totalSpend > 300) {
                decisionEngine = {
                    action: 'PAUSAR CAMPANHAS / INVESTIGAR 🚨',
                    reason: 'Gastos altos sem novas conversões pagas. Revise o funil de vendas.'
                };
            } else {
                decisionEngine = {
                    action: 'MANTER ORÇAMENTO ⚖️',
                    reason: 'Dados em linha com o esperado.'
                };
            }
        }

        res.json({
            success: true,
            period: { dateStart, dateEnd },
            ads: {
                meta: metaSpend,
                google: googleSpend,
                totalSpend: parseFloat(totalSpend.toFixed(2))
            },
            campaigns: {
                meta: metaCampaigns,
                google: googleCampaigns
            },
            platform: {
                trials: totalTrials,
                pagantes: totalPagantes,
                churned: totalChurned,
                total_cadastros: parseInt(pMetrics.total_cadastros || 0),
                cac: parseFloat(cac),
                cpl: parseFloat(cpl),
                whatsappClicks: whatsappClicks,
                closedDeals: closedDeals,
                ltv: parseFloat(ltv.toFixed(2)),
                ltvCacRatio: parseFloat(ltvCacRatio.toFixed(2)),
                trialToPaid: parseFloat(trialToPaid)
            },
            decisionEngine: decisionEngine
        });
    } catch (error) {
        console.error('[CMO Metrics] Erro Global na Rota:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao gerar dashboard do CMO', 
            details: error.message,
            stack: error.stack 
        });
    }
});

module.exports = router;
