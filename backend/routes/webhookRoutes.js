const express = require('express');
const router = express.Router();
const whatsappWebhook = require('../webhooks/whatsappWebhook');

// Webhooks do WhatsApp
router.get('/whatsapp', whatsappWebhook.verifyWebhook);
router.post('/whatsapp', whatsappWebhook.handleMessage);

module.exports = router;