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
router.get('/me', adminController.getAdminData);
router.put('/me', adminController.updateAdminData);

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

// ====================================================================================
// AVISO DE REFATORAÇÃO: As rotas básicas de admin (/messages, /conversations) abaixo 
// rodam no adminController. A arquitetura moderna principal agora está isolada 
// em adminMessageRoutes.js. (Não remover até que 'Notas Internas' e 'Broadcast' sejam migrados)
// ====================================================================================

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
        // Helper para formatar array de DB para Objeto { "Label": 10, "Label2": 5 }
        const formatObj = (rows) => {
            const obj = {};
            rows.forEach(r => {
                if (r.label) obj[r.label] = parseInt(r.value, 10);
            });
            return obj;
        };

        // --- 1. PATIENT ANALYTICS (DemandSearches) ---
        const [totalPatients] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches"`);
        
        // Helper para buscar estatísticas de pacientes
        const getPatientStat = async (key) => {
            const [rows] = await db.sequelize.query(`
                SELECT "searchParams"->>'${key}' as label, COUNT(*) as value 
                FROM "DemandSearches" 
                WHERE "searchParams"->>'${key}' IS NOT NULL 
                GROUP BY 1 ORDER BY value DESC LIMIT 10
            `);
            return formatObj(rows);
        };

        const patientAnalytics = {
            total: parseInt(totalPatients[0]?.count || 0, 10),
            idade: await getPatientStat('faixa_etaria'),
            identidade_genero: await getPatientStat('genero'),
            pref_genero_prof: await getPatientStat('preferencia_genero'),
            motivacao: await getPatientStat('motivo'),
            temas: await getPatientStat('temas'),
            terapia_anterior: await getPatientStat('terapia_anterior'),
            experiencia_desejada: await getPatientStat('experiencia_desejada'),
            caracteristicas_prof: await getPatientStat('caracteristicas'),
            faixa_valor: await getPatientStat('valor'),
            modalidade_atendimento: await getPatientStat('modalidade')
        };

        // --- 2. PSI ANALYTICS (Psychologists) ---
        const [totalPsis] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "Psychologists"`);
        
        const getPsiStat = async (col) => {
            try {
                // Tenta buscar, se a coluna não existir ou der erro, retorna vazio
                const [rows] = await db.sequelize.query(`
                    SELECT "${col}"::text as label, COUNT(*) as value 
                    FROM "Psychologists" 
                    WHERE "${col}" IS NOT NULL 
                    GROUP BY 1 ORDER BY value DESC LIMIT 10
                `);
                return formatObj(rows);
            } catch (e) { return {}; }
        };

        const psiAnalytics = {
            total: parseInt(totalPsis[0]?.count || 0, 10),
            modalidade: await getPsiStat('modalidade'),
            genero_identidade: await getPsiStat('genero_identidade'),
            valor_sessao_faixa: {}, // Complexo para calcular inline, deixando vazio por enquanto
            temas_atuacao: await getPsiStat('temas_atuacao'),
            abordagens_tecnicas: await getPsiStat('abordagens_tecnicas'),
            praticas_vivencias: await getPsiStat('praticas_inclusivas')
        };

        // --- 3. SUMMARY 30 DAYS (O que estava faltando) ---
        const [total30d] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" >= NOW() - INTERVAL '30 days'`);
        const total30 = parseInt(total30d[0]?.count || 0, 10);

        const getTopStat30d = async (key) => {
            if (total30 === 0) return null;
            const [rows] = await db.sequelize.query(`
                SELECT "searchParams"->>'${key}' as label, COUNT(*) as value 
                FROM "DemandSearches" 
                WHERE "createdAt" >= NOW() - INTERVAL '30 days' 
                AND "searchParams"->>'${key}' IS NOT NULL 
                GROUP BY 1 ORDER BY value DESC LIMIT 1
            `);
            if (rows.length > 0) {
                const val = parseInt(rows[0].value, 10);
                return {
                    label: rows[0].label,
                    percentage: Math.round((val / total30) * 100)
                };
            }
            return null;
        };

        const summary30d = {
            total: total30,
            stats: {
                idade: await getTopStat30d('faixa_etaria'),
                identidade_genero: await getTopStat30d('genero'),
                pref_genero_prof: await getTopStat30d('preferencia_genero'),
                motivacao: await getTopStat30d('motivo'),
                temas: await getTopStat30d('temas'),
                terapia_anterior: await getTopStat30d('terapia_anterior'),
                experiencia_desejada: await getTopStat30d('experiencia_desejada'),
                caracteristicas_prof: await getTopStat30d('caracteristicas'),
                faixa_valor: await getTopStat30d('valor'),
                modalidade_atendimento: await getTopStat30d('modalidade')
            }
        };

        res.json({ patientAnalytics, psiAnalytics, summary30d });
    } catch (error) {
        console.error("Erro em questionnaire-analytics:", error);
        res.json({ 
            patientAnalytics: { total: 0, idade: {} }, 
            psiAnalytics: { total: 0, modalidade: {} }, 
            summary30d: { total: 0, stats: {} } 
        });
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
// Rota para fixar/desfixar um post do fórum (NOVO)
router.put('/forum/posts/:id/pin', adminController.pinForumPost);
// Rota para listar todos os posts do fórum para o admin (NOVO)
router.get('/forum/posts', adminController.getAllForumPosts);

// --- ROTAS DE PROSPECÇÃO DE LEADS (OUTBOUND) ---
router.get('/leads', adminController.getLeads);
router.put('/leads/:id/contato', adminController.registrarContatoLead);
router.put('/leads/:id/status', adminController.atualizarStatusLead);
router.delete('/leads/:id', adminController.excluirLead);
router.post('/leads/scrape', adminController.runScraper);

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

// --- ROTA RÁPIDA: RAIO-X DO REMARKETING (FUNIL EM TEMPO REAL) ---
router.get('/remarketing-status', async (req, res) => {
    try {
        const pendingPsis = await db.Psychologist.findAll({
            where: {
                status: { [db.Sequelize.Op.ne]: 'active' },
                is_exempt: { [db.Sequelize.Op.not]: true }
            },
            attributes: ['id', 'nome', 'email', 'createdAt', 'whatsapp_clicks']
        });

        const now = new Date();
        const funnel = { passo1_hoje: [], passo2_hoje: [], passo3_hoje: [], passo4_hoje: [], aguardando_proxima_janela: [] };

        pendingPsis.forEach(p => {
            // Calcula quantas horas se passaram desde o cadastro
            const hoursSince = (now - new Date(p.createdAt)) / (1000 * 60 * 60);
            const psiData = { id: p.id, nome: p.nome, email: p.email, horas_desde_cadastro: Math.round(hoursSince), cliques: p.whatsapp_clicks || 0 };

            // Encaixa o psicólogo na regra exata do seu remarketingCron.js
            if (hoursSince >= 24 && hoursSince <= 48) funnel.passo1_hoje.push(psiData);
            else if (hoursSince >= 72 && hoursSince <= 96) funnel.passo2_hoje.push(psiData);
            else if (hoursSince >= 168 && hoursSince <= 192) funnel.passo3_hoje.push(psiData);
            else if (hoursSince >= 336 && hoursSince <= 360 && psiData.cliques > 0) funnel.passo4_hoje.push(psiData);
            else funnel.aguardando_proxima_janela.push(psiData);
        });

        res.json({
            resumo_envios_de_hoje: {
                total_cadastros_inativos: pendingPsis.length,
                recebem_passo_1_hoje: funnel.passo1_hoje.length,
                recebem_passo_2_hoje: funnel.passo2_hoje.length,
                recebem_passo_3_hoje: funnel.passo3_hoje.length,
                recebem_passo_4_hoje: funnel.passo4_hoje.length,
            },
            detalhes: funnel
        });
    } catch (error) {
        console.error("Erro ao gerar relatório de remarketing:", error);
        res.status(500).json({ error: "Erro ao gerar relatório" });
    }
});

module.exports = router;