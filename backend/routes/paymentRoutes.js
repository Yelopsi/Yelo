// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const asaasWebhook = require('../webhooks/asaasWebhook');
const { protect } = require('../middlewares/authMiddleware');

// Rota protegida: Cria assinatura no Asaas (Checkout Transparente)
router.post('/create-preference', protect, paymentController.createPreference);

// Rota pública: Webhook para receber notificações do Asaas
router.post('/webhook', asaasWebhook.handleWebhook);

module.exports = router;
