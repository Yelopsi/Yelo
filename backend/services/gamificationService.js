const db = require('../models');
const { Op } = require('sequelize');

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

// --- FUNÇÃO DE CÁLCULO DE BADGES ---
exports.calculateBadges = async (psychologistId) => {
    try {
        const psi = await db.Psychologist.findByPk(psychologistId);
        if (!psi) return;

        let badges = psi.badges || {};
        // Limpa o progresso antigo para recalcular
        badges.progress = badges.progress || {};

        // 1. 🌱 SEMEADOR (Blog)
        const postCount = await db.Post.count({ where: { psychologist_id: psychologistId } });
        if (postCount >= 15) {
            badges.semeador = 'ouro';
            badges.semeador_progress = { current: postCount, next: 15, tier: 'max' };
        } else if (postCount >= 5) {
            badges.semeador = 'prata';
            badges.semeador_progress = { current: postCount, next: 15, tier: 'ouro' };
        } else if (postCount >= 1) {
            badges.semeador = 'bronze';
            badges.semeador_progress = { current: postCount, next: 5, tier: 'prata' };
        } else {
            delete badges.semeador;
            badges.semeador_progress = { current: 0, next: 1, tier: 'bronze' };
        }

        // 2. 💬 VOZ ATIVA (Comunidade)
        const commentCount = await db.ForumComment.count({ where: { PsychologistId: psychologistId } });
        if (commentCount >= 200) {
            badges.voz_ativa = 'ouro';
            badges.voz_ativa_progress = { current: commentCount, next: 200, tier: 'max' };
        } else if (commentCount >= 50) {
            badges.voz_ativa = 'prata';
            badges.voz_ativa_progress = { current: commentCount, next: 200, tier: 'ouro' };
        } else if (commentCount >= 10) {
            badges.voz_ativa = 'bronze';
            badges.voz_ativa_progress = { current: commentCount, next: 50, tier: 'prata' };
        } else {
            delete badges.voz_ativa;
            badges.voz_ativa_progress = { current: commentCount, next: 10, tier: 'bronze' };
        }

        // 3. 🛡️ AUTÊNTICO (Segurança)
        const isProfileComplete = psi.bio && psi.fotoUrl &&
                                  psi.temas_atuacao && psi.temas_atuacao.length > 0 &&
                                  psi.abordagens_tecnicas && psi.abordagens_tecnicas.length > 0 &&
                                  psi.crp;
        if (isProfileComplete) badges.autentico = true;
        else delete badges.autentico;

        // 4. 🏅 PIONEIRO (Legado)
        const launchDate = new Date('2024-01-01');
        const cutoffDate = new Date(launchDate);
        cutoffDate.setMonth(cutoffDate.getMonth() + 6);
        if (psi.id <= 100 || psi.createdAt < cutoffDate) {
            badges.pioneiro = true;
        }

        await psi.update({ badges });
        return badges;
    } catch (error) {
        console.error("Erro em calculateBadges:", error);
    }
};

exports.processAction = async (psychologistId, actionType) => {
    try {
        const rule = SCORING_RULES[actionType];
        if (!rule) return null;

        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const endOfDay = new Date(now.setHours(23, 59, 59, 999));

        // 1. VERIFICAÇÃO DE LIMITES
        if (rule.type === 'unique') {
            // Verifica se já ganhou alguma vez na vida
            const exists = await db.GamificationLog.findOne({
                where: { psychologistId, actionType }
            });
            if (exists) return null; // Já ganhou, ignora
        } 
        else if (rule.type === 'daily') {
            // Conta quantos ganhou hoje
            const countToday = await db.GamificationLog.count({
                where: {
                    psychologistId,
                    actionType,
                    createdAt: { [Op.between]: [startOfDay, endOfDay] }
                }
            });
            if (countToday >= rule.limit) return null; // Atingiu limite diário
        }
        
        // 2. REGISTRA A PONTUAÇÃO
        await db.GamificationLog.create({
            psychologistId,
            actionType,
            points: rule.points
        });

        // 3. ATUALIZA O PSICÓLOGO (XP e Nível)
        const psi = await db.Psychologist.findByPk(psychologistId);
        const newXP = (psi.xp || 0) + rule.points;
        
        // Calcula novo nível baseado no XP total
        let newLevel = psi.authority_level;
        // Encontra o maior nível possível para o XP atual
        for (let i = LEVELS.length - 1; i >= 0; i--) {
            if (newXP >= LEVELS[i].min) {
                newLevel = LEVELS[i].slug;
                break;
            }
        }

        // Atualiza Badges (Mantendo a lógica visual de badges)
        let badges = psi.badges || {};
        badges.progress = {
            ...badges.progress,
            xp: newXP,
            nextLevelXP: getNextLevelXP(newXP)
        };

        await psi.update({ 
            xp: newXP, 
            authority_level: newLevel,
            badges: badges
        });

        // Recalcula as badges baseadas em contagem (posts, comentários)
        await exports.calculateBadges(psychologistId);

        return { xp: newXP, level: newLevel, pointsEarned: rule.points };

    } catch (error) {
        console.error(`Erro gamification (${actionType}):`, error);
        return null;
    }
};

// Função auxiliar para checar perfil completo (Chamada ao salvar perfil)
exports.checkProfileCompletion = async (psychologistId) => {
    try {
        const psi = await db.Psychologist.findByPk(psychologistId);
        // Critérios de 100%
        const isComplete = psi.nome && psi.crp && psi.bio && psi.fotoUrl && 
                           psi.temas_atuacao && psi.temas_atuacao.length > 0 &&
                           psi.abordagens_tecnicas && psi.abordagens_tecnicas.length > 0 &&
                           psi.valor_sessao_numero;

        if (isComplete) {
            // Tenta atribuir os 500 pontos (a função processAction já valida se é único)
            await exports.processAction(psychologistId, 'profile_complete');
        }
        
        // Verifica a badge "Autêntico" independentemente dos pontos
        await exports.calculateBadges(psychologistId);
    } catch (e) { console.error("Erro checkProfile:", e); }
};

// Helper para saber quanto falta para o próximo nível
function getNextLevelXP(currentXP) {
    const next = LEVELS.find(l => l.min > currentXP);
    return next ? next.min : currentXP; // Se for max, retorna o próprio
}