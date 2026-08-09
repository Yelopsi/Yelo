const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const db = require('../models');

const { emailSpamLimiter, authLimiter } = require('../middlewares/rateLimiters');

router.post('/google', authLimiter, authController.unifiedGoogleLogin);

// --- ROTA AUXILIAR PARA IDENTIFICAR TIPO DE USUÁRIO (RECUPERAÇÃO DE SENHA) ---
router.post('/identify-user', emailSpamLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

        // A lógica real de redefinição de senha para ambas as tabelas (Paciente e Psicólogo)
        // foi unificada no endpoint de Psicólogos (fallback do frontend).
        // Ao retornar sempre um tipo fixo ('unified'), o frontend fará uma única requisição
        // para a mesma rota, eliminando 100% da enumeração de contas,
        // enquanto o backend processa o e-mail corretamente, independentemente de quem seja.
        return res.json({ type: 'unified' });
    } catch (error) {
        console.error('Erro ao identificar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao verificar e-mail.' });
    }
});

module.exports = router;