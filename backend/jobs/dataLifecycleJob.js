const cron = require('node-cron');
const db = require('../models');
const { Op } = require('sequelize');

async function cleanUpData() {
    console.log('[DataLifecycle] Iniciando varredura de expurgo de dados LGPD/CFP...');
    try {
        // 1. Limpeza de DemandSearches (Lixo Tóxico > 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const deletedDemands = await db.DemandSearch.destroy({
            where: {
                createdAt: { [Op.lt]: thirtyDaysAgo }
            },
            force: true // Hard Delete
        });
        console.log(`[DataLifecycle] Expurgo: ${deletedDemands} registros de DemandSearch antigos (anônimos) deletados.`);

        // 2. Limpeza de Pacientes Expirados (Prontuários e Soft Deletados há > 5 anos)
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

        const expiredPatients = await db.Patient.findAll({
            where: {
                deletedAt: {
                    [Op.ne]: null, // Apenas os que estão na lixeira (Soft Deleted)
                    [Op.lt]: fiveYearsAgo // Deletados há mais de 5 anos
                }
            },
            paranoid: false // Permite buscar os soft-deleted
        });

        let deletedPatientsCount = 0;
        for (const patient of expiredPatients) {
            // Executa Hard Delete final
            await patient.destroy({ force: true });
            deletedPatientsCount++;
        }

        console.log(`[DataLifecycle] Expurgo: ${deletedPatientsCount} pacientes inativos (prazo CFP > 5 anos) deletados definitivamente.`);
    } catch (error) {
        console.error('[DataLifecycle] Erro na varredura de expurgo de dados:', error);
    }
}

// Inicializa o CRON - Roda todos os dias às 03:00 da manhã
function initDataLifecycleJob() {
    cron.schedule('0 3 * * *', () => {
        cleanUpData();
    });
    console.log('[DataLifecycle] Reaper Job agendado para as 03:00 AM diariamente.');
}

module.exports = { cleanUpData, initDataLifecycleJob };
