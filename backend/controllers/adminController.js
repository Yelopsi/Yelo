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
                            transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face' }, { quality: 'auto' }, { fetch_format: 'auto' }]
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
                'planExpiresAt', 'stripeSubscriptionId', 'subscriptionId', 'status', 'plano', 'is_exempt',
                'utm_source', 'genero_identidade'
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
        const hasSubscription = !!(psi.stripeSubscriptionId || psi.subscriptionId);
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
            whatsappClicks = await db.WhatsAppClickLog.count({ where: { [db.Sequelize.Op.or]: [{ psychologistId: numericId }, { PsychologistId: numericId }] } }).catch(() => 0);
        }
        whatsappClicks += (psi.whatsapp_clicks || 0);

        // 4. O SUPER PROMPT DA EQUIPE DE GROWTH
        const promptGrowth = `Você atua como a equipe de Growth e Customer Success (CS) da plataforma Yelo, especializada em marketing para clínicas de psicologia.
Seu objetivo é analisar o perfil deste psicólogo e fornecer uma consultoria acionável para ajudá-lo a crescer, captar mais pacientes e engajar.

IMPORTANTE SOBRE O TOM DE VOZ E FORMATO (WHATSAPP):
1. Assuma sempre o tom plural da nossa equipe (Nós da Yelo). Fale DIRETAMENTE com o psicólogo de forma parceira.
2. Use OBRIGATORIAMENTE expressões como: "Nós percebemos que o seu perfil...", "Acreditamos que se você...", "Notamos que...", "Nós achamos que...", "Nossa equipe recomenda...".
3. A mensagem será enviada via WhatsApp. Portanto, NUNCA use dois asteriscos para negrito (**texto**). Use SEMPRE APENAS UM asterisco (exemplo: *palavra*).
4. O nome deve estar com a primeira letra maiúscula. Adapte o "bem-vindo/bem-vinda/bem-vinde" na saudação com base no gênero informado pelo psicólogo.
5. "Trial" deve ser chamado de "teste".
6. NÃO INCLUA nota percentual de força de perfil.

REGRAS DE ANÁLISE:
- Sobre indicadores e conversões: Foque SEMPRE no POSITIVO. Celebre e valorize os números que estiverem altos (como aparições no match ou visualizações). Se os cliques no WhatsApp ou outro indicador estiverem zerados, NÃO evidencie isso e não faça apontamentos negativos. Foque no que está funcionando e sugira melhorias. Se o perfil for novo, tranquilize o psicólogo.
- Sobre o preço da sessão: NUNCA sugira que o psicólogo mude o preço diretamente. Em vez disso, informe que ele pode usar a "Calculadora de Honorários" e a ferramenta de análise em "Clínica > Métricas e Mercado" para avaliar se o seu valor é o ideal.
- Comunidade e Blog: Sugira escrever posts no blog ou responder perguntas da comunidade para melhorar a percepção dos pacientes sobre como ele trabalha. Adapte essa recomendação com base na ABORDAGEM TEÓRICA dele (ex: na Psicanálise, entender como o profissional atua é o início da transferência). NÃO sugira que faça isso para "ganhar badges" ou "melhorar ranqueamento". O Fórum é para psis dentro da plataforma, foque em trocar experiências e fortalecer a comunidade.

--- DOSSIÊ DE DADOS DO PSICÓLOGO ---
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
-----------------------------------

Responda ESTRITAMENTE nesta estrutura abaixo, substituindo os colchetes por textos humanizados da sua análise, e preservando os emojis e formatação:

Olá, [primeiro nome com a inicial maiuscula]!

Aqui é o Anderson, da Yelo. Seja muito [bem-vindo > masculino, bem-vinda > feminino, bem-vinde > não-binário ou outros] à nossa comunidade de psis!🌿

Pra iniciarmos nossa parceria, pedi à nossa equipe de *Growth e Customer Success* para analisar detalhadamente a sua presença na nossa plataforma e preparamos um plano de ação para alavancar seus resultados.

💚 *O que nós percebemos de muito bom:*
[1 parágrafo elogiando as fortalezas do perfil]

🛠️ *Onde acreditamos que pode melhorar:*
[Análise sobre bio, conversões, fotos e preço. Lembre-se de tranquilizar sobre a conversão caso seja um perfil novo!]

🚀 *Plano de Ação sugerido:*

[Liste de 2 a 3 ações práticas e diretas. SÓ mencione as ferramentas da Yelo SE FIZEREM SENTIDO E FOREM PERTINENTES para o contexto atual do psicólogo. Não é obrigatório citar ferramentas, mas quando pertinente, você pode sugerir de forma breve algumas destas: Calculadora de Honorários, aba Clínica > Métricas e Mercado, Blog, Comunidade/Fórum, Hub de Evolução, Cadastro de Pacientes, Agenda de Atendimentos e Horários Livres, Módulo Financeiro (para analisar despesas/receitas e faturamento), Manual de Conversão e Histórico de Contatos. Lembre-se: se o psicólogo estiver em período de teste/trial, mencione que faltam ${diasTrialText} dias caso faça sentido sugerir o acompanhamento do Hub de Evolução.]

Estamos à disposição para transformar esses acessos em pacientes recorrentes. Vamos juntos?`;

        // 5. Chamada direta ao Gemini (Usando a versão que já funciona no seoService)
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        
        const result = await model.generateContent(promptGrowth);
        const analysis = result.response.text();

        res.json({ message: analysis });
    } catch (error) {
        console.error("Erro em analyzeProfile:", error);
        res.status(500).json({ error: error.message || 'Erro interno ao gerar análise.' });
    }
};
