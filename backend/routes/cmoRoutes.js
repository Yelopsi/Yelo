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

        // 1. Definição de Períodos (Atual e Anterior)
        const start = new Date(dateStart + 'T00:00:00');
        const end = new Date(dateEnd + 'T00:00:00');
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - diffDays + 1);

        const prevDateStart = prevStart.toISOString().split('T')[0];
        const prevDateEnd = prevEnd.toISOString().split('T')[0];

        // 2. Fetch de Ads Services (Atual e Anterior)
        const [metaSpend, googleSpend, metaCampaigns, googleCampaigns, manualGoogle, prevMetaSpend, prevGoogleSpend, prevManualGoogle] = await Promise.all([
            metaAdsService.getAccountSpend(dateStart, dateEnd),
            googleAdsService.getAccountSpend(dateStart, dateEnd),
            metaAdsService.getCampaignInsights(dateStart, dateEnd),
            googleAdsService.getCampaignInsights(dateStart, dateEnd),
            sequelize.models.ManualAdMetric.findOne({ where: { dateStart, dateEnd, platform: 'google' } }),
            metaAdsService.getAccountSpend(prevDateStart, prevDateEnd),
            googleAdsService.getAccountSpend(prevDateStart, prevDateEnd),
            sequelize.models.ManualAdMetric.findOne({ where: { dateStart: prevDateStart, dateEnd: prevDateEnd, platform: 'google' } })
        ]);

        const actualGoogleSpend = googleSpend.spend > 0 ? googleSpend.spend : (manualGoogle ? parseFloat(manualGoogle.spend) || 0 : 0);
        const actualPrevGoogleSpend = prevGoogleSpend.spend > 0 ? prevGoogleSpend.spend : (prevManualGoogle ? parseFloat(prevManualGoogle.spend) || 0 : 0);
        
        const totalSpend = metaSpend.spend + actualGoogleSpend;
        const totalPrevSpend = prevMetaSpend.spend + actualPrevGoogleSpend;

        // 3. Atribuição e Cohort (Atual)
        const conversionsQuery = `
            SELECT 
                COUNT(*) as total_cadastros,
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NULL THEN 1 ELSE 0 END) as trials,
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN status = 'inactive' OR "deletedAt" IS NOT NULL THEN 1 ELSE 0 END) as churned,
                SUM(CASE WHEN "first_utm_source" IN ('facebook', 'instagram', 'ig', 'meta') AND status = 'active' AND "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as meta_pagantes,
                SUM(CASE WHEN "first_utm_source" IN ('google', 'adwords') AND status = 'active' AND "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as google_pagantes,
                SUM(CASE WHEN "first_utm_source" IN ('facebook', 'instagram', 'ig', 'meta') AND status = 'active' AND "firstPaidAt" IS NULL THEN 1 ELSE 0 END) as meta_trials,
                SUM(CASE WHEN "first_utm_source" IN ('google', 'adwords') AND status = 'active' AND "firstPaidAt" IS NULL THEN 1 ELSE 0 END) as google_trials
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        `;
        
        const platformMetricsResult = await sequelize.query(conversionsQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' },
            type: sequelize.QueryTypes.SELECT
        });
        
        const pMetrics = platformMetricsResult[0];

        // 3.1 Cohort (Anterior para Tendência)
        const prevPlatformMetricsResult = await sequelize.query(conversionsQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' },
            type: sequelize.QueryTypes.SELECT
        });
        const prevPMetrics = prevPlatformMetricsResult[0];

        const totalTrials = parseInt(pMetrics.trials || 0);
        const totalPagantes = parseInt(pMetrics.pagantes || 0);
        const totalChurned = parseInt(pMetrics.churned || 0);
        
        const cac = totalPagantes > 0 ? (totalSpend / totalPagantes) : 0;
        
        const prevTotalPagantes = parseInt(prevPMetrics.pagantes || 0);
        const prevCac = prevTotalPagantes > 0 ? (totalPrevSpend / prevTotalPagantes) : 0;

        // CAC Marginal (Custo Adicional / Clientes Adicionais)
        const deltaSpend = totalSpend - totalPrevSpend;
        const deltaPagantes = totalPagantes - prevTotalPagantes;
        let marginalCac = 0;
        if (deltaPagantes > 0) {
            marginalCac = deltaSpend / deltaPagantes;
        }

        // Fetch Whatsapp Clicks and Deals
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

        // LTV e Ratios
        const arpu = 99;
        const churnRate = totalPagantes > 0 ? (totalChurned / (totalPagantes + totalChurned)) : 0.05;
        const ltv = arpu / (churnRate > 0 ? churnRate : 0.05);
        const ltvCacRatio = cac > 0 ? (ltv / cac) : 0;
        
        const googlePagantes = parseInt(pMetrics.google_pagantes || 0);
        const metaPagantes = parseInt(pMetrics.meta_pagantes || 0);
        const googleCac = googlePagantes > 0 ? (actualGoogleSpend / googlePagantes) : 0;
        const metaCac = metaPagantes > 0 ? (metaSpend.spend / metaPagantes) : 0;

        // 4. Motor de Decisão de Escala 2.0
        let decisionEngine = {
            action: 'RECOLHENDO DADOS ⏳',
            confidence: 0,
            targetCac: arpu * 1.5, // Teto razoável
            ltv: ltv,
            ratio: ltvCacRatio,
            scaleCapacity: 'BAIXA',
            cacTrend: cac - prevCac,
            warning: null,
            recommendation: 'Aguarde mais dados de conversão.'
        };

        const hasAdsData = totalSpend > 0;
        const lowSample = totalPagantes < 15;

        if (lowSample) {
            decisionEngine.warning = `Amostra muito pequena (${totalPagantes} pagantes). O LTV calculado (R$ ${ltv.toFixed(0)}) é estatisticamente volátil e qualquer cancelamento mudará a métrica radicalmente.`;
        }

        if (hasAdsData) {
            const isScaleHealthy = ltvCacRatio >= 3;
            const isMarginalCacDangerous = marginalCac > (decisionEngine.targetCac * 1.2);
            
            if (isScaleHealthy && !isMarginalCacDangerous && totalPagantes >= 10) {
                decisionEngine.action = 'SINAL VERDE: AUMENTAR ORÇAMENTO 🚀';
                decisionEngine.confidence = lowSample ? 60 : 85;
                decisionEngine.scaleCapacity = 'ALTA';
                decisionEngine.recommendation = `O retorno está muito acima do ponto de equilíbrio (Ratio ${ltvCacRatio.toFixed(1)}x). Você pode aumentar o orçamento com segurança. Foque no canal com menor CAC (${googleCac < metaCac && googleCac > 0 ? 'Google' : 'Meta'}).`;
            } else if (isScaleHealthy && isMarginalCacDangerous) {
                decisionEngine.action = 'TETO DE EFICIÊNCIA ATINGIDO ⚖️';
                decisionEngine.confidence = 75;
                decisionEngine.scaleCapacity = 'LIMITADA';
                decisionEngine.warning = decisionEngine.warning || 'Atenção: O aumento recente de orçamento gerou clientes mais caros (CAC Marginal alto).';
                decisionEngine.recommendation = 'Mantenha o orçamento atual. Escalar mais neste momento vai corroer suas margens.';
            } else if (totalPagantes === 0 && totalSpend > 300) {
                decisionEngine.action = 'PAUSAR CAMPANHAS / INVESTIGAR 🚨';
                decisionEngine.confidence = 90;
                decisionEngine.scaleCapacity = 'ZERO';
                decisionEngine.recommendation = 'Custo elevado sem nenhum novo assinante no período. Revise as landing pages ou os anúncios.';
            } else {
                decisionEngine.action = 'MANTER ORÇAMENTO ⚖️';
                decisionEngine.confidence = 70;
                decisionEngine.scaleCapacity = 'MÉDIA';
                decisionEngine.recommendation = 'O fluxo está dentro da normalidade. Monitore o LTV:CAC.';
            }
        }

        res.json({
            success: true,
            period: { dateStart, dateEnd, prevDateStart, prevDateEnd },
            ads: {
                meta: { ...metaSpend, cac: metaCac },
                google: { ...googleSpend, spend: actualGoogleSpend, cac: googleCac },
                totalSpend: totalSpend,
                prevTotalSpend: totalPrevSpend
            },
            campaigns: {
                meta: metaCampaigns,
                google: googleCampaigns
            },
            platform: {
                trials: totalTrials,
                pagantes: totalPagantes,
                churned: totalChurned,
                cac: cac,
                prevCac: prevCac,
                marginalCac: marginalCac,
                cpl: totalTrials > 0 ? (totalSpend / totalTrials) : 0,
                whatsappClicks: parseInt(wppMetrics.total_clicks || 0),
                closedDeals: parseInt(wppMetrics.total_deals || 0),
                ltv: ltv,
                ltvCacRatio: ltvCacRatio,
                trialToPaid: totalTrials > 0 ? ((totalPagantes / totalTrials) * 100) : 0,
                google_pagantes: googlePagantes,
                meta_pagantes: metaPagantes,
                google_trials: parseInt(pMetrics.google_trials || 0),
                meta_trials: parseInt(pMetrics.meta_trials || 0)
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

// Rota para salvar inputs manuais (ex: Google Ads)
router.post('/manual-ads', async (req, res) => {
    try {
        const { dateStart, dateEnd, platform, campaignName, spend, impressions, clicks, conversions } = req.body;
        if (!dateStart || !dateEnd || !platform) {
            return res.status(400).json({ success: false, error: 'dateStart, dateEnd e platform são obrigatórios' });
        }
        
        const { ManualAdMetric } = require('../models');
        
        // Upsert usando a combinação dateStart, dateEnd e platform
        const [record, created] = await ManualAdMetric.upsert(
            { dateStart, dateEnd, platform, campaignName, spend, impressions, clicks, conversions },
            { returning: true }
        );
        
        res.json({ success: true, record, created });
    } catch (error) {
        console.error('[CMO] Erro ao salvar dados manuais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para carregar inputs manuais
router.get('/manual-ads', async (req, res) => {
    try {
        const { dateStart, dateEnd, platform } = req.query;
        if (!dateStart || !dateEnd || !platform) {
            return res.status(400).json({ success: false, error: 'Parâmetros insuficientes' });
        }

        const { ManualAdMetric } = require('../models');
        
        const record = await ManualAdMetric.findOne({
            where: { dateStart, dateEnd, platform }
        });
        
        res.json({ success: true, record });
    } catch (error) {
        console.error('[CMO] Erro ao buscar dados manuais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
