// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const db = require('../models');

/**
 * Middleware para proteger rotas. Verifica se o token JWT é válido.
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // 1. Extrai o token do cabeçalho
            token = req.headers.authorization.split(' ')[1];

            // 2. Verifica o token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 3. Encontra o usuário com base no tipo e ID do token
            if (decoded.type === 'patient') {
                req.patient = await db.Patient.findByPk(decoded.id, { attributes: { exclude: ['senha'] } });
            } else if (decoded.type === 'psychologist' || decoded.type === 'admin') {
                req.psychologist = await db.Psychologist.findByPk(decoded.id, { attributes: { exclude: ['senha'] } });
            }

            if (!req.patient && !req.psychologist) {
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }

            next(); // Continua para a próxima rota/middleware

        } catch (error) {
            console.error('Erro de autenticação:', error.message);
            res.status(401).json({ error: 'Não autorizado, token inválido.' });
        }
    }

    if (!token) {
        res.status(401).json({ error: 'Não autorizado, nenhum token fornecido.' });
    }
};

/**
 * Middleware para rotas de administrador.
 * Deve ser usado DEPOIS do middleware 'protect'.
 */
const admin = (req, res, next) => {
    // O middleware 'protect' já deve ter anexado 'req.psychologist'
    if (req.psychologist && req.psychologist.isAdmin) {
        next(); // O usuário é um psicólogo e é admin, pode prosseguir.
    } else {
        res.status(403).json({ error: 'Acesso negado. Rota exclusiva para administradores.' });
    }
};

/**
 * *** NOVO MIDDLEWARE ADICIONADO ***
 * Middleware para rotas de Psicólogo.
 * Verifica se o usuário logado é um psicólogo (ou admin).
 * Deve ser usado DEPOIS do middleware 'protect'.
 */
const isPsychologist = (req, res, next) => {
    // O 'protect' já preencheu req.psychologist se o token for de um 'psi' ou 'admin'
    if (req.psychologist) {
        next(); // O usuário é um psicólogo ou admin, pode prosseguir.
    } else {
        res.status(403).json({ error: 'Acesso negado. Rota exclusiva para psicólogos.' });
    }
};


// *** EXPORT CORRIGIDO ***
// Adicionamos 'isPsychologist' ao export
module.exports = { protect, admin, isPsychologist };