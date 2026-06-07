const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const gamificationService = require('../services/gamificationService');
const adminCommunityController = require('./adminCommunityController');
const adminLeadController = require('./adminLeadController');
const adminUsersController = require('./adminUsersController');
const adminMessagesController = require('./adminMessagesController');

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
            const results = await db.sequelize.query(
                `SELECT * FROM "Admins" WHERE email = :email LIMIT 1`,
                { replacements: { email }, type: db.sequelize.QueryTypes.SELECT }
            );
            if (results && results.length > 0) {
                adminUser = results[0];
                isLegacy = true;
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
            await db.SystemLog.create({
                level: 'info',
                message: `Login de administrador bem-sucedido: ${adminUser.email}`,
                meta: { adminId: adminUser.id, isLegacy }
            });

            const token = generateAdminToken(adminUser.id);

            // --- FIX: Define Cookie para evitar logout ---
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 8 * 60 * 60 * 1000 // 8 horas
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
                if (db.SystemLog) {
                    await db.SystemLog.create({
                        level: 'warning',
                        message: `Falha de login Admin (Senha incorreta): ${email}`
                    });
                }
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
            if (req.file.path) {
                const result = await cloudinary.uploader.upload(req.file.path, {
                    folder: 'yelo/profiles',
                    public_id: `admin-profile-${userId}-${Date.now()}`,
                    overwrite: true,
                    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }, { quality: 'auto' }, { fetch_format: 'auto' }]
                });
                fotoUrl = result.secure_url;
                
                const fs = require('fs').promises;
                try { await fs.unlink(req.file.path); } catch (e) { console.warn("Erro ao deletar arquivo local:", e); }
            } else if (req.file.buffer) {
                fotoUrl = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        {
                            folder: 'yelo/profiles',
                            public_id: `admin-profile-${userId}-${Date.now()}`,
                            overwrite: true,
                            transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }, { quality: 'auto' }, { fetch_format: 'auto' }]
                        },
                        (error, result) => {
                            if (error) reject(error);
                            else resolve(result.secure_url);
                        }
                    ).end(req.file.buffer);
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
        return res.status(500).json({ error: `Erro fatal no servidor: ${error.message} - Veja o terminal do NodeJS.` });
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

exports.getAllMessages = adminMessagesController.getAllMessages;
exports.sendBroadcastMessage = adminMessagesController.sendBroadcastMessage;
exports.sendReply = adminMessagesController.sendReply;
exports.deleteConversation = adminMessagesController.deleteConversation;
exports.deletePatient = adminUsersController.deletePatient;
exports.forceDeletePatient = adminUsersController.forceDeletePatient;
exports.restorePatient = adminUsersController.restorePatient;

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
            attributes: ['nome', 'telefone', 'email', 'status', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(waitlist);
    } catch (error) {
        console.error("Erro ao exportar lista de espera:", error);
        res.status(500).json({ error: 'Erro ao gerar lista de espera.' });
    }
};

/**
 * Rota: GET /api/admin/followups
 * Descrição: Busca a lista de cliques no WhatsApp para follow-up.
 */
exports.getFollowUps = async (req, res) => {
    try {
        // Busca os logs unindo com Pacientes e Psicólogos
        const [results] = await db.sequelize.query(`
            SELECT 
                w.id, 
                w."createdAt" as date, 
                w.status, 
                w."message_sent_at",
                w."guestPhone",
                w."guestName",
                p.nome as "patientName", 
                p.telefone as "patientPhone",
                psi.nome as "psychologistName"
            FROM "WhatsappClickLogs" w
            LEFT JOIN "Patients" p ON w."patientId" = p.id
            LEFT JOIN "Psychologists" psi ON w."psychologistId" = psi.id
            WHERE COALESCE(w.status, 'pending') != 'deleted'
            ORDER BY w."createdAt" DESC
            LIMIT 100
        `);

        // Formata para o frontend
        const formatted = results.map(item => ({
            id: item.id,
            date: item.date,
            patientName: item.patientName || item.guestName || 'Visitante',
            patientPhone: item.guestPhone || item.patientPhone || '', // Prioriza o telefone do questionário
            psychologistName: item.psychologistName || 'Psicólogo',
            status: item.status || 'pending',
            message_sent_at: item.message_sent_at,
            consent: true // Assumimos true pois clicou no botão
        }));

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
        const { id } = req.params;
        const { status, message_sent_at } = req.body;

        let query = `UPDATE "WhatsappClickLogs" SET status = :status`;
        const replacements = { id, status };

        if (message_sent_at) {
            query += `, "message_sent_at" = :message_sent_at`;
            replacements.message_sent_at = message_sent_at;
        }

        query += ` WHERE id = :id`;

        await db.sequelize.query(query, { replacements });
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
        const { id } = req.params;
        
        const [updated] = await db.sequelize.query(
            `UPDATE "WhatsappClickLogs" SET status = 'deleted' WHERE id = :id`,
            { replacements: { id } }
        );

        if (updated.rowCount === 0) return res.status(404).json({ error: "Follow-up não encontrado." });

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
