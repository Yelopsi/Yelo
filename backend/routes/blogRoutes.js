// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const blogController = require('../controllers/blogController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '../../uploads');
try {
    fs.mkdirSync(uploadsDir, { recursive: true });
} catch (_) {}

// Filtro de tamanho e extensão para upload do Blog
const upload = multer({ 
    dest: uploadsDir,
    limits: { fileSize: 8 * 1024 * 1024 }, // Max 8MB
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowedMimeTypes.includes(String(file.mimetype || '').toLowerCase())) {
            cb(null, true);
        } else {
            cb(new Error('Formato de imagem inválido. Envie apenas JPG, PNG ou WebP.'));
        }
    }
});

// Wrapper explícito para devolver JSON legível (evita cair sem CORS ou em erro genérico no cliente)
function handleBlogImageUpload(req, res, next) {
    upload.single('imagem')(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'A imagem de capa excede o limite de 8MB. Escolha uma foto menor.' });
        }
        return res.status(400).json({ error: err.message || 'Formato de imagem inválido. Use JPG, PNG ou WebP.' });
    });
}

// --- AS ROTAS ---
// Todas protegidas pelo middleware padrão 'protect' da Yelo
router.get('/quota', protect, blogController.obterCotaPublicacao);
router.get('/', protect, blogController.listarMeusPosts);
router.post('/', protect, handleBlogImageUpload, blogController.criarPost);
router.post('/:id/publish', protect, blogController.publicarPostSalvo);
router.put('/:id', protect, handleBlogImageUpload, blogController.atualizarPost);
router.delete('/:id', protect, blogController.deletarPost);

module.exports = router;