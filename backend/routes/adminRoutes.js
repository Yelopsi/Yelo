const express = require('express');
const router = express.Router();
const db = require('../models'); // Importa o banco de dados para operações diretas
const adminController = require('../controllers/adminController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminCommunityController = require('../controllers/adminCommunityController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const reviewController = require('../controllers/reviewController');
const qnaController = require('../controllers/qnaController'); // Importa o controlador de Q&A
const settingsController = require('../controllers/settingsController');
const { protect, admin } = require('../middlewares/authMiddleware'); // Corrigido para importar ambos
const { uploadProfilePhoto } = require('../middlewares/upload'); // Importa o Multer unificado

// Rota pública para login do admin
router.post('/login', adminController.loginAdmin);

// Aplica proteção para garantir que apenas admins logados acessem
router.use(protect);

// >>> ADICIONE ESTE BLOCO AQUI (ANTES DE router.use(admin)) <<<
// Permite que Psicólogos e Admins LEIAM os dados
router.get('/community-event', adminCommunityController.getCommunityEvent);
router.get('/community-resources', adminCommunityController.getCommunityResources);
// >>> FIM DO BLOCO <<<

router.use(admin);

// --- Rotas de Configuração do Sistema (Yelo v2.1) ---
router.get('/settings', settingsController.getSettings);
router.post('/settings', settingsController.updateSettings);

// --- NOVAS ROTAS DE VERIFICAÇÃO ---
// Busca psicólogos com documentos pendentes de verificação
router.get('/verifications', adminController.getPendingVerifications);
// Modera (aprova/rejeita) um psicólogo
router.put('/psychologists/:id/moderate', adminController.moderatePsychologist);

// Rota para buscar as estatísticas da Visão Geral
router.get('/stats', adminDashboardController.getDashboardStats);

// Rota para liberar 14 dias de teste para todos os usuários inativos/pendentes
router.post('/psychologists/grant-trial-all', adminController.grantTrialToAll);

// Rota para buscar e atualizar os dados do admin logado
router.get('/me', adminController.getAdminData);
router.put('/me', adminController.updateAdminData);

router.put('/me/password', adminController.updateAdminPassword);
router.put('/me/photo', uploadProfilePhoto.single('profilePhoto'), adminController.updateAdminPhoto);

// Rota para buscar todos os psicólogos para a página de gerenciamento
router.get('/psychologists', adminController.getAllPsychologists);
// Novas rotas para gerenciar psicólogos
router.get('/psychologists/:id/full-details', adminController.getPsychologistFullDetails); // <--- NOVA ROTA
router.get('/psychologists/:id/analyze', adminController.analyzeProfile);
router.put('/psychologists/:id/status', adminController.updatePsychologistStatus);
// Rota para ativar/desativar isenção (VIP)
router.patch('/psychologists/:id/vip', adminController.updateVipStatus);
router.delete('/psychologists/:id', adminController.deletePsychologist);
// Rota para EXCLUIR PERMANENTEMENTE um psicólogo (Hard Delete)
router.delete('/psychologists/:id/force', adminController.forceDeletePsychologist);


// Rota para buscar todos os pacientes
router.get('/patients', adminController.getAllPatients);
// Rota para atualizar status do paciente (suspender/ativar)
router.put('/patients/:id/status', adminController.updatePatientStatus);
// Rota para deletar um paciente específico
router.delete('/patients/:id', adminController.deletePatient);
// Rota para EXCLUIR PERMANENTEMENTE um paciente (Hard Delete)
router.delete('/patients/:id/force', adminController.forceDeletePatient);
// Rota para RESTAURAR um paciente da lixeira
router.put('/patients/:id/restore', adminController.restorePatient);

// Rota para buscar todas as avaliações (reviews)
router.get('/reviews', adminController.getAllReviews);
// Novas rotas para moderação de avaliações
router.get('/reviews/pending', adminController.getPendingReviews);
// CORREÇÃO: Adiciona a rota que faltava para ATUALIZAR o status da avaliação
router.put('/reviews/:id/moderate', adminController.moderateReview);

// --- ROTAS AVALIAÇÕES DA PLATAFORMA (NPS) ---
router.get('/platform-reviews', adminController.getPlatformReviews);
router.put('/platform-reviews/:id/testimonial', adminController.togglePlatformReviewTestimonial);

// --- ROTA DE RETENÇÃO E CHURN (EXIT SURVEYS) ---
router.get('/exit-surveys', adminController.getExitSurveys);



// Rota para buscar os logs do sistema
router.get('/logs', adminDashboardController.getSystemLogs);

// Rota para dados de gráficos
router.get('/charts/new-users', adminDashboardController.getNewUsersPerMonth);

// Rota de Relatórios
router.get('/reports/charts', protect, admin, adminDashboardController.getDetailedReports);

// Rota para dados financeiros
router.get('/financials', adminDashboardController.getFinancials);

// Rota para indicadores dos questionários
// router.get('/questionnaire-analytics', adminDashboardController.getQuestionnaireAnalytics);

// --- FIX: ROTA INLINE PARA INDICADORES (Evita erro 500 se controller falhar) ---
router.get('/questionnaire-analytics', adminAnalyticsController.getQuestionnaireAnalytics);

// --- ROTAS DE FOLLOW-UP (NOVO) ---
router.get('/followups', adminController.getFollowUps);
router.put('/followups/:id', adminController.updateFollowUpStatus);
router.delete('/followups/:id', adminController.deleteFollowUp);

// --- ROTAS DE EXPORTAÇÃO DE DADOS (NOVO) ---
router.get('/export/patients', adminController.exportPatients);
router.get('/export/psychologists', adminController.exportPsychologists);

// --- ROTA DE FEEDBACK DO WHATSAPP (CONVERSÃO PLG) ---
router.get('/whatsapp-feedbacks', adminDashboardController.getWhatsappFeedbacks);

// --- ROTA DE RANKING DE PSICÓLOGOS (NOVO CRM) ---
router.get('/analytics/ranking', adminController.getPsiRanking);

// --- ROTAS DE MODERAÇÃO DE PERGUNTAS (Q&A) ---

// Rota para buscar todas as perguntas com status 'pending_review'
router.get('/qna/pending', qnaController.getPendingQuestions);

// Rota para moderar (aprova/rejeita) uma pergunta específica
router.put('/qna/:questionId/moderate', qnaController.moderateQuestion);

// --- ROTAS DE MODERAÇÃO DE DENÚNCIAS DO FÓRUM (NOVO) ---
router.get('/forum/reports', adminCommunityController.getForumReports);
router.put('/forum/moderate', adminCommunityController.moderateForumContent);
// Rota para fixar/desfixar um post do fórum (NOVO)
router.put('/forum/posts/:id/pin', adminCommunityController.pinForumPost);
// Rota para listar todos os posts do fórum para o admin (NOVO)
router.get('/forum/posts', adminCommunityController.getAllForumPosts);

// --- ROTAS DE PROSPECÇÃO DE LEADS (OUTBOUND) ---
router.get('/leads', adminController.getLeads);
router.put('/leads/:id/contato', adminController.registrarContatoLead);
router.put('/leads/:id/status', adminController.atualizarStatusLead);
router.delete('/leads/:id', adminController.excluirLead);
router.post('/leads/scrape', adminController.runScraper);
router.post('/whatsapp/test', adminController.testWhatsAppMessage);
router.post('/whatsapp/test-batch', adminController.testOutboundBatch);

// --- ROTAS DE EDIÇÃO DA COMUNIDADE (Apenas Admin pode alterar) ---
router.put('/community-event', adminCommunityController.updateCommunityEvent);
router.put('/community-resources', adminCommunityController.updateCommunityResources);

// --- ROTA DE ESTATÍSTICAS PWA (NOVO) ---
router.get('/stats/pwa', adminAnalyticsController.getPwaStats);

// --- ROTA RÁPIDA: RAIO-X DO REMARKETING (FUNIL EM TEMPO REAL) ---
router.get('/remarketing-status', adminAnalyticsController.getRemarketingStatus);

module.exports = router;