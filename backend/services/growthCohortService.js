const { Op } = require('sequelize');
const db = require('../models');

class GrowthCohortService {
    async getRetentionCohorts(monthsBack = 6) {
        const cohorts = [];
        const now = new Date();
        
        for (let i = 0; i < monthsBack; i++) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            
            // Quantos psicólogos criaram a conta (iniciaram trial) neste mês
            const usuariosCohort = await db.Psychologist.findAll({
                where: {
                    createdAt: { [Op.gte]: startOfMonth, [Op.lte]: endOfMonth },
                    is_exempt: { [Op.or]: [false, null] }
                },
                attributes: ['id', 'status', 'cancelAtPeriodEnd', 'planExpiresAt', 'updatedAt']
            });

            const cohortSize = usuariosCohort.length;
            const retention = { M0: 100, M1: null, M2: null, M3: null, M4: null, M5: null };
            
            if (cohortSize > 0) {
                // Simplificação heurística para M1 a M5 baseada no estado atual
                // O ideal é ter snapshots ou event logs. Na falta deles, se o usuário está ativo, ele foi retido.
                // Se ele está inativo, a gente estima o mês do cancelamento pelo updatedAt ou planExpiresAt.
                const cancelMonths = usuariosCohort.map(u => {
                    if (u.status === 'active' && (!u.cancelAtPeriodEnd || new Date(u.planExpiresAt) > now)) {
                        return 999; // Continua ativo
                    }
                    const exitDate = u.planExpiresAt ? new Date(u.planExpiresAt) : new Date(u.updatedAt);
                    const monthsDiff = (exitDate.getFullYear() - startOfMonth.getFullYear()) * 12 + (exitDate.getMonth() - startOfMonth.getMonth());
                    return monthsDiff >= 0 ? monthsDiff : 0;
                });

                for (let m = 1; m <= 5; m++) {
                    if (i < m) break; // Mês futuro
                    const retidos = cancelMonths.filter(cm => cm >= m).length;
                    retention[`M${m}`] = Math.round((retidos / cohortSize) * 100);
                }
            }

            cohorts.push({
                month: startOfMonth.toLocaleString('pt-BR', { month: 'short', year: 'numeric' }),
                cohortSize,
                retention
            });
        }

        return cohorts.reverse();
    }
}

module.exports = new GrowthCohortService();
