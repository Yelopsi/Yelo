const { Op } = require('sequelize');
const db = require('../models');

/**
 * Privacy Pruning Job (Fase 6)
 * Realiza o Hard Delete de dados de Analytics e Logs expirados,
 * garantindo o princípio da minimização da LGPD.
 * 
 * @param {Object} options 
 * @param {boolean} options.dryRun - Se true, não apaga, apenas audita.
 */
async function runPrivacyPruning({ dryRun = false } = {}) {
    const results = {
        systemLogsDeleted: 0,
        expiredTokensCleared: 0,
        dryRun
    };

    console.log(`\n🛡️ [LGPD PRUNING] Iniciando Job de Minimização (DryRun: ${dryRun})`);

    try {
        // 1. Logs de Sistema (> 180 dias, confome Art. 15 MCI)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 180);

        if (db.SystemLog) {
            const logsToDelete = await db.SystemLog.count({
                where: { createdAt: { [Op.lt]: cutoffDate } }
            });

            if (!dryRun && logsToDelete > 0) {
                await db.SystemLog.destroy({
                    where: { createdAt: { [Op.lt]: cutoffDate } }
                });
            }
            results.systemLogsDeleted = logsToDelete;
            console.log(`   - SystemLog: ${logsToDelete} registros > 180 dias identificados.`);
        }

        // 2. Tokens Expirados (Patient)
        if (db.Patient) {
            // resetPasswordExpires is a BIGINT (Date.now())
            const nowMs = Date.now();
            const expiredPatients = await db.Patient.count({
                where: { 
                    resetPasswordExpires: { [Op.lt]: nowMs },
                    resetPasswordToken: { [Op.not]: null }
                }
            });

            if (!dryRun && expiredPatients > 0) {
                await db.Patient.update(
                    { resetPasswordToken: null, resetPasswordExpires: null },
                    { where: { resetPasswordExpires: { [Op.lt]: nowMs } } }
                );
            }
            results.expiredTokensCleared += expiredPatients;
            console.log(`   - Patient Tokens: ${expiredPatients} expurgados.`);
        }

        console.log(`✅ [LGPD PRUNING] Concluído com Sucesso.`);
        return results;

    } catch (err) {
        console.error(`❌ [LGPD PRUNING] Erro Crítico: `, err);
        throw new Error('Falha no Pruning de Privacidade');
    }
}

module.exports = { runPrivacyPruning };

if (require.main === module) {
    const isDryRun = process.argv.includes('--dry-run');
    runPrivacyPruning({ dryRun: isDryRun })
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}
