const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// Todas as rotas de mensagens são protegidas
router.use(protect);

router.put('/conversations/:id/read', messageController.markConversationAsRead);

module.exports = router;