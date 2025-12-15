// backend/routes/qnaRoutes.js
const express = require('express');
const router = express.Router();
const qnaController = require('../controllers/qnaController');
const { protect } = require('../middleware/authMiddleware'); 

// --- ROTAS PÚBLICAS (PACIENTE) ---
// Qualquer um pode ler e perguntar
router.get('/public', qnaController.getPublicQuestions);
router.post('/ask', qnaController.createQuestion);

// --- ROTAS PRIVADAS (PSICÓLOGO) ---
// Só Psi logado vê a lista interna e responde
router.get('/', protect, qnaController.getQuestions);
router.post('/:id/answer', protect, qnaController.answerQuestion);
router.post('/:id/ignore', protect, qnaController.ignoreQuestion);

module.exports = router;