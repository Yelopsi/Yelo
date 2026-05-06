// backend/cron/invitationManager.js

const { Op } = require('sequelize');
const db = require('../models');

/**
 * Verifica convites expirados e atualiza o status.
 * Isso libera a vaga para o próximo ciclo do demandMonitor.
 */
async function manageExpiredInvitations() {
    console.log('CRON: Iniciando verificação de convites expirados...');

    const expiredCount = await db.WaitingList.update(
        { status: 'expired' },
        {
            where: {
                status: 'invited',
                invitationExpiresAt: {
                    [Op.lt]: new Date() // Menor que a data/hora atual
                }
            }
        }
    );

    if (expiredCount[0] > 0) {
        console.log(`CRON: ${expiredCount[0]} convite(s) expirado(s) foram atualizados.`);
    }
    console.log('CRON: Verificação de convites expirados finalizada.');
}

// Exporta a função para que possa ser chamada pelo agendador
module.exports = { manageExpiredInvitations };