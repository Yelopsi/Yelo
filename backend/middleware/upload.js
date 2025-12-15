// backend/middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define o caminho absoluto para backend/uploads
const uploadDir = path.join(__dirname, '../uploads');

// Cria a pasta se não existir
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Salva sempre na pasta correta
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas imagens são permitidas!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

exports.uploadProfilePhoto = upload;
exports.uploadCrpDocument = upload;