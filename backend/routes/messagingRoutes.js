const express = require('express');
const router = express.Router();
// Importa o controller que criamos anteriormente
const messagingController = require('../controllers/messagingController'); 

// --- CORREÇÃO AQUI ---
// Usamos o nome correto do arquivo (authMiddleware) e extraímos a função 'protect'
const { protect } = require('../middleware/authMiddleware'); 

// Rotas protegidas com 'protect'
router.get('/conversations', protect, messagingController.getConversations);
router.get('/conversations/:id', protect, messagingController.getMessages);
router.post('/messages', protect, messagingController.sendMessage);

module.exports = router;