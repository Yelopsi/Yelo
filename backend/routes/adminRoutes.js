const express = require('express');
const router = express.Router();
const db = require('../models'); // Importa o banco de dados para operações diretas
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
// router.get('/me', adminController.getAdminData); // Substituído pela versão inline abaixo
// router.put('/me', adminController.updateAdminData); // Substituído pela versão inline abaixo

// --- ROTA DE PERFIL DO ADMIN (GET) - INLINE ---
router.get('/me', async (req, res) => {
    try {
        const [results] = await db.sequelize.query(
            `SELECT id, nome, email, telefone, "fotoUrl" FROM "Admins" WHERE id = :id`,
            { replacements: { id: req.user.id } }
        );
        if (results.length === 0) return res.status(404).json({ error: 'Admin não encontrado' });
        res.json(results[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar perfil: ' + error.message });
    }
});

// --- ROTA DE ATUALIZAÇÃO DO PERFIL DO ADMIN (PUT) - INLINE ---
router.put('/me', async (req, res) => {
    try {
        const { nome, email, telefone } = req.body;
        const emailFinal = email ? email.toLowerCase() : email;

        // Validação de e-mail único (se mudou)
        if (emailFinal) {
            const [existing] = await db.sequelize.query(
                `SELECT id FROM "Admins" WHERE email = :email AND id != :id`,
                { replacements: { email: emailFinal, id: req.user.id } }
            );
            if (existing.length > 0) return res.status(400).json({ error: 'Este e-mail já está em uso.' });
        }

        await db.sequelize.query(
            `UPDATE "Admins" SET nome = :nome, email = :email, telefone = :telefone, "updatedAt" = NOW() WHERE id = :id`,
            { replacements: { nome, email: emailFinal, telefone, id: req.user.id } }
        );
        res.json({ message: 'Perfil atualizado com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar perfil: ' + error.message });
    }
});

router.put('/me/password', adminController.updateAdminPassword);
router.put('/me/photo', upload.single('profilePhoto'), adminController.updateAdminPhoto);

// Rota para buscar todos os psicólogos para a página de gerenciamento
router.get('/psychologists', adminController.getAllPsychologists);
// Novas rotas para gerenciar psicólogos
router.get('/psychologists/:id/full-details', adminController.getPsychologistFullDetails); // <--- NOVA ROTA
router.put('/psychologists/:id/status', adminController.updatePsychologistStatus);
// Rota para ativar/desativar isenção (VIP)
router.patch('/psychologists/:id/vip', adminController.updateVipStatus);
router.delete('/psychologists/:id', adminController.deletePsychologist);


// Rota para buscar todos os pacientes
router.get('/patients', adminController.getAllPatients);
// Rota para atualizar status do paciente (suspender/ativar)
router.put('/patients/:id/status', adminController.updatePatientStatus);
// Rota para deletar um paciente específico
router.delete('/patients/:id', adminController.deletePatient);

// Rota para buscar todas as avaliações (reviews)
router.get('/reviews', adminController.getAllReviews);
// Novas rotas para moderação de avaliações
router.get('/reviews/pending', adminController.getPendingReviews);
// CORREÇÃO: Adiciona a rota que faltava para ATUALIZAR o status da avaliação
router.put('/reviews/:id/moderate', adminController.moderateReview);



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

// Rota para indicadores dos questionários
// router.get('/questionnaire-analytics', adminController.getQuestionnaireAnalytics);

// --- FIX: ROTA INLINE PARA INDICADORES (Evita erro 500 se controller falhar) ---
router.get('/questionnaire-analytics', async (req, res) => {
    try {
        // 1. Total de Buscas
        const [totalResult] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches"`);
        const total = parseInt(totalResult[0]?.count || 0, 10);

        // Helper para formatar
        const format = (rows) => rows.map(r => ({ label: r.label || 'N/A', value: parseInt(r.value, 10) }));

        // 2. Agregações (Gênero, Idade, Motivo, Estado)
        const [gender] = await db.sequelize.query(`
            SELECT "searchParams"->>'genero' as label, COUNT(*) as value 
            FROM "DemandSearches" WHERE "searchParams"->>'genero' IS NOT NULL 
            GROUP BY 1 ORDER BY value DESC
        `);

        const [age] = await db.sequelize.query(`
            SELECT "searchParams"->>'faixa_etaria' as label, COUNT(*) as value 
            FROM "DemandSearches" WHERE "searchParams"->>'faixa_etaria' IS NOT NULL 
            GROUP BY 1 ORDER BY value DESC
        `);

        const [symptoms] = await db.sequelize.query(`
            SELECT "searchParams"->>'motivo' as label, COUNT(*) as value 
            FROM "DemandSearches" WHERE "searchParams"->>'motivo' IS NOT NULL 
            GROUP BY 1 ORDER BY value DESC LIMIT 10
        `);
        
        const [location] = await db.sequelize.query(`
            SELECT "searchParams"->>'estado' as label, COUNT(*) as value 
            FROM "DemandSearches" WHERE "searchParams"->>'estado' IS NOT NULL 
            GROUP BY 1 ORDER BY value DESC LIMIT 10
        `);

        res.json({ total, gender: format(gender), age: format(age), symptoms: format(symptoms), location: format(location) });
    } catch (error) {
        console.error("Erro em questionnaire-analytics:", error);
        res.json({ total: 0, gender: [], age: [], symptoms: [], location: [] });
    }
});

// --- ROTAS DE FOLLOW-UP (NOVO) ---
router.get('/followups', adminController.getFollowUps);
router.put('/followups/:id', adminController.updateFollowUpStatus);
router.delete('/followups/:id', adminController.deleteFollowUp);

// --- ROTAS DE EXPORTAÇÃO DE DADOS (NOVO) ---
router.get('/export/patients', adminController.exportPatients);
router.get('/export/psychologists', adminController.exportPsychologists);

// --- ROTAS DE MODERAÇÃO DE PERGUNTAS (Q&A) ---

// Rota para buscar todas as perguntas com status 'pending_review'
router.get('/qna/pending', qnaController.getPendingQuestions);

// Rota para moderar (aprova/rejeita) uma pergunta específica
router.put('/qna/:questionId/moderate', qnaController.moderateQuestion);

// --- ROTAS DE MODERAÇÃO DE DENÚNCIAS DO FÓRUM (NOVO) ---
router.get('/forum/reports', adminController.getForumReports);
router.put('/forum/moderate', adminController.moderateForumContent);

// --- ROTAS DE EDIÇÃO DA COMUNIDADE (Apenas Admin pode alterar) ---
router.put('/community-event', adminController.updateCommunityEvent);
router.put('/community-resources', adminController.updateCommunityResources);

// --- ROTA DE ESTATÍSTICAS PWA (NOVO) ---
router.get('/stats/pwa', async (req, res) => {
    try {
        // Busca total geral
        const [totalResult] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "PwaInstallLogs"`);
        
        // Busca agrupado por plataforma
        const [byPlatform] = await db.sequelize.query(`SELECT platform, COUNT(*) as count FROM "PwaInstallLogs" GROUP BY platform`);
        
        res.json({ 
            total: parseInt(totalResult[0]?.count || 0, 10), 
            byPlatform 
        });
    } catch (error) {
        console.error("Erro ao buscar stats PWA:", error);
        // Retorna zerado se a tabela não existir ou der erro, para não quebrar o front
        res.json({ total: 0, byPlatform: [] });
    }
});

module.exports = router;