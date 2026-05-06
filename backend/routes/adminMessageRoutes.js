// c:/Users/Anderson/Desktop/Yelo/backend/routes/adminMessageRoutes.js

const express = require('express');
const router = express.Router();
const adminMessageController = require('../controllers/adminMessageController');
const adminController = require('../controllers/adminController'); // Controller legado para migração
const { protect, admin } = require('../middlewares/authMiddleware');

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

// --- FUNCIONALIDADES MIGRADAS DO ADMIN ROUTES ---

// Rota para enviar mensagens em massa (broadcast)
router.post('/broadcast', protect, admin, adminController.sendBroadcastMessage);

// Rotas para Notas Internas
router.get('/conversations/:id/notes', protect, admin, adminController.getInternalNotesForConversation);
router.post('/conversations/:id/notes', protect, admin, adminController.addInternalNote);

module.exports = router;
