const db = require('../models');
const { Op } = require('sequelize');

// Listar todas as conversas do usuário logado
exports.getConversations = async (req, res) => {
    try {
        const user = req.patient || req.psychologist;
        const userType = req.patient ? 'patient' : 'psychologist';

        const whereClause = userType === 'patient'
            ? { patientId: user.id }
            : { psychologistId: user.id };

        const conversations = await db.Conversation.findAll({
            where: whereClause,
            include: [
                { model: db.Patient, as: 'patient', attributes: ['id', 'nome', 'fotoUrl'] },
                { model: db.Psychologist, as: 'psychologist', attributes: ['id', 'nome', 'fotoUrl'] }
            ],
            order: [['updatedAt', 'DESC']]
        });

        res.status(200).json(conversations);
    } catch (error) {
        console.error("Erro ao buscar conversas:", error);
        res.status(500).json({ error: 'Erro ao buscar conversas.' });
    }
};

// Listar mensagens de uma conversa específica
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const user = req.patient || req.psychologist;
        const userType = req.patient ? 'patient' : 'psychologist';

        const messages = await db.Message.findAll({
            where: { conversationId },
            order: [['createdAt', 'ASC']]
        });

        // Marcar mensagens como lidas
        await db.Message.update({ isRead: true }, {
            where: {
                conversationId,
                recipientId: user.id,
                recipientType: userType
            }
        });

        res.status(200).json(messages);
    } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
        res.status(500).json({ error: 'Erro ao buscar mensagens.' });
    }
};

// Enviar uma nova mensagem
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, recipientId, recipientType, content } = req.body;
        const sender = req.patient || req.psychologist;
        const senderType = req.patient ? 'patient' : 'psychologist';

        if (!content) {
            return res.status(400).json({ error: 'O conteúdo da mensagem é obrigatório.' });
        }

        const message = await db.Message.create({
            conversationId,
            senderId: sender.id,
            senderType,
            recipientId,
            recipientType,
            content
        });

        // Atualiza o 'updatedAt' da conversa para ordenação
        await db.Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

        res.status(201).json(message);
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ error: 'Erro ao enviar mensagem.' });
    }
};

/**
 * Rota: PUT /api/messaging/conversations/:id/read
 * Descrição: Marca todas as mensagens de uma conversa como lidas para o usuário logado.
 */
exports.markConversationAsRead = async (req, res) => {
    try {
        const conversationId = req.params.id;
        const userId = req.psychologist?.id || req.patient?.id;
        const userType = req.psychologist ? 'psychologist' : 'patient';

        await db.Message.update(
            { isRead: true },
            {
                where: {
                    conversationId: conversationId,
                    recipientId: userId,
                    recipientType: userType
                }
            }
        );
        res.status(200).json({ message: 'Mensagens marcadas como lidas.' });
    } catch (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};