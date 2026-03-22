// backend/services/gamificationService.js

const db = require('../models');
const { Op, Sequelize } = require('sequelize');

const PIONEER_BADGE_LIMIT = 100;
const PIONEER_PLATFORM_LIMIT = 500;

// --- TABELA DE PONTUAÇÃO ---
const SCORING_RULES = {
    'profile_complete': { points: 500, limit: 1, type: 'unique' }, // Único
    'forum_post':       { points: 25,  limit: 2, type: 'daily' },  // Criar post no fórum
    'blog_post':        { points: 50,  limit: 1, type: 'daily' },  // 1x por dia
    'forum_reply':      { points: 20,  limit: 5, type: 'daily' },  // 5x por dia
    'whatsapp_click':   { points: 10,  limit: 0, type: 'unlimited' },
    'receive_like':     { points: 5,   limit: 0, type: 'unlimited' },
    'login':            { points: 1,   limit: 1, type: 'daily' }
};

// --- RÉGUA DE EVOLUÇÃO ---
const LEVELS = [
    { slug: 'nivel_iniciante',    min: 0,      label: 'Membro Iniciante' },
    { slug: 'nivel_verificado',   min: 500,    label: 'Psicólogo Verificado' },
    { slug: 'nivel_ativo',        min: 1500,   label: 'Perfil Ativo' },
    { slug: 'nivel_especialista', min: 5000,   label: 'Especialista Yelo' },
    { slug: 'nivel_mentor',       min: 15000,  label: 'Mentor / Top Voice' }
];

// --- Helper para saber quanto falta para o próximo nível ---
const getNextLevelXP = (currentXP) => { const next = LEVELS.find(l => l.min > currentXP); return next ? next.min : currentXP; };

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

/**
 * Calcula e atualiza as badges de um psicólogo com base em suas conquistas.
 * @param {number} psychologistId O ID do psicólogo.
 */
async function calculateBadges(psychologistId) {
    try {
        const psi = await db.Psychologist.findByPk(psychologistId);
        if (!psi) return;

        let badges = psi.badges ? JSON.parse(JSON.stringify(psi.badges)) : {};
        badges.progress = badges.progress || {};

        // 1. 🌱 SEMEADOR (Blog)
        const postCount = await db.Post.count({ where: { psychologist_id: psychologistId } });
        if (postCount >= 15) {
            badges.semeador = 'ouro';
        } else if (postCount >= 5) {
            badges.semeador = 'prata';
        } else if (postCount >= 1) {
            badges.semeador = 'bronze';
        } else {
            delete badges.semeador;
        }

        // 2. 💬 VOZ ATIVA (Comunidade)
        const commentCount = await db.ForumComment.count({ where: { PsychologistId: psychologistId } });
        if (commentCount >= 200) {
            badges.voz_ativa = 'ouro';
        } else if (commentCount >= 50) {
            badges.voz_ativa = 'prata';
        } else if (commentCount >= 10) {
            badges.voz_ativa = 'bronze';
        } else {
            delete badges.voz_ativa;
        }

        // 3. 🛡️ AUTÊNTICO (Segurança) - Usa os critérios mais recentes
        const requiredFields = ['nome', 'bio', 'crp', 'telefone', 'cep', 'cidade', 'estado', 'fotoUrl', 'valor_sessao_numero', 'genero_identidade'];
        const requiredArrays = ['temas_atuacao', 'abordagens_tecnicas', 'modalidade', 'disponibilidade_periodo'];
        
        const isComplete = requiredFields.every(field => psi[field] != null && String(psi[field]).trim() !== '') &&
                           requiredArrays.every(field => Array.isArray(psi[field]) && psi[field].length > 0);

        if (isComplete) {
            badges.autentico = true;
        } else {
            delete badges.autentico;
        }

        // A badge 'Pioneiro' é atribuída separadamente pela função `assignPioneerBadge`.

        await psi.update({ badges });
        return badges;
    } catch (error) {
        console.error("Erro em calculateBadges:", error);
    }
}

/**
 * Processa uma ação de gamificação, atribui pontos e atualiza o nível do psicólogo.
 * @param {number} psychologistId O ID do psicólogo.
 * @param {string} actionType O tipo de ação (ex: 'login', 'blog_post').
 */
async function processAction(psychologistId, actionType) {
    try {
        const rule = SCORING_RULES[actionType];
        if (!rule) return null;

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

        // 1. VERIFICAÇÃO DE LIMITES
        if (rule.limit > 0) {
            const where = { psychologistId, actionType };
            if (rule.type === 'daily') {
                where.createdAt = { [Op.between]: [startOfDay, endOfDay] };
            }
            const count = await db.GamificationLog.count({ where });
            if (count >= rule.limit) return null;
        }
        
        // 2. REGISTRA A PONTUAÇÃO E ATUALIZA O XP
        await db.GamificationLog.create({ psychologistId, actionType, points: rule.points });
        const psi = await db.Psychologist.findByPk(psychologistId);
        const newXP = (psi.xp || 0) + rule.points;
        
        // 3. ATUALIZA NÍVEL
        let newLevel = psi.authority_level;
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (newXP >= LEVELS[i].min) {
                newLevel = LEVELS[i].slug;
                break;
            }
        }

        await psi.update({ xp: newXP, authority_level: newLevel });
        await calculateBadges(psychologistId);

        return { xp: newXP, level: newLevel, pointsEarned: rule.points };
    } catch (error) {
        console.error(`Erro gamification (${actionType}):`, error);
        return null;
    }
}

/**
 * Verifica se o perfil está 100% completo e atribui a badge 'Autêntico' e os pontos.
 * @param {number} psychologistId O ID do psicólogo.
 */
async function checkProfileCompletion(psychologistId) {
    await calculateBadges(psychologistId); // A lógica de verificação já está em calculateBadges
    const psi = await db.Psychologist.findByPk(psychologistId, { attributes: ['badges'] });
    if (psi && psi.badges && psi.badges.autentico) {
        // Atribui os pontos de perfil completo (a função processAction já valida se é a primeira vez)
        await processAction(psychologistId, 'profile_complete');
    }
}

module.exports = {
    assignPioneerBadge,
    processAction,
    calculateBadges,
    checkProfileCompletion
};