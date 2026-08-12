const express = require('express');
const router = express.Router();
const db = require('../models'); // Importa o banco de dados para operações diretas
const adminController = require('../controllers/adminController');
const adminDashboardController = require('../controllers/adminDashboardController');
const adminCommunityController = require('../controllers/adminCommunityController');
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const adminGrowthController = require('../controllers/adminGrowthController');
const adminExpenseController = require('../controllers/adminExpenseController');
const reviewController = require('../controllers/reviewController');
const qnaController = require('../controllers/qnaController'); // Importa o controlador de Q&A
const settingsController = require('../controllers/settingsController');
const adminEficienciaController = require('../controllers/adminEficienciaController');
const adminPerformanceController = require('../controllers/adminPerformanceController');
const { protect, admin } = require('../middlewares/authMiddleware'); // Corrigido para importar ambos
const { uploadProfilePhoto } = require('../middlewares/upload'); // Importa o Multer unificado
const { adminLimiter } = require('../middlewares/rateLimiters');

// Rota pública para login do admin
router.post('/login', adminLimiter, adminController.loginAdmin);

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
router.get('/psychologists/low-performance', adminPerformanceController.getLowPerformancePsychologists);
router.post('/psychologists/:id/ai-diagnosis', adminPerformanceController.generateAiDiagnosis);
router.post('/psychologists/:id/ai-churn-message', adminPerformanceController.generateAiChurnMessage);
router.post('/psychologists/:id/ai-paid-churn-message', adminPerformanceController.generateAiPaidChurnMessage);
router.post('/psychologists/:id/ai-expiring-trial-message', adminPerformanceController.generateAiExpiringTrialMessage);
// Novas rotas para gerenciar psicólogos
router.get('/psychologists/:id/full-details', adminController.getPsychologistFullDetails); // <--- NOVA ROTA
router.get('/psychologists/:id/analyze', adminController.analyzeProfile);
// --- ROTA PARA SALVAR A MARCAÇÃO DA ANÁLISE NA NUVEM ---
router.put('/psychologists/:id/analyzed', async (req, res) => {
    try {
        const { id } = req.params;
        await db.Psychologist.update(
            { isProfileAnalyzed: true },
            { where: { id } }
        );
        res.json({ success: true, message: 'Status de análise salvo na nuvem.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar marcação.' });
    }
});
router.put('/psychologists/:id/status', adminController.updatePsychologistStatus);
// Rota para ativar/desativar isenção (VIP)
router.patch('/psychologists/:id/vip', adminController.updateVipStatus);
router.delete('/psychologists/:id', adminController.deletePsychologist);
// Rota para EXCLUIR PERMANENTEMENTE um psicólogo (Hard Delete)
router.delete('/psychologists/:id/force', adminController.forceDeletePsychologist);


// Rota para buscar todos os pacientes
router.get('/patients', adminController.getAllPatients);
// Rota para compilar o Dossiê 360º do paciente
router.get('/patients/:id/360', adminController.getPatient360);
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
router.get('/founder-metrics', adminDashboardController.getFounderMetrics);
router.post('/founder-metrics/billing-sent/:id', adminDashboardController.markBillingSent);
router.post('/founder-goals', adminDashboardController.saveFounderGoals);

// Rota para indicadores dos questionários
// router.get('/questionnaire-analytics', adminDashboardController.getQuestionnaireAnalytics);

// --- FIX: ROTA INLINE PARA INDICADORES (Evita erro 500 se controller falhar) ---
router.get('/questionnaire-analytics', adminAnalyticsController.getQuestionnaireAnalytics);
router.get('/analytics/growth', adminGrowthController.getGrowthData);
router.get('/analytics/growth/pmf', adminGrowthController.getPMFDetails);
router.post('/analytics/growth/ai-insights', adminGrowthController.getAIInsights);
router.get('/growth/overview', adminGrowthController.getOverview);
router.get('/growth/acquisition', adminGrowthController.getAcquisition);
router.get('/growth/demand', adminGrowthController.getDemand);
router.get('/growth/marketing', adminGrowthController.getMarketing);
router.get('/growth/cohorts', adminGrowthController.getCohorts);
router.get('/growth/audit', adminGrowthController.getAudit);
router.get('/growth/pmf', adminGrowthController.getPMFReport);
router.get('/growth/pmf/details', adminGrowthController.getPMFDetails);
// --- ROTAS FINANCEIRAS E DESPESAS ---
router.get('/expenses', adminExpenseController.getExpenses);
router.post('/expenses', adminExpenseController.createExpense);
router.delete('/expenses/:id', adminExpenseController.deleteExpense);
router.get('/cash-flow', adminExpenseController.getCashFlow);

