const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const reviewController = require('../controllers/reviewController');
const qnaController = require('../controllers/qnaController'); // Importa o controlador de Q&A
const settingsController = require('../controllers/settingsController');
const { protect, admin } = require('../middleware/authMiddleware'); // Corrigido para importar ambos
const upload = require('../config/upload'); // Importa a configuração de upload

// Rota pública para login do admin
router.post('/login', adminController.loginAdmin);

// Aplica proteção para garantir que apenas admins logados acessem
router.use(protect);

// >>> ADICIONE ESTE BLOCO AQUI (ANTES DE router.use(admin)) <<<
// Permite que Psicólogos e Admins LEIAM os dados
router.get('/community-event', adminController.getCommunityEvent);
router.get('/community-resources', adminController.getCommunityResources);
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
router.get('/stats', adminController.getDashboardStats);

// Rota para buscar e atualizar os dados do admin logado
router.get('/me', adminController.getAdminData);
router.put('/me', adminController.updateAdminData);
router.put('/me/password', adminController.updateAdminPassword);
router.put('/me/photo', upload.single('profilePhoto'), adminController.updateAdminPhoto);

// Rota para buscar todos os psicólogos para a página de gerenciamento
router.get('/psychologists', adminController.getAllPsychologists);
// Novas rotas para gerenciar psicólogos
router.put('/psychologists/:id/status', adminController.updatePsychologistStatus);
router.delete('/psychologists/:id', adminController.deletePsychologist);


// Rota para buscar todos os pacientes
router.get('/patients', adminController.getAllPatients);
// Rota para deletar um paciente específico
router.delete('/patients/:id', adminController.deletePatient);

// Rota para buscar todas as avaliações (reviews)
router.get('/reviews', adminController.getAllReviews);
// Novas rotas para moderação de avaliações
router.get('/reviews/pending', adminController.getPendingReviews);


// Rota para buscar os logs do sistema
router.get('/logs', adminController.getSystemLogs);

// Rota para buscar todas as mensagens
router.get('/messages', adminController.getAllMessages);

// Rota para enviar mensagens em massa (broadcast)
router.post('/broadcast', adminController.sendBroadcastMessage);

// Rota para o admin responder a uma conversa específica
router.post('/reply', adminController.sendReply);

// Rota para deletar uma conversa
router.delete('/conversations/:id', adminController.deleteConversation);

// Rota para buscar as conversas do admin
router.get('/conversations', adminController.getConversations);

// Rotas para Notas Internas
router.get('/conversations/:id/notes', adminController.getInternalNotesForConversation);
router.post('/conversations/:id/notes', adminController.addInternalNote);

// Rota para buscar as mensagens de uma conversa específica
router.get('/conversations/:id/messages', adminController.getConversationMessages);

// Rota para dados de gráficos
router.get('/charts/new-users', adminController.getNewUsersPerMonth);

// Rota de Relatórios
router.get('/reports/charts', protect, admin, adminController.getDetailedReports);

// Rota para dados financeiros
router.get('/financials', adminController.getFinancials);

// --- ROTAS DE MODERAÇÃO DE PERGUNTAS (Q&A) ---

// Rota para buscar todas as perguntas com status 'pending_review'
router.get('/qna/pending', qnaController.getPendingQuestions);

// Rota para moderar (aprova/rejeita) uma pergunta específica
router.put('/qna/:questionId/moderate', qnaController.moderateQuestion);

// --- ROTAS DE EDIÇÃO DA COMUNIDADE (Apenas Admin pode alterar) ---
router.put('/community-event', adminController.updateCommunityEvent);
router.put('/community-resources', adminController.updateCommunityResources);


module.exports = router;