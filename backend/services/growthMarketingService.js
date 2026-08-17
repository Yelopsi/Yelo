const { Op } = require('sequelize');
const db = require('../models');

class GrowthMarketingService {
    async getUnitEconomics(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. Despesas Totais e por Canal
        const expenses = await db.YeloExpense.findAll({
            where: { createdAt: { [Op.gte]: periodStart } }
        });

        let totalMarketingSpend = 0;
        const spendByChannel = {
            'Google Ads': 0,
            'Meta Ads': 0,
            'Outros': 0
        };

        for (const exp of expenses) {
            const amount = Number(exp.amount) || 0;
            totalMarketingSpend += amount;
            
            if (exp.category && exp.category.includes('Google')) {
                spendByChannel['Google Ads'] += amount;
            } else if (exp.category && exp.category.includes('Meta') || exp.category && exp.category.includes('Facebook')) {
                spendByChannel['Meta Ads'] += amount;
            } else {
                spendByChannel['Outros'] += amount;
            }
        }

        // 2. Import and call MetricsService for all growth metrics
        const MetricsService = require('./metricsService');
        const metrics = await MetricsService.getMetrics(periodStart, now);
        
        const novosPagantes = metrics.novosCount;
        
        // 3. CAC & Payback (Conservative / Not fully attributed yet)
        const cac = null; // N/D
        const cacDemanda = null; // N/D
        const marketingNaoAtribuido = totalMarketingSpend;
        let payback = metrics.cacPaybackMonths;

        // 4. LTV, MRR, ARPU & Churn
        const mrrTotal = metrics.mrrTotal;
        const arpu = metrics.arpu;
        const churnRate = metrics.churnRateMedioMensal / 100;
        const weightedChurnRate = metrics.weightedChurnRate / 100;
        const paidChurnCount = metrics.paidChurnCount;
        const trialChurnCount = metrics.trialChurnCount;
        const ltvObservado = metrics.ltvObservado;
        const ltvProjetado = metrics.ltvProjetado;
        const sampleData = metrics.sampleData;

        // Flags de confiabilidade
        const hasMarketingSpend = totalMarketingSpend > 0;
        const amostraSuficienteLTV = sampleData && sampleData.somaBaseInicial > 30; // Min exposure threshold

        return {
            totalMarketingSpend,
            marketingNaoAtribuido,
            spendByChannel,
            novosPagantes,
            cac,
            cacDemanda,
            mrrTotal,
            arpu,
            churnRate,
            weightedChurnRate,
            paidChurnCount,
            trialChurnCount,
            ltvObservado,
            ltvProjetado,
            payback,
            hasMarketingSpend,
            amostraSuficienteLTV,
            sampleData
        };
    }
}

module.exports = new GrowthMarketingService();