// --- ROTAS DE FOLLOW-UP (AÇÕES MANUAIS NO CRM) ---
router.get('/pending-actions', adminController.getPendingActions);
router.get('/reset-crm', adminController.resetCrm);
router.get('/debug-crm', adminController.debugCrm);
router.patch('/psychologists/:id/action-sent', adminController.markActionSent);

// --- ROTAS DE FOLLOW-UP (VISITANTES WHATSAPP) ---
router.get('/followups', adminController.getFollowUps);
router.put('/followups/:id', adminController.updateFollowUpStatus);
router.delete('/followups/:id', adminController.deleteFollowUp);

// ROTAS DE NOTIFICAÇÕES (PUSH)
router.post('/push', adminController.sendPushNotification);

// ROTAS DE ESPERA
router.get('/waitlist', adminController.exportWaitlist);

// --- ROTAS DE EXPORTAÇÃO DE DADOS (NOVO) ---
router.get('/export/patients', adminController.exportPatients);
router.get('/export/psychologists', adminController.exportPsychologists);

// --- ROTA DE FEEDBACK DO WHATSAPP (CONVERSÃO PLG) ---
router.get('/whatsapp-feedbacks', adminDashboardController.getWhatsappFeedbacks);
router.post('/whatsapp-feedbacks/remind/:psiId', adminDashboardController.markWhatsappReminder);
router.post('/whatsapp-feedbacks/:id/force-response', adminDashboardController.forceWhatsappResponse);

// --- ROTA DE RANKING DE PSICÓLOGOS (NOVO CRM) ---
router.get('/analytics/ranking', adminController.getPsiRanking);

// --- ROTAS DE MODERAÇÃO DE PERGUNTAS (Q&A) ---

// Rota para listar TODAS as perguntas na aba de remoção
router.get('/content/qna', qnaController.getAllQuestions);

// Rota para buscar todas as perguntas com status 'pending_review'
router.get('/qna/pending', qnaController.getPendingQuestions);

// Rota para moderar (aprova/rejeita) uma pergunta específica
router.put('/qna/:questionId/moderate', qnaController.moderateQuestion);

// --- Rotas da IA (Drafts) ---
const aiQnaController = require('../controllers/aiQnaController');
router.get('/qna/ai-drafts', aiQnaController.getAiDrafts);
router.post('/qna/ai-drafts/generate-now', aiQnaController.generateNow);
router.put('/qna/ai-drafts/:id/approve', aiQnaController.approveDraft);
router.delete('/qna/ai-drafts/:id', aiQnaController.rejectDraft);


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

// --- ROTA DO TERMÔMETRO DE ESCALA (TRÁFEGO) ---
router.get('/termometro', adminAnalyticsController.getTermometroEscala);

// --- ROTA DE AUDITORIA DE LEADS RECENTES ---
router.get('/leads-recentes', adminAnalyticsController.getLeadsRecentes);

// --- ROTA RÁPIDA: RAIO-X DO REMARKETING (FUNIL EM TEMPO REAL) ---
router.get('/remarketing-status', adminAnalyticsController.getRemarketingStatus);

// --- ROTA DO PAINEL DE EFICIÊNCIA (STOP-LOSS) ---
router.get('/efficiency', adminEficienciaController.getEfficiencyDashboard);
router.post('/efficiency', adminEficienciaController.saveWeeklyEfficiency);
router.delete('/efficiency/:id', adminEficienciaController.deleteWeeklyEfficiency);

module.exports = router;