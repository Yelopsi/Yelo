const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const gamificationService = require('../services/gamificationService');
const adminCommunityController = require('./adminCommunityController');
const adminLeadController = require('./adminLeadController');
const adminUsersController = require('./adminUsersController');
const adminMessagesController = require('./adminMessagesController');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // IA da Equipe de Growth

const generateAdminToken = (id) => {
    return jwt.sign({ id, type: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '8h', // Token de admin dura 8 horas
    });
};

/**
 * Rota: POST /api/admin/login
 * Descrição: Autentica um administrador.
 */
exports.loginAdmin = async (req, res) => {
    try {
        const email = req.body.email;
        const senha = req.body.senha || req.body.password || req.body['senha-login'];
        
        // 1. Tenta buscar na tabela de Psicólogos (Admins modernos)
        let adminUser = await db.Psychologist.findOne({ where: { email, isAdmin: true } });
        let isLegacy = false;

        // 2. Fallback: Busca na tabela de Admins (Legado/Super Admin)
        if (!adminUser) {
            try {
                const results = await db.sequelize.query(
                    `SELECT * FROM "Admins" WHERE email = :email LIMIT 1`,
                    { replacements: { email }, type: db.sequelize.QueryTypes.SELECT }
                );
                if (results && results.length > 0) {
                    adminUser = results[0];
                    isLegacy = true;
                }
            } catch (legacyErr) {
                // Tabela Admins não existe, ignora e prossegue (adminUser continuará null)
            }
        }

        if (!adminUser) {
            // Usuário não é admin ou não existe. 
            // NÃO geramos log de erro aqui, pois a rota de fallback (login.js) testa essa porta para todos.
            return res.status(401).json({ error: 'Credenciais de administrador inválidas.' });
        }

        if (await bcrypt.compare(senha, adminUser.senha)) {
            console.log(`[LOGIN ADMIN] Sucesso para: ${email}. Gerando token e cookie...`);
            // --- GERAÇÃO DE LOG REAL ---
            try {
                await db.SystemLog.create({
                    level: 'info',
                    message: `Login de administrador bem-sucedido: ${adminUser.email}`,
                    meta: { adminId: adminUser.id, isLegacy }
                });
            } catch (err) {}

            const token = generateAdminToken(adminUser.id);

            // --- FIX: Define Cookie para evitar logout ---
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 8 * 60 * 60 * 1000 // 8 horas
            , sameSite: 'lax' 
        });

            res.status(200).json({ 
                token: token,
                user: {
                    id: adminUser.id,
                    nome: adminUser.nome,
                    email: adminUser.email
                }
            });
        } else {
            // O usuário É um admin, mas errou a senha. Aqui sim geramos o log de falha.
            try {
                await db.SystemLog.create({
                    level: 'warning',
                    message: `Tentativa de login falha (senha incorreta) para admin: ${adminUser.email}`
                });
            } catch(e) {}
            res.status(401).json({ error: 'Credenciais de administrador inválidas.' });
        }
    } catch (error) {
        console.error('Erro no login do administrador:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// =====================================================================
// CORREÇÃO: FUNÇÕES PENDENTES ADICIONADAS PARA CONSERTAR O DEPLOY
// =====================================================================

exports.getPendingVerifications = adminUsersController.getPendingVerifications;
exports.moderatePsychologist = adminUsersController.moderatePsychologist;
exports.updateVipStatus = adminUsersController.updateVipStatus;
exports.getPsychologistFullDetails = adminUsersController.getPsychologistFullDetails;
exports.grantTrialToAll = adminUsersController.grantTrialToAll;
exports.getPendingActions = adminUsersController.getPendingActions;
exports.resetCrm = adminUsersController.resetCrm;
exports.debugCrm = adminUsersController.debugCrm;
exports.markActionSent = adminUsersController.markActionSent;

// =====================================================================
// (O RESTANTE DO SEU ARQUIVO PERMANECE IDÊNTICO)
// =====================================================================

exports.getConversationMessages = adminMessagesController.getConversationMessages;
exports.getConversations = adminMessagesController.getConversations;

/**
 * Rota: GET /api/admin/me
 * Descrição: Busca os dados do administrador logado.
 */
exports.getAdminData = async (req, res) => {
    try {
        const userId = req.user.id;

        // Tenta encontrar como Psicólogo-Admin
        const psychologistAdmin = await db.Psychologist.findByPk(userId, {
            attributes: ['id', 'nome', 'email', 'telefone', 'fotoUrl', 'isAdmin']
        });

        if (psychologistAdmin && psychologistAdmin.isAdmin) {
            return res.status(200).json(psychologistAdmin);
        } else {
            // Fallback para tabela Admins
            const [results] = await db.sequelize.query(
                `SELECT * FROM "Admins" WHERE id = :id`,
                { replacements: { id: userId } }
            );
            if (results.length > 0) {
                return res.status(200).json({
                    ...results[0],
                    role: 'admin',
                    type: 'admin',
                    isAdmin: true
                });
            }
        }

        res.status(404).json({ error: 'Administrador não encontrado.' });
    } catch (error) {
        console.error('Erro ao buscar dados do admin:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/me
 * Descrição: Atualiza os dados do administrador logado.
 */
exports.updateAdminData = async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user.type; // 'admin' ou 'psychologist'
        const { nome, email, telefone } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
        }

        // 1. Lógica para Psicólogo-Admin
        if (userType === 'psychologist') {
            const psychologistAdmin = await db.Psychologist.findByPk(userId);
            // Lógica para Psicólogo-Admin
            if (email.toLowerCase() !== psychologistAdmin.email.toLowerCase()) {
                const existingUser = await db.Psychologist.findOne({ where: { email, id: { [Op.ne]: userId } } });
                if (existingUser) return res.status(409).json({ error: 'Este email já está em uso.' });
            }
            await psychologistAdmin.update({ nome, email, telefone });
            return res.status(200).json({ message: 'Dados atualizados com sucesso!' });
        } 
        // 2. Lógica para Admin Legado (Tabela Admins)
        else {
            // Lógica para Admin da tabela 'Admins'
            const [existing] = await db.sequelize.query(`SELECT id FROM "Admins" WHERE email = :email AND id != :id LIMIT 1`, { replacements: { email, id: userId } });
            if (existing.length > 0) return res.status(409).json({ error: 'Este email já está em uso.' });

            await db.sequelize.query(
                `UPDATE "Admins" SET nome = :nome, email = :email, telefone = :telefone, "updatedAt" = NOW() WHERE id = :id`,
                { replacements: { nome, email, telefone, id: userId } }
            );
            return res.status(200).json({ message: 'Dados atualizados com sucesso!' });
        }
    } catch (error) {
        console.error('Erro ao atualizar dados do admin:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/me/password
 * Descrição: Atualiza a senha do administrador logado.
 */
exports.updateAdminPassword = async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;
        const userId = req.user.id;
        const userType = req.user.type; // Identifica se é 'admin' ou 'psychologist'

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }

        // 1. Se for Psicólogo Admin
        if (userType === 'psychologist') {
            const psychologistAdmin = await db.Psychologist.findByPk(userId);
            const isMatch = await bcrypt.compare(senha_atual, psychologistAdmin.senha);
            if (!isMatch) return res.status(401).json({ error: 'A senha atual está incorreta.' });

            psychologistAdmin.senha = await bcrypt.hash(nova_senha, 10);
            await psychologistAdmin.save();
            return res.status(200).json({ message: 'Senha alterada com sucesso!' });
        } 
        // 2. Se for Admin Legado (Seu caso)
        else {
            // Lógica para Admin da tabela 'Admins'
            const [rows] = await db.sequelize.query(`SELECT senha FROM "Admins" WHERE id = :id`, { replacements: { id: userId } });
            if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });

            const userHash = rows[0].senha;
            const isMatch = await bcrypt.compare(senha_atual, userHash);
            if (!isMatch) return res.status(401).json({ error: 'A senha atual está incorreta.' });

            const newHash = await bcrypt.hash(nova_senha, 10);
            await db.sequelize.query(`UPDATE "Admins" SET senha = :senha, "updatedAt" = NOW() WHERE id = :id`, { replacements: { senha: newHash, id: userId } });
            return res.status(200).json({ message: 'Senha alterada com sucesso!' });
        }
    } catch (error) {
        console.error('Erro ao alterar senha do admin:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/me/photo
 * Descrição: Atualiza a foto de perfil do administrador logado.
 */
exports.updateAdminPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
        }

        const userId = (req.user && req.user.id) || (req.userDecoded && req.userDecoded.id);
        const userType = (req.user && req.user.type) || (req.userDecoded && req.userDecoded.type) || 'admin';

        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        // Integração com Cloudinary
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET
        });

        let fotoUrl = '';
        try {
            if (req.file.buffer) {
                fotoUrl = await new Promise((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: 'yelo/profiles',
                            public_id: `admin-profile-${userId}-${Date.now()}`,
                            overwrite: true,
                            transformation: [{ width: 800, height: 800, crop: 'fill', gravity: 'face' }, { quality: 'auto:best' }, { fetch_format: 'auto' }]
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result.secure_url);
                        }
                    );
                    uploadStream.end(req.file.buffer);
                });
            } else {
                throw new Error('Formato de arquivo não suportado');
            }
        } catch (uploadError) {
            return res.status(500).json({ error: `Falha no provedor de imagens (Cloudinary): ${uploadError.message}` });
        }

        const isModernAdmin = await db.Psychologist.findOne({ where: { id: userId, isAdmin: true } });

        if (isModernAdmin) {
            await db.Psychologist.update({ fotoUrl }, { where: { id: userId } });
        } else {
            try {
                await db.sequelize.query('ALTER TABLE "Admins" ADD COLUMN IF NOT EXISTS "fotoUrl" VARCHAR(255);');
            } catch (colErr) {
                console.warn("Aviso ao verificar coluna fotoUrl:", colErr.message);
            }

            await db.sequelize.query(`UPDATE "Admins" SET "fotoUrl" = :fotoUrl, "updatedAt" = NOW() WHERE id = :id`, {
                replacements: { fotoUrl, id: userId }
            });
        }
        return res.status(200).json({ message: 'Foto atualizada!', fotoUrl });
    } catch (error) {
        console.error('Falha Fatal ao atualizar foto do admin:', error);
        if (error && error.message && (error.message.includes('format') || error.message.includes('invalid') || error.message.includes('supported') || error.message.includes('corrupt') || error.message.includes('image'))) {
            return res.status(400).json({ error: 'Formato ou conteúdo de arquivo de imagem inválido.' });
        }
        return res.status(500).json({ error: `Erro interno no servidor ao fazer upload da foto.` });
    }
};

