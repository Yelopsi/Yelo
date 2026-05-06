const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middlewares/authMiddleware'); 

// Rota protegida: POST /api/support/contact
// O middleware 'protect' garante que apenas usuários logados (autenticados) consigam enviar mensagens
router.post('/contact', protect, supportController.sendSupportContact);

module.exports = router;