// Arquivo: backend/routes/psychologistRoutes.js (VERSÃO FINAL CORRIGIDA)

const express = require('express');
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