const { Op } = require('sequelize');
const db = require('../models');

class GrowthMarketingService {
    async getUnitEconomics(periodDays = 30) {
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. Calcular Despesas Pro-Rata
        let totalMarketingSpend = 0;
        const spendByChannel = {
            'Google Ads': 0,
            'Meta Ads': 0,
            'Outros': 0
        };

        // Encontrar os meses envolvidos
        const monthsInvolved = new Set();
        for (let d = new Date(periodStart); d <= now; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            monthsInvolved.add(`${year}-${month}`);
        }

        const expenses = await db.YeloExpense.findAll({
            where: { monthYear: { [Op.in]: Array.from(monthsInvolved) } }
        });

        // Agrupa por mês para cálculo
        const expenseMap = {};
        for (const exp of expenses) {
            if (!expenseMap[exp.monthYear]) expenseMap[exp.monthYear] = [];
            expenseMap[exp.monthYear].push(exp);
        }

        // Soma rateada por dia
        for (let d = new Date(periodStart); d <= now; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const key = `${year}-${month}`;
            const daysInMonth = new Date(year, d.getMonth() + 1, 0).getDate();

            if (expenseMap[key]) {
                for (const exp of expenseMap[key]) {
                    const dailyAmount = (Number(exp.amount) || 0) / daysInMonth;
                    totalMarketingSpend += dailyAmount;

                    if (exp.category && exp.category.includes('Google')) {
                        spendByChannel['Google Ads'] += dailyAmount;
                    } else if (exp.category && exp.category.includes('Meta') || exp.category && exp.category.includes('Facebook')) {
                        spendByChannel['Meta Ads'] += dailyAmount;
                    } else {
                        spendByChannel['Outros'] += dailyAmount;
                    }
                }
            }
        }

        // 2. Import and call MetricsService for all growth metrics
        const MetricsService = require('./metricsService');
        const metrics = await MetricsService.getMetrics(periodStart, now);
        
        const novosPagantes = metrics.novosCount;
        
        // 3. CAC & Payback (Conservative / Not fully attributed yet)
        const cac = null; // N/D
        const cacDemanda = null; // N/D
        const marketingNaoAtribuido = spendByChannel['Outros'] || 0;
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
