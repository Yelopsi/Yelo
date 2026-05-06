const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../models');
const { Op } = require('sequelize');

let io;

const initSocket = (server) => {
    io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] } });

    io.on('connection', (socket) => {
        console.log(`[SOCKET] Nova conexão: ${socket.id}`);
        let user = null;
        try {
            let token = socket.handshake.auth.token;
            if (!token || token === 'cookie_auth_active') {
                const cookies = socket.handshake.headers.cookie?.split(';');
                const tokenCookie = cookies?.find(c => c.trim().startsWith('token='));
                if (tokenCookie) token = tokenCookie.split('=')[1];
            }
            if (token) {
                user = jwt.verify(token, process.env.JWT_SECRET);
                if (user?.id) {
                    socket.join(`user-${user.id}`);
                    if (user.role === 'psychologist' || user.type === 'psychologist') socket.join(`psychologist-${user.id}`);
                    else if (user.role === 'patient' || user.type === 'patient') socket.join(`patient-${user.id}`);
                }
                if (user && (user.role === 'admin' || user.type === 'admin')) socket.join('admins');
            }
        } catch (e) { /* Token inválido */ }

        socket.on('admin_sent_message', (msg) => {
            if (msg.targetUserId) io.to(`user-${msg.targetUserId}`).to(`psychologist-${msg.targetUserId}`).to(`patient-${msg.targetUserId}`).emit('receiveMessage', msg);
        });

        socket.on('message_delivered', async ({ messageId }) => {
            try {
                if (!messageId) return;
                const [updated] = await db.Message.update({ status: 'delivered' }, { where: { id: messageId, status: 'sent' } });
                if (updated > 0) io.emit('message_status_updated', { messageId, status: 'delivered' });
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
                const msgs = await db.Message.findAll({ attributes: ['id'], where: whereClause });
                if (msgs.length > 0) {
                    const ids = msgs.map(m => m.id);
                    await db.sequelize.query(`UPDATE "Messages" SET "status" = 'read', "updatedAt" = NOW() WHERE "id" IN (:ids)`, { replacements: { ids } });
                    msgs.forEach(m => io.emit('message_status_updated', { messageId: m.id, status: 'read' }));
                }
            } catch (err) { console.error("Erro socket messages_read:", err.message); }
        });
    });
    return io;
};

module.exports = { initSocket, getIo: () => io };