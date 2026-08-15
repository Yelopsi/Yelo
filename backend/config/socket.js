const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { Op } = require('sequelize');

const { dtoMessage, dtoMessageStatus } = require('../utils/socketDataMinimization');

let io;

const initSocket = (server) => {
    io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });

    const { checkConnectionRateLimit, checkEventRateLimit } = require('../utils/socketRateLimiter');

    // MIDDLEWARE DE AUTENTICAÇÃO ESTRITA E CONNECTION RATE LIMITING
    io.use((socket, next) => {
        // Camada A: Rate limit de conexão baseado no IP (com fallback)
        const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || 'unknown_ip';
        checkConnectionRateLimit(clientIp, (err) => {
            if (err) return next(err); // Deny handshake if flooded

            try {
                let token = socket.handshake.auth.token;
                if (!token || token === 'cookie_auth_active') {
                    const cookies = socket.handshake.headers.cookie?.split(';');
                    const tokenCookie = cookies?.find(c => c.trim().startsWith('token='));
                    if (tokenCookie) token = tokenCookie.split('=')[1];
                }
                if (!token) {
                    return next(new Error('Authentication error: Token missing'));
                }
                const user = jwt.verify(token, process.env.JWT_SECRET);
                socket.user = user; // Salva o usuário no socket para uso posterior
                next();
            } catch (e) {
                return next(new Error('Authentication error: Token invalid or expired'));
            }
        });
    });

    io.on('connection', (socket) => {
        console.log(`[SOCKET] Nova conexão Autenticada: ${socket.id} (User: ${socket.user.id})`);
        
        // Camada B: Middleware Genérico para Event Rate Limiting (Flood de Payloads)
        socket.use(([event, ...args], next) => {
            if (!checkEventRateLimit(socket, event)) {
                console.log(`[SOCKET] DROP EVENT ${event} from socket ${socket.id} (Rate Limit Exceeded)`);
                return next(new Error('Rate limit exceeded for event'));
            }
            next();
        });

        const user = socket.user;
        
        if (user?.id) {
            socket.join(`user-${user.id}`);
            if (user.role === 'psychologist' || user.type === 'psychologist') socket.join(`psychologist-${user.id}`);
            else if (user.role === 'patient' || user.type === 'patient') socket.join(`patient-${user.id}`);
        }
        if (user && (user.role === 'admin' || user.type === 'admin')) socket.join('admins');

        socket.on('admin_sent_message', (msg) => {
            if (user.role !== 'admin' && user.type !== 'admin') return; // PROTEÇÃO: Só admin pode disparar
            const safeMsg = dtoMessage(msg); // Aplica minimização
            if (msg.targetUserId && safeMsg) io.to(`user-${msg.targetUserId}`).emit('receiveMessage', safeMsg);
        });

        socket.on('message_delivered', async ({ messageId }) => {
            try {
                if (!messageId) return;
                const msg = await db.Message.findOne({ where: { id: messageId, status: 'sent' } });
                if (!msg) return; // Mensagem não existe ou já entregue
                
                // DATA MINIMIZATION + ROOM ISOLATION: Avisa SOMENTE o remetente (senderId) original, não a rede inteira.
                const [updated] = await db.Message.update({ status: 'delivered' }, { where: { id: messageId } });
                if (updated > 0) {
                    const statusDto = dtoMessageStatus(messageId, 'delivered');
                    io.to(`user-${msg.senderId}`).emit('message_status_updated', statusDto);
                }
            } catch (err) { console.error("Erro socket message_delivered:", err.message); }
        });

        socket.on('messages_read', async ({ conversationId }) => {
            try {
                if (!conversationId) return;
                const whereClause = { conversationId, status: { [Op.in]: ['sent', 'delivered'] } };
                if (user) {
                    if (user.role === 'admin' || user.type === 'admin') whereClause.senderType = { [Op.ne]: 'admin' };
                    else if (user.role === 'psychologist' || user.type === 'psychologist') whereClause.senderType = { [Op.ne]: 'psychologist' };
                    else if (user.role === 'patient' || user.type === 'patient') whereClause.senderType = { [Op.ne]: 'patient' };
                }
                const msgs = await db.Message.findAll({ attributes: ['id', 'senderId'], where: whereClause });
                if (msgs.length > 0) {
                    const ids = msgs.map(m => m.id);
                    await db.sequelize.query(`UPDATE "Messages" SET "status" = 'read', "updatedAt" = NOW() WHERE "id" IN (:ids)`, { replacements: { ids } });
                    msgs.forEach(m => {
                        const statusDto = dtoMessageStatus(m.id, 'read');
                        io.to(`user-${m.senderId}`).emit('message_status_updated', statusDto);
                    });
                }
            } catch (err) { console.error("Erro socket messages_read:", err.message); }
        });
    });
    return io;
};

module.exports = { initSocket, getIo: () => io };