const db = require('../models');

// Regex simples para validar o formato do e-mail
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Garante que a tabela exista com as colunas necessárias
let tableEnsured = false;
const ensureTable = async () => {
    if (tableEnsured) return;
    try {
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "NewsletterSubscriptions" (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                origin VARCHAR(100) DEFAULT 'website',
                "ipAddress" VARCHAR(100),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);
        tableEnsured = true;
    } catch (e) {
        console.error('[Newsletter] Erro ao assegurar tabela NewsletterSubscriptions:', e.message);
    }
};

exports.subscribe = async (req, res) => {
    const { email, origin } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Por favor, forneça um e-mail válido.' });
    }

    try {
        await ensureTable();
        const cleanEmail = email.toLowerCase().trim();

        // Insere ou atualiza status para 'active'
        await db.sequelize.query(
            `INSERT INTO "NewsletterSubscriptions" ("email", "status", "origin", "ipAddress", "createdAt", "updatedAt")
             VALUES (:email, 'active', :origin, :ipAddress, NOW(), NOW())
             ON CONFLICT ("email") 
             DO UPDATE SET "status" = 'active', "updatedAt" = NOW()`,
            {
                replacements: { email: cleanEmail, origin: origin || 'site_geral', ipAddress },
                type: db.sequelize.QueryTypes.INSERT
            }
        );

        return res.status(200).json({ 
            success: true, 
            message: 'Inscrição confirmada com sucesso! Você continuará recebendo nossas novidades e comunicados.' 
        });

    } catch (error) {
        console.error('[Newsletter] Erro ao inscrever:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro ao processar sua inscrição. Tente novamente.' });
    }
};

exports.unsubscribe = async (req, res) => {
    const { email, reason } = req.body;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Por favor, forneça um e-mail válido.' });
    }

    try {
        await ensureTable();
        const cleanEmail = email.toLowerCase().trim();

        // Insere ou atualiza status para 'unsubscribed'
        await db.sequelize.query(
            `INSERT INTO "NewsletterSubscriptions" ("email", "status", "origin", "ipAddress", "createdAt", "updatedAt")
             VALUES (:email, 'unsubscribed', :origin, :ipAddress, NOW(), NOW())
             ON CONFLICT ("email") 
             DO UPDATE SET "status" = 'unsubscribed', "updatedAt" = NOW()`,
            {
                replacements: { email: cleanEmail, origin: reason || 'email_footer', ipAddress },
                type: db.sequelize.QueryTypes.INSERT
            }
        );

        return res.status(200).json({ 
            success: true, 
            message: 'Descadastro realizado com sucesso! Você não receberá mais e-mails informativos nesta conta.' 
        });

    } catch (error) {
        console.error('[Newsletter] Erro ao descadastrar:', error);
        return res.status(500).json({ success: false, message: 'Ocorreu um erro ao processar o descadastro. Tente novamente.' });
    }
};

exports.getStatus = async (req, res) => {
    const email = req.query.email || req.body.email;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'E-mail inválido.' });
    }

    try {
        await ensureTable();
        const cleanEmail = email.toLowerCase().trim();
        const rows = await db.sequelize.query(
            `SELECT "status", "updatedAt" FROM "NewsletterSubscriptions" WHERE "email" = :email LIMIT 1`,
            {
                replacements: { email: cleanEmail },
                type: db.sequelize.QueryTypes.SELECT
            }
        );

        if (rows && rows.length > 0) {
            return res.json({ 
                success: true, 
                subscribed: rows[0].status === 'active',
                status: rows[0].status,
                email: cleanEmail
            });
        } else {
            // Por padrão, se não está explicitamente descadastrado, está ativo
            return res.json({ 
                success: true, 
                subscribed: true, 
                status: 'active', 
                email: cleanEmail,
                notInDbYet: true
            });
        }
    } catch (error) {
        console.error('[Newsletter] Erro ao buscar status:', error);
        return res.status(500).json({ success: false, message: 'Erro ao consultar status.' });
    }
};