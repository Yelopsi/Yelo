const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const gamificationService = require('../services/gamificationService');
const { verifyGoogleToken } = require('./authController');
const metaService = require('../services/metaService');

// ----------------------------------------------------------------------
// Função Auxiliar: Gera o Token JWT para Psicólogo
// ----------------------------------------------------------------------
const generateToken = (id, type = 'psychologist') => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET, {
        expiresIn: '30d', // O token expira em 30 dias
    });
};

// ==============================================================================
// 1. REGISTRO (CORRIGIDO: Detecta CPF ou CNPJ e salva na coluna certa)
// ==============================================================================
exports.registerPsychologist = async (req, res) => {
    try {
        let nome = req.body.nome || req.body['nome-completo'];
        let passwordInput = req.body.password || req.body.senha;
        let email = req.body.email;
        const crp = req.body.crp || null; // Agora é opcional na entrada
        // REVERTIDO: Volta a ler apenas o CPF
        const cpf = req.body.cpf || req.body.documento || null; // Agora é opcional na entrada
        const telefone = req.body.telefone || null; // Captura o telefone vindo do formulário
        const { googleToken, utm_source, utm_medium, utm_campaign, utm_content, meta_event_id } = req.body;

        // --- Lógica de Registro via Google ---
        if (googleToken) {
            try {
                const googleUser = await verifyGoogleToken(googleToken);
                email = googleUser.email; // Confia no email do Google
                // Gera senha aleatória segura se o usuário veio pelo Google
                if (!passwordInput || passwordInput === 'GoogleAuth123!') {
                    passwordInput = crypto.randomBytes(16).toString('hex');
                }
            } catch (e) {
                return res.status(400).json({ error: 'Token do Google inválido ou expirado.' });
            }
        }

        // --- 1. Validação de Campos Obrigatórios ---
        if (!nome) return res.status(400).json({ error: 'O nome é obrigatório.' });
        if (!email) return res.status(400).json({ error: 'O e-mail é obrigatório.' });
        if (!passwordInput || passwordInput.trim() === '') return res.status(400).json({ error: 'A senha é obrigatória.' });

        // --- 2. Validação de Formato e Comprimento ---
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({ error: 'Formato de e-mail inválido.' });
        if (passwordInput.length < 6) return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });

        // REVERTIDO: Limpeza simples de CPF
        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : null;

        // --- 3. VERIFICAÇÃO DE DUPLICIDADE ---
        // Monta a query dinamicamente para não buscar por null
        const whereConditions = [{ email: email }];
        if (crp) whereConditions.push({ crp: crp });
        if (cleanCpf) whereConditions.push({ cpf: cleanCpf });

        const existingUser = await db.Psychologist.findOne({
            where: { [Op.or]: whereConditions },
            paranoid: false // FIX: Verifica até usuários deletados para permitir reativação
        });

        // Se um usuário existe E NÃO está deletado (soft-deleted), então bloqueia.
        if (existingUser && !existingUser.deletedAt) {
            if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                return res.status(409).json({ 
                    error: 'Este e-mail já pertence a uma conta de psicólogo ativa. Tente fazer login.', 
                    redirect: true 
                });
            }
            if (crp && existingUser.crp === crp) return res.status(400).json({ error: 'CRP já cadastrado.' });
            if (cleanCpf && existingUser.cpf === cleanCpf) return res.status(400).json({ error: 'CPF já cadastrado.' });
        }

        // [RESTRIÇÃO] Verifica se já existe como Paciente
        try {
            const existingPatient = await db.Patient.findOne({
                where: { email: { [Op.iLike]: email } }, // Busca case-insensitive
                paranoid: false // Inclui usuários com soft-delete na busca
            });
            if (existingPatient && !existingPatient.deletedAt) {
                return res.status(400).json({ error: 'Este e-mail já está em uso por uma conta de Paciente.' });
            }
        } catch (patientErr) {
        }

        // --- 4. Geração de Slug ---
        let generatedSlug = nome
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-');
        generatedSlug += `-${Math.floor(Math.random() * 10000)}`;

        // --- 5. Criptografia ---
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(passwordInput, salt);

        // --- Define o Trial Automático de 14 Dias ---
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        // --- 6. CRIAÇÃO NO BANCO (USANDO COLUNAS REAIS) ---
        const newPsychologist = await db.Psychologist.create({
            nome,
            email,
            senha: hashedPassword,
            crp,
            slug: generatedSlug,
            status: cleanCpf ? 'active' : 'pending', // Só ativa e aparece nas buscas se tiver CPF
            plano: cleanCpf ? 'Essencial' : null,
            planExpiresAt: cleanCpf ? trialEndDate : null,
            cpf: cleanCpf, // Salva na coluna CPF
            telefone, // Salva o número de telefone no banco
            utm_source,
            utm_medium,
            utm_campaign,
            utm_content
        });

        // --- 6.1 LIMPEZA DA LISTA DE ESPERA ---
        try {
            if (db.WaitingList) {
                await db.WaitingList.destroy({ where: { email: { [Op.iLike]: email } } });
            }
        } catch (e) { }

        // --- 7. Token ---
        const token = generateToken(newPsychologist.id);

        // --- MIGRAÇÃO GRADUAL: Definindo Cookie HttpOnly ---
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
        });

        // --- 8. E-mail de Boas-vindas ---
        // FIX: Não aguarda o e-mail para evitar travamento no front se o SMTP estiver lento
        sendWelcomeEmail(newPsychologist, 'psychologist').catch(err => {});

        // [CAPI] Avisa o Facebook sobre o novo cadastro (Registro Completo)
        metaService.sendCAPIEvent('CompleteRegistration', newPsychologist, req, { user_type: 'psychologist' }, meta_event_id);

        res.status(201).json({
            message: 'Cadastro realizado com sucesso!',
            token,
            user: {
                id: newPsychologist.id,
                nome: newPsychologist.nome,
                email: newPsychologist.email,
                slug: newPsychologist.slug
            }
        });

    } catch (error) {
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `Erro no registro de Psicólogo: ${error.message}`
                });
            }
        } catch (logErr) { }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ error: 'Dados já cadastrados (E-mail, CPF ou CRP).', redirect: true });
        }
        res.status(500).json({ error: 'Erro interno ao criar conta: ' + error.message });
    }
};

