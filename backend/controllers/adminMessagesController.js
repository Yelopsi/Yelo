const db = require('../models');
const { Op } = require('sequelize');

/**
 * Rota: GET /api/admin/conversations/:id/messages
 * Descrição: Busca todas as mensagens de uma conversa específica.
 */
exports.getConversationMessages = async (req, res) => {
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
      totalPages: 1,
      currentPage: 1,
    });
  } catch (error) {
    console.error('Erro ao buscar conversas do admin:', error);
    res.status(500).json({ error: 'Falha ao buscar conversas.' });
  }
};

exports.getAllMessages = async (req, res) => {
    try {
        const messages = await db.Message.findAll({
            include: [
                { model: db.Patient, as: 'senderPatient', attributes: ['nome', 'id'] },
                { model: db.Psychologist, as: 'senderPsychologist', attributes: ['nome', 'id'] },
                { model: db.Patient, as: 'recipientPatient', attributes: ['nome', 'id'] },
                { model: db.Psychologist, as: 'recipientPsychologist', attributes: ['nome', 'id'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 200
        });
        res.status(200).json(messages);
    } catch (error) {
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.sendBroadcastMessage = async (req, res) => {
    try {
        const { title, content } = req.body;
        const adminName = req.psychologist?.nome || req.user?.nome || 'Equipe Yelo';
        if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });

        const aviso = await db.Aviso.create({ title, content, author: adminName, status: 'published' });
        if (req.io) req.io.emit('new_announcement', aviso.toJSON());

        res.status(201).json({ message: 'Aviso enviado com sucesso para todos os psicólogos.', aviso });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.sendReply = async (req, res) => {
    try {
        const { recipientId, recipientType, content } = req.body;
        const adminId = req.psychologist.id;
        if (!recipientId || !recipientType || !content) return res.status(400).json({ error: 'Destinatário e conteúdo são obrigatórios.' });
        
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
        const message = await db.Message.create({ conversationId: conversation.id, senderId: adminId, senderType: 'psychologist', recipientId: recipientId, recipientType: recipientType, content: content });
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await db.Conversation.findByPk(id);
        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada.' });
        await conversation.destroy();
        res.status(200).json({ message: 'Conversa excluída com sucesso.' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.getInternalNotesForConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const notes = await db.InternalNote.findAll({
            where: { conversationId: id },
            include: [{ model: db.Psychologist, as: 'author', attributes: ['id', 'nome', 'fotoUrl'] }],
            order: [['createdAt', 'ASC']]
        });
        res.status(200).json(notes);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.addInternalNote = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { content } = req.body;
        const adminId = req.psychologist.id;
        if (!content) return res.status(400).json({ error: 'O conteúdo da nota é obrigatório.' });
        
        const newNote = await db.InternalNote.create({ conversationId, adminId, content });
        res.status(201).json(newNote);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};