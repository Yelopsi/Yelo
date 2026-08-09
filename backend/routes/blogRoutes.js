// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');

// Filtro de tamanho e extensão para upload do Blog
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo inválido. Apenas JPEG, PNG e WebP são permitidos.'));
        }
    }
});
// --- AS ROTAS ---
// Todas protegidas pelo middleware padrão 'protect' da Yelo
router.get('/', protect, blogController.listarMeusPosts);
router.post('/', protect, upload.single('imagem'), blogController.criarPost);
router.put('/:id', protect, upload.single('imagem'), blogController.atualizarPost);
router.delete('/:id', protect, blogController.deletarPost);

module.exports = router;