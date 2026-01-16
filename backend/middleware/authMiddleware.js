// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const db = require('../models');

/**
 * Middleware para proteger rotas. Verifica se o token JWT é válido.
 */
const protect = async (req, res, next) => {
    let token;

    // --- DEBUG AUTH ---
    console.log(`[AUTH] Verificando acesso a: ${req.originalUrl}`);
    console.log(`[AUTH] Headers Auth: ${req.headers.authorization ? 'SIM' : 'NÃO'}`);
    console.log(`[AUTH] Cookies:`, req.cookies ? Object.keys(req.cookies) : 'Nenhum');

    // 1. Tenta pegar do Header (Padrão Bearer)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } 
    // 2. Tenta pegar do Cookie (Fallback de segurança)
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        console.log(`[AUTH] Token encontrado. Tentando verificar...`);
        try {
            // 3. Verifica o token
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_yelo_dev');

            // 4. Lógica Unificada para encontrar o usuário
            const userType = decoded.type || decoded.role; // Aceita 'type' (psi/paciente) ou 'role' (admin)
            let user = null;

            if (userType === 'patient') {
                user = await db.Patient.findByPk(decoded.id, { attributes: { exclude: ['senha'] } });
                if (user) req.patient = user;
            } else if (userType === 'psychologist') {
                user = await db.Psychologist.findByPk(decoded.id, { attributes: { exclude: ['senha'] } });
                if (user) req.psychologist = user;
            } else if (userType === 'admin') {
                // Busca o admin na tabela correta ('Admins')
                const [adminResults] = await db.sequelize.query('SELECT * FROM "Admins" WHERE id = :id', { replacements: { id: decoded.id } });
                user = adminResults[0];
                // Para compatibilidade, anexa como req.psychologist também
                if (user) req.psychologist = { id: user.id, nome: user.nome, email: user.email, isAdmin: true };
            }

            // 5. Validação Final
            if (!user) {
                return res.status(401).json({ error: 'Usuário não encontrado.' });
            }
            console.log(`[AUTH] Sucesso! Usuário: ${user.email} (${userType})`);

            // Anexa um objeto de usuário genérico para facilitar o uso nos controllers
            req.user = user;
            req.user.type = userType;

            next(); // Continua para a próxima rota/middleware

        } catch (error) {
            console.error('[AUTH ERROR] Token inválido ou expirado:', error.message);
            res.status(401).json({ error: 'Não autorizado, token inválido.' });
        }
    } else {
        console.log('[AUTH ERROR] Nenhum token fornecido (Header ou Cookie).');
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