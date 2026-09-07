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
        
        const cac = totalPagantes > 0 ? (totalSpend / totalPagantes).toFixed(2) : 0;
        const cpl = totalTrials > 0 ? (totalSpend / totalTrials).toFixed(2) : 0;

        // 3. Motor de Decisão Simples
        let decision = "MANTER ORÇAMENTO";
        let decisionReason = "Dados em linha com o esperado.";
        
        // Simulação de regras de negócio (Pode ser refinado pelo CMO)
        if (totalSpend > 0 && totalPagantes === 0) {
            decision = "PAUSAR CAMPANHAS / INVESTIGAR";
            decisionReason = "Gastos altos sem novas conversões pagas.";
        } else if (cac > 0 && cac < 300) { // Se CAC for menor que R$300 (Assumindo que o ticket seja alto)
            decision = "AUMENTAR ORÇAMENTO";
            decisionReason = `CAC (${cac}) está excelente. Escale o investimento B2B.`;
        } else if (cac >= 300) {
            decision = "OTIMIZAR / DIMINUIR ORÇAMENTO";
            decisionReason = `CAC (${cac}) está acima da meta. Avaliar campanhas ruins.`;
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
                churned: parseInt(pMetrics.churned || 0),
                total_cadastros: parseInt(pMetrics.total_cadastros || 0),
                cac: parseFloat(cac),
                cpl: parseFloat(cpl)
            },
            decisionEngine: {
                action: decision,
                reason: decisionReason
            }
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
