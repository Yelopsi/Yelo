const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Todas as rotas de mensagens e conversas do usuário exigem autenticação
router.use(protect);

// --- Rotas de Conversas ---
router.get('/conversations', messageController.getConversations);
router.put('/conversations/:id/read', messageController.markConversationAsRead);

// --- Rotas de Mensagens ---
// Rota para listar mensagens (GET /api/messages ou /api/messaging)
router.get('/', messageController.getMessages);
// Rota para enviar mensagem (POST /api/messages ou /api/messaging)
router.post('/', messageController.sendMessage);

module.exports = router;