const express = require('express');
const router = express.Router();
const newsletterController = require('../controllers/newsletterController');

router.post('/subscribe', newsletterController.subscribe);
router.post('/unsubscribe', newsletterController.unsubscribe);
router.get('/status', newsletterController.getStatus);

module.exports = router;