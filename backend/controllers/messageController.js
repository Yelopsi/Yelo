const db = require('../models');
const { Op } = require('sequelize');
const { getIo } = require('../config/socket'); // Importa o Socket

// Lista mensagens entre o usuário logado e um contato (Admin ou outro usuário)
exports.getMessages = async (req, res) => {
    try {
        console.log('--- EXECUTANDO: messageController.getMessages ---');

        // --- CORREÇÃO DE ROBUSTEZ ---
        // Em vez de confiar em 'req.user', verificamos 'req.psychologist' e 'req.patient'
        // que são preenchidos de forma mais confiável pelo middleware.
        const user = req.psychologist || req.patient;
        const userType = req.psychologist ? 'psychologist' : 'patient';

        if (!user) {
            console.error('[DIAGNÓSTICO] getMessages: Nenhum usuário autenticado encontrado. Verifique o token e o authMiddleware.');
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }
        
        const userId = user.id;
        console.log(`--- [DIAGNÓSTICO] getMessages --- User: { id: ${userId}, type: ${userType} }`);

        const { contactType } = req.query; // ex: 'admin'

        if (contactType === 'admin') {
            // 1. Encontra o ID da conversa entre este usuário e o admin.
            // A convenção é que a conversa com o admin tem o patientId nulo.
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
        console.error('Erro ao buscar mensagens:', error);
        res.status(500).json({ error: 'Erro interno ao buscar mensagens: ' + error.message });
    }
};

// Envia uma nova mensagem
exports.sendMessage = async (req, res) => {
    try {
        console.log('--- EXECUTANDO: messageController.sendMessage ---');

        // --- CORREÇÃO DE ROBUSTEZ ---
        const sender = req.psychologist || req.patient;
        const senderType = req.psychologist ? 'psychologist' : 'patient';

        if (!sender) {
            console.error('[DIAGNÓSTICO] sendMessage: Nenhum usuário autenticado encontrado. Verifique o token e o authMiddleware.');
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        const senderId = sender.id;
        console.log(`--- [DIAGNÓSTICO] sendMessage --- User: { id: ${senderId}, type: ${senderType} } | Body:`, req.body);

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
            console.log(`[SOCKET] Tentando emitir mensagem via Socket. RecipientType: ${recipientType}`);
            
            // --- DIAGNÓSTICO DE SALA ---
            const adminRoom = io.sockets.adapter.rooms.get('admin_room');
            const numAdmins = adminRoom ? adminRoom.size : 0;
            console.log(`[SOCKET DIAGNOSTIC] Clientes conectados na sala 'admin_room': ${numAdmins}`);
            // ----------------------------

            const msgPayload = newMessage.toJSON();
            
            // Se o destinatário for Admin, envia para a sala 'admin_room'
            if (recipientType === 'admin' || !recipientId) {
                io.to('admin_room').emit('receiveMessage', msgPayload);
                io.to('admin_room').emit('conversationUpdated', { id: conversation.id, lastMessage: msgPayload });
            } else {
                // Se for um usuário específico, envia para a sala do ID dele
                console.log(`[SOCKET] Emitindo para user ID: ${recipientId}`);
                io.to(recipientId.toString()).emit('receiveMessage', msgPayload);
                io.to(recipientId.toString()).emit('conversationUpdated', { id: conversation.id, lastMessage: msgPayload });
            }
        } else {
            console.error('[SOCKET] ERRO: Instância IO não encontrada no controller.');
        }
        // ---------------------------------------------

        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro interno ao enviar mensagem: ' + error.message });
    }
};