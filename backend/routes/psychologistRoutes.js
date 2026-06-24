// Arquivo: backend/routes/psychologistRoutes.js (VERSÃO FINAL CORRIGIDA)

const express = require('express');
const db = require('../models'); // Adicionado para acesso ao banco
const { Op } = require('sequelize'); // Adicionado para queries complexas
const jwt = require('jsonwebtoken'); // Adicionado para validação segura do modal
const router = express.Router();
const psychologistController = require('../controllers/psychologistController');
const psiAuthController = require('../controllers/psiAuthController');
const psiWaitlistController = require('../controllers/psiWaitlistController');
const matchController = require('../controllers/matchController');
const psiDashboardController = require('../controllers/psiDashboardController');
const whatsappClickController = require('../controllers/whatsappClickController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadProfilePhoto, uploadCrpDocument } = require('../middlewares/upload');

// ===============================================
// ROTAS PÚBLICAS (Não exigem login)
// ===============================================
router.post('/register', psiAuthController.registerPsychologist);
router.post('/login', psiAuthController.loginPsychologist);
router.post('/check-demand', psiWaitlistController.checkDemand);
router.post('/add-to-waitlist', psiWaitlistController.addToWaitlist);
router.get('/showcase', matchController.getShowcasePsychologists);
router.get('/slug/:slug', matchController.getProfileBySlug);
router.post('/match', matchController.getAnonymousMatches); 
router.get('/:id/reviews', matchController.getPsychologistReviews);

// Rota para SOLICITAR o envio do e-mail de redefinição (PÚBLICA)
router.post('/forgot-password', psiAuthController.requestPasswordReset);

// Rota para o usuário ENVIAR a nova senha com o token (PÚBLICA)
router.post('/reset-password/:token', psiAuthController.resetPassword); 

// Rotas de Tracking/Analytics de Conversão (PÚBLICAS)
router.post('/:slug/whatsapp-click', psiDashboardController.incrementWhatsappClick);
router.post('/:id/appearance', psiDashboardController.incrementProfileAppearance);
router.post('/public/whatsapp-click-log', whatsappClickController.registerClick);

// ===============================================
// ROTAS PROTEGIDAS (Exigem login)
// ===============================================

// Interceptor: Escudo de Titânio - Remove qualquer token estruturalmente inválido
// forçando o middleware 'protect' a usar o Cookie HttpOnly de verdade.
router.use((req, res, next) => {
    const isValidJWT = (t) => typeof t === 'string' && t.split('.').length === 3;

    // 1. Limpa cabeçalho Authorization
    if (req.headers.authorization) {
        const tokenStr = req.headers.authorization.replace('Bearer ', '').trim();
        if (!isValidJWT(tokenStr)) {
            delete req.headers.authorization;
        }
    }
    
    // 2. Limpa query param (Se o frontend enviou na URL ?token=null)
    if (req.query && req.query.token) {
        if (!isValidJWT(String(req.query.token))) delete req.query.token;
    }

    // 3. Limpa body param (Se o frontend enviou no corpo do POST)
    if (req.body && req.body.token) {
        if (!isValidJWT(String(req.body.token))) delete req.body.token;
    }

    next();
});

// ===============================================
// BYPASS SEGURO: Modal do WhatsApp
// ===============================================
// Middleware exclusivo que não crasha o servidor (evita o Erro 500 jwt malformed)
// garantindo que o frontend carregue normalmente mesmo com tokens corrompidos.
const safeProtect = async (req, res, next) => {
    try {
        let token = null;
        if (req.cookies && req.cookies.token) token = req.cookies.token;
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token || token === 'null' || token === 'undefined' || token === 'cookie_auth_active') {
            return res.status(401).json({ error: 'Token ausente ou inválido.' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.psychologist = { id: decoded.id };
        req.userDecoded = decoded;
        req.user = { id: decoded.id }; 
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Falha de autenticação local.' });
    }
};

// Rotas do Feedback do WhatsApp puxadas para cima (Bypass do middleware global)
router.get('/me/pending-whatsapp-feedback', safeProtect, whatsappClickController.getPendingFeedback);
router.post('/me/whatsapp-feedback', safeProtect, whatsappClickController.submitFeedback);

// O middleware 'protect' é aplicado a TODAS as rotas abaixo desta linha
router.use(protect); 

// Rotas "ME" (do usuário logado)
router.get('/me', psychologistController.getAuthenticatedPsychologistProfile);
router.put('/me', psychologistController.updatePsychologistProfile);

// Rota para otimizar a bio com IA
router.post('/me/optimize-bio', psychologistController.optimizeBio);
router.post('/me/optimize-article', psychologistController.optimizeArticle);

// Rota para marcar modal de boas-vindas como visto
router.post('/me/welcome-seen', psychologistController.markWelcomeAsSeen);

// Dados de Dashboards do Psicólogo
router.get('/me/analytics', psiDashboardController.getAnalyticsData);
router.post('/me/ai-insights', psiDashboardController.getAiInsights);

router.get('/me/favorites-profile', (req, res) => res.json({ total: 0, temas: {}, faixaValor: {}, genero: {} }));
router.get('/me/announcements', psiDashboardController.getAnnouncements);
router.post('/me/announcements/:avisoId/read', psiDashboardController.markAnnouncementAsRead);

// ROTA DE ESTATÍSTICAS REAIS (KPIs)
router.get('/me/stats', psiDashboardController.getStats);

// Nota: O frontend envia para /me/foto via POST com campo 'foto'. 
// Mantive conforme seu código original, mas verifique se o frontend bate com 'profilePhoto'
router.put('/me/photo', uploadProfilePhoto.single('profilePhoto'), psychologistController.updateProfilePhoto);
router.post('/me/foto', uploadProfilePhoto.single('foto'), psychologistController.updateProfilePhoto); // Rota alternativa para compatibilidade

// router.put('/me/crp-document', uploadCrpDocument.single('crpDocument'), psychologistController.uploadCrpDocument); // Função não existe no controller
router.get('/me/qna-unanswered-count', psychologistController.getUnansweredQuestionsCount);
router.put('/me/password', psychologistController.updatePsychologistPassword);
router.delete('/me', psychologistController.deletePsychologistAccount);
 
// Adicione junto com as rotas protegidas "me"
router.post('/me/cancel-subscription', psychologistController.cancelSubscription);

router.post('/me/link-google', psiAuthController.linkGoogleAccount);

// Cole esta linha junto com as outras rotas (geralmente no final da lista)
router.post('/me/reactivate-subscription', psychologistController.reactivateSubscription);
router.post('/me/platform-review', psiDashboardController.savePlatformReview);

// CORREÇÃO AQUI: Removemos 'authMiddleware' pois 'protect' já está aplicado globalmente acima
router.post('/me/exit-survey', psychologistController.saveExitSurvey);

// Outras rotas protegidas
router.get('/matches', matchController.getPatientMatches);
router.get('/waiting-list', psiWaitlistController.getWaitingList);
router.post('/waiting-list/invite', psiWaitlistController.inviteFromWaitlist);

// ===============================================
// ROTA PÚBLICA GENÉRICA (DEVE SER A ÚLTIMA)
// ===============================================
router.get('/:id', matchController.getPsychologistProfile);

module.exports = router;