// routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const jwt = require('jsonwebtoken');

// --- MIDDLEWARE DE SEGURANÇA (Proteção) ---
// Verifica se o usuário é um Psicólogo logado antes de deixar passar
const verificarTokenPsi = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token não fornecido' });

    const token = authHeader.split(' ')[1]; // Remove o "Bearer "
    
    try {
        // Usa a mesma chave secreta que vi no seu server.js
        const secret = process.env.JWT_SECRET || 'secreto_yelo_dev';
        const decoded = jwt.verify(token, secret);
        
        // Salva o ID do psicólogo na requisição para o controller usar
        req.userId = decoded.id; 
        
        next(); // Pode passar
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
};

// --- AS ROTAS ---
// Todas protegidas pelo verificarTokenPsi
router.get('/', verificarTokenPsi, blogController.listarMeusPosts);
router.post('/', verificarTokenPsi, blogController.criarPost);
router.put('/:id', verificarTokenPsi, blogController.atualizarPost);
router.delete('/:id', verificarTokenPsi, blogController.deletarPost);

module.exports = router;