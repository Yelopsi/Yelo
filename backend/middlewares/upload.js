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

exports.uploadProfilePhoto = upload;
exports.uploadCrpDocument = upload;