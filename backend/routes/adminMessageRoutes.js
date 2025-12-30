// c:/Users/Anderson/Desktop/Yelo/backend/routes/adminMessageRoutes.js

const express = require('express');
const router = express.Router();
const adminMessageController = require('../controllers/adminMessageController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rota para o admin buscar todas as conversas ativas
router.get('/conversations', protect, admin, adminMessageController.getAllConversations);

// Rota para o admin buscar as mensagens de uma conversa específica
router.get('/conversation/:id', protect, admin, adminMessageController.getMessagesForConversation);

// Rota para o admin responder a uma conversa
router.post('/reply', protect, admin, adminMessageController.replyToConversation);

// Rota para Arquivar/Desarquivar conversa
router.patch('/conversation/:id/:action', protect, admin, adminMessageController.toggleArchiveConversation);

// Rota para Excluir conversa
router.delete('/conversation/:id', protect, admin, adminMessageController.deleteConversation);

module.exports = router;