// ==============================================================================
// 2. LOGIN (CORRIGIDO: Lê 'senha' em vez de 'password')
// ==============================================================================
exports.loginPsychologist = async (req, res) => {
    try {
        const { email } = req.body;
        const passwordInput = req.body.password || req.body.senha || req.body['senha-login'];

        if (!email || !passwordInput) {
            return res.status(400).json({ error: 'Por favor, preencha e-mail e senha.' });
        }

        let psychologist = await db.Psychologist.findOne({ where: { email }, paranoid: false });
        let userType = 'psychologist';
        let redirectUrl = '/psi/psi_dashboard.html';

        if (!psychologist) {
            try {
                const results = await db.sequelize.query(
                    `SELECT * FROM "Admins" WHERE email = :email LIMIT 1`,
                    { replacements: { email }, type: db.sequelize.QueryTypes.SELECT }
                );
                
                if (results && results.length > 0) {
                    const adminUser = results[0];
                    psychologist = {
                        id: adminUser.id,
                        nome: adminUser.nome,
                        email: adminUser.email,
                        senha: adminUser.senha,
                        fotoUrl: adminUser.fotoUrl,
                        slug: 'admin',
                        is_exempt: true,
                        status: 'active',
                        isAdmin: true
                    };
                }
            } catch (err) {
                // Tabela Admins não existe, ignora e prossegue (psychologist continuará null)
            }
        }

        if (!psychologist) {
            return res.status(401).json({ error: 'E-mail não encontrado.' });
        }

        const isMatch = await bcrypt.compare(passwordInput, psychologist.senha);
        
        if (!isMatch) {
            try {
                await db.SystemLog.create({
                    level: 'error',
                    message: `Falha de login (Senha incorreta): ${email}`
                });
            } catch (err) {}
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        let accountRestored = false;
        if (psychologist.deletedAt) {
            await psychologist.restore(); // Remove o deletedAt
            accountRestored = true;
        }

        if (psychologist.isAdmin) {
            userType = 'admin';
            redirectUrl = '/admin/admin.html';
        }

        try {
            await db.SystemLog.create({
                level: 'info',
                message: `Login bem-sucedido: ${email}`
            });
        } catch (err) {}

        const token = generateToken(psychologist.id, userType);

        if (userType === 'psychologist') {
            gamificationService.processAction(psychologist.id, 'login').catch(e => {});
        }

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
        });

        res.json({
            id: psychologist.id,
            nome: psychologist.nome,
            email: psychologist.email,
            slug: psychologist.slug,
            fotoUrl: psychologist.fotoUrl,
            is_exempt: psychologist.is_exempt,
            token: token,
            redirect: redirectUrl,
            type: userType,
            accountRestored: accountRestored
        });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/forgot-password
// ----------------------------------------------------------------------
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'E-mail é obrigatório.' });
        }

        const psychologist = await db.Psychologist.findOne({ 
            where: { email: { [Op.iLike]: email.trim() } },
            paranoid: false 
        });

        if (!psychologist) {
            return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição foi enviado.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        psychologist.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        psychologist.resetPasswordExpires = Date.now() + 3600000; // 1 hora

        await psychologist.save();
        
        const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'https://www.yelopsi.com.br';
        const resetLink = `${frontendUrl}/redefinir-senha?token=${resetToken}&type=psychologist`;
        await sendPasswordResetEmail(psychologist, resetLink);

        res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição foi enviado.' });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/reset-password/:token
// ----------------------------------------------------------------------
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const psychologist = await db.Psychologist.findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { [Op.gt]: Date.now() }
            },
            paranoid: false 
        });

        if (!psychologist) {
            return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
        }

        const newPassword = req.body.senha || req.body.nova_senha;
        if (!newPassword) {
            return res.status(400).json({ error: 'A nova senha é obrigatória.' });
        }

        psychologist.senha = await bcrypt.hash(newPassword, 10);
        psychologist.resetPasswordToken = null;
        psychologist.resetPasswordExpires = null;
        await psychologist.save();

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/link-google
// ----------------------------------------------------------------------
exports.linkGoogleAccount = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token do Google obrigatório.' });

        const googleUser = await verifyGoogleToken(token);
        const { sub: googleId } = googleUser;

        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const [existingPsychologist] = await db.sequelize.query(
            `SELECT id FROM "Psychologists" WHERE "googleId" = :googleId LIMIT 1`,
            { replacements: { googleId }, type: db.sequelize.QueryTypes.SELECT }
        );
        if (existingPsychologist && existingPsychologist.id !== psychologist.id) {
            return res.status(400).json({ error: 'Esta conta do Google já está vinculada a outro perfil.' });
        }

        // Usando raw query pois o model pode não ter googleId mapeado estruturalmente
        await db.sequelize.query(`UPDATE "Psychologists" SET "googleId" = :googleId WHERE id = :id`, { replacements: { googleId, id: psychologist.id } });

        res.status(200).json({ message: 'Conta do Google vinculada com sucesso!', googleId });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao vincular conta do Google.' });
    }
};