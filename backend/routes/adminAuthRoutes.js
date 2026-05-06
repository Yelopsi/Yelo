const express = require('express');
const router = express.Router();
const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login-admin-check', async (req, res) => {
    try {
        const email = req.body.email;
        const senha = req.body.senha || req.body.password || req.body['senha-login'];

        if (!senha) return res.status(400).json({ success: false, message: 'Senha não fornecida.' });

        const [results] = await db.sequelize.query(
            `SELECT * FROM "Admins" WHERE email ILIKE :email LIMIT 1`,
            { replacements: { email: email } }
        );

        const adminUser = results[0];
        if (!adminUser) return res.status(401).json({ success: false }); 

        const senhaValida = await bcrypt.compare(senha, adminUser.senha);
        if (!senhaValida) {
            try {
                if (db.SystemLog) await db.SystemLog.create({ level: 'warning', message: `Falha de login (Senha incorreta): ${email}` });
            } catch(e) {}
            return res.status(401).json({ success: false, message: 'Senha de Admin incorreta' });
        }

        const token = jwt.sign(
            { id: adminUser.id, role: 'admin', type: 'admin', nome: adminUser.nome },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000
        });

        try {
            if (db.SystemLog) await db.SystemLog.create({ level: 'info', message: `Login de Administrador bem-sucedido: ${email}` });
        } catch(e) {}

        return res.json({ 
            success: true, redirect: '/admin', type: 'admin',
            token: token, user: { nome: adminUser.nome }
        });
    } catch (error) {
        console.error('Erro no login de admin:', error);
        return res.status(401).json({ success: false }); 
    }
});

module.exports = router;