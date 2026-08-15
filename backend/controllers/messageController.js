const db = require('../models');
const { Op } = require('sequelize');
const { getIo } = require('../config/socket'); // Importa o Socket

// Lista as conversas do usuário logado (Consolidado do antigo messagingController)
exports.getConversations = async (req, res) => {
    try {
        const user = req.psychologist || req.patient;
        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        const userId = user.id;
        const isPsychologist = !!req.psychologist;

        // Busca conversas reais no banco de dados usando a arquitetura nova
        const whereClause = isPsychologist ? { psychologistId: userId } : { patientId: userId };
        const conversations = await db.Conversation.findAll({ where: whereClause });

        if (conversations.length === 0) {
            // MVP Fallback: Se não houver conversas no banco, retorna a conversa fixa de suporte
            return res.json([{
                id: 'suporte_admin',
                type: 'support',
                participant: { nome: 'Suporte Yelo', role: 'Administração' },
                lastMessage: 'Canal direto com a administração.',
                updatedAt: new Date()
            }]);
        }

        // Mapeia conversas reais para o formato esperado pelo frontend
        const formattedConversations = conversations.map(convo => ({
            id: convo.id,
            type: (!convo.patientId) ? 'support' : 'chat',
            participant: (!convo.patientId) ? { nome: 'Suporte Yelo', role: 'Administração' } : { nome: 'Contato' },
            updatedAt: convo.updatedAt
        }));
        
        return res.json(formattedConversations);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao buscar conversas.' });
    }
};

// Lista mensagens entre o usuário logado e um contato (Admin ou outro usuário)
exports.getMessages = async (req, res) => {
    try {

        // --- CORREÇÃO DE ROBUSTEZ ---
        // Em vez de confiar em 'req.user', verificamos 'req.psychologist' e 'req.patient'
        // que são preenchidos de forma mais confiável pelo middleware.
        const user = req.psychologist || req.patient;
        const userType = req.psychologist ? 'psychologist' : 'patient';

        if (!user) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }
        
        const userId = user.id;

        const { contactType } = req.query; // ex: 'admin'

        // Para manter a retrocompatibilidade com o MVP, assumimos 'admin' se não especificado
        if (contactType === 'admin' || !contactType) {
            // 1. Encontra o ID da conversa entre este usuário e o admin.
            /// a convenção é que a conversa com o admin tem o patientId nulo.
            const whereClause = { psychologistId: userId, patientId: null };
            const conversation = await db.Conversation.findOne({ where: whereClause });

            // Se nunca houve uma conversa, retorna uma lista vazia.
            if (!conversation) {
                return res.json([]);
            }

            // 2. Busca todas as mensagens que pertencem a essa conversa.
            const messages = await db.Message.findAll({
                where: { conversationId: conversation.id },
                order: [['createdAt', 'ASC']]
            });
            return res.json(messages);
        }

        return res.json([]); // Se não for para o admin, retorna vazio por enquanto.
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao buscar mensagens: ' + error.message });
    }
};

// Envia uma nova mensagem
exports.sendMessage = async (req, res) => {
    try {

        // --- CORREÇÃO DE ROBUSTEZ ---
        const sender = req.psychologist || req.patient;
        const senderType = req.psychologist ? 'psychologist' : 'patient';

        if (!sender) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        const senderId = sender.id;

        const { recipientId, recipientType, content } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório.' });
        }

        // --- CORREÇÃO PRINCIPAL ---
        // 1. Encontra ou cria uma conversa entre o psicólogo e o admin.
        // Usamos `findOrCreate` para evitar duplicatas.
        const [conversation] = await db.Conversation.findOrCreate({
            where: { psychologistId: senderId, patientId: null },
            defaults: { psychologistId: senderId, patientId: null }
        });

        if (!conversation) {
            throw new Error('Não foi possível criar ou encontrar a conversa.');
        }

        // 2. Cria a mensagem associando-a ao ID da conversa.
        const newMessage = await db.Message.create({
            conversationId: conversation.id,
            senderId,
            senderType,
            recipientId: recipientId || null, 
            recipientType: recipientType || 'admin',
            content,
            status: 'sent'
        });
        // --- FIM DA CORREÇÃO ---

        // --- NOTIFICAÇÃO EM TEMPO REAL (SOCKET.IO) ---
        const io = getIo();
        if (io) {
            
            // --- DIAGNÓSTICO DE SALA ---
            const adminRoom = io.sockets.adapter.rooms.get('admin_room');
            const numAdmins = adminRoom ? adminRoom.size : 0;
            // ----------------------------
            const { dtoMessage } = require('../utils/socketDataMinimization');
            const msgPayload = dtoMessage(newMessage.toJSON());
            
            // Se o destinatário for Admin, envia para a sala 'admin_room'
            if (recipientType === 'admin' || !recipientId) {
                io.to('admin_room').emit('receiveMessage', msgPayload);
                io.to('admin_room').emit('conversationUpdated', { id: conversation.id, lastMessage: msgPayload });
            } else {
                // Se for um usuário específico, envia para a sala do ID dele
                io.to(recipientId.toString()).emit('receiveMessage', msgPayload);
                io.to(recipientId.toString()).emit('conversationUpdated', { id: conversation.id, lastMessage: msgPayload });
            }
        } else {
        }
        // ---------------------------------------------

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao enviar mensagem: ' + error.message });
    }
};

// Marca todas as mensagens de uma conversa como lidas para o usuário logado
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
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};