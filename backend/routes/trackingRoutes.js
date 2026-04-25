const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');

// Rota para registrar a visita inicial na Landing Page e capturar UTMs
router.post('/visit', trackingController.registerVisit);

// Rota para registrar os abandonos (drop-offs) do questionário
router.post('/questionario-step', trackingController.registerQuestionnaireStep);

module.exports = router;