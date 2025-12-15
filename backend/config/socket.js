const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize'); // <-- ADICIONADO: Importação necessária
const db = require('../models');

let io;
const connectedUsers = new Map(); // Mapeia userId -> socketId

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "http://127.0.0.1:5500", // Permite a conexão do seu frontend
            methods: ["GET", "POST"]
        }
    });

    // Middleware de autenticação do Socket.IO
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token not provided.'));
        }
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) {
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
                    senderType: sender.type,
                    recipientId,
                    recipientType,
                    content
                });

                // Atualiza o 'updatedAt' da conversa para ordenação
                await db.Conversation.update({ updatedAt: new Date() }, { where: { id: conversationId } });

                // 2. Envia a mensagem para o destinatário, se ele estiver online
                const recipientSocketId = connectedUsers.get(recipientId.toString());
                if (recipientSocketId) {
                    // Notifica o destinatário sobre a nova mensagem e a atualização da conversa
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