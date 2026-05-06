const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const db = require('../models');

router.post('/google', authController.unifiedGoogleLogin);

// --- ROTA AUXILIAR PARA IDENTIFICAR TIPO DE USUÁRIO (RECUPERAÇÃO DE SENHA) ---
router.post('/identify-user', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório' });

        // Verifica na tabela de Pacientes
        const [patients] = await db.sequelize.query('SELECT 1 FROM "Patients" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
        if (patients.length > 0) return res.json({ type: 'patient' });

        // Verifica na tabela de Psicólogos
        const [psis] = await db.sequelize.query('SELECT 1 FROM "Psychologists" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
        if (psis.length > 0) return res.json({ type: 'psychologist' });

        return res.status(404).json({ error: 'E-mail não encontrado em nossa base de dados.' });
    } catch (error) {
        console.error('Erro ao identificar usuário:', error);
        res.status(500).json({ error: 'Erro interno ao verificar e-mail.' });
    }
});

module.exports = router;