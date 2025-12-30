// Arquivo: backend/routes/psychologistRoutes.js (VERSÃO FINAL CORRIGIDA)

const express = require('express');
const db = require('../models'); // Adicionado para acesso ao banco
const { Op } = require('sequelize'); // Adicionado para queries complexas
const router = express.Router();
const psychologistController = require('../controllers/psychologistController');
const { protect } = require('../middleware/authMiddleware');
const { uploadProfilePhoto, uploadCrpDocument } = require('../middleware/upload');

// ===============================================
// ROTAS PÚBLICAS (Não exigem login)
// ===============================================
router.post('/register', psychologistController.registerPsychologist);
router.post('/login', psychologistController.loginPsychologist);
router.post('/check-demand', psychologistController.checkDemand);
router.post('/add-to-waitlist', psychologistController.addToWaitlist);
router.get('/showcase', psychologistController.getShowcasePsychologists);
router.get('/slug/:slug', psychologistController.getProfileBySlug);
router.post('/match', psychologistController.getAnonymousMatches); 
router.get('/:id/reviews', psychologistController.getPsychologistReviews);

// Rota para SOLICITAR o envio do e-mail de redefinição (PÚBLICA)
router.post('/forgot-password', psychologistController.requestPasswordReset);

// Rota para o usuário ENVIAR a nova senha com o token (PÚBLICA)
router.post('/reset-password/:token', psychologistController.resetPassword); 

// ===============================================
// ROTAS PROTEGIDAS (Exigem login)
// ===============================================
// O middleware 'protect' é aplicado a TODAS as rotas abaixo desta linha
router.use(protect); 

// Rotas "ME" (do usuário logado)
router.get('/me', psychologistController.getAuthenticatedPsychologistProfile);
router.put('/me', psychologistController.updatePsychologistProfile);

// ROTA DE ESTATÍSTICAS REAIS (KPIs)
router.get('/me/stats', async (req, res) => {
    try {
        // Verificação de segurança extra
        if (!req.user) {
            console.error("[KPI Error] Usuário não autenticado na rota de stats.");
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const psychologistId = req.user.id;
        const { period = 'last30days' } = req.query;

        let dateFilter = {};
        let startDate, endDate;
        let rawDateQuery = ""; // Query string para SQL puro
        const replacements = { psychologistId };

        if (period !== 'allTime') {
            const now = new Date();
            
            if (period === 'last30days') {
                startDate = new Date();
                startDate.setDate(now.getDate() - 30);
                endDate = now;
            } else if (period === 'thisMonth') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = now;
            } else if (period === 'lastMonth') {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                // Define o fim como o último momento do último dia do mês anterior
                endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            }
            
            if (startDate && endDate) {
                dateFilter = { createdAt: { [Op.between]: [startDate, endDate] } };
                rawDateQuery = 'AND "createdAt" BETWEEN :startDate AND :endDate';
                replacements.startDate = startDate;
                replacements.endDate = endDate;
            }
        }

        // --- OTIMIZAÇÃO DE KPIs: Executa contagens em uma única query paralela ---
        let kpiCounts = { whatsappClicks: 0, profileAppearances: 0, favoritesCount: 0 };
        try {
            const kpiQuery = `
                SELECT
                    (SELECT COUNT(*) FROM "WhatsappClickLogs" WHERE "psychologistId" = :psychologistId ${rawDateQuery}) as "whatsappClicks",
                    (SELECT COUNT(*) FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :psychologistId ${rawDateQuery}) as "profileAppearances",
                    (SELECT COUNT(*) FROM "PatientFavorites" WHERE "PsychologistId" = :psychologistId ${rawDateQuery}) as "favoritesCount"
            `;
            const [results] = await db.sequelize.query(kpiQuery, { replacements, type: db.sequelize.QueryTypes.SELECT });
            kpiCounts = {
                whatsappClicks: parseInt(results.whatsappClicks, 10) || 0,
                profileAppearances: parseInt(results.profileAppearances, 10) || 0,
                favoritesCount: parseInt(results.favoritesCount, 10) || 0,
            };
        } catch(e) {
            console.error("Erro ao buscar KPIs agregados:", e.message);
        }

        let topDemands = [];
        try {
            // A query de demandas (unnest) é mais complexa e mantemos separada.
            if (db && db.sequelize) { 
                topDemands = await db.sequelize.query(`
                    SELECT tag, COUNT(tag)::int as count
                    FROM (
                        SELECT unnest("matchTags") as tag 
                        FROM "MatchEvents" 
                        WHERE "psychologistId" = :psychologistId 
                        ${rawDateQuery}
                    ) as tags
                    GROUP BY tag
                    ORDER BY count DESC
                    LIMIT 3
                `, { 
                    replacements: replacements, // Usa o objeto replacements unificado
                    type: db.sequelize.QueryTypes.SELECT 
                });
            }
        } catch(e) {
            console.error("KPI Error (TopDemands):", e.message);
        }

        res.json({
            whatsappClicks: kpiCounts.whatsappClicks,
            profileAppearances: kpiCounts.profileAppearances,
            favoritesCount: kpiCounts.favoritesCount,
            topDemands: topDemands || []
        });

    } catch (error) {
        console.error("Erro CRÍTICO na rota de estatísticas:", error);
        res.status(500).json({ error: "Erro interno do servidor ao processar estatísticas.", details: error.message });
    }
});

// Nota: O frontend envia para /me/foto via POST com campo 'foto'. 
// Mantive conforme seu código original, mas verifique se o frontend bate com 'profilePhoto'
router.put('/me/photo', uploadProfilePhoto.single('profilePhoto'), psychologistController.updateProfilePhoto);
router.post('/me/foto', uploadProfilePhoto.single('foto'), psychologistController.updateProfilePhoto); // Rota alternativa para compatibilidade

router.put('/me/crp-document', uploadCrpDocument.single('crpDocument'), psychologistController.uploadCrpDocument);
router.get('/me/unread-count', psychologistController.getUnreadMessageCount);
router.get('/me/qna-unanswered-count', psychologistController.getUnansweredQuestionsCount);
router.put('/me/password', psychologistController.updatePsychologistPassword);
router.delete('/me', psychologistController.deletePsychologistAccount);
 
// Adicione junto com as rotas protegidas "me"
router.post('/me/cancel-subscription', psychologistController.cancelSubscription);

// Cole esta linha junto com as outras rotas (geralmente no final da lista)
router.post('/me/reactivate-subscription', psychologistController.reactivateSubscription);

// CORREÇÃO AQUI: Removemos 'authMiddleware' pois 'protect' já está aplicado globalmente acima
router.post('/me/exit-survey', psychologistController.saveExitSurvey);

// Outras rotas protegidas
router.get('/matches', psychologistController.getPatientMatches);
router.get('/waiting-list', psychologistController.getWaitingList);
router.post('/waiting-list/invite', psychologistController.inviteFromWaitlist);

// ===============================================
// ROTA PÚBLICA GENÉRICA (DEVE SER A ÚLTIMA)
// ===============================================
router.get('/:id', psychologistController.getPsychologistProfile);

module.exports = router;