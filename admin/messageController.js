const db = require('../models');
const { Op } = require('sequelize');

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