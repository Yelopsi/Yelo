const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuração de Armazenamento
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Define o caminho: Yelo/uploads/profiles
        // __dirname é backend/middleware, então subimos 2 níveis
        const dir = path.join(__dirname, '../../uploads/profiles');
        
        // Garante que a pasta existe
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Gera nome único: campo-timestamp-random.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro de Arquivos (Apenas Imagens)
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos de imagem são permitidos!'), false);
    }
};

// Configuração do Upload de Foto de Perfil (Limite 10MB)
const uploadProfilePhoto = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFilter
});

// Configuração do Upload de CRP (PDF ou Imagem, Limite 10MB)
const uploadCrpDocument = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

module.exports = { uploadProfilePhoto, uploadCrpDocument };