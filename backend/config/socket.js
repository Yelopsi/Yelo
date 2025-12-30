const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');

let io;
const connectedUsers = new Map(); // Mapeia userId -> socketId

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Middleware de autenticação do Socket.IO
    io.use((socket, next) => {
        let token = socket.handshake.auth.token;

        if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
            token = token.slice(7, token.length).trim();
        }

        if (!token) {
            return next(new Error('Authentication error: Token not provided.'));
        }
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
                console.error('Socket Auth Error:', err.message); // Log para ajudar no debug
                return next(new Error('Authentication error: Invalid token.'));
            }
            socket.user = decoded; // Anexa os dados do usuário (id, type) ao socket
            next();
        });
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.id} with socket ID ${socket.id}`);
        
        // Armazena o usuário conectado e seu socket ID
        connectedUsers.set(socket.user.id.toString(), socket.id);

        socket.join(socket.user.id.toString()); // Sala pessoal (ex: "15")
        
        // Verifica tanto 'role' quanto 'type' para garantir que o admin entre na sala
        if (socket.user.role === 'admin' || socket.user.type === 'admin') {
            socket.join('admin_room'); 
            console.log(`✅ Socket ${socket.id} entrou na sala 'admin_room'`);
        }

        // --- CORREÇÃO 1: Ouvinte de Mensagem Entregue ---
        socket.on('message_delivered', async ({ messageId }) => {
            try {
                const [updated] = await db.Message.update(
                    { status: 'delivered' },
                    { where: { id: messageId, status: 'sent' } }
                );

                if (updated > 0) {
                    const message = await db.Message.findByPk(messageId, { attributes: ['id', 'senderId', 'senderType'] });
                    if (message && message.senderId) {
                        const evtData = { messageId: message.id, status: 'delivered' };
                        // CORREÇÃO: Garante comparação case-insensitive para 'admin'
                        const type = (message.senderType || '').toLowerCase();
                        const targetRoom = type === 'admin' ? 'admin_room' : message.senderId.toString();
                        io.to(targetRoom).emit('message_status_updated', evtData);
                    }
                }
            } catch (error) {
                console.error('Erro socket message_delivered:', error);
            }
        });

        // --- CORREÇÃO 2: Ouvinte de Mensagens Lidas ---
        socket.on('messages_read', async ({ conversationId }) => {
            try {
                const readerId = socket.user.id;
                const readerRole = socket.user.role || socket.user.type;
                
                // Monta a query: busca mensagens nesta conversa, que NÃO foram lidas,
                // e que foram destinadas ao usuário atual.
                const whereClause = {
                    conversationId: conversationId,
                    status: { [Op.ne]: 'read' }
                };

                // Se quem lê é Admin, ele lê mensagens destinadas a ele (ID específico) OU ao tipo 'admin'
                if (readerRole === 'admin') {
                    whereClause[Op.or] = [{ recipientId: readerId }, { recipientType: 'admin' }];
                } else {
                    whereClause.recipientId = readerId;
                }
                
                const messagesToUpdate = await db.Message.findAll({
                    where: whereClause,
                    attributes: ['id', 'senderId', 'senderType']
                });

                if (messagesToUpdate.length > 0) {
                    const ids = messagesToUpdate.map(m => m.id);
                    await db.Message.update({ status: 'read', isRead: true }, { where: { id: ids } });

                    // Notifica os remetentes originais sobre a leitura
                    messagesToUpdate.forEach(msg => {
                        const evtData = { messageId: msg.id, status: 'read' };
                        // Garante comparação case-insensitive para 'admin'
                        const type = (msg.senderType || '').toLowerCase();
                        const targetRoom = type === 'admin' ? 'admin_room' : msg.senderId.toString();
                        
                        console.log(`[Socket] Mensagem ${msg.id} lida. Notificando sala: ${targetRoom}`);
                        io.to(targetRoom).emit('message_status_updated', evtData);
                    });
                }
            } catch (error) {
                console.error('Erro socket messages_read:', error);
            }
        });

        // Evento para enviar uma mensagem
        socket.on('sendMessage', async (data, callback) => {
            let { conversationId, recipientId, recipientType, content } = data;
            const sender = socket.user;

            try {
                // Se não houver ID de conversa, é uma nova conversa.
                if (!conversationId) {
                    const [conversation] = await db.Conversation.findOrCreate({
                        where: {
                            [Op.or]: [
                                { psychologistId: sender.id, patientId: recipientId },
                                { psychologistId: recipientId, patientId: sender.id }
                            ]
                        },
                        defaults: {
                            psychologistId: sender.type === 'psychologist' ? sender.id : recipientId,
                            patientId: sender.type === 'patient' ? sender.id : recipientId
                        }
                    });
                    conversationId = conversation.id;
                }

                // 1. Salva a mensagem no banco de dados
                const message = await db.Message.create({
                    conversationId,
                    senderId: sender.id,
                    senderType: sender.type || sender.role, // CORREÇÃO: Fallback para garantir que salve 'admin'
                    recipientId,
                    recipientType,
                    content,
                    status: 'sent' // Garante status inicial
                });

                // Atualiza o 'updatedAt' da conversa para ordenação
                await db.Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

                // 2. Envia a mensagem para o destinatário, se ele estiver online
                const recipientSocketId = connectedUsers.get(recipientId.toString());
                
                if (recipientType === 'admin') {
                     io.to('admin_room').emit('receiveMessage', message);
                     io.to('admin_room').emit('conversationUpdated', { id: conversationId, lastMessage: message });
                } else if (recipientSocketId) {
                    io.to(recipientSocketId).emit('receiveMessage', message);
                    io.to(recipientSocketId).emit('conversationUpdated', {
                        id: conversationId,
                        lastMessage: message
                    });
                }

                // 3. Confirma o envio para o remetente (callback)
                callback({ success: true, message });

                // 4. Notifica o próprio remetente para que sua lista de conversas seja atualizada
                // Isso é útil se ele estiver com o chat aberto em outra aba/dispositivo.
                socket.emit('conversationUpdated', {
                    id: conversationId,
                    lastMessage: message
                });

            } catch (error) {
                console.error('Error sending message:', error);
                callback({ success: false, error: 'Failed to send message.' });
            }
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.user.id}`);
            connectedUsers.delete(socket.user.id.toString());
        });
    });

    console.log('Socket.IO initialized.');
}

module.exports = { initSocket, getIo: () => io };