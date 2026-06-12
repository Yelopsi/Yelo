// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// --- AS ROTAS ---
// Todas protegidas pelo middleware padrão 'protect' da Yelo
router.get('/', protect, blogController.listarMeusPosts);
router.post('/', protect, upload.single('imagem'), blogController.criarPost);
router.put('/:id', protect, upload.single('imagem'), blogController.atualizarPost);
router.delete('/:id', protect, blogController.deletarPost);

module.exports = router;