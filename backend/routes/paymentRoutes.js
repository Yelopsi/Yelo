// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const paymentController = require('../controllers/paymentController');
const asaasWebhook = require('../webhooks/asaasWebhook');
const { protect } = require('../middlewares/authMiddleware');

// Rota pública de alta velocidade para QR Code simulado do App
router.get('/mock-pix-qr', async (req, res) => {
    try {
        const payload = '00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540599.005802BR5913YELO SAUDE6009SAO PAULO62070503***6304ABCD';
        const buffer = await QRCode.toBuffer(payload, { width: 300, margin: 1 });
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.type('image/png').send(buffer);
    } catch (e) {
        res.status(500).send('Erro ao gerar QRCode');
    }
});

// Rotas protegidas: Verifica elegibilidade de oferta por e-mail, valida cupom VIP interno e cria assinatura no Asaas
router.get('/promo-eligibility', protect, paymentController.getPromoEligibility);
router.post('/validate-coupon', protect, paymentController.validateCoupon);
router.post('/create-preference', protect, paymentController.createPreference);

// Rotas protegidas para PIX e Atualização de Assinatura
router.get('/pending-pix', protect, paymentController.getPendingPix);
router.post('/convert-overdue-to-pix', protect, paymentController.convertOverdueToPix);
router.post('/update-method', protect, paymentController.updateSubscriptionMethod);

// Rota pública: Webhook para receber notificações do Asaas
router.post('/webhook', asaasWebhook.handleWebhook);

module.exports = router;
