// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const asaasWebhook = require('../webhooks/asaasWebhook');
const { protect } = require('../middlewares/authMiddleware');

// Rota protegida: Cria assinatura no Asaas (Checkout Transparente)
router.post('/create-preference', protect, paymentController.createPreference);

// Rotas protegidas para PIX e Atualização de Assinatura
router.get('/pending-pix', protect, paymentController.getPendingPix);
router.post('/update-method', protect, paymentController.updateSubscriptionMethod);

// Rota pública: Webhook para receber notificações do Asaas
router.post('/webhook', asaasWebhook.handleWebhook);

module.exports = router;
