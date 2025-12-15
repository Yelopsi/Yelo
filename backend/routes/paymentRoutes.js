// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Rota protegida (só usuário logado gera boleto/pix)
router.post('/create-preference', protect, paymentController.createPreference);

// Rota pública (o Mercado Pago não faz login para te avisar)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
