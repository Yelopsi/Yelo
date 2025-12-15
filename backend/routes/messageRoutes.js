const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Todas as rotas de mensagem são protegidas pelo middleware de autenticação
router.use(protect);

router.get('/conversations', messageController.getConversations);
router.get('/conversations/:conversationId', messageController.getMessages);
router.put('/conversations/:conversationId/read', messageController.markConversationAsRead);
router.post('/messages', messageController.sendMessage);

module.exports = router;