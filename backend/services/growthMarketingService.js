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

        // 2. CAC (Customer Acquisition Cost)
        // Precisamos dos novos pagantes no período
        const novosPagantes = await db.Psychologist.count({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { stripeSubscriptionId: { [Op.not]: null } },
                    { subscriptionId: { [Op.not]: null } }
                ],
                updatedAt: { [Op.gte]: periodStart }
            }
        });

        const cac = novosPagantes > 0 ? totalMarketingSpend / novosPagantes : 0;

        // 3. ARPU (Average Revenue Per User) e MRR Atual
        const activeFilter = {
            status: 'active',
            is_exempt: { [Op.or]: [false, null] }
        };

        const pagantesAtivos = await db.Psychologist.findAll({
            where: {
                ...activeFilter,
                [Op.or]: [
                    { stripeSubscriptionId: { [Op.not]: null } },
                    { subscriptionId: { [Op.not]: null } }
                ]
            },
            attributes: ['id', 'valor_mensal_numero', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd']
        });

        let settings = {};
        try {
            settings = await db.SystemSetting.findOne() || {};
        } catch(e) {
            console.warn('⚠️ SystemSetting findOne failed, using default prices');
        }
        const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
        const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
        const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;

        let mrrTotal = 0;
        let activeCount = 0;
        for (const p of pagantesAtivos) {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) continue;
            activeCount++;
            if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') mrrTotal += Number(priceEssencial);
            else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') mrrTotal += Number(priceClinico);
            else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') mrrTotal += Number(priceReference);
        }

        const arpu = activeCount > 0 ? mrrTotal / activeCount : 0;

        // 4. LTV (Lifetime Value)
        // Churn = Cancelamentos / Ativos no início
        const churnCount = await db.Psychologist.count({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { status: 'inactive', updatedAt: { [Op.gte]: periodStart } },
                    { cancelAtPeriodEnd: true, planExpiresAt: { [Op.gte]: periodStart, [Op.lte]: now } }
                ]
            }
        });

        // Aproximação do Churn Rate mensal
        // Consideraremos o período como se fosse mensal para simplificar a taxa, ou normalizaremos
        let churnRate = 0;
        if (activeCount > 0) {
            churnRate = churnCount / (activeCount + churnCount); // Base simplificada
        }

        let ltv = 0;
        if (churnRate > 0) {
            ltv = arpu / churnRate;
        }

        // 5. Payback (Meses para recuperar CAC)
        const payback = arpu > 0 ? cac / arpu : 0;

        return {
            totalMarketingSpend,
            spendByChannel,
            novosPagantes,
            cac,
            mrrTotal,
            arpu,
            churnRate,
            ltv,
            payback,
            periodDays,
            amostraSuficienteLTV: churnCount >= 3 && activeCount >= 10 // Flag para o frontend exibir alerta de baixa confiança
        };
    }
}

module.exports = new GrowthMarketingService();
