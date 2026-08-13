const express = require('express');
const router = express.Router();
const whatsappWebhook = require('../webhooks/whatsappWebhook');
const asaasWebhook = require('../webhooks/asaasWebhook');
const { verifyWhatsAppSignature } = require('../middlewares/webhookAuth');

// Webhooks do WhatsApp
router.get('/whatsapp', whatsappWebhook.verifyWebhook);
router.post('/whatsapp', verifyWhatsAppSignature, whatsappWebhook.handleMessage);

// Webhook de validação de saque do Asaas
router.post('/asaas/withdrawal', asaasWebhook.validateWithdrawal);

module.exports = router;