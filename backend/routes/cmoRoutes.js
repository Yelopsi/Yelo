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

        // 3. Atribuição B2B (Meta Ads -> Psicólogos)
        const b2bQuery = `
            SELECT 
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN status = 'active' AND "firstPaidAt" IS NULL THEN 1 ELSE 0 END) as trials,
                SUM(CASE WHEN status = 'inactive' OR "deletedAt" IS NOT NULL THEN 1 ELSE 0 END) as churned
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
            AND "deletedAt" IS NULL
            AND (
                utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
                OR first_utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
            )
        `;

        const [metaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const [prevMetaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });

        const metaPagantes = parseInt(metaMetricsRes.pagantes || 0);
        const prevMetaPagantes = parseInt(prevMetaMetricsRes.pagantes || 0);
        const metaTrials = parseInt(metaMetricsRes.trials || 0);
        const metaChurned = parseInt(metaMetricsRes.churned || 0);

        const metaCac = metaPagantes > 0 ? (metaSpend.spend / metaPagantes) : 0;
        const prevMetaCac = prevMetaPagantes > 0 ? (prevMetaSpend.spend / prevMetaPagantes) : 0;

        const deltaMetaSpend = metaSpend.spend - prevMetaSpend.spend;
        const deltaMetaPagantes = metaPagantes - prevMetaPagantes;
        const metaMarginalCac = deltaMetaPagantes > 0 ? (deltaMetaSpend / deltaMetaPagantes) : 0;

        const arpu = 99;
        const metaChurnRate = metaPagantes > 0 ? (metaChurned / (metaPagantes + metaChurned)) : 0.05;
        const metaLtv = arpu / (metaChurnRate > 0 ? metaChurnRate : 0.05);
        const metaLtvCacRatio = metaCac > 0 ? (metaLtv / metaCac) : 0;

        // 4. Atribuição B2C (Google Ads -> Pacientes)
        const b2cQuery = `
            SELECT 
                COUNT(*) as total_clicks,
                SUM(CASE WHEN "dealClosed" IN ('yes', 'started') THEN 1 ELSE 0 END) as total_deals
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        `;

        const [googleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const [prevGoogleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });

        const googleClicks = parseInt(googleMetricsRes.total_clicks || 0);
        const googleDeals = parseInt(googleMetricsRes.total_deals || 0);
        const prevGoogleDeals = parseInt(prevGoogleMetricsRes.total_deals || 0);

        const googleCpa = googleDeals > 0 ? (actualGoogleSpend / googleDeals) : 0;
        const prevGoogleCpa = prevGoogleDeals > 0 ? (actualPrevGoogleSpend / prevGoogleDeals) : 0;

        const deltaGoogleSpend = actualGoogleSpend - actualPrevGoogleSpend;
        const deltaGoogleDeals = googleDeals - prevGoogleDeals;
        const googleMarginalCpa = deltaGoogleDeals > 0 ? (deltaGoogleSpend / deltaGoogleDeals) : 0;

        // 5. Motor de Decisão (Meta/B2B)
        let decisionEngineMeta = {
            action: 'RECOLHENDO DADOS ⏳', confidence: 0, target: arpu * 1.5,
            scaleCapacity: 'BAIXA', trend: metaCac - prevMetaCac, warning: null, recommendation: 'Aguarde mais conversões.'
        };

        if (metaPagantes < 15) {
            decisionEngineMeta.warning = `Amostra pequena (${metaPagantes} pagantes). O LTV é estatisticamente volátil e qualquer cancelamento mudará a métrica.`;
        }

        if (metaSpend.spend > 0) {
            const isScaleHealthy = metaLtvCacRatio >= 3;
            const isMarginalDangerous = metaMarginalCac > (decisionEngineMeta.target * 1.2);

            if (isScaleHealthy && !isMarginalDangerous && metaPagantes >= 5) {
                decisionEngineMeta.action = 'SINAL VERDE: AUMENTAR 🚀';
                decisionEngineMeta.confidence = metaPagantes < 15 ? 60 : 85;
                decisionEngineMeta.scaleCapacity = 'ALTA';
                decisionEngineMeta.recommendation = `O CAC está lucrativo (Ratio ${metaLtvCacRatio.toFixed(1)}x). Aumente o orçamento para Psicólogos com segurança.`;
            } else if (isScaleHealthy && isMarginalDangerous) {
                decisionEngineMeta.action = 'TETO DE EFICIÊNCIA ⚖️';
                decisionEngineMeta.confidence = 75;
                decisionEngineMeta.scaleCapacity = 'LIMITADA';
                decisionEngineMeta.warning = decisionEngineMeta.warning || 'Atenção: O aumento recente gerou psicólogos muito mais caros (CAC Marginal alto).';
                decisionEngineMeta.recommendation = 'Mantenha o orçamento atual para proteger suas margens.';
            } else if (metaPagantes === 0 && metaSpend.spend > 300) {
                decisionEngineMeta.action = 'PAUSAR / INVESTIGAR 🚨';
                decisionEngineMeta.confidence = 90;
                decisionEngineMeta.scaleCapacity = 'ZERO';
                decisionEngineMeta.recommendation = 'Gasto elevado sem novas assinaturas. Revise sua campanha B2B no Facebook/Insta.';
            } else {
                decisionEngineMeta.action = 'MANTER ORÇAMENTO ⚖️';
                decisionEngineMeta.confidence = 70;
                decisionEngineMeta.scaleCapacity = 'MÉDIA';
                decisionEngineMeta.recommendation = 'O fluxo de aquisição está aceitável.';
            }
        }

        // 6. Motor de Decisão (Google/B2C)
        let decisionEngineGoogle = {
            action: 'RECOLHENDO DADOS ⏳', confidence: 0, target: 30, // Teto sugerido de 30 reais por paciente
            scaleCapacity: 'BAIXA', trend: googleCpa - prevGoogleCpa, warning: null, recommendation: 'Aguarde pacientes fechados.'
        };

        if (googleDeals < 15) {
            decisionEngineGoogle.warning = `Amostra pequena (${googleDeals} pacientes fechados na Yelo).`;
        }

        if (actualGoogleSpend > 0) {
            const isCpaHealthy = googleCpa <= decisionEngineGoogle.target;
            const isMarginalDangerous = googleMarginalCpa > (decisionEngineGoogle.target * 1.5);

            if (isCpaHealthy && !isMarginalDangerous && googleDeals >= 5) {
                decisionEngineGoogle.action = 'SINAL VERDE: AUMENTAR 🚀';
                decisionEngineGoogle.confidence = googleDeals < 15 ? 60 : 85;
                decisionEngineGoogle.scaleCapacity = 'ALTA';
                decisionEngineGoogle.recommendation = `O Custo por Paciente (CPA R$ ${googleCpa.toFixed(2)}) está excelente. Aumente o Google Ads para gerar mais pacientes para os psicólogos.`;
            } else if (isCpaHealthy && isMarginalDangerous) {
                decisionEngineGoogle.action = 'TETO DE EFICIÊNCIA ⚖️';
                decisionEngineGoogle.confidence = 75;
                decisionEngineGoogle.scaleCapacity = 'LIMITADA';
                decisionEngineGoogle.warning = decisionEngineGoogle.warning || 'O custo marginal do Google (R$ ' + googleMarginalCpa.toFixed(2) + ') está subindo rápido.';
                decisionEngineGoogle.recommendation = 'Mantenha o orçamento do Google. O aumento recente de verba trouxe pacientes mais caros.';
            } else if (googleDeals === 0 && actualGoogleSpend > 150) {
                decisionEngineGoogle.action = 'PAUSAR / INVESTIGAR 🚨';
                decisionEngineGoogle.confidence = 90;
                decisionEngineGoogle.scaleCapacity = 'ZERO';
                decisionEngineGoogle.recommendation = 'Gasto no Google sem gerar pacientes fechados. Reveja o tráfego de pesquisa.';
            } else {
                decisionEngineGoogle.action = 'MANTER ORÇAMENTO ⚖️';
                decisionEngineGoogle.confidence = 70;
                decisionEngineGoogle.scaleCapacity = 'MÉDIA';
                decisionEngineGoogle.recommendation = `CPA atual é R$ ${googleCpa.toFixed(2)}. Mantenha e monitore.`;
            }
        }

        res.json({
            success: true,
            period: { dateStart, dateEnd, prevDateStart, prevDateEnd },
            ads: {
                meta: { ...metaSpend, spend: metaSpend.spend, cac: metaCac, marginalCac: metaMarginalCac },
                google: { ...googleSpend, spend: actualGoogleSpend, cpa: googleCpa, marginalCpa: googleMarginalCpa }
            },
            campaigns: { meta: metaCampaigns, google: googleCampaigns },
            platform: {
                b2b: { trials: metaTrials, pagantes: metaPagantes, churned: metaChurned, ltv: metaLtv, ratio: metaLtvCacRatio },
                b2c: { clicks: googleClicks, deals: googleDeals }
            },
            decisionEngineMeta,
            decisionEngineGoogle
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

        // Busca o registro existente
        let record = await ManualAdMetric.findOne({
            where: { dateStart, dateEnd, platform }
        });

        let created = false;
        if (record) {
            record = await record.update({ campaignName, spend, impressions, clicks, conversions });
        } else {
            record = await ManualAdMetric.create({ dateStart, dateEnd, platform, campaignName, spend, impressions, clicks, conversions });
            created = true;
        }

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
