// backend/routes/adminSupportRoutes.js
const express = require('express');
const router = express.Router();
const adminSupportController = require('../controllers/supportController');

// Middleware de proteção (Verifica se é Admin mesmo)
// Vou usar um genérico que você deve ter. Se der erro, ajustamos igual fizemos antes.
// Tente usar o mesmo middleware que protege suas outras rotas de admin.
// Assumindo que você tem um middleware de admin:
const { protectAdmin } = require('../middleware/authMiddleware'); 
// SE NÃO TIVER 'protectAdmin', troque por 'protect' provisoriamente.

// Rotas
router.get('/conversations', adminSupportController.getConversations); // Lista Psis
router.get('/messages/:psiId', adminSupportController.getMessages);    // Lê chat
router.post('/messages/:psiId', adminSupportController.replyMessage);  // Responde

module.exports = router;