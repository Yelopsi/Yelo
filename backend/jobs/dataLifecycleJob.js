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

async function expirePsychologists() {
    console.log('[DataLifecycle] Verificando planos expirados (Lazy Evaluation Fallback)...');
    try {
        const now = new Date();
        const [updatedCount] = await db.Psychologist.update(
            { status: 'inactive' },
            {
                where: {
                    status: 'active',
                    is_exempt: { [Op.ne]: true },
                    planExpiresAt: { [Op.lte]: now }
                }
            }
        );
        if (updatedCount > 0) {
            console.log(`[DataLifecycle] ⏰ ${updatedCount} psicólogos tiveram os planos expirados e foram inativados.`);
        }
    } catch (error) {
        console.error('[DataLifecycle] Erro ao expirar psicólogos:', error);
    }
}

// Inicializa o CRON - Roda todos os dias às 03:00 da manhã
function initDataLifecycleJob() {
    cron.schedule('0 3 * * *', () => {
        cleanUpData();
    });
    
    // Roda de hora em hora no minuto 0 para derrubar quem venceu (Substitui Lazy Evaluation)
    cron.schedule('0 * * * *', () => {
        expirePsychologists();
    });
    
    console.log('[DataLifecycle] Reaper Job agendado para as 03:00 AM (Expurgo) e de hora em hora (Expiração).');
}

module.exports = { cleanUpData, initDataLifecycleJob };
