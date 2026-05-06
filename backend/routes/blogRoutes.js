// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect } = require('../middlewares/authMiddleware');

// --- AS ROTAS ---
// Todas protegidas pelo middleware padrão 'protect' da Yelo
router.get('/', protect, blogController.listarMeusPosts);
router.post('/', protect, blogController.criarPost);
router.put('/:id', protect, blogController.atualizarPost);
router.delete('/:id', protect, blogController.deletarPost);

module.exports = router;