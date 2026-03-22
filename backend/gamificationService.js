// backend/services/gamificationService.js

const db = require('../models');
const { Op } = require('sequelize');

const PIONEER_BADGE_LIMIT = 100;
const PIONEER_PLATFORM_LIMIT = 500;

/**
 * Tenta atribuir a badge 'Pioneiro' a um psicólogo.
 * Esta função deve ser chamada quando um psicólogo se torna ativo (ex: primeiro pagamento confirmado ou marcado como VIP).
 * @param {number} psychologistId O ID do psicólogo a ser verificado.
 */
async function assignPioneerBadge(psychologistId) {
    // Usa uma transação para evitar condições de corrida ao contar e atribuir badges.
    const transaction = await db.sequelize.transaction();

    try {
        // 1. Verifica se o programa "Pioneiro" ainda está ativo (limite de 500 psicólogos na plataforma)
        const totalPsychologists = await db.Psychologist.count({ transaction });
        if (totalPsychologists > PIONEER_PLATFORM_LIMIT) {
            console.log(`[GAMIFICATION] Programa Pioneiro encerrado. Total de psicólogos (${totalPsychologists}) excede o limite de ${PIONEER_PLATFORM_LIMIT}.`);
            await transaction.commit();
            return;
        }

        // 2. Conta quantos pioneiros já existem
        const pioneerCount = await db.Psychologist.count({
            where: {
                'badges.pioneiro': true
            },
            transaction
        });

        if (pioneerCount >= PIONEER_BADGE_LIMIT) {
            console.log(`[GAMIFICATION] Limite de ${PIONEER_BADGE_LIMIT} badges 'Pioneiro' atingido.`);
            await transaction.commit();
            return;
        }

        // 3. Busca o psicólogo e verifica sua elegibilidade
        const psychologist = await db.Psychologist.findByPk(psychologistId, { transaction });

        if (!psychologist) {
            console.log(`[GAMIFICATION] Psicólogo com ID ${psychologistId} não encontrado.`);
            await transaction.commit();
            return;
        }

        // Verifica se ele já possui a badge
        if (psychologist.badges && psychologist.badges.pioneiro) {
            await transaction.commit();
            return; // Já é um pioneiro
        }

        // Verifica se é elegível (ativo e assinante/VIP)
        const isEligible = psychologist.status === 'active' &&
                           (psychologist.is_exempt === true || (psychologist.planExpiresAt && new Date(psychologist.planExpiresAt) > new Date()));

        if (!isEligible) {
            console.log(`[GAMIFICATION] Psicólogo ${psychologist.email} não é elegível para a badge (não é assinante ativo ou VIP).`);
            await transaction.commit();
            return;
        }

        // 4. Atribui a badge
        const currentBadges = psychologist.badges || {};
        const newBadges = { ...currentBadges, pioneiro: true };

        await psychologist.update({
            badges: newBadges
        }, { transaction });

        console.log(`[GAMIFICATION] 🏆 Badge 'Pioneiro' atribuída a ${psychologist.email}. Total: ${pioneerCount + 1}/${PIONEER_BADGE_LIMIT}.`);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        console.error(`[GAMIFICATION] Erro ao atribuir badge 'Pioneiro' para o ID ${psychologistId}:`, error);
    }
}

module.exports = {
    assignPioneerBadge,
    // Mantém a função existente para não quebrar outras partes do sistema
    processAction: async (psychologistId, actionType) => { return; }
};