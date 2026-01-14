// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');

// Rota protegida: Cria assinatura no Asaas (Checkout Transparente)
router.post('/create-preference', protect, paymentController.createPreference);

// Rota pública: Webhook para receber notificações do Asaas
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
