require('dotenv').config();
const db = require('./backend/models');
const MetricsService = require('./backend/services/metricsService');
const { Op } = require('sequelize');

async function run() {
    try {
        const startDate = undefined;
        const endDate = undefined;

        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const activePsychologists = await db.Psychologist.findAll({
            where: { plano: { [Op.ne]: null }, status: 'active' },
            attributes: ['id', 'nome', 'plano', 'updatedAt', 'is_exempt', 'planExpiresAt', 'subscriptionId', 'createdAt', 'subscription_payments_count'],
            paranoid: false
        });

        let start, end, prevStart, prevEnd;
        end = new Date();
        start = new Date(new Date().setDate(end.getDate() - 30));
        const sixtyDaysAgo = new Date(new Date().setDate(end.getDate() - 60));
        prevStart = sixtyDaysAgo;
        prevEnd = new Date(start.getTime() - 1);

        const metrics = await MetricsService.getMetrics(start, end);
        const prevMetrics = await MetricsService.getMetrics(prevStart, prevEnd);
        
        console.log("=== KPI METRICS ===");
        console.log("MRR:", metrics.mrrTotal, "Prev:", prevMetrics.mrrTotal);
        console.log("Paid Churn Rate:", metrics.weightedChurnRate, "Prev:", prevMetrics.weightedChurnRate);
        console.log("Trial Churn Count:", metrics.trialChurnCount, "Prev:", prevMetrics.trialChurnCount);
        console.log("Paid Churn Count:", metrics.paidChurnCount, "Prev:", prevMetrics.paidChurnCount);
        console.log("Inadimplentes Count:", metrics.inadimplentesCount, "Prev:", prevMetrics.inadimplentesCount);
        console.log("LTV Projetado:", metrics.ltvProjetado);
        console.log("LTV Observado:", metrics.ltvObservado);
        console.log("Ticket Medio (ARPU):", metrics.arpu);

        let activePlans = activePsychologists.map(psy => {
            const hasSub = !!psy.subscriptionId || (psy.subscription_payments_count && psy.subscription_payments_count > 0);
            const planKey = (psy.plano || '').toLowerCase();
            return {
                psychologistName: psy.nome,
                planName: psy.is_exempt ? `${psy.plano} (VIP)` : (!hasSub ? `${psy.plano} (Trial)` : psy.plano),
                mrr: (psy.is_exempt || !hasSub) ? 0 : (planPrices[planKey] || 0),
                nextBilling: psy.is_exempt ? null : (psy.planExpiresAt ? new Date(psy.planExpiresAt) : new Date(new Date(psy.updatedAt).setMonth(new Date(psy.updatedAt).getMonth() + 1))) 
            };
        });
        
        activePlans.sort((a,b) => {
            if(!a.nextBilling) return 1; if(!b.nextBilling) return -1;
            return a.nextBilling.getTime() - b.nextBilling.getTime();
        });

        console.log("\n=== PRÓXIMOS PAGAMENTOS (Active Plans) ===");
        console.log(activePlans.slice(0, 10).map(p => `${p.psychologistName} - ${p.planName} - ${p.nextBilling}`));
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
run();
