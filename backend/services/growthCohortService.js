const { Op } = require('sequelize');
const db = require('../models');

class GrowthCohortService {
    async getRetentionCohorts(monthsBack = 6) {
        const cohorts = [];
        const now = new Date();
        
        for (let i = 0; i < monthsBack; i++) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            
            // 1. COHORT DE AQUISIÇÃO (Trials)
            const usuariosTrials = await db.Psychologist.findAll({
                where: {
                    createdAt: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
                    is_exempt: { [Op.or]: [false, null] }
                },
                attributes: ['id', 'status', 'stripeSubscriptionId', 'subscriptionId']
            });

            const trialCohortSize = usuariosTrials.length;
            let trialsConvertidos = 0;
            
            usuariosTrials.forEach(u => {
                if (u.stripeSubscriptionId || u.subscriptionId) {
                    trialsConvertidos++;
                }
            });
            const trialConvRate = trialCohortSize > 0 ? Math.round((trialsConvertidos / trialCohortSize) * 100) : 0;

            // 2. COHORT DE RETENÇÃO (Pagantes)
            // Aqui deveríamos usar a data em que o psicólogo ASSINOU (virou pagante). 
            // Na falta de um event log puro no sistema legado, usamos a data de criação filtrando quem É pagante.
            // Para maior fidelidade, pegamos apenas os pagantes que foram adquiridos nesse mês.
            const pagantesCohortSize = trialsConvertidos;
            const retention = { M0: 100, M1: null, M2: null, M3: null, M4: null, M5: null };
            
            if (pagantesCohortSize > 0) {
                const pagantes = usuariosTrials.filter(u => u.stripeSubscriptionId || u.subscriptionId);
                
                const cancelMonths = pagantes.map(u => {
                    if (u.status === 'active') return 999;
                    const exitDate = new Date(u.updatedAt);
                    const monthsDiff = (exitDate.getFullYear() - startOfMonth.getFullYear()) * 12 + (exitDate.getMonth() - startOfMonth.getMonth());
                    return monthsDiff >= 0 ? monthsDiff : 0;
                });

                for (let m = 1; m <= 5; m++) {
                    if (i < m) break; // Mês futuro
                    const retidos = cancelMonths.filter(cm => cm >= m).length;
                    retention[`M${m}`] = Math.round((retidos / pagantesCohortSize) * 100);
                }
            }

            cohorts.push({
                month: startOfMonth.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
                acquisition: {
                    size: trialCohortSize,
                    converted: trialsConvertidos,
                    conversionRate: trialConvRate
                },
                retention: {
                    size: pagantesCohortSize,
                    ...retention
                }
            });
        }

        return cohorts.reverse();
    }
}

module.exports = new GrowthCohortService();
