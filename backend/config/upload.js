const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Define o diretório de uploads
const uploadDir = path.join(__dirname, '../public/uploads/profiles');

// Garante que o diretório de uploads exista
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Cria um nome de arquivo único para evitar conflitos
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage
});

module.exports = upload;