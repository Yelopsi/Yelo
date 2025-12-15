const express = require('express');
const router = express.Router();
// Importa o controlador de suporte que (espero que) você já tenha criado
const supportController = require('../controllers/supportController');
const { protect } = require('../middleware/authMiddleware');

// Protege todas as rotas abaixo
router.use(protect);

// Definição das rotas
router.get('/conversations', supportController.getConversations);
router.get('/conversations/:id', supportController.getMessages);
router.post('/messages', supportController.sendMessage);

module.exports = router;