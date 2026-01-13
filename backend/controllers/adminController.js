const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        const { email, senha } = req.body;
        const adminUser = await db.Psychologist.findOne({ where: { email, isAdmin: true } });

        if (adminUser && (await bcrypt.compare(senha, adminUser.senha))) {
            // --- GERAÇÃO DE LOG REAL ---
            await db.SystemLog.create({
                level: 'info',
                message: `Login de administrador bem-sucedido: ${adminUser.email}`,
                meta: { adminId: adminUser.id }
            });

            res.status(200).json({ token: generateAdminToken(adminUser.id) });
        } else {
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

/**
 * Rota: GET /api/admin/verifications (NOVA)
 * Descrição: Busca psicólogos com status 'pending' para verificação.
 */
exports.getPendingVerifications = async (req, res) => {
    try {
        // TODO: Implementar a lógica real para buscar psicólogos com status 'pending'
        // Por enquanto, apenas retorna sucesso para o deploy não quebrar.
        const pending = await db.Psychologist.findAll({
            where: { status: 'pending' },
            attributes: ['id', 'nome', 'email', 'crp', 'cpf', 'createdAt']
        });
        res.status(200).json(pending);
    } catch (error) {
        console.error('Erro em getPendingVerifications:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

/**
 * Rota: PUT /api/admin/psychologists/:id/moderate (NOVA)
 * Descrição: Modera (aprova/rejeita) um psicólogo.
 */
exports.moderatePsychologist = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' ou 'rejected'

        if (!['active', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use "active" ou "rejected".' });
        }

        // TODO: Implementar a lógica real
        // Por enquanto, apenas retorna sucesso para o deploy não quebrar.
        console.log(`[Admin] Moderando psicólogo ${id} para ${status}`);
        
        const psychologist = await db.Psychologist.findByPk(id);
        if (psychologist) {
            await psychologist.update({ status });
            res.status(200).json({ message: `Psicólogo ${status} com sucesso.` });
        } else {
            res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }
    } catch (error) {
        console.error('Erro em moderatePsychologist:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

/**
 * Rota: PATCH /api/admin/psychologists/:id/vip
 * Descrição: Ativa ou desativa o status VIP (isento) de um psicólogo.
 * CORREÇÃO: Agora permite definir um plano específico ou remover a isenção.
 */
exports.updateVipStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body; // Recebe 'ESSENTIAL', 'CLINICAL', 'REFERENCE', ou null

        const psychologist = await db.Psychologist.findByPk(id);

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        let message;
        let newExemptStatus;
        let newPlan;

        if (plan) {
            // Concedendo um plano VIP
            newExemptStatus = true;
            newPlan = plan;
            message = `Isenção do plano ${plan} concedida com sucesso.`;
        } else {
            // Removendo a isenção
            newExemptStatus = false;
            newPlan = null;
            message = 'Isenção removida com sucesso.';
        }

        await psychologist.update({
            is_exempt: newExemptStatus,
            plano: newPlan
        });

        res.status(200).json({
            message,
            is_exempt: newExemptStatus,
            plano: newPlan
        });

    } catch (error) {
        console.error('Erro ao atualizar status VIP:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/psychologists/:id/full-details
 * Descrição: Busca TODOS os dados relacionados a um psicólogo (Visão 360º).
 * Agrega: Perfil, Blog, Fórum, Avaliações, Matches e Logs de WhatsApp.
 */
exports.getPsychologistFullDetails = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Dados do Psicólogo
        const psychologist = await db.Psychologist.findByPk(id, {
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] }
        });

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        // 2. Blog Posts (Se o model existir)
        let blogPosts = [];
        if (db.Post) {
            blogPosts = await db.Post.findAll({
                where: { psychologistId: id },
                order: [['createdAt', 'DESC']]
            }).catch(() => []);
        }

        // 3. Fórum (Posts e Comentários)
        let forumPosts = [];
        let forumComments = [];
        
        // Tenta buscar posts do fórum (considerando variações de FK)
        if (db.ForumPost) {
            try {
                forumPosts = await db.ForumPost.findAll({ where: { PsychologistId: id }, order: [['createdAt', 'DESC']] });
            } catch (e) {
                // Fallback para camelCase se PascalCase falhar
                forumPosts = await db.ForumPost.findAll({ where: { psychologistId: id }, order: [['createdAt', 'DESC']] }).catch(() => []);
            }
        }

        // Tenta buscar comentários do fórum
        if (db.ForumComment) {
            try {
                forumComments = await db.ForumComment.findAll({ 
                    where: { PsychologistId: id },
                    include: db.ForumPost ? [{ model: db.ForumPost, attributes: ['titulo'] }] : [],
                    order: [['createdAt', 'DESC']] 
                });
            } catch (e) {
                forumComments = await db.ForumComment.findAll({ where: { psychologistId: id }, order: [['createdAt', 'DESC']] }).catch(() => []);
            }
        }

        // 4. Avaliações
        const reviews = await db.Review.findAll({
            where: { psychologistId: id },
            order: [['createdAt', 'DESC']]
        });

        // 5. Matches (Tabela MatchEvents - Raw Query para robustez)
        const [matches] = await db.sequelize.query(
            `SELECT * FROM "MatchEvents" WHERE "psychologistId" = :id ORDER BY "createdAt" DESC`,
            { replacements: { id } }
        ).catch(() => [[], null]);

        // 6. Stats (Whatsapp Clicks - Raw Query)
        const [whatsappStats] = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "psychologistId" = :id`,
            { replacements: { id } }
        ).catch(() => [[{ count: 0 }]]);

        res.json({
            psychologist,
            stats: {
                matches: matches ? matches.length : 0,
                whatsappClicks: whatsappStats[0] ? parseInt(whatsappStats[0].count) : 0
            },
            blogPosts,
            forumPosts,
            forumComments: forumComments.map(c => c.toJSON ? { ...c.toJSON(), postTitle: c.ForumPost?.titulo } : c),
            reviews,
            matches: matches || []
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes completos do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/forum/reports
 * Descrição: Busca todos os conteúdos denunciados no fórum.
 */
exports.getForumReports = async (req, res) => {
    try {
        // Esta query agrupa as denúncias por conteúdo, conta quantas denúncias
        // cada um tem, e retorna o status atual do conteúdo para a moderação.
        const query = `
            SELECT
                FR."itemId" AS "contentId",
                FR."type" AS "contentType",
                COUNT(FR.id) AS "reportCount",
                MIN(FR."createdAt") AS "firstReportDate",
                MAX(COALESCE(FP.status, FC.status, 'active')) AS "contentStatus",
                MAX(COALESCE(FP.title, FP.content, FC.content)) AS "contentText",
                MAX(COALESCE(author_p.nome, 'Usuário Removido')) AS "authorName"
            FROM "ForumReports" AS FR
            LEFT JOIN "ForumPosts" AS FP ON FR."itemId" = FP.id AND FR."type" = 'post'
            LEFT JOIN "ForumComments" AS FC ON FR."itemId" = FC.id AND FR."type" = 'comment'
            LEFT JOIN "Psychologists" AS author_p ON (FP."PsychologistId" = author_p.id OR FC."PsychologistId" = author_p.id)
            GROUP BY FR."itemId", FR."type"
            ORDER BY 
                CASE 
                    WHEN MAX(COALESCE(FP.status, FC.status, 'active')) IN ('active', 'pending') THEN 1
                    ELSE 2 
                END, 
                COUNT(FR.id) DESC, 
                MIN(FR."createdAt") ASC;
        `;

        const [reports] = await db.sequelize.query(query);
        res.json(reports);

    } catch (error) {
        if (error.message.includes('relation "ForumReports" does not exist')) {
            console.warn("Tabela 'ForumReports' não encontrada. Retornando lista de denúncias vazia.");
            return res.json([]);
        }
        console.error("Erro ao buscar denúncias do fórum:", error);
        res.status(500).json({ error: "Erro interno ao buscar denúncias." });
    }
};

/**
 * Rota: PUT /api/admin/forum/moderate
 * Descrição: Modera um conteúdo do fórum (mantém ou remove).
 */
exports.moderateForumContent = async (req, res) => {
    const { contentType, contentId, action } = req.body; // action: 'approve' ou 'remove'

    if (!['post', 'comment'].includes(contentType) || !contentId || !['approve', 'remove'].includes(action)) {
        return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    try {
        const Model = contentType === 'post' ? db.ForumPost : db.ForumComment;
        const newStatus = action === 'approve' ? 'approved_by_admin' : 'hidden_by_admin';
        const message = action === 'approve' ? 'Conteúdo mantido com sucesso.' : 'Conteúdo removido com sucesso.';

        await Model.update({ status: newStatus }, { where: { id: contentId } });
        if (db.ForumReport) await db.ForumReport.update({ status: 'resolved' }, { where: { itemId: contentId, type: contentType } });

        res.json({ message });
    } catch (error) {
        console.error("Erro ao moderar conteúdo do fórum:", error);
        res.status(500).json({ error: error.message || "Erro interno ao moderar conteúdo." });
    }
};

// =====================================================================
// (O RESTANTE DO SEU ARQUIVO PERMANECE IDÊNTICO)
// =====================================================================

/**
 * Rota: GET /api/admin/conversations/:id/messages
 * Descrição: Busca todas as mensagens de uma conversa específica.
 */
exports.getConversationMessages = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id: conversationId } = req.params;
        const adminId = req.psychologist.id;

        const messages = await db.Message.findAll({
            where: { conversationId },
            order: [['createdAt', 'ASC']]
        });

        // Marca as mensagens como lidas para o admin
        await db.Message.update({ isRead: true }, {
            where: { conversationId, recipientId: adminId, isRead: false }
        });

        res.status(200).json(messages);
    } catch (error) {
        console.error('Erro ao buscar mensagens da conversa:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/conversations
 * Descrição: Busca conversas paginadas para a caixa de entrada do admin.
 */
exports.getConversations = async (req, res) => {
  // ... (seu código existente)
  try {
    const adminId = req.psychologist.id;
    const { search = '' } = req.query;
    const query = `
      WITH LastMessages AS (
        SELECT
          "conversationId",
          "content",
          "senderId",
          "createdAt",
          ROW_NUMBER() OVER(PARTITION BY "conversationId" ORDER BY "createdAt" DESC) as rn
        FROM "Messages"
      ),
      UnreadCounts AS (
        SELECT
          "conversationId",
          COUNT(*) as "unreadCount"
        FROM "Messages"
        WHERE "recipientId" = :adminId AND "isRead" = false
        GROUP BY "conversationId"
      )
      SELECT
        c.id,
        c."updatedAt",
        CASE
          WHEN c."psychologistId" = :adminId THEN pat.id
          ELSE psy.id
        END as "otherParticipantId",
        CASE
          WHEN c."psychologistId" = :adminId THEN pat.nome
          ELSE psy.nome
        END as "otherParticipantNome",
        CASE
          WHEN c."psychologistId" = :adminId THEN pat."fotoUrl"
          ELSE psy."fotoUrl"
        END as "otherParticipantFotoUrl",
        CASE
          WHEN c."psychologistId" = :adminId THEN 'patient'
          ELSE 'psychologist'
        END as "otherParticipantType",
        lm.content as "lastMessageContent",
        lm."createdAt" as "lastMessageCreatedAt",
        lm."senderId" as "lastMessageSenderId",
        COALESCE(uc."unreadCount", 0) as "unreadCount"
      FROM "Conversations" c
      LEFT JOIN "Patients" pat ON c."patientId" = pat.id
      LEFT JOIN "Psychologists" psy ON c."psychologistId" = psy.id
      LEFT JOIN LastMessages lm ON c.id = lm."conversationId" AND lm.rn = 1
      LEFT JOIN UnreadCounts uc ON c.id = uc."conversationId"
      WHERE (c."psychologistId" = :adminId OR c."patientId" = :adminId)
      AND (psy.id != :adminId OR pat.id != :adminId)
      ORDER BY c."updatedAt" DESC;
    `;

    let conversations = await db.sequelize.query(query, {
      replacements: { adminId },
      type: db.sequelize.QueryTypes.SELECT,
    });
    let finalConversations = conversations.map(convo => ({
      id: convo.id,
      otherParticipant: {
        id: convo.otherParticipantId,
        nome: convo.otherParticipantNome,
        fotoUrl: convo.otherParticipantFotoUrl,
        type: convo.otherParticipantType,
      },
      lastMessage: {
        content: convo.lastMessageContent || 'Nenhuma mensagem.',
        createdAt: convo.lastMessageCreatedAt || convo.updatedAt,
        senderId: convo.lastMessageSenderId,
      },
      unreadCount: parseInt(convo.unreadCount, 10),
    }));
    if (search) {
      finalConversations = finalConversations.filter(c =>
        c.otherParticipant.nome.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (search) {
        const existingParticipantIds = finalConversations.map(c => c.otherParticipant.id);
        const newPatients = await db.Patient.findAll({ where: { nome: { [Op.iLike]: `%${search}%` }, id: { [Op.notIn]: existingParticipantIds } }, attributes: ['id', 'nome', 'fotoUrl'], limit: 5 });
        const newPsychologists = await db.Psychologist.findAll({ where: { nome: { [Op.iLike]: `%${search}%` }, id: { [Op.notIn]: [...existingParticipantIds, adminId] } }, attributes: ['id', 'nome', 'fotoUrl'], limit: 5 });
        const formatNewContact = (user, type) => ({ id: null, isNew: true, otherParticipant: { id: user.id, nome: user.nome, fotoUrl: user.fotoUrl, type: type }, lastMessage: { content: 'Clique para iniciar uma nova conversa.' }, unreadCount: 0 });
        const newContacts = [
            ...newPatients.map(p => formatNewContact(p, 'patient')),
            ...newPsychologists.map(p => formatNewContact(p, 'psychologist'))
        ];
        finalConversations.unshift(...newContacts); // Adiciona novos contatos no topo da lista
    }
    res.status(200).json({
      conversations: finalConversations,
      totalPages: 1, // Pagination removed for simplicity, can be re-added
      currentPage: 1,
    });
  } catch (error) {
    console.error('Erro ao buscar conversas do admin:', error);
    res.status(500).json({ error: 'Falha ao buscar conversas.' });
  }
};

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
                `SELECT id, nome, email, telefone, "fotoUrl" FROM "Admins" WHERE id = :id`,
                { replacements: { id: userId } }
            );
            if (results.length > 0) {
                return res.status(200).json(results[0]);
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
        const { nome, email, telefone } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
        }

        // Tenta encontrar como Psicólogo-Admin primeiro
        const psychologistAdmin = await db.Psychologist.findByPk(userId);

        if (psychologistAdmin && psychologistAdmin.isAdmin) {
            // Lógica para Psicólogo-Admin
            if (email.toLowerCase() !== psychologistAdmin.email.toLowerCase()) {
                const existingUser = await db.Psychologist.findOne({ where: { email, id: { [Op.ne]: userId } } });
                if (existingUser) return res.status(409).json({ error: 'Este email já está em uso.' });
            }
            await psychologistAdmin.update({ nome, email, telefone });
            return res.status(200).json({ message: 'Dados atualizados com sucesso!' });
        } else {
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

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }

        // Tenta encontrar como Psicólogo-Admin
        const psychologistAdmin = await db.Psychologist.findByPk(userId);

        if (psychologistAdmin && psychologistAdmin.isAdmin) {
            const isMatch = await bcrypt.compare(senha_atual, psychologistAdmin.senha);
            if (!isMatch) return res.status(401).json({ error: 'A senha atual está incorreta.' });

            psychologistAdmin.senha = await bcrypt.hash(nova_senha, 10);
            await psychologistAdmin.save();
            return res.status(200).json({ message: 'Senha alterada com sucesso!' });
        } else {
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
        const fotoUrl = `/uploads/profiles/${req.file.filename}`;
        
        if (req.psychologist) {
            await req.psychologist.update({ fotoUrl });
            return res.status(200).json({ message: 'Foto atualizada!', fotoUrl });
        }

        if (req.user && (req.user.type === 'admin' || req.user.role === 'admin')) {
            await db.sequelize.query(`UPDATE "Admins" SET "fotoUrl" = :fotoUrl, "updatedAt" = NOW() WHERE id = :id`, {
                replacements: { fotoUrl, id: req.user.id }
            });
            return res.status(200).json({ message: 'Foto atualizada!', fotoUrl });
        }

        res.status(404).json({ error: 'Usuário não encontrado.' });
    } catch (error) {
        console.error('Erro ao atualizar foto do admin:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao processar a imagem.' });
    }
};

/**
 * Rota: GET /api/admin/stats
 * Descrição: Busca estatísticas BLINDADAS para o dashboard
 */
exports.getDashboardStats = async (req, res) => {
    try {
        console.time('⏱️ Dashboard Stats Load');
        const now = new Date();
        
        // Definição de "30 dias atrás"
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // --- A. DADOS DE CRESCIMENTO ---
        
        // --- 1. Definição do "Hoje" (Universal: Funciona Local e Produção) ---
        // Objetivo: Encontrar o Timestamp exato da meia-noite brasileira (00:00 BRT)
        
        const offsetBrasil = 3 * 60 * 60 * 1000; // 3 horas em milissegundos

        // Passo A: Descobre que dia é hoje no Brasil
        // (Pega o tempo UTC atual e volta 3 horas. Se for 01:00 UTC de amanhã, vira 22:00 de hoje)
        const tempoNoBrasil = new Date(now.getTime() - offsetBrasil);

        // Passo B: Zera o relógio para o início desse dia (00:00:00)
        // Usamos setUTCHours para garantir que estamos mexendo na hora absoluta
        tempoNoBrasil.setUTCHours(0, 0, 0, 0);

        // Passo C: Ajusta para o formato do Banco de Dados
        // O banco salva em UTC. Meia-noite no Brasil = 03:00 UTC.
        // Então somamos as 3 horas de volta.
        const startOfToday = new Date(tempoNoBrasil.getTime() + offsetBrasil);

        // Lógica de Desistência (Abandono de Funil)
        // Conta quem está como 'started' há mais de 10 MINUTOS
        const tenMinutesAgo = new Date(new Date() - 10 * 60 * 1000); // 10 minutos em ms
        
        // --- OTIMIZAÇÃO MASTER V2: Múltiplas Queries Otimizadas em Paralelo ---
        const patientStatsQuery = `
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE "deletedAt" IS NULL) as active,
                COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as deleted,
                COUNT(*) FILTER (WHERE "createdAt" >= :thirtyDaysAgo) as new30d
            FROM "Patients"
        `;

        const psychologistStatsQuery = `
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND status = 'active') as active,
                COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as deleted,
                COUNT(*) FILTER (WHERE "createdAt" >= :thirtyDaysAgo AND "deletedAt" IS NULL) as new30d
            FROM "Psychologists"
        `;

        const demandStatsQuery = `
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed') as total,
                COUNT(*) FILTER (WHERE "createdAt" >= :startOfToday AND status = 'completed') as today,
                COUNT(*) FILTER (WHERE status = 'started' AND "updatedAt" < :tenMinutesAgo) as abandoned
            FROM "DemandSearches"
        `;

        const [
            [patientStats],
            [psychologistStats],
            [demandStats],
            waitingListCount,
            pendingReviewsCount,
            psisByPlan
        ] = await Promise.all([
            db.sequelize.query(patientStatsQuery, { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }),
            db.sequelize.query(psychologistStatsQuery, { replacements: { thirtyDaysAgo }, type: db.sequelize.QueryTypes.SELECT }),
            db.sequelize.query(demandStatsQuery, { replacements: { startOfToday, tenMinutesAgo }, type: db.sequelize.QueryTypes.SELECT }),
            db.WaitingList.count({ where: { status: 'pending' } }),
            db.Review.count({ where: { status: 'pending' } }),
            db.Psychologist.findAll({
                attributes: ['plano', [db.sequelize.fn('COUNT', 'plano'), 'count']],
                where: { status: 'active', plano: { [Op.ne]: null } },
                group: ['plano']
            })
        ]);

        // Processamento dos Planos e MRR (Sem query extra)
        const plansCount = {};
        const planPrices = { 'Essencial': 59.90, 'Clínico': 89.90, 'Sol': 129.90 };
        let mrr = 0;
        
        psisByPlan.forEach(p => {
            const plano = p.dataValues.plano;
            const count = parseInt(p.dataValues.count, 10);
            plansCount[plano] = count;
            
            // Calcula MRR baseado na contagem agregada
            if (planPrices[plano]) {
                mrr += planPrices[plano] * count;
            }
        });

        console.timeEnd('⏱️ Dashboard Stats Load');
        res.status(200).json({
            mrr: mrr.toFixed(2),
            newPatients30d: parseInt(patientStats.new30d, 10),
            newPsis30d: parseInt(psychologistStats.new30d, 10),
            questToday: parseInt(demandStats.today, 10),
            patients: { total: parseInt(patientStats.total, 10), active: parseInt(patientStats.active, 10), deleted: parseInt(patientStats.deleted, 10) },
            psychologists: { total: parseInt(psychologistStats.total, 10), active: parseInt(psychologistStats.active, 10), deleted: parseInt(psychologistStats.deleted, 10), byPlan: plansCount },
            questionnaires: { total: parseInt(demandStats.total, 10), deleted: parseInt(demandStats.abandoned, 10) },
            waitingListCount: waitingListCount,
            pendingReviewsCount: pendingReviewsCount
        });

    } catch (error) {
        console.error('Erro crítico no dashboard:', error);
        res.status(500).json({ error: 'Erro ao calcular métricas.' });
    }
};

/**
 * Rota: GET /api/admin/psychologists
 * Descrição: Busca todos os psicólogos para a página de gerenciamento.
 */
exports.getAllPsychologists = async (req, res) => {
    // ... (seu código existente)
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { search, status, plano } = req.query;
        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { crp: { [Op.iLike]: `%${search}%` } }
            ];
        }
        if (status) {
            whereClause.status = status;
        }
        if (plano) {
            whereClause.plano = plano;
        }
        const { count, rows } = await db.Psychologist.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] },
            order: [['createdAt', 'DESC']]
        });
        const totalPages = Math.ceil(count / limit);
        res.status(200).json({
            data: rows,
            totalPages,
            currentPage: page,
            totalCount: count
        });
    } catch (error) {
        console.error('Erro ao buscar lista de psicólogos:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/reports/charts
 * Descrição: Gera dados históricos detalhados + Comunidade + Horários
 */
exports.getDetailedReports = async (req, res) => {
    try {
        console.time('⏱️ Detailed Reports Load');
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date();
        if (!req.query.startDate) startDate.setDate(startDate.getDate() - 30);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // 1. QUERY EVOLUÇÃO (Mantida)
        const usersQuery = `
            SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as data,
            SUM(CASE WHEN "type" = 'patient' THEN 1 ELSE 0 END) as pacientes,
            SUM(CASE WHEN "type" = 'psychologist' THEN 1 ELSE 0 END) as psis
            FROM (SELECT "createdAt", 'patient' as type FROM "Patients" UNION ALL SELECT "createdAt", 'psychologist' as type FROM "Psychologists") as combined
            WHERE "createdAt" BETWEEN :start AND :end GROUP BY data ORDER BY data ASC;
        `;

        // 2. QUERY DEMANDA (Mantida)
        const demandQuery = `
            SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as data,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as concluidos,
            SUM(CASE WHEN status = 'started' THEN 1 ELSE 0 END) as desistencias
            FROM "DemandSearches" WHERE "createdAt" BETWEEN :start AND :end GROUP BY data ORDER BY data ASC;
        `;

        // 3. QUERY PLANOS (Mantida)
        const plansQuery = `SELECT plano, COUNT(*) as total FROM "Psychologists" WHERE status = 'active' AND plano IS NOT NULL AND "deletedAt" IS NULL GROUP BY plano;`;

        // --- NOVO: 4. ANÁLISE DE HORÁRIO ---
        const timeOfDayQuery = `
            SELECT 
                CASE 
                    WHEN EXTRACT(HOUR FROM "createdAt") BETWEEN 6 AND 11 THEN 'Manhã'
                    WHEN EXTRACT(HOUR FROM "createdAt") BETWEEN 12 AND 17 THEN 'Tarde'
                    WHEN EXTRACT(HOUR FROM "createdAt") BETWEEN 18 AND 23 THEN 'Noite'
                    ELSE 'Madrugada'
                END as periodo,
                COUNT(*) as total
            FROM "DemandSearches"
            WHERE status = 'completed' -- Só conta os concluídos
            AND "createdAt" BETWEEN :start AND :end -- CORREÇÃO: Filtra por data
            GROUP BY periodo;
        `;

        // --- NOVO: 6. ACESSOS AO SITE (Page Views) ---
        const visitsQuery = `
            SELECT 
                TO_CHAR("createdAt", 'YYYY-MM-DD') as data,
                COUNT(*) as total
            FROM "SiteVisits"
            WHERE "createdAt" BETWEEN :start AND :end
            GROUP BY data
            ORDER BY data ASC;
        `;

        // --- OTIMIZAÇÃO: EXECUÇÃO PARALELA ---
        const [
            [usersData],
            [demandData],
            [plansData],
            [timeData],
            visitsResult,
            questionsTotal,
            questionsAnswered,
            answersTotal,
            activePsychologists,
            churnedCount
        ] = await Promise.all([
            db.sequelize.query(usersQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(demandQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(plansQuery),
            db.sequelize.query(timeOfDayQuery, { replacements: { start: startDate, end: endDate } }),
            db.sequelize.query(visitsQuery, { replacements: { start: startDate, end: endDate } }).catch(() => [[]]), // Fallback para visits
            // Community Stats
            db.Question.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } }),
            db.Question.count({ where: { status: 'answered', updatedAt: { [Op.between]: [startDate, endDate] } } }),
            db.Answer.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } }),
            // Financial Stats
            db.Psychologist.findAll({ where: { plano: { [Op.ne]: null }, status: 'active' }, attributes: ['plano'] }),
            db.Psychologist.count({ where: { status: 'inactive', updatedAt: { [Op.between]: [startDate, endDate] } } })
        ]);

        const visitsData = visitsResult[0] || [];
        const communityStats = { questionsTotal, questionsAnswered, answersTotal, blogPosts: 0 };

        // --- CÁLCULO FINANCEIRO ---
        let financialStats = { mrr: 0, churnRate: 0, ltv: 0 };
        try {
            // Normaliza para minúsculo para evitar erros (ex: 'Essencial' vs 'Essencial')
            const planPrices = { 'Essencial': 59.90, 'Clínico': 89.90, 'sol': 129.90 };
            const mrr = activePsychologists.reduce((acc, psy) => {
                const planoKey = (psy.plano || '').toLowerCase();
                return acc + (planPrices[planoKey] || 0);
            }, 0);

            const totalActive = activePsychologists.length;
            const totalStart = totalActive + churnedCount; // Aproximação da base no início do período
            const churnRate = totalStart > 0 ? (churnedCount / totalStart) * 100 : 0;

            // LTV: ARPU / Churn Rate (decimal)
            const arpu = totalActive > 0 ? mrr / totalActive : 0;
            const ltv = churnRate > 0 ? arpu / (churnRate / 100) : 0;

            // Log para debug no terminal
            console.log(`[KPIs Financeiros] MRR: R$${mrr} | Ativos: ${totalActive} | Churn: ${churnedCount} (${churnRate.toFixed(1)}%)`);

            financialStats = {
                mrr: parseFloat(mrr.toFixed(2)),
                churnRate: parseFloat(churnRate.toFixed(1)),
                ltv: parseFloat(ltv.toFixed(2))
            };
        } catch (err) {
            console.error("Erro KPIs Financeiros:", err);
        }

        console.timeEnd('⏱️ Detailed Reports Load');
        res.json({
            users: usersData,
            demand: demandData,
            plans: plansData,
            timeOfDay: timeData, // Novo dado
            community: communityStats, // Novo dado
            visits: visitsData,
            financials: financialStats // <--- KPIs Financeiros incluídos
        });

    } catch (error) {
        console.error('Erro ao gerar relatórios:', error);
        res.status(500).json({ error: 'Erro ao processar dados gráficos.' });
    }
};

// --- GESTÃO DOS LINKS DE RECURSOS (NOVO) ---

exports.getCommunityResources = async (req, res) => {
    try {
        let resources = await db.CommunityResource.findOne();
        // Se não existir, cria padrão vazio
        if (!resources) {
            resources = await db.CommunityResource.create({
                link_intervisao: "#",
                link_biblioteca: "#",
                link_cursos: "#"
            });
        }
        res.json(resources);
    } catch (error) {
        res.status(500).json({ error: "Erro ao buscar recursos" });
    }
};

exports.updateCommunityResources = async (req, res) => {
    try {
        let resources = await db.CommunityResource.findOne();
        if (resources) {
            await resources.update(req.body);
        } else {
            await db.CommunityResource.create(req.body);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao salvar recursos" });
    }
};

// --- GESTÃO DA COMUNIDADE (NOVO) ---

exports.getCommunityEvent = async (req, res) => {
    try {
        // Pega o evento mais recente
        let event = await db.CommunityEvent.findOne({ order: [['updatedAt', 'DESC']] });
        
        // Se não existir, retorna um objeto padrão (mock) para não quebrar o front
        if (!event) {
            return res.json({
                titulo: "Próximo Workshop",
                subtitulo: "Em breve novidades",
                data_hora: "A definir",
                tipo: "Online",
                link_acao: "#",
                texto_botao: "Aguarde",
                ativo: false
            });
        }
        res.json(event);
    } catch (error) {
        console.error("Erro ao buscar evento:", error);
        res.status(500).json({ error: "Erro interno" });
    }
};

exports.updateCommunityEvent = async (req, res) => {
    try {
        const { titulo, subtitulo, data_hora, tipo, link_acao, texto_botao, ativo } = req.body;
        
        // Verifica se já existe algum registro para atualizar, senão cria um novo
        let event = await db.CommunityEvent.findOne({ order: [['updatedAt', 'DESC']] });
        
        if (event) {
            await event.update({ titulo, subtitulo, data_hora, tipo, link_acao, texto_botao, ativo });
        } else {
            event = await db.CommunityEvent.create(req.body);
        }
        
        res.json({ success: true, event });
    } catch (error) {
        console.error("Erro ao salvar evento:", error);
        res.status(500).json({ error: "Erro ao salvar" });
    }
};

/**
 * Rota: GET /api/admin/patients
 * Descrição: Busca todos os pacientes para a página de gerenciamento.
 */
exports.getAllPatients = async (req, res) => {
    // ... (seu código existente)
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { search } = req.query;
        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }
        const { count, rows } = await db.Patient.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json({ data: rows, totalPages: Math.ceil(count / limit), currentPage: page, totalCount: count });
    } catch (error) {
        console.error('Erro ao buscar lista de pacientes:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

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
 * Rota: GET /api/admin/logs
 * Descrição: Busca os logs do sistema.
 */
exports.getSystemLogs = async (req, res) => {
    // ... (seu código existente)
    try {
        // 1. Busca os logs normais
        const logs = await db.SystemLog.findAll({
            limit: 100, // Limita aos 100 logs mais recentes
            order: [['createdAt', 'DESC']]
        });

        // 2. CÁLCULO DE SAÚDE DO SISTEMA (Health Check)
        const oneDayAgo = new Date(new Date() - 24 * 60 * 60 * 1000);
        
        // --- OTIMIZAÇÃO: PARALELISMO (Executa todas as contagens juntas) ---
        const [
            newPatients,
            newPsis,
            errorCount,
            paymentErrors,
            startedQuests,
            completedQuests,
            loginFailures,
            sessionQueryRaw,
            avgSessionResult
        ] = await Promise.all([
            db.Patient.count({ where: { createdAt: { [Op.gte]: oneDayAgo } } }),
            db.Psychologist.count({ where: { createdAt: { [Op.gte]: oneDayAgo } } }),
            db.SystemLog.count({ where: { level: 'error', createdAt: { [Op.gte]: oneDayAgo } } }),
            db.SystemLog.count({ where: { level: 'error', message: { [Op.iLike]: '%stripe%' }, createdAt: { [Op.gte]: oneDayAgo } } }),
            db.DemandSearch.count({ where: { status: 'started', createdAt: { [Op.gte]: oneDayAgo } } }),
            db.DemandSearch.count({ where: { status: 'completed', createdAt: { [Op.gte]: oneDayAgo } } }),
            db.SystemLog.count({ where: { message: { [Op.iLike]: '%Falha de login%' }, createdAt: { [Op.gte]: oneDayAgo } } }),
            // Sessões Ativas (Raw Query retorna [results, metadata])
            db.sequelize.query(`SELECT COUNT(*) FROM "ActiveSessions" WHERE "lastSeen" >= NOW() - INTERVAL '5 minutes'`),
            // Tempo Médio (QueryType SELECT retorna array de rows)
            db.sequelize.query(`SELECT AVG("durationInSeconds") as "avgDuration" FROM "AnonymousSessions" WHERE "endedAt" >= :date`, { replacements: { date: oneDayAgo }, type: db.sequelize.QueryTypes.SELECT })
        ]);

        // Processamento dos Resultados
        const registrationStatus = (newPatients + newPsis) > 0 ? 'active' : 'idle'; // active = verde, idle = amarelo
        const systemStatus = errorCount === 0 ? 'healthy' : 'warning'; // healthy = verde, warning = vermelho
        const paymentStatus = paymentErrors === 0 ? 'healthy' : 'error';
        const dbStatus = 'online';
        const funnelStatus = (startedQuests > 5 && completedQuests === 0) ? 'critical' : 'healthy';
        const securityStatus = loginFailures > 20 ? 'warning' : 'healthy'; // Mais de 20 erros = Alerta

        // G. INFRAESTRUTURA (Memória e Uptime)
        const memoryUsage = process.memoryUsage();
        const memoryUsedMB = Math.round(memoryUsage.rss / 1024 / 1024); // Resident Set Size em MB
        const infraStatus = memoryUsedMB > 500 ? 'warning' : 'healthy'; // Alerta se usar > 500MB (ajuste conforme seu servidor)

        // H. DADOS DE SESSÃO
        const sessionResults = sessionQueryRaw[0]; // Extrai resultados da Raw Query
        const concurrentUsers = sessionResults[0] ? parseInt(sessionResults[0].count, 10) : 0;

        // CÁLCULO REAL DO TEMPO MÉDIO DE SESSÃO (ANÔNIMOS)
        let avgSessionTime = 0;
        if (avgSessionResult && avgSessionResult[0] && avgSessionResult[0].avgDuration) {
            avgSessionTime = Math.round(avgSessionResult[0].avgDuration / 60);
        }
        // --- FIM DO CÁLCULO ---
        res.status(200).json({
            logs,
            health: {
                registration: { status: registrationStatus, count: newPatients + newPsis },
                system: { status: systemStatus, errors: errorCount },
                payment: { status: paymentStatus, errors: paymentErrors },
                database: { status: dbStatus },
                funnel: { status: funnelStatus, started: startedQuests, completed: completedQuests },
                security: { status: securityStatus, failures: loginFailures },
                infrastructure: { status: infraStatus, memory: memoryUsedMB, uptime: process.uptime() },
                // Adicionando os novos dados
                concurrentUsers: concurrentUsers,
                avgSessionTime: avgSessionTime
            }
        });
    } catch (error) {
        console.error('Erro ao buscar logs do sistema:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/messages
 * Descrição: Busca todas as mensagens para a caixa de entrada do admin.
 */
exports.getAllMessages = async (req, res) => {
    // ... (seu código existente)
    try {
        const messages = await db.Message.findAll({
            include: [
                { model: db.Patient, as: 'senderPatient', attributes: ['nome', 'id'] },
                { model: db.Psychologist, as: 'senderPsychologist', attributes: ['nome', 'id'] }, // A linha duplicada foi removida
                { model: db.Patient, as: 'recipientPatient', attributes: ['nome', 'id'] },
                { model: db.Psychologist, as: 'recipientPsychologist', attributes: ['nome', 'id'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 200 // Limita às 200 mensagens mais recentes
        });
        res.status(200).json(messages);
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: POST /api/admin/broadcast
 * Descrição: Envia uma mensagem em massa para todos os psicólogos ou pacientes.
 */
exports.sendBroadcastMessage = async (req, res) => {
    // ... (seu código existente)
    const transaction = await db.sequelize.transaction();
    try {
        const { target, content } = req.body;
        const adminId = req.psychologist.id;
        if (!target || !content) {
            return res.status(400).json({ error: 'Público-alvo e conteúdo são obrigatórios.' });
        }
        let recipients;
        let recipientType;
        if (target.startsWith('psychologists')) {
            const whereClause = { id: { [Op.ne]: adminId } }; 
            if (target.includes('-')) {
                const plan = target.split('-')[1]; 
                whereClause.plano = plan;
            }
            recipients = await db.Psychologist.findAll({ where: whereClause });
            recipientType = 'psychologist';
        } else if (target === 'patients') {
            recipients = await db.Patient.findAll();
            recipientType = 'patient';
        } else {
            return res.status(400).json({ error: 'Público-alvo inválido.' });
        }
        if (recipients.length === 0) {
            return res.status(200).json({ message: 'Nenhum destinatário encontrado para este público-alvo.' });
        }
        const messagePromises = recipients.map(async (recipient) => {
            const whereClause = {
                [Op.or]: [
                    { psychologistId: adminId, patientId: recipient.id },
                    { psychologistId: recipient.id, patientId: adminId }
                ]
            };
            const defaults = recipientType === 'psychologist' 
                ? { psychologistId: recipient.id, patientId: adminId }
                : { psychologistId: adminId, patientId: recipient.id };
            const [conversation] = await db.Conversation.findOrCreate({
                where: whereClause,
                defaults: defaults,
                transaction
            });
            await db.Message.create({
                conversationId: conversation.id,
                senderId: adminId,
                senderType: 'psychologist', 
                recipientId: recipient.id,
                recipientType: recipientType,
                content: content
            }, { transaction });
        });
        await Promise.all(messagePromises);
        await transaction.commit();
        res.status(200).json({ message: `Mensagem enviada para ${recipients.length} destinatários.` });
    } catch (error) {
        console.error('Erro ao enviar mensagem em massa:', error);
        await transaction.rollback();
        res.status(500).json({ error: 'Erro interno no servidor ao enviar a mensagem.' });
    }
};

/**
 * Rota: POST /api/admin/reply
 * Descrição: Envia uma resposta do admin para uma conversa específica.
 */
exports.sendReply = async (req, res) => {
    // ... (seu código existente)
    try {
        const { recipientId, recipientType, content } = req.body;
        const adminId = req.psychologist.id;
        if (!recipientId || !recipientType || !content) {
            return res.status(400).json({ error: 'Destinatário e conteúdo são obrigatórios.' });
        }
        const [conversation] = await db.Conversation.findOrCreate({
            where: {
                [Op.or]: [
                    { psychologistId: adminId, patientId: recipientId },
                    { psychologistId: recipientId, patientId: adminId }
                ]
            },
            defaults: {
                psychologistId: recipientType === 'psychologist' ? recipientId : adminId,
                patientId: recipientType === 'patient' ? recipientId : null
            }
        });
        const message = await db.Message.create({
            conversationId: conversation.id,
            senderId: adminId,
            senderType: 'psychologist',
            recipientId: recipientId,
            recipientType: recipientType,
            content: content
        });
        res.status(201).json(message);
    } catch (error) {
        console.error('Erro ao enviar resposta do admin:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: DELETE /api/admin/conversations/:id
 * Descrição: Deleta uma conversa e todas as suas mensagens.
 */
exports.deleteConversation = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params;
        const conversation = await db.Conversation.findByPk(id);
        if (!conversation) {
            return res.status(404).json({ error: 'Conversa não encontrada.' });
        }
        await conversation.destroy();
        res.status(200).json({ message: 'Conversa excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao deletar conversa:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};
/**
 * Rota: DELETE /api/admin/patients/:id
 * Descrição: Exclui um paciente específico.
 */
exports.deletePatient = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id);
        if (!patient) {
            return res.status(404).json({ error: 'Paciente não encontrado.' });
        }
        await patient.destroy();
        res.status(200).json({ message: 'Paciente excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao excluir o paciente.' });
    }
};

/**
 * Rota: GET /api/admin/conversations/:id/notes
 * Descrição: Busca todas as notas internas de uma conversa.
 */
exports.getInternalNotesForConversation = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params; // ID da conversa
        const notes = await db.InternalNote.findAll({
            where: { conversationId: id },
            include: [{
                model: db.Psychologist,
                as: 'author',
                attributes: ['id', 'nome', 'fotoUrl']
            }],
            order: [['createdAt', 'ASC']]
        });
        res.status(200).json(notes);
    } catch (error) {
        console.error('Erro ao buscar notas internas:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: POST /api/admin/conversations/:id/notes
 * Descrição: Adiciona uma nova nota interna a uma conversa.
 */
exports.addInternalNote = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id: conversationId } = req.params;
        const { content } = req.body;
        const adminId = req.psychologist.id;
        if (!content) {
            return res.status(400).json({ error: 'O conteúdo da nota é obrigatório.' });
        }
        const newNote = await db.InternalNote.create({ conversationId, adminId, content });
        res.status(201).json(newNote);
    } catch (error) {
        console.error('Erro ao adicionar nota interna:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/charts/new-users
 * Descrição: Busca dados de novos usuários (pacientes e psicólogos) por mês para o gráfico.
 */
exports.getNewUsersPerMonth = async (req, res) => {
    // ... (seu código existente)
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const newPatients = await db.Patient.findAll({
            attributes: [
                [db.sequelize.fn('date_trunc', 'month', db.sequelize.col('createdAt')), 'month'],
                [db.sequelize.fn('count', '*'), 'count']
            ],
            where: { createdAt: { [Op.gte]: sixMonthsAgo } },
            group: ['month'],
            order: [['month', 'ASC']]
        });
        const newPsychologists = await db.Psychologist.findAll({
            attributes: [
                [db.sequelize.fn('date_trunc', 'month', db.sequelize.col('createdAt')), 'month'],
                [db.sequelize.fn('count', '*'), 'count']
            ],
            where: { createdAt: { [Op.gte]: sixMonthsAgo } },
            group: ['month'],
            order: [['month', 'ASC']]
        });
        const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const labels = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - 5 + i);
            return monthNames[d.getMonth()];
        });
        const dataMap = new Map();
        labels.forEach(label => dataMap.set(label, { patients: 0, psychologists: 0 }));
        newPatients.forEach(item => {
            const monthName = monthNames[new Date(item.dataValues.month).getMonth()];
            if (dataMap.has(monthName)) {
                dataMap.get(monthName).patients = parseInt(item.dataValues.count, 10);
            }
        });
        newPsychologists.forEach(item => {
            const monthName = monthNames[new Date(item.dataValues.month).getMonth()];
            if (dataMap.has(monthName)) {
                dataMap.get(monthName).psychologists = parseInt(item.dataValues.count, 10);
            }
        });
        const patientData = labels.map(label => dataMap.get(label).patients);
        const psychologistData = labels.map(label => dataMap.get(label).psychologists);
        res.status(200).json({ labels, patientData, psychologistData });
    } catch (error) {
        console.error('Erro ao buscar dados para o gráfico de novos usuários:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/financials
 * Descrição: Busca dados financeiros para o dashboard.
 */
exports.getFinancials = async (req, res) => {
    // ... (seu código existente)
    try {
        const activePsychologists = await db.Psychologist.findAll({
            where: {
                plano: { [Op.ne]: null },
                status: 'active'
            },
            attributes: ['nome', 'plano', 'updatedAt'] 
        });
        const planPrices = { 'Essencial': 59.90, 'Clínico': 89.90, 'Sol': 129.90 };
        const mrr = activePsychologists.reduce((acc, psy) => acc + (planPrices[psy.plano] || 0), 0);
        const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30));
        const churnedCount = await db.Psychologist.count({
            where: {
                status: 'inactive',
                updatedAt: { [Op.gte]: thirtyDaysAgo }
            }
        });
        const totalActiveCount = activePsychologists.length;
        const totalUsersAtStartOfMonth = totalActiveCount + churnedCount;
        const churnRate = totalUsersAtStartOfMonth > 0 ? (churnedCount / totalUsersAtStartOfMonth) * 100 : 0;
        const ltv = churnRate > 0 ? (mrr / totalActiveCount) / (churnRate / 100) : 0;
        const kpis = {
            mrr: mrr,
            churnRate: churnRate.toFixed(1), 
            ltv: ltv,
        };
        const recentInvoices = [
            { psychologistName: 'Dra. Ana Psicóloga', date: new Date(), amount: 89.90, status: 'Paga' },
            { psychologistName: 'Dr. Carlos Terapeuta', date: new Date(), amount: 59.90, status: 'Paga' },
        ];
        const activePlans = activePsychologists.map(psy => ({
            psychologistName: psy.nome,
            planName: psy.plano,
            mrr: planPrices[psy.plano] || 0,
            nextBilling: new Date(new Date(psy.updatedAt).setMonth(new Date(psy.updatedAt).getMonth() + 1)) 
        }));
        res.status(200).json({
            kpis,
            recentInvoices,
            activePlans
        });
    } catch (error) {
        console.error('Erro ao buscar dados financeiros:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/psychologists/:id/status
 * Descrição: Atualiza o status de um psicólogo (ex: 'active', 'inactive').
 */
exports.updatePsychologistStatus = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['active', 'inactive', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }
        await psychologist.update({ status });
        res.status(200).json(psychologist);
    } catch (error) {
        console.error('Erro ao atualizar status do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: PUT /api/admin/patients/:id/status
 * Descrição: Atualiza o status de um paciente (ex: 'active', 'inactive').
 */
exports.updatePatientStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }
        const patient = await db.Patient.findByPk(id);
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });
        
        await patient.update({ status });
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: DELETE /api/admin/psychologists/:id
 * Descrição: Exclui permanentemente um psicólogo.
 */
exports.deletePsychologist = async (req, res) => {
    // ... (seu código existente)
    try {
        const { id } = req.params;
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }
        await psychologist.destroy();
        res.status(200).json({ message: 'Psicólogo excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/questionnaire-analytics
 * Descrição: Agrega e conta as respostas dos questionários de pacientes e psicólogos.
 */
exports.getQuestionnaireAnalytics = async (req, res) => {
    try {
        // --- 1. Análise do Questionário do Paciente (DemandSearch) ---
        
        // Helper para contar campos JSON (Simples ou Array)
        const countJsonField = async (field, isArray = false) => {
            let query;
            if (isArray) {
                // Verifica se é array antes de expandir para evitar erros em dados legados
                query = `
                    SELECT value, COUNT(*) as count
                    FROM "DemandSearches",
                    jsonb_array_elements_text("searchParams"->'${field}') as value
                    WHERE status = 'completed' 
                    AND "searchParams"->'${field}' IS NOT NULL
                    AND jsonb_typeof("searchParams"->'${field}') = 'array'
                    GROUP BY value
                `;
            } else {
                query = `
                    SELECT "searchParams"->>'${field}' as value, COUNT(*) as count
                    FROM "DemandSearches"
                    WHERE status = 'completed' AND "searchParams"->>'${field}' IS NOT NULL
                    GROUP BY value
                `;
            }
            const [results] = await db.sequelize.query(query);
            const counts = {};
            results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const totalPatients = await db.DemandSearch.count({ where: { status: 'completed' } });

        // --- OTIMIZAÇÃO: Executa todas as contagens de JSON em paralelo ---
        const [
            idade,
            identidade_genero,
            pref_genero_prof,
            motivacao,
            temas,
            terapia_anterior,
            experiencia_desejada,
            caracteristicas_prof,
            faixa_valor,
            modalidade_atendimento
        ] = await Promise.all([
            countJsonField('idade'),
            countJsonField('identidade_genero'),
            countJsonField('pref_genero_prof'),
            countJsonField('motivacao', true),
            countJsonField('temas', true),
            countJsonField('terapia_anterior'),
            countJsonField('experiencia_desejada', true),
            countJsonField('caracteristicas_prof', true),
            countJsonField('faixa_valor'),
            countJsonField('modalidade_atendimento')
        ]);

        const patientAnalytics = {
            total: totalPatients,
            idade, identidade_genero, pref_genero_prof, motivacao, temas,
            terapia_anterior, experiencia_desejada, caracteristicas_prof,
            faixa_valor, modalidade_atendimento
        };

        // --- 2. Análise do Questionário do Psicólogo (Psychologist) ---
        
        const totalPsis = await db.Psychologist.count({ where: { status: 'active' } });

        // Helper para campos de Array do Postgres (text[])
        const countArrayField = async (field) => {
            const query = `
                SELECT unnest("${field}") as value, COUNT(*) as count
                FROM "Psychologists"
                WHERE status = 'active' AND "${field}" IS NOT NULL
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        // Helper para campos simples
        const countSimpleField = async (field) => {
            const query = `
                SELECT "${field}" as value, COUNT(*) as count
                FROM "Psychologists"
                WHERE status = 'active' AND "${field}" IS NOT NULL
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        // Helper para Modalidade (JSONB)
        const countModalidadePsi = async () => {
             const query = `
                SELECT value, COUNT(*) as count
                FROM "Psychologists",
                jsonb_array_elements_text("modalidade") as value
                WHERE status = 'active' 
                AND "modalidade" IS NOT NULL 
                AND jsonb_typeof("modalidade") = 'array'
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        // Helper para Faixa de Valor (Bucketing)
        const countValorPsi = async () => {
            const query = `
                SELECT
                  CASE
                    WHEN "valor_sessao_numero" <= 90 THEN 'Social (até R$ 90)'
                    WHEN "valor_sessao_numero" <= 150 THEN 'R$ 91 - R$ 150'
                    WHEN "valor_sessao_numero" <= 250 THEN 'R$ 151 - R$ 250'
                    ELSE 'R$ 251+'
                  END as value,
                  COUNT(*) as count
                FROM "Psychologists"
                WHERE status = 'active' AND "valor_sessao_numero" IS NOT NULL
                GROUP BY value
            `;
            const [results] = await db.sequelize.query(query);
            const counts = {};
            results.forEach(r => counts[r.value] = parseInt(r.count, 10));
            return counts;
        };

        const [
            modalidade,
            genero_identidade_psi,
            valor_sessao_faixa_psi,
            temas_atuacao,
            abordagens_tecnicas,
            praticas_vivencias
        ] = await Promise.all([
            countModalidadePsi(),
            countSimpleField('genero_identidade'),
            countValorPsi(),
            countArrayField('temas_atuacao'),
            countArrayField('abordagens_tecnicas'),
            countArrayField('praticas_vivencias')
        ]);

        const psiAnalytics = {
            total: totalPsis,
            modalidade, genero_identidade: genero_identidade_psi, valor_sessao_faixa: valor_sessao_faixa_psi,
            temas_atuacao, abordagens_tecnicas, praticas_vivencias
        };

        // --- 3. Resumo dos últimos 30 dias (DemandSearch) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const total30d = await db.DemandSearch.count({
            where: {
                status: 'completed',
                createdAt: { [Op.gte]: thirtyDaysAgo }
            }
        });

        const summary30d = {
            total: total30d,
            stats: {}
        };

        if (total30d > 0) {
            const getTopStat = async (field, isArray = false) => {
                let query;
                if (isArray) {
                    query = `
                        SELECT value, COUNT(*) as count
                        FROM "DemandSearches",
                        jsonb_array_elements_text("searchParams"->'${field}') as value
                        WHERE status = 'completed' 
                        AND "createdAt" >= :date
                        AND "searchParams"->'${field}' IS NOT NULL
                        AND jsonb_typeof("searchParams"->'${field}') = 'array'
                        GROUP BY value
                        ORDER BY count DESC
                        LIMIT 1
                    `;
                } else {
                    query = `
                        SELECT "searchParams"->>'${field}' as value, COUNT(*) as count
                        FROM "DemandSearches"
                        WHERE status = 'completed' 
                        AND "createdAt" >= :date
                        AND "searchParams"->>'${field}' IS NOT NULL
                        GROUP BY value
                        ORDER BY count DESC
                        LIMIT 1
                    `;
                }
                const [results] = await db.sequelize.query(query, { replacements: { date: thirtyDaysAgo } });
                if (results.length > 0) {
                    return {
                        label: results[0].value,
                        percentage: Math.round((parseInt(results[0].count, 10) / total30d) * 100)
                    };
                }
                return null;
            };

            const fields = [
                { key: 'idade', isArray: false },
                { key: 'identidade_genero', isArray: false },
                { key: 'pref_genero_prof', isArray: false },
                { key: 'motivacao', isArray: true },
                { key: 'temas', isArray: true },
                { key: 'terapia_anterior', isArray: false },
                { key: 'experiencia_desejada', isArray: true },
                { key: 'caracteristicas_prof', isArray: true },
                { key: 'faixa_valor', isArray: false },
                { key: 'modalidade_atendimento', isArray: false }
            ];
            
            for (const f of fields) {
                summary30d.stats[f.key] = await getTopStat(f.key, f.isArray);
            }
        }

        res.json({ patientAnalytics, psiAnalytics, summary30d });

    } catch (error) {
        console.error("Erro ao gerar analytics de questionários:", error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
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