exports.getAllPsychologists = adminUsersController.getAllPsychologists;
exports.getAllPatients = adminUsersController.getAllPatients;

/**
 * Rota: GET /api/admin/reviews
 * Descrição: Busca todas as avaliações para a página de gestão de conteúdo.
 */
exports.getAllReviews = async (req, res) => {
    // ... (seu código existente)
    try {
        const reviews = await db.Review.findAll({
            include: [
                { model: db.Patient, as: 'patient', attributes: ['nome'] },
                { model: db.Psychologist, as: 'psychologist', attributes: ['nome'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Erro ao buscar lista de avaliações:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/reviews/pending
 * Descrição: Busca todas as avaliações com status 'pending' para moderação.
 */
exports.getPendingReviews = async (req, res) => {
    // ... (seu código existente)
    try {
        const pendingReviews = await db.Review.findAll({
            where: { status: 'pending' },
            include: [
                { model: db.Patient, as: 'patient', attributes: ['nome'] },
                { model: db.Psychologist, as: 'psychologist', attributes: ['nome'] }
            ],
            order: [['createdAt', 'ASC']] // Mais antigas primeiro
        });
        res.status(200).json(pendingReviews);
    } catch (error) {
        console.error('Erro ao buscar avaliações pendentes:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/reviews/:id/moderate
 * Descrição: Atualiza o status de uma avaliação (aprova ou rejeita).
 */
exports.moderateReview = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' ou 'rejected'
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use "approved" ou "rejected".' });
        }
        const [updated] = await db.Review.update({ status }, { where: { id } });
        if (updated) {
            res.status(200).json({ message: `Avaliação ${status === 'approved' ? 'aprovada' : 'rejeitada'} com sucesso.` });
        } else {
            res.status(404).json({ error: 'Avaliação não encontrada.' });
        }
    } catch (error) {
        console.error('Erro ao moderar avaliação:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/platform-reviews (NOVA)
 * Descrição: Busca todas as avaliações de NPS da plataforma feitas pelos psicólogos.
 */
exports.getPlatformReviews = async (req, res) => {
    try {
        const query = `
            SELECT pr.id, pr.rating, pr.comment, pr."isTestimonial", pr."createdAt", p.nome as "psychologistName", p.email as "psychologistEmail", p."fotoUrl" as "psychologistPhoto"
            FROM "PlatformReviews" pr
            LEFT JOIN "Psychologists" p ON pr."psychologistId" = p.id
            ORDER BY pr."createdAt" DESC
        `;
        const [reviews] = await db.sequelize.query(query);
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Erro ao buscar avaliações da plataforma:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/platform-reviews/:id/testimonial (NOVA)
 * Descrição: Alterna o status isTestimonial de uma avaliação.
 */
exports.togglePlatformReviewTestimonial = async (req, res) => {
    try {
        const { id } = req.params;
        const { isTestimonial } = req.body;
        await db.sequelize.query(`UPDATE "PlatformReviews" SET "isTestimonial" = :isTestimonial, "updatedAt" = NOW() WHERE id = :id`, { replacements: { id, isTestimonial } });
        res.status(200).json({ message: 'Status de prova social atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar status de depoimento:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/analytics/ranking (NOVA)
 * Descrição: Retorna o ranking de performance dos psicólogos
 */
exports.getPsiRanking = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let dateFilter = '';
        const replacements = {};

        if (startDate && endDate) {
            dateFilter = `WHERE "createdAt" >= :startDate AND "createdAt" <= :endDate`;
            // Ajuste para Timezone Brasília (UTC-3), resolvendo o vazamento de madrugadas
            replacements.startDate = new Date(`${startDate}T00:00:00-03:00`).toISOString();
            replacements.endDate = new Date(`${endDate}T23:59:59-03:00`).toISOString();
        }

        // 1. Busca Cliques do WhatsApp
        const clicksData = await db.sequelize.query(`
            SELECT "psychologistId", COUNT(id) as total_cliques
            FROM "WhatsAppClickLogs"
            ${dateFilter}
            GROUP BY "psychologistId"
        `, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

        // 2. Busca Aparições (Com fallback inteligente caso a coluna 'type' não exista na tabela antiga)
        let appearancesData = [];
        try {
            appearancesData = await db.sequelize.query(`
                SELECT "psychologistId", "type", COUNT(id) as total_aparicoes
                FROM "ProfileAppearanceLogs"
                ${dateFilter}
                GROUP BY "psychologistId", "type"
            `, { replacements, type: db.sequelize.QueryTypes.SELECT });
        } catch(e) {
            appearancesData = await db.sequelize.query(`
                SELECT "psychologistId", 'profile_click_funnel' as type, COUNT(id) as total_aparicoes
                FROM "ProfileAppearanceLogs"
                ${dateFilter}
                GROUP BY "psychologistId"
            `, { replacements, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);
        }

        // 3. Busca todos os psicólogos cadastrados (ignorando admins)
        const psis = await db.Psychologist.findAll({
            where: { 
                isAdmin: { [Op.ne]: true },
                status: 'active' // Limpa expostos, inativos, pendentes ou soft deletes
            },
            attributes: ['id', 'nome', 'status'],
            raw: true
        });

        // 4. Mapeia e consolida os dados de cada um
        const rankingMap = psis.map(psi => {
            const clickRecord = clicksData.find(c => c.psychologistId === psi.id);
            const psiApps = appearancesData.filter(a => a.psychologistId === psi.id);
            
            const cliquesWpp = clickRecord ? parseInt(clickRecord.total_cliques) : 0;
            const aparicoesBusca = psiApps.filter(a => a.type === 'profile_click_funnel').reduce((acc, curr) => acc + parseInt(curr.total_aparicoes), 0);
            const visitasDiretas = psiApps.filter(a => a.type !== 'profile_click_funnel').reduce((acc, curr) => acc + parseInt(curr.total_aparicoes), 0);
            
            return { id: psi.id, nome: psi.nome, cliquesWpp, aparicoesBusca, visitasDiretas };
        });

        // 5. Ordena o Ranking: Primeiro quem tem + Cliques, depois quem tem + Visitas/Aparições Totais
        rankingMap.sort((a, b) => {
            if (b.cliquesWpp !== a.cliquesWpp) return b.cliquesWpp - a.cliquesWpp;
            return (b.aparicoesBusca + b.visitasDiretas) - (a.aparicoesBusca + a.visitasDiretas);
        });

        // 6. Retorna o Top 50 para o Front-end
        res.status(200).json(rankingMap.slice(0, 50));
    } catch (error) {
        console.error('Erro ao buscar ranking de psis:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.getAllMessages = adminMessagesController.getAllMessages;
exports.sendBroadcastMessage = adminMessagesController.sendBroadcastMessage;
exports.sendReply = adminMessagesController.sendReply;
exports.deleteConversation = adminMessagesController.deleteConversation;
exports.deletePatient = adminUsersController.deletePatient;
exports.forceDeletePatient = adminUsersController.forceDeletePatient;
exports.restorePatient = adminUsersController.restorePatient;

/**
 * Rota: GET /api/admin/patients/:id/360
 * Descrição: Compila a linha do tempo (Dossiê) de um paciente
 */
exports.getPatient360 = async (req, res) => {
    try {
        const { id } = req.params;
        
        const patient = await db.Patient.findByPk(id, {
            attributes: ['id', 'nome', 'email', 'telefone', 'createdAt', 'status']
        });

        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });

        // Busca Histórico de Demandas (Questionários)
        const demandas = await db.DemandSearch.findAll({
            where: { patientId: id },
            order: [['createdAt', 'DESC']]
        }).catch(() => []);

        // Busca Cliques no WhatsApp
        const cliques = await db.WhatsAppClickLog.findAll({
            where: { patientId: id },
            include: [{ model: db.Psychologist, as: 'psychologist', attributes: ['nome'] }],
            order: [['createdAt', 'DESC']]
        }).catch(() => []);

        // Compila a timeline
        const timeline = [];
        
        timeline.push({ type: 'system', date: patient.createdAt, title: 'Conta Criada', description: 'Paciente se registrou na plataforma.' });

        demandas.forEach(d => {
            timeline.push({
                type: d.status === 'completed' ? 'success' : 'warning',
                date: d.createdAt,
                title: d.status === 'completed' ? 'Questionário Finalizado' : 'Questionário Iniciado',
                description: d.status === 'completed' ? 'Concluiu o funil e viu os matches.' : 'Abandonou o questionário.'
            });
        });

        cliques.forEach(c => {
            timeline.push({ type: 'success', date: c.createdAt, title: 'Contato Realizado', description: `Clicou no WhatsApp do profissional: ${c.psychologist ? c.psychologist.nome : 'Desconhecido'}` });
        });

        timeline.sort((a, b) => new Date(b.date) - new Date(a.date)); // Mais recente primeiro
        res.json({ patient, timeline });

    } catch (error) {
        console.error("Erro no Dossiê 360 do Paciente:", error);
        res.status(500).json({ error: 'Erro ao carregar o histórico.' });
    }
};

exports.getInternalNotesForConversation = adminMessagesController.getInternalNotesForConversation;
exports.addInternalNote = adminMessagesController.addInternalNote;

exports.updatePsychologistStatus = adminUsersController.updatePsychologistStatus;
exports.updatePatientStatus = adminUsersController.updatePatientStatus;
exports.deletePsychologist = adminUsersController.deletePsychologist;
exports.forceDeletePsychologist = adminUsersController.forceDeletePsychologist;

// =====================================================================
// GESTÃO DE CONTEÚDO (BLOG E FÓRUM)
// =====================================================================

exports.getAllBlogPosts = adminCommunityController.getAllBlogPosts;
exports.deleteBlogPost = adminCommunityController.deleteBlogPost;
exports.deleteForumPost = adminCommunityController.deleteForumPost;

// ----------------------------------------------------------------------
// Rota: GET /api/admin/exit-surveys
// Descrição: Busca as pesquisas de satisfação de saída (Churn) preenchidas
// ----------------------------------------------------------------------
exports.getExitSurveys = async (req, res) => {
    try {
        const { motivo, nota, startDate, endDate } = req.query;
        const whereClause = {};

        if (motivo) whereClause.motivo = motivo;
        if (nota) whereClause.avaliacao = parseInt(nota, 10);
        
        if (startDate || endDate) {
            whereClause.createdAt = {};
            if (startDate) whereClause.createdAt[Op.gte] = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                whereClause.createdAt[Op.lte] = end;
            }
        }

        const surveys = await db.ExitSurvey.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']]
        });

        const total = surveys.length;
        const media = total > 0 ? (surveys.reduce((acc, curr) => acc + (curr.avaliacao || 0), 0) / total).toFixed(1) : 0;
        
        const reasonCounts = {};
        surveys.forEach(s => { if (s.motivo) reasonCounts[s.motivo] = (reasonCounts[s.motivo] || 0) + 1; });
        
        let topReason = null; let maxCount = 0;
        for (const [reason, count] of Object.entries(reasonCounts)) { if (count > maxCount) { maxCount = count; topReason = reason; } }

        res.json({ stats: { total, media, topReason }, list: surveys });
    } catch (error) {
        console.error('Erro ao buscar exit surveys:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
};

/**
 * Rota: GET /api/admin/export/patients
 * Descrição: Exporta uma lista de todos os pacientes para marketing.
 */
exports.exportPatients = async (req, res) => {
    try {
        const patients = await db.Patient.findAll({
            attributes: ['nome', 'telefone', 'email'],
            order: [['nome', 'ASC']],
            paranoid: false // Inclui pacientes que excluíram a conta
        });
        res.json(patients);
    } catch (error) {
        console.error("Erro ao exportar pacientes:", error);
        res.status(500).json({ error: 'Erro ao gerar lista de pacientes.' });
    }
};

/**
 * Rota: GET /api/admin/export/psychologists
 * Descrição: Exporta uma lista de todos os psicólogos para marketing.
 */
exports.exportPsychologists = async (req, res) => {
    try {
        const psychologists = await db.Psychologist.findAll({
            attributes: ['nome', 'telefone', 'email'],
            where: {
                isAdmin: { [Op.ne]: true } // Exclui o próprio admin da lista
            },
            order: [['nome', 'ASC']],
            paranoid: false // Inclui psicólogos que excluíram a conta
        });
        res.json(psychologists);
    } catch (error) {
        console.error("Erro ao exportar psicólogos:", error);
        res.status(500).json({ error: 'Erro ao gerar lista de psicólogos.' });
    }
};

/**
 * Rota: GET /api/admin/export/waitlist
 * Descrição: Exporta a lista de espera para marketing.
 */
exports.exportWaitlist = async (req, res) => {
    try {
        const waitlist = await db.WaitingList.findAll({
            order: [['createdAt', 'DESC']]
        });
        res.json(waitlist);
    } catch (error) {
        console.error("Erro ao exportar waitlist:", error);
        res.status(500).json({ error: "Erro ao exportar lista de espera" });
    }
};

// --- GESTÃO DE PUSH NOTIFICATIONS ---
exports.sendPushNotification = async (req, res) => {
    try {
        const { title, content, target, scheduleType, scheduleDate, scheduleTime } = req.body;
        console.log(`[Admin] 📢 Disparando Push: "${title}" para [${target}]`);
        console.log(`[Admin] Mensagem: ${content.substring(0, 50)}...`);
        if (scheduleType === 'agendado') {
            console.log(`[Admin] ⏳ Agendado para: ${scheduleDate} às ${scheduleTime}`);
        }
        // TODO: Integrar com Firebase Cloud Messaging ou OneSignal
        res.json({ success: true, message: 'Push notification enviado/agendado com sucesso!' });
    } catch (error) {
        console.error("Erro ao enviar push:", error);
        res.status(500).json({ error: "Erro ao enviar notificação push" });
    }
};


/**
 * Rota: GET /api/admin/followups
 * Descrição: Busca a lista de cliques no WhatsApp para follow-up.
 */
exports.getFollowUps = async (req, res) => {
    try {
        const formatted = [];

        // 1. Busca os logs de PACIENTES (tabela antiga: WhatsappClickLogs)
        const [patientResults] = await db.sequelize.query(`
            SELECT 
                w.id, 
                w."createdAt" as date, 
                w.status, 
                w."message_sent_at",
                w."guestPhone",
                w."guestName",
                p.nome as "patientName", 
                p.telefone as "patientPhone",
                psi.nome as "psychologistName",
                psi.telefone as "psychologistPhone"
            FROM "WhatsAppClickLogs" w
            LEFT JOIN "Patients" p ON w."patientId" = p.id
            LEFT JOIN "Psychologists" psi ON w."psychologistId" = psi.id
            WHERE COALESCE(w.status, 'pending') != 'deleted'
            ORDER BY w."createdAt" DESC
            LIMIT 150
        `);

        patientResults.forEach(item => {
            const patientName = item.patientName || item.guestName || 'Visitante';
            const patientPhone = item.guestPhone || item.patientPhone || '';
            const psiName = item.psychologistName || 'Psicólogo';
            
            formatted.push({
                id: item.id,
                date: item.date,
                type: 'patient_followup',
                targetName: patientName,
                targetPhone: patientPhone,
                psychologistName: psiName,
                patientName: patientName,
                status: item.status || 'pending',
                message_sent_at: item.message_sent_at
            });
        });

        // 2. Busca os logs de PSICÓLOGOS (tabela nova: WhatsAppClickLogs)
        const [psiResults] = await db.sequelize.query(`
            SELECT 
                w.id, 
                w."createdAt" as date, 
                w."guestName",
                w."feedbackGiven",
                w."dealClosed",
                w."adminWppReminderSentAt",
                w."adminWppReminderCount",
                psi.nome as "psychologistName",
                psi.telefone as "psychologistPhone"
            FROM "WhatsAppClickLogs" w
            LEFT JOIN "Psychologists" psi ON w."psychologistId" = psi.id
            WHERE (w."feedbackGiven" = false OR w."feedbackGiven" IS NULL)
               OR (w."feedbackGiven" = true AND w."dealClosed" = 'talking')
            ORDER BY w."createdAt" DESC
        `);

        psiResults.forEach(item => {
            const patientName = item.guestName || 'Visitante';
            const psiName = item.psychologistName || 'Psicólogo';
            const psiPhone = item.psychologistPhone || '';

            // Follow-up Psi: Feedback Pendente
            if (item.feedbackGiven === false || item.feedbackGiven === null) {
                if (item.adminWppReminderSentAt) {
                    const daysSinceReminder = (new Date() - new Date(item.adminWppReminderSentAt)) / (1000 * 60 * 60 * 24);
                    if (daysSinceReminder >= 7) {
                        formatted.push({
                            id: item.id + '_psi_feedback',
                            realId: item.id,
                            date: item.adminWppReminderSentAt,
                            type: 'psi_feedback',
                            targetName: psiName,
                            targetPhone: psiPhone,
                            psychologistName: psiName,
                            patientName: patientName,
                            status: item.adminWppReminderCount > 1 ? 'sent' : 'pending',
                            message_sent_at: item.adminWppReminderCount > 1 ? item.adminWppReminderSentAt : null
                        });
                    }
                } else {
                    const hoursSinceClick = (new Date() - new Date(item.date)) / (1000 * 60 * 60);
                    if (hoursSinceClick >= 48) {
                        formatted.push({
                            id: item.id + '_psi_feedback',
                            realId: item.id,
                            date: item.date,
                            type: 'psi_feedback',
                            targetName: psiName,
                            targetPhone: psiPhone,
                            psychologistName: psiName,
                            patientName: patientName,
                            status: 'pending',
                            message_sent_at: null
                        });
                    }
                }
            }

            // Follow-up Psi: Em Negociação
            if (item.feedbackGiven === true && item.dealClosed === 'talking') {
                const daysSinceClick = (new Date() - new Date(item.date)) / (1000 * 60 * 60 * 24);
                if (daysSinceClick >= 7) {
                    formatted.push({
                        id: item.id + '_psi_negotiation',
                        realId: item.id,
                        date: item.date,
                        type: 'psi_negotiation',
                        targetName: psiName,
                        targetPhone: psiPhone,
                        psychologistName: psiName,
                        patientName: patientName,
                        status: item.adminWppReminderCount > 0 ? 'sent' : 'pending',
                        message_sent_at: item.adminWppReminderCount > 0 ? item.adminWppReminderSentAt : null
                    });
                }
            }
        });

        // Ordenar por data decrescente
        formatted.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(formatted);
    } catch (error) {
        console.error("Erro ao buscar follow-ups:", error);
        res.status(500).json({ error: "Erro interno ao buscar lista." });
    }
};

/**
 * Rota: PUT /api/admin/followups/:id
 * Descrição: Atualiza o status de um follow-up.
 */
exports.updateFollowUpStatus = async (req, res) => {
    try {
        let { id } = req.params;
        const { status, message_sent_at } = req.body;

        // Parse composite ID
        let isPsiFeedback = false;
        let isPsiNegotiation = false;
        if (typeof id === 'string') {
            if (id.includes('_psi_feedback')) {
                isPsiFeedback = true;
                id = id.replace('_psi_feedback', '');
            } else if (id.includes('_psi_negotiation')) {
                isPsiNegotiation = true;
                id = id.replace('_psi_negotiation', '');
            }
        }

        if (isPsiFeedback || isPsiNegotiation) {
            // Se for um follow-up direcionado ao psicólogo, o clique de "Mensagem enviada" incrementa o contador
            let query = `UPDATE "WhatsAppClickLogs" SET "adminWppReminderCount" = "adminWppReminderCount" + 1`;
            const replacements = { id };

            if (message_sent_at) {
                query += `, "adminWppReminderSentAt" = :message_sent_at`;
                replacements.message_sent_at = message_sent_at;
            }

            query += ` WHERE id = :id`;
            await db.sequelize.query(query, { replacements });
        } else {
            // Lógica padrão para o follow-up do Paciente
            let query = `UPDATE "WhatsAppClickLogs" SET status = :status`;
            const replacements = { id, status };

            if (message_sent_at) {
                query += `, "message_sent_at" = :message_sent_at`;
                replacements.message_sent_at = message_sent_at;
            }

            query += ` WHERE id = :id`;
            await db.sequelize.query(query, { replacements });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Erro ao atualizar follow-up:", error);
        res.status(500).json({ error: "Erro ao atualizar." });
    }
};

/**
 * Rota: DELETE /api/admin/followups/:id
 * Descrição: Exclui (soft delete) um item de follow-up.
 */
exports.deleteFollowUp = async (req, res) => {
    try {
        let { id } = req.params;

        if (typeof id === 'string') {
            if (id.includes('_psi_feedback')) id = id.replace('_psi_feedback', '');
            else if (id.includes('_psi_negotiation')) id = id.replace('_psi_negotiation', '');
        }

        await db.sequelize.query(`UPDATE "WhatsAppClickLogs" SET status = 'deleted' WHERE id = :id`, {
            replacements: { id }
        });
        res.json({ success: true, message: "Contato excluído." });
    } catch (error) {
        console.error("Erro ao excluir follow-up:", error);
        res.status(500).json({ error: "Erro ao excluir." });
    }
};

// --- PROSPECÇÃO DE LEADS (OUTBOUND) ---
exports.getLeads = adminLeadController.getLeads;
exports.registrarContatoLead = adminLeadController.registrarContatoLead;
exports.atualizarStatusLead = adminLeadController.atualizarStatusLead;
exports.excluirLead = adminLeadController.excluirLead;
exports.runScraper = adminLeadController.runScraper;
exports.testWhatsAppMessage = adminLeadController.testWhatsAppMessage;
exports.testOutboundBatch = adminLeadController.testOutboundBatch;

// ----------------------------------------------------------------------
// Rota: GET /api/admin/psychologists/:id/analyze (NOVA)
// Descrição: Gera feedback de perfil usando IA para o WhatsApp
// ----------------------------------------------------------------------
exports.analyzeProfile = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Busca os dados super enriquecidos do psicólogo
        const psi = await db.Psychologist.findByPk(id, {
            attributes: [
                'nome', 'bio', 'valor_sessao_numero', 'valor_mensal_numero', 'tipo_cobranca', 
                'temas_atuacao', 'abordagens_tecnicas', 'fotoUrl', 'authority_level', 'xp',
                'profile_appearances', 'whatsapp_clicks', 'createdAt',
                'planExpiresAt', 'subscriptionId', 'status', 'plano', 'is_exempt',
                'utm_source', 'genero_identidade', 'aiOptimizationHistory'
            ]
        });

        if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        // 2. Busca métricas extras de engajamento
        const reviewsCount = await db.Review.count({ where: { psychologistId: id, status: 'approved' } }).catch(() => 0);
        const recentReviews = await db.Review.findAll({ 
            where: { psychologistId: id, status: 'approved' },
            attributes: ['rating', 'comment'],
            order: [['createdAt', 'DESC']],
            limit: 3
        }).catch(() => []);

        let postsCount = 0;
        let recentPosts = [];
        if (db.Post) {
            postsCount = await db.Post.count({ where: { psychologistId: id } }).catch(() => 0);
            recentPosts = await db.Post.findAll({
                where: { psychologistId: id },
                attributes: ['titulo', 'conteudo'],
                order: [['createdAt', 'DESC']],
                limit: 2
            }).catch(() => []);
        }
        let forumAnswersCount = 0;
        if (db.ForumComment) forumAnswersCount = await db.ForumComment.count({ where: { PsychologistId: id } }).catch(() => 0);

        // 2.1. Busca Tendências de Mercado (O que os pacientes estão buscando)
        const [topDemands] = await db.sequelize.query(`
            SELECT value as tema, COUNT(*) as count 
            FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value 
            WHERE status = 'completed' AND "createdAt" >= NOW() - INTERVAL '30 days' 
            AND jsonb_typeof("searchParams"->'temas') = 'array' 
            GROUP BY value 
            ORDER BY count DESC 
            LIMIT 5;
        `).catch(() => [[]]);
        const topDemandsText = topDemands.length > 0 ? topDemands.map(d => `- ${d.tema}`).join('\n') : 'Sem dados recentes de busca.';

        // 3. Formatação do Preço
        let valorConsulta = "A combinar";
        if (psi.tipo_cobranca === 'mensal' && psi.valor_mensal_numero && parseFloat(psi.valor_mensal_numero) > 0) {
            valorConsulta = `R$ ${psi.valor_mensal_numero} (Mensal)`;
        } else if (psi.valor_sessao_numero && parseFloat(psi.valor_sessao_numero) > 0) {
            valorConsulta = `R$ ${psi.valor_sessao_numero} (Por Sessão)`;
        }

        // 3.1. Formatação de Textos para a IA
        const reviewsText = recentReviews.length > 0 ? recentReviews.map(r => `- ${r.rating} estrelas: "${r.comment && r.comment !== 'null' ? r.comment : 'Apenas nota, sem comentário escrito.'}"`).join('\n') : 'Nenhuma avaliação recente.';
        const postsText = recentPosts.length > 0 ? recentPosts.map(p => `- Título: "${p.titulo}"\n  Trecho: "${p.conteudo ? p.conteudo.substring(0, 200).replace(/\n/g, ' ') : ''}..."`).join('\n\n') : 'Nenhum artigo publicado.';

        // 3.2. Formatação de Status Financeiro/Ciclo de Vida
        const dataCadastro = new Date(psi.createdAt).toLocaleDateString('pt-BR');
        let statusPagamento = 'Desconhecido';
        const hasSubscription = !!(psi.subscriptionId);
        const isVip = psi.is_exempt;
        const agora = new Date();
        const expiracao = psi.planExpiresAt ? new Date(psi.planExpiresAt) : null;
        let diasParaExpirar = null;
        
        if (isVip) {
            statusPagamento = 'Conta VIP / Isenta';
        } else if (hasSubscription) {
            statusPagamento = `Assinante Pago (${psi.plano || 'Plano Ativo'})`;
        } else if (expiracao) {
            const diffTime = Math.ceil((expiracao - agora) / (1000 * 60 * 60 * 24));
            diasParaExpirar = diffTime;
            if (diffTime > 0) {
                statusPagamento = `Trial Ativo (Faltam ${diffTime} dias para expirar)`;
            } else {
                statusPagamento = `Trial Expirado (Há ${Math.abs(diffTime)} dias)`;
            }
        } else {
             statusPagamento = 'Pendente / Sem Trial Iniciado';
        }

        if (!process.env.GEMINI_API_KEY) {
            throw new Error("A chave GEMINI_API_KEY não foi encontrada no servidor. Adicione-a no arquivo .env!");
        }

        const diasTrialText = diasParaExpirar !== null && diasParaExpirar > 0 ? diasParaExpirar : 'alguns';

        // 3.3. Busca de Métricas Reais do Banco de Dados (Padronizadas)
        const numericId = parseInt(id, 10);
        const [matchEventsRaw] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id`, { replacements: { id: numericId } }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "PsychologistId" = :id`, { replacements: { id: numericId } })).catch(() => [[{count: 0}]]);
        const matchAppearances = (parseInt(matchEventsRaw[0]?.count || 0, 10)) + (psi.profile_appearances || 0);

        const [profileViewsRaw] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id`, { replacements: { id: numericId } }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "PsychologistId" = :id`, { replacements: { id: numericId } })).catch(() => [[{count: 0}]]);
        const profileViews = parseInt(profileViewsRaw[0]?.count || 0, 10);

        let whatsappClicks = 0;
        if (db.WhatsAppClickLog) {
            whatsappClicks = await db.WhatsAppClickLog.count({ where: { psychologistId: numericId } }).catch(() => 0);
        }

        let historyText = "Sem histórico de orientações anteriores.";
        if (psi.aiOptimizationHistory && Array.isArray(psi.aiOptimizationHistory) && psi.aiOptimizationHistory.length > 0) {
            historyText = psi.aiOptimizationHistory.map((h, i) => {
                const dateStr = h.sentAt ? new Date(h.sentAt).toLocaleDateString('pt-BR') : 'Data desconhecida';
                return `[Interação ${i+1}] Data: ${dateStr} | Mensagem enviada anteriormente: "${h.contentSnippet}"`;
            }).join('\n\n');
        }

        // 4. O SUPER PROMPT DA EQUIPE DE GROWTH
        const promptGrowth = `# ANÁLISE DE PERFIL E BOAS-VINDAS — YELO

## 1. SEU PAPEL

Você é um representante da equipe de *Growth e Customer Success da Yelo*.

## APRESENTAÇÃO

A mensagem deve apresentar obrigatoriamente o remetente como:

"Eu sou o Anderson, da Yelo."

O nome do psicólogo analisado é independente do nome do remetente. Nunca confundir os dois.

Sua função é analisar os primeiros sinais de desempenho e as informações do perfil de um psicólogo dentro da plataforma Yelo para gerar uma mensagem personalizada de boas-vindas e orientação para WhatsApp.

Você NÃO deve apenas elogiar o profissional ou apresentar funcionalidades da plataforma.

Seu objetivo é:

1. interpretar os dados disponíveis com responsabilidade;
2. identificar o estágio atual do profissional;
3. reconhecer um sinal positivo real;
4. identificar a principal oportunidade de evolução;
5. definir a orientação mais útil e justificável pelos dados disponíveis agora;
6. recomendar a ferramenta da Yelo mais adequada para essa necessidade;
7. orientar o profissional com ações práticas e específicas.

A mensagem deve fazer o profissional sentir que:

* a Yelo realmente analisou o seu momento atual;
* os dados foram interpretados de forma responsável;
* existe algo positivo ou promissor em sua trajetória;
* existe uma prioridade clara;
* ele sabe exatamente o que fazer agora;
* as ferramentas recomendadas têm relação direta com suas necessidades.

## PERSONALIZAÇÃO OBRIGATÓRIA

A mensagem deve conter pelo menos UMA observação específica daquele profissional, baseada diretamente nos dados recebidos.

Evite frases que poderiam ser enviadas para qualquer psicólogo recém-cadastrado.

Sempre que possível, conecte:
CARACTERÍSTICA REAL DO PERFIL → VALOR PARA A PACIENTE → RECOMENDAÇÃO.

A recomendação deve nascer dessa análise, e não ser escolhida simplesmente porque corresponde ao estágio.

## RECOMENDAÇÃO ESPECÍFICA

A recomendação deve apontar, sempre que possível, UMA mudança concreta baseada no conteúdo real do perfil.

Evite recomendações genéricas como "melhore sua Bio", "deixe o perfil mais convidativo" ou "explique melhor seu atendimento" sem identificar exatamente o que pode ser melhorado.

Se não houver evidência suficiente para indicar uma mudança específica, a IA deve assumir que o objetivo é apenas acompanhar a evolução dos dados, sem inventar um gargalo.

## EVIDÊNCIA TEXTUAL

Quando mencionar a Bio, temas, abordagem ou qualquer característica do perfil, a afirmação deve ser diretamente sustentada pelos dados fornecidos.

NUNCA criar uma conexão poética, interpretativa ou metafórica que não esteja claramente presente no conteúdo original.

Se não houver evidência suficiente, não mencionar a característica.

## BENCHMARK

NUNCA classificar uma métrica como "excelente", "baixa", "alta", "ótima" ou similar sem possuir benchmark ou regra objetiva para essa classificação.

Na ausência de benchmark, descreva o dado de forma neutra e interprete apenas o que ele permite concluir.

---

# 2. DADOS DISPONÍVEIS

Você poderá receber alguns ou todos os seguintes dados:

## Dados pessoais e profissionais

* Nome;
* Gênero;
* Tempo desde a criação do perfil;
* Biografia;
* Foto;
* Valor da sessão;
* Temas de atuação;
* Abordagem teórica;
* Informações sobre experiência ou formação.

## Dados de desempenho

* Número de aparições nos sistemas de recomendação;
* Número de visualizações do perfil;
* Número de favoritos;
* Número de cliques para WhatsApp;
* Número de contatos recebidos;
* Número de pacientes;
* Número de leads em negociação;
* Número de pacientes fechados;
* Dados do Histórico de Contatos, quando disponíveis.

## Dados da plataforma

* Status do período de Teste;
* Número de dias restantes do Teste;
* Top 5 temas mais buscados pelos pacientes na plataforma no período analisado;
* Outras métricas disponíveis.

IMPORTANTE:

Nunca invente dados que não foram fornecidos.

Nunca assuma que uma informação existe apenas porque seria útil para a análise.

Se um dado não estiver disponível, simplesmente não o utilize.

---

# 3. OBJETIVO CENTRAL

Antes de escrever a mensagem, faça internamente esta sequência de raciocínio:

**DADOS → QUALIDADE DA AMOSTRA → SINAL → INTERPRETAÇÃO → ESTÁGIO → PRIORIDADE → FERRAMENTA → AÇÃO → PRÓXIMA MÉTRICA**

Exemplo:

**Sinal:**
O perfil recebeu 25 visualizações.

**Interpretação:**
Já existe interesse inicial suficiente para algumas pessoas abrirem o perfil.

**Estágio:**
Conversão inicial.

**Prioridade:**
Melhorar a transformação de visitas em intenção de contato.

**Necessidade:**
Ajudar o paciente a entender melhor o atendimento e reduzir dúvidas antes do contato.

**Ferramenta:**
Ajustes > Meu Perfil.

**Ação:**
Explicar melhor como funciona o primeiro atendimento.

**Próxima métrica:**
Cliques para contato.

NÃO mostre essa estrutura técnica ao profissional.

Utilize-a apenas para construir uma análise coerente.

## REGRA DE OURO — NÃO FORÇAR UM DIAGNÓSTICO

A análise NÃO precisa encontrar um problema.

Quando a amostra for pequena demais para sustentar uma conclusão, a IA deve dizer isso claramente e evitar diagnosticar gargalos de conversão, Bio, preço, foto ou posicionamento.

Exemplo: 1 aparição + 1 visualização + 0 contatos NÃO permite concluir que existe um problema de conversão.

Nesse cenário, a IA deve priorizar uma observação concreta e específica do perfil e, quando fizer sentido, sugerir uma melhoria preventiva.

---

# 4. PRINCÍPIO MAIS IMPORTANTE

A mensagem deve responder claramente:

*Qual é a coisa mais importante que este profissional pode fazer agora para evoluir na Yelo?*

Escolha apenas UMA prioridade principal.

Pode haver até duas recomendações complementares, mas nunca apresente várias prioridades concorrentes.

A recomendação principal deve estar diretamente conectada ao diagnóstico.

---

# 5. INTERPRETAÇÃO RESPONSÁVEL DOS DADOS

## 5.1 Perfis novos possuem pouca evidência

Quando o profissional possui poucos dias de plataforma ou poucos dados:

* NÃO tire conclusões definitivas;
* NÃO diga que o perfil está performando muito bem apenas porque possui alguns acessos;
* NÃO trate ausência de contatos como fracasso;
* reconheça que os dados ainda estão amadurecendo.

Utilize expressões como:

* "primeiros sinais";
* "início da sua trajetória";
* "amostra ainda inicial";
* "dados que ainda estão amadurecendo";
* "vale acompanhar a evolução nos próximos dias";
* "ainda é cedo para tirar conclusões definitivas".

Evite:

* "isso prova que";
* "isso mostra com certeza";
* "seu perfil está performando muito bem";

quando a quantidade de dados ainda for pequena.

---

## 5.2 Diferencie visibilidade de conversão

Interprete cada etapa corretamente.

### Aparições

Indicam oportunidade de o perfil ser encontrado.

Não significam necessariamente interesse.

### Visualizações

Indicam que alguém demonstrou interesse suficiente para abrir o perfil.

Não significam necessariamente intenção de contato.

### Favoritos

Representam um sinal de interesse potencialmente mais forte que uma simples visualização.

Devem ser analisados como oportunidade para compreender melhor quem está demonstrando interesse.

### Cliques para WhatsApp

Representam uma intenção mais forte de iniciar contato.

### Contatos

Representam uma oportunidade real de conversa com um potencial paciente.

### Fechamentos

Representam a transformação de uma oportunidade em paciente.

Nunca trate todas essas métricas como equivalentes.

---

## 5.3 Não esconda oportunidades importantes

A mensagem deve ser positiva e construtiva.

Porém, NÃO esconda completamente um ponto importante apenas para manter um tom positivo.

Se existem muitas visualizações e poucos cliques, NÃO diga:

"Você teve 0 cliques."

Mas também NÃO ignore o fato.

Prefira:

"Seu perfil já está conseguindo atrair visitas. O próximo passo agora é entender como tornar essa primeira impressão ainda mais clara e convidativa para quem chega até você."

Transforme um dado fraco em uma *oportunidade de evolução*.

Nunca transforme a análise em crítica.

## CAUSALIDADE

Não apresente correlação como causa.

Use "pode indicar", "vale observar" ou "é uma oportunidade" quando os dados não forem suficientes para afirmar uma causa.

Nunca diga que determinado elemento do perfil está causando baixa conversão sem evidência suficiente.

---

# 6. COMO DEFINIR O ESTÁGIO DO PROFISSIONAL

O estágio deve ser determinado prioritariamente por regras objetivas baseadas nos dados disponíveis. A IA recebe esse estágio e é responsável por interpretar o contexto e comunicar a orientação de forma personalizada.

Quando não houver dados suficientes, utilizar ESTÁGIO A — INÍCIO / DADOS INSUFICIENTES.

## ESTÁGIO A — INÍCIO

Utilize quando:

* o perfil é muito recente;
* existem poucos dados;
* ainda não existe evidência suficiente para identificar um gargalo específico.

### Prioridade

Preparar bem o perfil e acompanhar os primeiros sinais.

---

## ESTÁGIO B — DESCOBERTA

Utilize quando:

* existem aparições;
* existem poucas ou algumas visualizações;
* o perfil ainda está começando a ser descoberto.

### Prioridade

Entender se o perfil está conseguindo despertar interesse e melhorar a clareza da apresentação.

---

## ESTÁGIO C — INTERESSE

Utilize quando:

* existem visualizações;
* existem favoritos;
* há sinais de interesse;
* mas ainda existem poucos contatos.

### Prioridade

Melhorar a transformação de interesse em intenção de contato.

---

## ESTÁGIO D — CONVERSÃO

Utilize quando:

* o profissional já recebe contatos;
* existem leads;
* existem negociações;
* mas ainda há oportunidade de melhorar o fechamento ou acompanhamento.

### Prioridade

Organizar os contatos e melhorar a condução das conversas.

---

## ESTÁGIO E — ESTRUTURAÇÃO

Utilize quando:

* a carteira de pacientes está crescendo;
* existem vários pacientes;
* existe necessidade de organização clínica ou financeira.

### Prioridade

Estruturar a gestão da clínica.

---

## ESTÁGIO F — AUTORIDADE E EXPANSÃO

Utilize quando:

* o perfil já possui uma base clara;
* não existe um gargalo urgente;
* o profissional pode fortalecer presença e autoridade.

### Prioridade

Ampliar presença, autoridade e participação no ecossistema.

---

# 7. COMO ANALISAR A BIO

Ao analisar a biografia, NÃO faça elogios vagos.

NÃO diga apenas:

"Sua bio transmite acolhimento."

Explique o motivo com base em elementos reais.

Procure identificar:

* clareza sobre para quem atende;
* temas específicos;
* forma de conduzir a terapia;
* linguagem acessível;
* acolhimento;
* explicação da abordagem;
* diferenciais profissionais;
* experiência;
* excesso de termos técnicos;
* linguagem muito genérica;
* ausência de explicação sobre o processo terapêutico.

Exemplo adequado:

"Você apresenta com clareza alguns dos temas com os quais trabalha, o que pode facilitar a identificação de pacientes que procuram ajuda para essas questões."

Exemplo inadequado:

"Sua bio está ótima e transmite muita humanidade."

NUNCA invente características que não estão presentes na bio.

---

# 8. USO DA ABORDAGEM TEÓRICA

A abordagem teórica pode ajudar a personalizar a linguagem da análise.

Porém:

* NÃO faça interpretações clínicas profundas;
* NÃO invente conceitos da abordagem;
* NÃO utilize jargões apenas para parecer especializado;
* NÃO diga que uma abordagem é melhor que outra;
* NÃO sugira mudar de abordagem.

Utilize a abordagem apenas quando ela realmente ajudar a tornar uma recomendação mais relevante.

---

# 9. USO DOS TEMAS MAIS BUSCADOS

Os Top 5 temas mais buscados pelos pacientes devem ser utilizados apenas quando houver relação REAL com os temas que o profissional já atende.

Exemplo correto:

O profissional já atende ansiedade e relacionamentos, e esses temas aparecem entre as buscas relevantes.

Você pode dizer:

"Alguns temas que já fazem parte da sua atuação também aparecem entre assuntos bastante procurados pelos pacientes. Vale garantir que essas áreas estejam apresentadas com clareza no seu perfil."

Exemplo incorreto:

"Ansiedade está sendo muito buscada. Você deveria atender ansiedade."

NUNCA:

* sugira que o profissional passe a atender um tema apenas porque existe demanda;
* invente especialidades;
* incentive atuação fora da área do profissional.

A demanda deve ajudar o profissional a *comunicar melhor aquilo que já faz*, e não mudar sua atuação.

---

# 10. PREÇO E POSICIONAMENTO

NUNCA diga diretamente que o profissional deve:

* aumentar o preço;
* diminuir o preço;
* cobrar determinado valor;
* copiar o preço de outros profissionais.

Se houver necessidade de reflexão sobre posicionamento, recomende ferramentas apropriadas.

Exemplo:

"Se você quiser entender melhor como o seu valor atual se relaciona com a estrutura da sua clínica e com o mercado, vale explorar as ferramentas de *Calculadora de Honorários* e *Métricas & Mercado*."

NÃO mencione preço automaticamente em todas as mensagens.

---

## FERRAMENTAS DO DASHBOARD — RECOMENDAÇÃO OBRIGATÓRIA QUANDO HOUVER ADERÊNCIA

O psicólogo possui acesso a ferramentas dentro do seu dashboard.

A IA deve analisar o gargalo ou oportunidade identificada e verificar se existe UMA ferramenta disponível que possa ajudar diretamente naquele momento.

Quando houver aderência, a ferramenta deve fazer parte do plano de ação.

A ferramenta NÃO deve ser mencionada apenas para divulgar uma funcionalidade da Yelo.

A recomendação deve seguir:

GARGALO/OPORTUNIDADE → NECESSIDADE → FERRAMENTA → COMO USAR → OBJETIVO

A IA deve recomendar apenas UMA ferramenta principal por mensagem.

Se nenhuma ferramenta for realmente útil para o momento identificado (ou seja, o perfil já está bom e sem gargalos evidentes), a IA deve:
1. Reconhecer que o cenário está "nos conformes" e que o perfil está redondo.
2. FAZER UM CONVITE DE DESCOBERTA: Escolher ALEATORIAMENTE UMA das ferramentas secundárias do catálogo (por exemplo, Comunidade Yelo, Calculadora de Honorários, Financeiro, etc.) e apresentá-la de forma leve e convidativa. 
Exemplo de abordagem: "Como o seu perfil já está super bem estruturado, queria aproveitar para te convidar a conhecer o nosso Fórum..."

## CATÁLOGO DE FERRAMENTAS DISPONÍVEIS

- Meu Perfil Público → visualizar o perfil como uma paciente e avaliar a apresentação.
- Métricas & Mercado → acompanhar desempenho, preço de mercado e temas procurados.
- Análise de Favoritos → entender quem favoritou o perfil e quais temas essas pessoas procuram.
- Clínica / Meus Pacientes → acompanhar pacientes e sessões.
- Financeiro → acompanhar receitas, despesas e fluxo de caixa.
- Calculadora de Honorários → apoiar decisões relacionadas aos honorários.
- Manual de Conversão → orientar o profissional sobre como transformar contatos em pacientes.
- Comunidade Yelo → interação e troca com outros profissionais.

IMPORTANTE:
Nunca invente ferramentas, funções ou caminhos de navegação que não estejam neste catálogo.

---

# 13. MATRIZ DE DECISÃO

Utilize esta matriz como orientação.

---

## CENÁRIO 1 — PERFIL NOVO E POUCOS DADOS

### Diagnóstico possível

Ainda não existe informação suficiente para identificar um gargalo real.

### Prioridade

Preparar bem o perfil e acompanhar os primeiros sinais.

### Ferramentas prioritárias

1. *Ajustes > Meu Perfil*
2. *Ajustes > Meu Perfil Público*
3. *Evolução > Comunidade Yelo* ou *Minha Jornada*

### Não fazer

NÃO inventar um problema.

NÃO dizer que o perfil está indo muito bem apenas porque possui alguns acessos.

---

## CENÁRIO 2 — MUITAS APARIÇÕES, POUCAS VISUALIZAÇÕES

### Possível necessidade

Melhorar a atratividade e a clareza da primeira impressão.

### Prioridade

Entender se a apresentação do profissional desperta interesse.

### Ferramentas prioritárias

1. *Ajustes > Meu Perfil*
2. *Ajustes > Meu Perfil Público*
3. *Clínica > Métricas & Mercado*, se houver oportunidade relacionada aos temas.

### Pergunta central

"Uma pessoa consegue entender rapidamente por que deveria abrir este perfil?"

---

## CENÁRIO 3 — EXISTEM VISUALIZAÇÕES, MAS POUCOS CLIQUES OU CONTATOS

### Possível necessidade

Melhorar a conversão de interesse em intenção de contato.

### Prioridade

Tornar a proposta de atendimento mais clara e reduzir dúvidas do paciente.

### Ferramentas prioritárias

1. *Ajustes > Meu Perfil*
2. *Ajustes > Meu Perfil Público*
3. *Clínica > Análise de Favoritos*, se existirem favoritos.

### Pergunta central

"Quem visita o perfil consegue entender claramente como seria iniciar um processo com este profissional?"

---

## CENÁRIO 4 — EXISTEM FAVORITOS

### Possível necessidade

Entender melhor quem demonstra interesse pelo perfil.

### Ferramentas prioritárias

1. *Clínica > Análise de Favoritos*
2. *Ajustes > Meu Perfil*
3. *Clínica > Métricas & Mercado*, quando houver relação com demanda.

### Pergunta central

"Existe algum padrão entre as pessoas que demonstram maior interesse pelo perfil?"

---

## CENÁRIO 5 — EXISTEM CONTATOS, MAS POUCOS FECHAMENTOS

### Possível necessidade

Melhorar acompanhamento e condução das oportunidades.

### Ferramentas prioritárias

1. *Evolução > Histórico de Contatos*
2. *Clínica > Manual de Conversão*
3. *Clínica > Meus Pacientes*, quando houver crescimento da carteira.

### Pergunta central

"O profissional está acompanhando adequadamente as oportunidades que já chegaram?"

---

## CENÁRIO 6 — OS TEMAS DO PROFISSIONAL POSSUEM RELAÇÃO COM A DEMANDA

### Possível necessidade

Comunicar melhor uma competência que já existe.

### Ferramentas prioritárias

1. *Clínica > Métricas & Mercado*
2. *Ajustes > Meu Perfil*
3. *Evolução > Perguntas da Comunidade* ou *Meus Artigos*, apenas se o perfil já estiver bem estruturado.

### Regra

A demanda serve para melhorar a comunicação de temas que o profissional JÁ atende.

Nunca para alterar artificialmente sua atuação.

---

## CENÁRIO 7 — PERFIL BEM ESTRUTURADO, SEM GARGALO URGENTE

### Possível necessidade

Fortalecer autoridade e presença.

### Ferramentas prioritárias

1. *Evolução > Perguntas da Comunidade*
2. *Evolução > Meus Artigos*
3. *Evolução > Fórum de Discussão*

### Objetivo

Transformar conhecimento e experiência em presença dentro do ecossistema.

---

## CENÁRIO 8 — CRESCIMENTO DA CARTEIRA DE PACIENTES

### Possível necessidade

Estruturar melhor a prática profissional.

### Ferramentas prioritárias

1. *Clínica > Meus Pacientes*
2. *Clínica > Financeiro*
3. *Evolução > Histórico de Contatos*

---

# 14. LIMITE DE RECOMENDAÇÕES

A mensagem final deve conter:

* 1 recomendação principal;
* até 2 recomendações complementares.

NUNCA recomende uma lista extensa de ferramentas.

A recomendação principal deve ser a de maior impacto.

As recomendações complementares devem apoiar a principal.

---

# 15. FORMATO DE CADA RECOMENDAÇÃO

Sempre que recomendar uma ferramenta, deixe claro:

### 1. Por que ela está sendo recomendada

Baseado em uma necessidade real.

### 2. Onde encontrá-la

Exemplo:

*Ajustes > Meu Perfil*

### 3. O que fazer

Uma ação concreta.

Exemplo adequado:

"Abra *Ajustes > Meu Perfil* e acrescente uma ou duas frases explicando como costuma funcionar o primeiro encontro."

Exemplo inadequado:

"Explore seu perfil."

---

# 16. TOM DE VOZ

Fale em nome da Yelo, utilizando a primeira pessoa do plural quando isso soar natural.

Exemplos possíveis:

* "Nós analisamos..."
* "Percebemos..."
* "Nossa principal recomendação..."
* "Acreditamos que..."
* "Para este momento, nossa sugestão é..."

NÃO repita obrigatoriamente as mesmas frases em todas as mensagens.

A mensagem deve parecer natural e personalizada.

O tom deve ser:

* próximo;
* acolhedor;
* profissional;
* inteligente;
* parceiro;
* claro;
* orientado à evolução.

Evite ser:

* corporativo demais;
* excessivamente entusiasmado;
* paternalista;
* crítico;
* genérico;
* exageradamente técnico.

---

# 17. FOCO NO POSITIVO, SEM ESCONDER A REALIDADE

Sempre procure reconhecer algo positivo real.

Porém, não invente elogios.

Exemplos de sinais positivos possíveis:

* primeiros sinais de visibilidade;
* perfil sendo visualizado;
* temas apresentados com clareza;
* alinhamento entre atuação e demanda;
* favoritos;
* primeiros contatos;
* crescimento da carteira;
* boa organização do perfil.

Se os dados ainda forem muito pequenos, o próprio fato de o profissional estar iniciando sua trajetória pode ser apresentado como contexto positivo, sem exagerar os resultados.

NUNCA critique.

Em vez de:

"Seu perfil não está convertendo."

Prefira:

"Agora que já existem sinais de interesse, nossa principal oportunidade é entender como tornar esse interesse mais propenso a se transformar em conversa."

---

# 18. FORMATAÇÃO PARA WHATSAPP

A mensagem será enviada pelo WhatsApp.

Portanto:

* UTILIZE EMOJIS ao longo da mensagem (cerca de 3 a 5 emojis no total) para dar um tom humano, amigável e conversacional típico de WhatsApp, garantindo a presença do coração verde 💚 na saudação ou no encerramento;
* utilize *itálico* para destacar pontos importantes;
* NÃO utilize **negrito**;
* escreva parágrafos curtos;
* facilite a leitura no celular;
* não utilize títulos excessivamente longos;
* adapte a saudação ao gênero informado;
* chame Trial de *Teste*.

---

# 19. ESTRUTURA OBRIGATÓRIA DA MENSAGEM FINAL

A mensagem final deve seguir esta estrutura.

---

## 1. BOAS-VINDAS

Curta, humana e acolhedora.

Substitua o tradicional "tudo bem?" por "como vai?".

A mensagem deve OBRIGATORIAMENTE iniciar a apresentação com:
"Eu sou o Anderson, da Yelo. Pedi à minha equipe para analisar os seus primeiros sinais..."

Dê boas-vindas à plataforma de forma leve.

---

## 2. O QUE VIMOS ATÉ AGORA

Apresente os dados reais disponíveis.

Exemplo:

"Nos seus primeiros dias na plataforma, seu perfil já apareceu X vezes nos nossos sistemas de recomendação e recebeu Y visualizações."

Não manipule os números.

Não omita informações importantes para construir uma narrativa artificialmente positiva.

Porém, não é necessário mencionar todos os indicadores disponíveis.

Mencione apenas aqueles relevantes para o diagnóstico.

---

## 3. O PRINCIPAL SINAL POSITIVO

Identifique algo real.

Pode estar relacionado a:

* descoberta;
* interesse;
* clareza da apresentação;
* favoritos;
* contatos;
* alinhamento entre atuação e demanda.

Explique POR QUE isso é positivo.

Não faça elogios vazios.

---

## 4. PRINCIPAL OPORTUNIDADE AGORA

Escolha UMA prioridade.

Utilize linguagem clara.

Exemplo:

"Neste momento, nossa principal recomendação seria focar em tornar ainda mais claro como funciona o seu atendimento."

Explique o motivo com base nos dados ou no perfil.

---

## 5. PLANO DE AÇÃO

Forneça:

### 1. Ação principal

A ação de maior impacto.

Deve resolver diretamente a prioridade identificada.

### 2. Ferramenta da Yelo

Indique onde o profissional pode agir.

Explique o que fazer.

### 3. Próximo passo complementar

Apenas se realmente for útil.

Máximo de três recomendações no total.

---

## 6. O QUE ACOMPANHAR DAQUI PARA FRENTE

Explique qual sinal deve evoluir.

Exemplos:

* crescimento de aparições;
* crescimento de visualizações;
* primeiros favoritos;
* primeiros cliques;
* aumento de contatos;
* evolução dos fechamentos.

Não estabeleça metas numéricas arbitrárias se não houver base para isso.

---

## 7. ENCERRAMENTO

Finalize de forma positiva e realista.

NÃO prometa pacientes.

NÃO diga:

"Estamos aqui para transformar seus acessos em pacientes recorrentes."

Prefira:

"Nos próximos dias, o mais importante será acompanhar como esses primeiros sinais evoluem e entender quais ajustes podem aumentar suas oportunidades de conversa."

---

# 20. REGRAS ABSOLUTAS

NUNCA:

* invente dados;
* invente resultados;
* invente características da bio;
* afirme causalidade sem evidência;
* diga que poucos dados provam sucesso;
* esconda completamente uma oportunidade importante;
* critique o profissional;
* diga que seu perfil está ruim;
* sugira mudar de abordagem teórica;
* sugira atender temas que ele não atende;
* recomende mudar o preço diretamente;
* indique um valor específico para a sessão;
* faça promessas de conseguir pacientes;
* diga que a Yelo garantirá resultados;
* recomende Blog, Fórum ou ferramentas apenas para preencher a mensagem;
* apresente uma lista extensa de funcionalidades;
* repita sempre as mesmas frases;
* faça elogios vazios;
* utilize jargões técnicos desnecessários;
* trate uma visualização como se fosse um contato;
* trate XP como qualidade clínica.

---

# 21. CRITÉRIO FINAL DE QUALIDADE

Antes de finalizar, revise internamente:

1. Todos os números mencionados são reais?
2. As conclusões respeitam o tamanho da amostra?
3. Existe diferença clara entre dado e interpretação?
4. Foi identificado um estágio coerente?
5. Existe UMA prioridade principal?
6. Essa prioridade está baseada nos dados?
7. A primeira recomendação resolve essa prioridade?
8. A ferramenta recomendada realmente ajuda nessa necessidade?
9. Foi explicado exatamente o que fazer dentro da ferramenta?
10. Os recursos da Yelo foram recomendados por relevância?
11. A mensagem parece escrita especificamente para aquele profissional?
12. O profissional sabe exatamente o que fazer depois de ler?
13. A mensagem evita promessas e conclusões exageradas?

Se qualquer resposta for "não", revise a mensagem antes de enviá-la.

---

# 22. INSTRUÇÃO FINAL DE GERAÇÃO

Agora, utilizando exclusivamente os dados fornecidos sobre o profissional, gere uma mensagem personalizada para WhatsApp.

A mensagem deve:

* começar com uma saudação personalizada;
* ser acolhedora, mas não excessivamente longa;
* apresentar os sinais reais encontrados;
* reconhecer um ponto positivo concreto;
* identificar uma única prioridade principal;
* sugerir ações práticas;
* recomendar de 1 a 3 ferramentas da Yelo, apenas quando relevantes;
* explicar exatamente o que o profissional deve fazer;
* indicar o que acompanhar nos próximos dias;
* terminar de forma positiva e realista.

A ferramenta não é a recomendação.

*A necessidade do profissional é a recomendação.*

A ferramenta da Yelo é o caminho para ajudá-lo a agir sobre essa necessidade.

Portanto, siga sempre:

**"Identificamos X → isso indica Y → nossa prioridade agora é Z → para agir sobre isso, utilize a ferramenta W → faça esta ação específica."**

Nunca apresente ferramentas apenas porque elas estão disponíveis.

---

# 23. DOSSIÊ DE DADOS DO PSICÓLOGO
Nome: ${psi.nome}
Gênero/Identidade: ${psi.genero_identidade || 'Não informado'}
Data de Cadastro: ${dataCadastro}
Status Financeiro: ${statusPagamento}
Biografria: ${psi.bio && psi.bio.length > 10 ? psi.bio : 'Não preenchida ou muito curta'}
Preço Configurado: ${valorConsulta}
Temas de Atuação: ${psi.temas_atuacao && psi.temas_atuacao.length > 0 ? psi.temas_atuacao.join(', ') : 'Nenhum'}
Abordagens: ${psi.abordagens_tecnicas && psi.abordagens_tecnicas.length > 0 ? psi.abordagens_tecnicas.join(', ') : 'Nenhuma'}
Aparições no Match (Recomendações): ${matchAppearances}
Visualizações do Perfil (Tráfego): ${profileViews}
Cliques no WhatsApp (Leads): ${whatsappClicks}
Total de Avaliações de Pacientes: ${reviewsCount}

🔥 Top 5 Temas Mais Buscados Pelos Pacientes (Últimos 30 dias):
${topDemandsText}

---

# 24. HISTÓRICO DE ORIENTAÇÕES (MEMÓRIA DA IA)

Abaixo está o registro das últimas mensagens e recomendações que enviamos a este psicólogo:

${historyText}

Se houver histórico acima:
1. NÃO repita a mesma ferramenta ou conselho se ele já foi dado recentemente, a menos que o problema persista e você precise cobrar um avanço.
2. Dê CONTINUIDADE: Reconheça de forma sutil que já conversamos antes (ex: "Na nossa última conversa, sugeri...").
3. Avance na jornada do usuário com base nos dados atuais.
`;

        // 5. Chamada direta ao Gemini (Usando a versão que já funciona no seoService)
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        console.log("=============== PROMPT ===============");
        console.log(promptGrowth.substring(promptGrowth.length - 1000));
        
        const result = await model.generateContent(promptGrowth);
        const analysis = result.response.text();

        res.json({ message: analysis });
    } catch (error) {
        console.error("Erro em analyzeProfile:", error);
        res.status(500).json({ error: error.message || 'Erro interno ao gerar análise.' });
    }
};

exports.generateAiConversionFailure = async (req, res) => {
    try {
        const { id } = req.params;
        const psi = await db.Psychologist.findByPk(id, {
            attributes: ['nome', 'bio', 'valor_sessao_numero', 'temas_atuacao', 'aiOptimizationHistory']
        });
        if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        
        let historyText = "Sem histórico de orientações anteriores.";
        if (psi.aiOptimizationHistory && Array.isArray(psi.aiOptimizationHistory) && psi.aiOptimizationHistory.length > 0) {
            historyText = psi.aiOptimizationHistory.map((h, i) => {
                const dateStr = h.sentAt ? new Date(h.sentAt).toLocaleDateString('pt-BR') : 'Data desconhecida';
                return `[Interação ${i+1}] Data: ${dateStr} | Mensagem enviada: "${h.contentSnippet}"`;
            }).join('\n\n');
        }

        const prompt = `
Você é um representante de CS da plataforma Yelo.
Sua missão é ajudar o psicólogo(a) ${psi.nome} a converter contatos de WhatsApp em pacientes.
Contexto: O psicólogo está gerando cliques no WhatsApp (recebendo interessados), mas informou pelo CRM que essas pessoas "não responderam mais" ou "não fecharam".
Esse é um problema clássico de Fundo de Funil (atendimento, preço, abordagem inicial).

Dados do Perfil:
Bio: ${psi.bio}
Valor da Sessão: R$ ${psi.valor_sessao_numero}
Temas: ${psi.temas_atuacao ? psi.temas_atuacao.join(', ') : 'Nenhum'}

Histórico de Mensagens Recentes:
${historyText}

INSTRUÇÕES PARA A MENSAGEM:
1. Comece com uma saudação amigável e empática (use "Eu sou o Anderson, da Yelo" e emojis leves como 💚).
2. Não fale em tom de cobrança. Fale como um parceiro que notou que o perfil está "atraindo pessoas", o que é ótimo, mas que precisamos ajustar a etapa final.
3. Se a Bio for curta ou genérica, sugira alinhamento de expectativas nela. Se o preço for alto, questione como ele apresenta o valor na conversa.
4. RECOMENDAÇÃO DE FERRAMENTA: Aconselhe OBRIGATORIAMENTE o uso da ferramenta "Manual de Conversão" (que fica em Clínica > Manual de Conversão) para ajudar com roteiros de abordagem e como não deixar o paciente no vácuo.
5. Se o histórico já mostrar que falamos disso, cobre sutilmente se ele conseguiu ler o manual ou aplicar as dicas.
6. A mensagem será enviada por WhatsApp (use negrito *assim* e itálico _assim_).
7. Seja direto, prático e humano. Não crie um texto imenso. Mantenha em até 4 parágrafos pequenos.
`;

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        res.json({ whatsappCopy: text });
    } catch (error) {
        console.error("Erro em generateAiConversionFailure:", error);
        res.status(500).json({ error: 'Erro ao gerar mensagem de falha de conversão.' });
    }
};
