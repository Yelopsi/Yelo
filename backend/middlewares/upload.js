// backend/middleware/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Proteção rigorosa contra SVG / Stored XSS
    if (mime.includes('svg') || ext === '.svg') {
        return cb(new Error('Arquivos SVG não são permitidos por segurança.'), false);
    }

    if (mime.startsWith('image/') && (mime.includes('jpeg') || mime.includes('jpg') || mime.includes('png') || mime.includes('webp'))) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem (JPEG, PNG, WebP) são permitidos!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Limite de 10MB
    fileFilter: fileFilter
});

// Validação rigorosa de Magic Bytes (Header do Arquivo) para prevenir spoofing de extensão/MIME
const magicBytesValidator = (req, res, next) => {
    if (!req.file) return next();

    const buffer = req.file.buffer;
    if (!buffer || buffer.length < 4) {
        return res.status(400).json({ error: 'Arquivo corrompido ou vazio.' });
    }

    const hex = buffer.toString('hex', 0, 4).toUpperCase();
    
    // Assinaturas conhecidas (Magic Numbers)
    const isJPEG = hex.startsWith('FFD8FF');
    const isPNG = hex.startsWith('89504E47');
    const isWEBP = hex.startsWith('52494646') && buffer.toString('hex', 8, 12).toUpperCase() === '57454250';

    if (!isJPEG && !isPNG && !isWEBP) {
        return res.status(415).json({ error: 'Formato de arquivo inválido. Assinatura binária não corresponde a uma imagem segura.' });
    }

    next();
};

exports.uploadProfilePhoto = upload;
exports.uploadCrpDocument = upload;
exports.magicBytesValidator = magicBytesValidator;