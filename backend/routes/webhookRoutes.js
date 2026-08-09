const express = require('express');
const router = express.Router();
const whatsappWebhook = require('../webhooks/whatsappWebhook');
const { verifyWhatsAppSignature } = require('../middlewares/webhookAuth');

// Webhooks do WhatsApp
router.get('/whatsapp', whatsappWebhook.verifyWebhook);
router.post('/whatsapp', verifyWhatsAppSignature, whatsappWebhook.handleMessage);

module.exports = router;