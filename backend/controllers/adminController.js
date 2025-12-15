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
    // ... (seu código existente)
    if (req.psychologist) {
        const { id, nome, email, telefone, fotoUrl } = req.psychologist;
        res.status(200).json({ id, nome, email, telefone, fotoUrl });
    } else {
        res.status(404).json({ error: 'Administrador não encontrado.' });
    }
};

/**
 * Rota: PUT /api/admin/me
 * Descrição: Atualiza os dados do administrador logado.
 */
exports.updateAdminData = async (req, res) => {
    // ... (seu código existente)
    try {
        const adminUser = req.psychologist;
        const { nome, email, telefone } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
        }
        if (email.toLowerCase() !== adminUser.email.toLowerCase()) {
            const existingUser = await db.Psychologist.findOne({ where: { email } });
            if (existingUser) {
                return res.status(409).json({ error: 'Este email já está em uso por outra conta.' });
            }
        }
        await adminUser.update({ nome, email, telefone });
        res.status(200).json({ message: 'Dados atualizados com sucesso!' });
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
    // ... (seu código existente)
    try {
        const { senha_atual, nova_senha } = req.body;
        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }
        const adminUser = await db.Psychologist.findByPk(req.psychologist.id);
        const isMatch = await bcrypt.compare(senha_atual, adminUser.senha);
        if (!isMatch) {
            return res.status(401).json({ error: 'A senha atual está incorreta.' });
        }
        adminUser.senha = await bcrypt.hash(nova_senha, 10);
        await adminUser.save();
        res.status(200).json({ message: 'Senha alterada com sucesso!' });
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
    // ... (seu código existente)
    try {
        const adminUser = req.psychologist;
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
        }
        const fotoUrl = `/uploads/profiles/${req.file.filename}`;
        await adminUser.update({ fotoUrl });
        res.status(200).json({
            message: 'Foto de perfil atualizada com sucesso!',
            fotoUrl: fotoUrl
        });
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
        const now = new Date();
        
        // Definição de "30 dias atrás"
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

        // --- A. DADOS DE CRESCIMENTO ---
        const newPatients30d = await db.Patient.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } });
        // CORREÇÃO: Adicionamos paranoid: false para contar também quem se cadastrou e já saiu (Churn)
        const newPsis30d = await db.Psychologist.count({ 
            where: { createdAt: { [Op.gte]: thirtyDaysAgo } },
            paranoid: false 
        });
        
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

        // --- 2. Busca no Banco ---
        // Agora o filtro funciona perfeitamente
        const questToday = await db.DemandSearch.count({ 
            where: { 
                createdAt: { [Op.gte]: startOfToday },
                status: 'completed' // <--- SÓ CONTA CONCLUÍDOS
            } 
        });

        // --- B. DADOS GERAIS (Raio-X da Base - Lógica Exata) ---

        // 1. PACIENTES
        // Total histórico (inclui excluídos)
        const totalPat = await db.Patient.count({ paranoid: false });
        // Ativos agora (ignora excluídos)
        const activePat = await db.Patient.count(); 
        // Excluídos (conta explicitamente quem tem data de exclusão)
        const deletedPat = await db.Patient.count({ 
            where: { deletedAt: { [Op.not]: null } }, 
            paranoid: false 
        });

        // 2. PSICÓLOGOS
        const totalPsi = await db.Psychologist.count({ paranoid: false });
        // Consideramos "Ativos" apenas quem está com status 'active' E não foi deletado
        const activePsi = await db.Psychologist.count({ where: { status: 'active' } });
        
        // Excluídos Real (Quem foi deletado da base)
        const deletedPsi = await db.Psychologist.count({ 
            where: { deletedAt: { [Op.not]: null } }, 
            paranoid: false 
        });

        // Contagem de Planos (Apenas de psis não-excluídos e ativos)
        const psisByPlan = await db.Psychologist.findAll({
            attributes: ['plano', [db.sequelize.fn('COUNT', 'plano'), 'count']],
            where: { status: 'active', plano: { [Op.ne]: null } },
            group: ['plano']
        });
        const plansCount = {};
        psisByPlan.forEach(p => plansCount[p.dataValues.plano] = parseInt(p.dataValues.count, 10));

        // 3. QUESTIONÁRIOS (Corrigido)
        
        // Total = Apenas os que foram concluídos com sucesso
        const totalQuest = await db.DemandSearch.count({ 
            where: { status: 'completed' }, 
            paranoid: false 
        });
        
        // Lógica de Desistência (Abandono de Funil)
        // Conta quem está como 'started' há mais de 10 MINUTOS
        const tenMinutesAgo = new Date(new Date() - 10 * 60 * 1000); // 10 minutos em ms
        
        const abandonedQuest = await db.DemandSearch.count({ 
            where: { 
                status: 'started',
                updatedAt: { [Op.lt]: tenMinutesAgo } // Menor que 10 min atrás
            },
            paranoid: false 
        });

        // --- C. FINANCEIRO (MRR) ---
        // Calcula somando o valor dos planos dos ativos
        const activePayingPsis = await db.Psychologist.findAll({ 
            where: { status: 'active', plano: { [Op.ne]: null } } 
        });
        
        const planPrices = { 'Semente': 59.90, 'Luz': 89.90, 'Sol': 129.90 };
        let mrr = 0;
        
        activePayingPsis.forEach(psy => {
            const price = planPrices[psy.plano];
            if (price) mrr += price;
        });

        // --- D. ALERTAS ---
        const waitingListCount = await db.WaitingList.count({ where: { status: 'pending' } });
        const pendingReviewsCount = await db.Review.count({ where: { status: 'pending' } });

        res.status(200).json({
            mrr: mrr.toFixed(2),
            newPatients30d,
            newPsis30d,
            questToday,
            patients: { total: totalPat, active: activePat, deleted: deletedPat },
            psychologists: { total: totalPsi, active: activePsi, deleted: deletedPsi, byPlan: plansCount },
            questionnaires: { total: totalQuest, deleted: abandonedQuest },
            waitingListCount,
            pendingReviewsCount
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
            GROUP BY periodo;
        `;

        // --- NOVO: 5. DADOS DA COMUNIDADE E BLOG (KPIs) ---
        // Contagens simples para cards
        const communityStats = {
            questionsTotal: await db.Question.count(),
            questionsAnswered: await db.Question.count({ where: { status: 'answered' } }),
            answersTotal: await db.Answer.count(),
            blogPosts: 0 // Placeholder se você ainda não tem tabela de Blog
        };
        // Se tiver tabela de Blog, descomente:
        // communityStats.blogPosts = await db.BlogPost.count(); 

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

        const [usersData] = await db.sequelize.query(usersQuery, { replacements: { start: startDate, end: endDate } });
        const [demandData] = await db.sequelize.query(demandQuery, { replacements: { start: startDate, end: endDate } });
        const [plansData] = await db.sequelize.query(plansQuery);
        const [timeData] = await db.sequelize.query(timeOfDayQuery);
        const [visitsData] = await db.sequelize.query(visitsQuery, { replacements: { start: startDate, end: endDate } });

        res.json({
            users: usersData,
            demand: demandData,
            plans: plansData[0],
            timeOfDay: timeData, // Novo dado
            community: communityStats, // Novo dado
            visits: visitsData // <--- Adicione aqui no retorno
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
        const logs = await db.SystemLog.findAll({
            limit: 100, // Limita aos 100 logs mais recentes
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(logs);
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
        const planPrices = { 'Semente': 59.90, 'Luz': 89.90, 'Sol': 129.90 };
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