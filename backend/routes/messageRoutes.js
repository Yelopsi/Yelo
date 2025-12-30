const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Rota para listar mensagens (GET /api/messages)
router.get('/', protect, messageController.getMessages);

// Rota para enviar mensagem (POST /api/messages)
router.post('/', protect, messageController.sendMessage);

module.exports = router;