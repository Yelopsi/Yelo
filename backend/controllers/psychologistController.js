const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail, sendSubscriptionCancelledEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs').promises;
const gamificationService = require('../services/gamificationService'); // Importa o serviço
const { verifyGoogleToken } = require('./authController');
const metaService = require('../services/metaService'); // Importa o rastreador
const matchService = require('../services/matchService'); // Algoritmo unificado de Match

// Configurações do Asaas
let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, ''); // Remove barra final e espaços
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

// --- CONFIGURAÇÃO DO CLOUDINARY ---
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ----------------------------------------------------------------------
// Função Auxiliar: Gera o Token JWT para Psicólogo
// ----------------------------------------------------------------------
const generateToken = (id, type = 'psychologist') => {
    return jwt.sign({ id, type }, process.env.JWT_SECRET, {
        expiresIn: '30d', // O token expira em 30 dias
    });
};
 
// Função Auxiliar: Gera um slug único (Nome + Sufixo Aleatório)
const generateSlug = (name) => {
    const baseSlug = name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-');
    
    // Adiciona sufixo aleatório para evitar duplicidade (ex: ana-silva-4921)
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); 
    return `${baseSlug}-${randomSuffix}`;
};
// ==============================================================================
// 1. REGISTRO (CORRIGIDO: Detecta CPF ou CNPJ e salva na coluna certa)
// ==============================================================================
exports.registerPsychologist = async (req, res) => {
    try {
        console.log("Dados recebidos no Registro:", req.body);

        let nome = req.body.nome || req.body['nome-completo'];
        let passwordInput = req.body.password || req.body.senha;
        let email = req.body.email;
        const crp = req.body.crp || null; // Agora é opcional na entrada
        // REVERTIDO: Volta a ler apenas o CPF
        const cpf = req.body.cpf || req.body.documento || null; // Agora é opcional na entrada
        const telefone = req.body.telefone || null; // Captura o telefone vindo do formulário
        const { googleToken, utm_source, utm_medium, utm_campaign, meta_event_id } = req.body;

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

        if (existingUser) {
            // Retorna 409 (Conflict) para o frontend saber que deve redirecionar
            // FIX: Comparação case-insensitive para garantir que pegue duplicatas
            if (existingUser.email.toLowerCase() === email.toLowerCase()) {
                // Se o usuário já existe, limpa ele da lista de espera caso ele tenha caído lá
                try { if (db.WaitingList) await db.WaitingList.destroy({ where: { email: { [Op.iLike]: email } } }); } catch(e) {}
                return res.status(409).json({ error: 'E-mail já cadastrado. Redirecionando para login...', redirect: true });
            }
            if (crp && existingUser.crp === crp) return res.status(400).json({ error: 'CRP já cadastrado.' });
            if (cleanCpf && existingUser.cpf === cleanCpf) return res.status(400).json({ error: 'CPF já cadastrado.' });
        }

        // [RESTRIÇÃO] Verifica se já existe como Paciente
        try {
            const existingPatient = await db.Patient.findOne({ 
                where: { email },
                attributes: ['id'] // Busca apenas o ID para ignorar colunas removidas do banco de dados
            });
            if (existingPatient) {
                return res.status(400).json({ error: 'Este e-mail já está em uso por uma conta de Paciente.' });
            }
        } catch (patientErr) {
            console.warn("Aviso ao checar duplicidade de paciente (ignorado):", patientErr.message);
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
            utm_campaign
        });

        // --- 6.1 LIMPEZA DA LISTA DE ESPERA ---
        // Como o registro foi concluído com sucesso, removemos o e-mail da tabela de leads (espera)
        try {
            if (db.WaitingList) {
                await db.WaitingList.destroy({ where: { email: { [Op.iLike]: email } } });
            }
        } catch (e) { console.warn("Falha ao remover lead da lista de espera:", e.message); }

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
        sendWelcomeEmail(newPsychologist, 'psychologist').catch(err => console.error("Erro envio email boas-vindas (Psi):", err));

        // [CAPI] Avisa o Facebook sobre o novo cadastro (Registro Completo)
        metaService.sendCAPIEvent('CompleteRegistration', newPsychologist, req, { user_type: 'psychologist' }, meta_event_id);

        // --- [WEB PUSH] Notifica Admin no PWA do iOS/Android ---
        try {
            if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
                const webpush = require('web-push');
                webpush.setVapidDetails(
                    'mailto:admin@yelopsi.com.br',
                    process.env.VAPID_PUBLIC_KEY,
                    process.env.VAPID_PRIVATE_KEY
                );
                
                const [subs] = await db.sequelize.query(`SELECT * FROM "AdminPushSubscriptions"`);
                if (subs && subs.length > 0) {
                    const payload = JSON.stringify({
                        title: 'Novo Psicólogo! 🎉',
                        body: `${newPsychologist.nome} acabou de se cadastrar na Yelo.`,
                        url: '/admin/admin.html?page=admin_gerenciar_psicologos'
                    });
                    subs.forEach(async (sub) => {
                        try {
                            await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
                        } catch (err) {
                            if (err.statusCode === 410 || err.statusCode === 404) {
                                await db.sequelize.query(`DELETE FROM "AdminPushSubscriptions" WHERE endpoint = :endpoint`, { replacements: { endpoint: sub.endpoint } });
                            }
                        }
                    });
                }
            }
        } catch (pushErr) { console.error("Erro ao notificar via Web Push:", pushErr); }

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
        console.error('Erro no registro:', error);
        // GRAVA O ERRO NO LOG
        try {
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'error',
                    message: `Erro no registro de Psicólogo: ${error.message}`
                });
            }
        } catch (logErr) { console.warn("Falha ao gravar log:", logErr.message); }

        if (error.name === 'SequelizeUniqueConstraintError') {
            // Se for erro de constraint, retorna 409 se for email, ou 400 para outros
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
        // --- FIX: Aceita 'password', 'senha' ou 'senha-login' vindo do front ---
        const passwordInput = req.body.password || req.body.senha || req.body['senha-login'];

        if (!email || !passwordInput) {
            return res.status(400).json({ error: 'Por favor, preencha e-mail e senha.' });
        }

        // 1. Tenta buscar na tabela de Psicólogos
        // FIX: Busca inclusive usuários deletados (paranoid: false) para permitir restauração
        let psychologist = await db.Psychologist.findOne({ where: { email }, paranoid: false });
        let userType = 'psychologist';
        let redirectUrl = '/psi/psi_dashboard.html'; // Padrão

        // 2. Se não achou, tenta na tabela de Admins (Legado) para permitir login unificado
        if (!psychologist) {
            const results = await db.sequelize.query(
                `SELECT * FROM "Admins" WHERE email = :email LIMIT 1`,
                { replacements: { email }, type: db.sequelize.QueryTypes.SELECT }
            );
            
            if (results && results.length > 0) {
                const adminUser = results[0];
                // Mapeia o Admin para parecer um objeto de usuário padrão
                psychologist = {
                    id: adminUser.id,
                    nome: adminUser.nome,
                    email: adminUser.email,
                    senha: adminUser.senha,
                    fotoUrl: adminUser.fotoUrl,
                    slug: 'admin',
                    is_exempt: true,
                    status: 'active',
                    isAdmin: true // Flag importante
                };
            }
        }

        if (!psychologist) {
            return res.status(401).json({ error: 'E-mail não encontrado.' });
        }

        // 3. Verifica a senha
        const isMatch = await bcrypt.compare(passwordInput, psychologist.senha);
        
        if (!isMatch) {
            await db.SystemLog.create({
                level: 'warning',
                message: `Falha de login (Senha incorreta): ${email}`
            });
            return res.status(401).json({ error: 'Senha incorreta.' });
        }

        // --- LÓGICA DE RESTAURAÇÃO (RETOMADA) ---
        let accountRestored = false;
        if (psychologist.deletedAt) {
            console.log(`[LOGIN] Restaurando conta deletada: ${email}`);
            await psychologist.restore(); // Remove o deletedAt
            accountRestored = true;
            // Opcional: Se quiser forçar status 'inactive' para obrigar pagamento, descomente abaixo:
            // await psychologist.update({ status: 'inactive' });
        }

        // --- FIX: Permite login de TODOS (ativos, inativos, pendentes) para que possam ver o dashboard e pagar ---
        // Removemos o bloqueio 403. O Dashboard cuidará de bloquear as funcionalidades se o status for 'inactive'.
        if (false) { 
            // Código morto intencional para documentar que removemos a trava
        }

        // 4. Define o tipo de token e redirecionamento se for Admin
        if (psychologist.isAdmin) {
            userType = 'admin';
            redirectUrl = '/admin/admin.html';
        }

        // [LOG DE SUCESSO PARA RASTREAMENTO NO DASHBOARD]
        await db.SystemLog.create({
            level: 'info',
            message: `Login de Psicólogo bem-sucedido: ${email}`
        });

        const token = generateToken(psychologist.id, userType);

        // --- GAMIFICATION: LOGIN DIÁRIO (1 pt) ---
        if (userType === 'psychologist') {
            gamificationService.processAction(psychologist.id, 'login').catch(e => console.error(e));
        }

        // --- MIGRAÇÃO GRADUAL: Definindo Cookie HttpOnly ---
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
            is_exempt: psychologist.is_exempt, // Retorna flag VIP no login
            token: token,
            redirect: redirectUrl, // Frontend deve usar isso para navegar
            type: userType,
            accountRestored: accountRestored // Flag para o frontend exibir modal
        });

    } catch (error) {
        console.error('Erro no login:', error);
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

        // FIX: Adicionado paranoid: false para permitir recuperação de contas deletadas (retomada)
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
        
        // --- FIX: URL Dinâmica para Produção ---
        const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'https://www.yelopsi.com.br';
        const resetLink = `${frontendUrl}/redefinir-senha?token=${resetToken}&type=psychologist`;
        await sendPasswordResetEmail(psychologist, resetLink);
        console.log(`📧 E-mail de recuperação enviado para: ${psychologist.email}`);

        res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição foi enviado.' });

    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha de psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/reset-password/:token
// ----------------------------------------------------------------------
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        // BUSCA O USUÁRIO E VALIDA SE O TOKEN NÃO EXPIROU
        const psychologist = await db.Psychologist.findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { [Op.gt]: Date.now() } // FIX: Usa Op importado diretamente
            },
            paranoid: false // FIX: Permite redefinir senha de conta deletada
        });

        if (!psychologist) {
            return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
        }

        // Se o token for válido, atualiza a senha
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
        console.error('Erro ao redefinir senha de psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// Função auxiliar (você já a tem)
const parsePriceRange = (rangeString) => {
    if (!rangeString || typeof rangeString !== 'string') return { min: 0, max: 9999 };
    const numbers = rangeString.match(/\d+/g);
    if (!numbers || numbers.length === 0) return { min: 0, max: 9999 };
    const min = parseInt(numbers[0], 10);
    const max = numbers.length > 1 ? parseInt(numbers[1], 10) : min;
    return { min, max };
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me (Rota Protegida)
// ----------------------------------------------------------------------
exports.getAuthenticatedPsychologistProfile = async (req, res) => {
    try {
        // 'req.psychologist' é anexado pelo seu middleware 'protect'
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Psicólogo não autenticado.' });
        }

        const psychologistId = req.psychologist.id;

        const psychologist = await db.Psychologist.findByPk(psychologistId, {
            // Agora permitimos o CPF, pois é o próprio usuário vendo seus dados
            attributes: { 
                    exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires']
            }
        });

        if (!psychologist) {
            return res.status(404).json({ error: 'Perfil do psicólogo não encontrado.' });
        }

        // --- CORREÇÃO V2: Busca contagens com Fallback Duplo do ORM ---
        let blogPostCount = 0, forumPostCount = 0, forumCommentCount = 0, answerCount = 0;
        
        if (db.Post) blogPostCount = await db.Post.count({ where: { psychologistId } }).catch(async () => await db.Post.count({ where: { psychologist_id: psychologistId } }).catch(() => 0));
        
        if (db.ForumPost) forumPostCount = await db.ForumPost.count({ where: { PsychologistId: psychologistId } }).catch(async () => await db.ForumPost.count({ where: { psychologistId } }).catch(() => 0));
        
        if (db.ForumComment) forumCommentCount = await db.ForumComment.count({ where: { PsychologistId: psychologistId } }).catch(async () => await db.ForumComment.count({ where: { psychologistId } }).catch(() => 0));
        
        if (db.Answer) answerCount = await db.Answer.count({ where: { psychologistId } }).catch(() => 0);

        // Monta o objeto de resposta
        const responseData = psychologist.toJSON();

        // --- AVISO DE QUALIDADE (PERFIL EM BRANCO) ---
        const hasPhoto = !!psychologist.fotoUrl;
        const hasBio = !!(psychologist.bio && psychologist.bio.trim().length >= 10);
        responseData.isProfileComplete = hasPhoto && hasBio;
        responseData.profileWarning = responseData.isProfileComplete 
            ? null 
            : "⚠️ Atenção: Seu perfil não aparecerá nos Matches para os pacientes enquanto não tiver uma Foto de Perfil e uma Biografia. Complete seus dados para receber contatos.";

        // --- NOVO: LÓGICA PARA O BANNER DE TRIAL PREMIUM (CPF) ---
        const hasValidCpf = !!(psychologist.cpf && psychologist.cpf.replace(/\D/g, '').length >= 11);
        responseData.showTrialBanner = (psychologist.status === 'pending' && !hasValidCpf);
        responseData.trialBannerMessage = responseData.showTrialBanner
            ? "Complete seu CPF no perfil para liberar seus 14 dias Premium grátis."
            : null;
        responseData.gamificationProgress = {
            blogPostCount, // Para Semeador
            forumActivityCount: forumPostCount + forumCommentCount, // Para Voz Ativa
            answerCount, // Para Conselheiro
            // Fallbacks de segurança para garantir que o front leia a chave certa
            semeador: blogPostCount,
            vozAtiva: forumPostCount + forumCommentCount,
            conselheiro: answerCount
        };
        
        // Fallback direto na raiz (se o frontend ler solto)
        responseData.blogPostCount = blogPostCount;
        responseData.forumActivityCount = forumPostCount + forumCommentCount;
        responseData.answerCount = answerCount;
        
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Erro ao buscar perfil do psicólogo autenticado (/me):', error);
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/check-demand
// ----------------------------------------------------------------------
exports.checkDemand = async (req, res) => {    
    try {
        // --- LÓGICA DE VERIFICAÇÃO DE DEMANDA (CORRIGIDA) ---
        const DEMAND_TARGET = 0; 
        // REGRA DE NEGÓCIO: Aprovar todos os cadastros no momento atual.
        // "nenhum psicólogo em hipótese nenhuma deve ser privado de se cadastrar na plataforma."
        return res.status(200).json({ status: 'approved', message: 'Há demanda para este perfil.' });

        /* --- Lógica original (Desativada temporariamente para aprovar todos) ---
        const DEMAND_TARGET = 0;
        const { min: psyMinPrice, max: psyMaxPrice } = parsePriceRange(valor_sessao_faixa);

        // 2. Define a query de busca por pacientes compatíveis em SQL Puro.
        // Usamos SQL puro para contornar a incompatibilidade de Sequelize Op.overlap em campos JSONB nativos
        const replacements = {
            genero_identidade: genero_identidade
        };
        
        let temasQuery = "";
        if (temas_atuacao && Array.isArray(temas_atuacao) && temas_atuacao.length > 0) {
            /// a coluna temas_buscados já é um array nativo do Postgres (character varying[])
            // O operador && (overlap) verifica de forma nativa se há algum tema em comum entre os arrays
            temasQuery = `AND "temas_buscados" IS NOT NULL AND "temas_buscados" && ARRAY[:temas_atuacao]::varchar[]`;
            replacements.temas_atuacao = temas_atuacao;
        }

        const query = `
            SELECT COUNT(*) as count 
            FROM "Patients" 
            WHERE "valor_sessao_faixa" IS NOT NULL
            AND ("genero_profissional" = :genero_identidade OR "genero_profissional" = 'Indiferente')
            ${temasQuery}
        `;

        const [result] = await db.sequelize.query(query, {
            replacements,
            type: db.sequelize.QueryTypes.SELECT
        });

        // --- FORÇA O UPDATE NO BANCO CASO O ORM IGNORE AS COLUNAS NOVAS ---
        try {
            await db.sequelize.query(`UPDATE "Psychologists" SET "tipo_cobranca" = :tc, "valor_mensal_numero" = :vm WHERE id = :id`, {
                replacements: { 
                    tc: tipo_cobranca || 'sessao', 
                    vm: valor_mensal_numero ? parseFloat(valor_mensal_numero) : null, 
                    id: psychologist.id 
                }
            });
        } catch (e) { console.warn("Erro ao forçar update das colunas novas:", e.message); }

        const count = parseInt(result.count, 10) || 0;

        console.log(`[CHECK DEMAND] Nicho verificado. Pacientes encontrados: ${count}. Alvo: ${DEMAND_TARGET}.`);

        if (count >= DEMAND_TARGET) {
            res.status(200).json({ status: 'approved', message: 'Há demanda para este perfil.' });
        } else {
            res.status(200).json({ status: 'waitlisted', message: 'Perfil adicionado à lista de espera.' });
        }
        */
    } catch (error) {
        console.error('Erro ao verificar demanda:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/add-to-waitlist
// ----------------------------------------------------------------------
exports.addToWaitlist = async (req, res) => {
    try {
        const { nome, email, telefone, crp, genero_identidade, valor_sessao_faixa, temas_atuacao, praticas_afirmativas, abordagens_tecnicas, utm_source, utm_medium, utm_campaign } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'O e-mail é obrigatório para entrar na lista de espera.' });
        }

        // Verifica se já é um Psicólogo cadastrado e ativo (Evita colocar quem já tem conta na lista)
        const isRegistered = await db.Psychologist.findOne({ where: { email: { [Op.iLike]: email } } });
        if (isRegistered) {
            return res.status(200).json({ message: 'Usuário já registrado. Ignorando lista de espera.' });
        }

        let waitlistEntry = await db.WaitingList.findOne({ where: { email } });
        
        const payload = {
            nome, telefone, crp, genero_identidade, valor_sessao_faixa,
            temas_atuacao, praticas_afirmativas, abordagens_tecnicas,
            utm_source, utm_medium, utm_campaign, status: 'pending'
        };

        if (waitlistEntry) {
            // Se já tentou antes, atualiza com os dados mais recentes de UTM
            await waitlistEntry.update(payload);
        } else {
            waitlistEntry = await db.WaitingList.create({ email, ...payload });
        }

        console.log(`[WAITLIST] Lead Parcial (Email: ${email}) capturado com sucesso.`);
        res.status(201).json({ message: 'E-mail adicionado à lista de espera com sucesso.' });
    } catch (error) {
        console.error('Erro ao adicionar à lista de espera:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao salvar na lista de espera.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/waiting-list (Rota Protegida)
// ----------------------------------------------------------------------
exports.getWaitingList = async (req, res) => {
    try {
        const waitingList = await db.WaitingList.findAll({
            where: { status: 'pending' },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(waitingList);
    } catch (error) {
        console.error('Erro ao buscar lista de espera:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};


// ==============================================================================
// 2. ATUALIZAÇÃO (Permite personalizar o Link e corrige dados faltantes)
// ==============================================================================
exports.updatePsychologistProfile = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado' });
        }

        // Extrai os dados enviados pelo Dashboard
        let {
            nome, telefone, bio, crp, cep, cidade, estado,
            temas_atuacao, abordagens_tecnicas, modalidade,
            publico_alvo, estilo_terapia, praticas_inclusivas, // NOVOS CAMPOS
            valor_sessao_numero, disponibilidade_periodo, genero_identidade, // CORRIGIDO
            dailySummaryTime, reminderHoursBefore, // NOVOS CAMPOS DE NOTIFICAÇÃO
            linkedin_url, instagram_url, facebook_url, tiktok_url, x_url,
            slug, // <--- AGORA ESTAMOS LENDO O CAMPO SLUG QUE VEM DO FORMULÁRIO
        cpf, // <--- ADICIONADO: Extraindo o CPF enviado pelo frontend
        formacao_nivel, formacao_desc,
        tipo_cobranca, valor_mensal_numero,
        ano_inicio_experiencia,
        razao_social
        } = req.body;

        // --- FALLBACK PARA CAMPOS LEGADOS (Especialidades/Temas) ---
        if (!temas_atuacao) {
            if (req.body.temas) temas_atuacao = req.body.temas;
            else if (req.body.especialidades) temas_atuacao = req.body.especialidades;
        }

        // --- CORREÇÃO ROBUSTA DE ARRAYS ---
        // Garante que qualquer campo que deva ser array, SEJA array, mesmo se vier como string JSON.
        const parseArrayField = (fieldValue) => {
            if (fieldValue === undefined) return undefined; // IGNORA se não foi enviado (não apaga o banco)
            if (!fieldValue) return [];
            
            // Se já for array, verifica se os itens dentro não são strings JSON (ex: ['["Online"]'])
            if (Array.isArray(fieldValue)) {
                return fieldValue.map(item => {
                    if (typeof item === 'string' && item.trim().startsWith('[')) {
                        try { 
                            const parsed = JSON.parse(item);
                            return Array.isArray(parsed) ? parsed[0] : parsed; 
                        } catch(e) { return item; }
                    }
                    return item;
                });
            }

            // Se for string, tenta parsear
            if (typeof fieldValue === 'string') {
                try {
                    if (fieldValue.trim().startsWith('[')) return JSON.parse(fieldValue);
                    return [fieldValue]; // Se for string solta, encapsula
                } catch (e) { return []; }
            }
            return [fieldValue];
        };

        // Aplica a correção em TODOS os campos de lista
        modalidade = parseArrayField(modalidade);
        temas_atuacao = parseArrayField(temas_atuacao);
        abordagens_tecnicas = parseArrayField(abordagens_tecnicas);
        publico_alvo = parseArrayField(publico_alvo);
        estilo_terapia = parseArrayField(estilo_terapia);
        praticas_inclusivas = parseArrayField(praticas_inclusivas);
        disponibilidade_periodo = parseArrayField(disponibilidade_periodo);
        
        // --- DEBUG: LOG DOS DADOS TRATADOS ---
        console.log("--- DEBUG UPDATE PERFIL ---");
        console.log("ID:", psychologist.id);
            // Adicionado para depuração de um problema não relacionado, pode ser removido depois.
            console.log("Conteúdo recebido para post:", req.body.conteudo); 

        console.log("Modalidade (Type):", typeof modalidade, "IsArray:", Array.isArray(modalidade));
        console.log("Modalidade (Value):", JSON.stringify(modalidade));
        console.log("Temas (Value):", JSON.stringify(temas_atuacao));
        console.log("Abordagens (Value):", JSON.stringify(abordagens_tecnicas));
        console.log("Público Alvo (Value):", JSON.stringify(publico_alvo));
        // -------------------------------------

        // --- LÓGICA DE PERSONALIZAÇÃO DO LINK (SLUG) ---
        let finalSlug = psychologist.slug; // Padrão: Mantém o atual

        // Cenário A: Usuário quer mudar o link (digitou algo novo no input 'slug')
        if (slug && slug.trim() !== '' && slug !== psychologist.slug) {
            // Sanitiza o que o usuário digitou (para não quebrar a URL)
            finalSlug = slug
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9\s-]/g, '') // Remove tudo que não for letra, número ou traço
                .replace(/\s+/g, '-');
            
            // Verifica se esse link já existe (para evitar duplicidade)
            const slugExiste = await db.Psychologist.findOne({ 
                where: { 
                    slug: finalSlug, 
                    id: { [Op.ne]: psychologist.id } // Ignora o próprio usuário
                } 
            });

            if (slugExiste) {
                return res.status(400).json({ error: 'Este link personalizado já está em uso. Escolha outro.' });
            }
        }
        
        // Cenário B: Usuário não tem link (Correção de legado) e não enviou um novo
        else if (!finalSlug && nome) {
            finalSlug = nome.toLowerCase().replace(/\s+/g, '-') + `-${Math.floor(Math.random()*1000)}`;
        }

        // --- ATUALIZAÇÃO VIA ORM (MODERNA E DEFINITIVA) ---
        // Graças ao patch no server.js, o Sequelize agora trata esses campos como JSONB nativo.
        const updatePayload = {};
        if (finalSlug !== undefined) updatePayload.slug = finalSlug;
        if (nome !== undefined) updatePayload.nome = nome;
        if (telefone !== undefined) updatePayload.telefone = telefone;
        if (bio !== undefined) updatePayload.bio = bio;
        if (crp !== undefined) updatePayload.crp = crp;
        if (cep !== undefined) updatePayload.cep = cep;
        if (cidade !== undefined) updatePayload.cidade = cidade;
        if (estado !== undefined) updatePayload.estado = estado;
        if (formacao_nivel !== undefined) updatePayload.formacao_nivel = formacao_nivel;
        if (formacao_desc !== undefined) updatePayload.formacao_desc = formacao_desc;
        if (tipo_cobranca !== undefined) updatePayload.tipo_cobranca = tipo_cobranca;
        if (valor_mensal_numero !== undefined) updatePayload.valor_mensal_numero = valor_mensal_numero ? parseFloat(valor_mensal_numero) : null;
        if (valor_sessao_numero !== undefined) updatePayload.valor_sessao_numero = valor_sessao_numero ? parseFloat(valor_sessao_numero) : null;
        if (genero_identidade !== undefined) updatePayload.genero_identidade = genero_identidade;
        if (cpf !== undefined) updatePayload.cpf = cpf;
        if (razao_social !== undefined) updatePayload.razao_social = razao_social;
        if (ano_inicio_experiencia !== undefined) updatePayload.ano_inicio_experiencia = ano_inicio_experiencia ? parseInt(ano_inicio_experiencia, 10) : null;
        if (dailySummaryTime !== undefined) updatePayload.dailySummaryTime = dailySummaryTime || '08:00';
        if (reminderHoursBefore !== undefined) updatePayload.reminderHoursBefore = reminderHoursBefore ? parseInt(reminderHoursBefore) : 24;
        if (linkedin_url !== undefined) updatePayload.linkedin_url = linkedin_url;
        if (instagram_url !== undefined) updatePayload.instagram_url = instagram_url;
        if (facebook_url !== undefined) updatePayload.facebook_url = facebook_url;
        if (tiktok_url !== undefined) updatePayload.tiktok_url = tiktok_url;
        if (x_url !== undefined) updatePayload.x_url = x_url;

        // Passamos os Arrays JS diretamente. O Sequelize fará a serialização correta para JSONB.
        if (temas_atuacao !== undefined) updatePayload.temas_atuacao = temas_atuacao;
        if (abordagens_tecnicas !== undefined) updatePayload.abordagens_tecnicas = abordagens_tecnicas;
        if (modalidade !== undefined) updatePayload.modalidade = modalidade;
        if (publico_alvo !== undefined) updatePayload.publico_alvo = publico_alvo;
        if (estilo_terapia !== undefined) updatePayload.estilo_terapia = estilo_terapia;
        if (praticas_inclusivas !== undefined) updatePayload.praticas_inclusivas = praticas_inclusivas;
        if (disponibilidade_periodo !== undefined) updatePayload.disponibilidade_periodo = disponibilidade_periodo;

        await psychologist.update(updatePayload);

        // --- ATIVAÇÃO DO TRIAL PÓS-CADASTRO (ANTI-ABUSO) ---
        // Se o perfil estava pendente e o profissional preencheu um CPF válido agora, ativa os 14 dias
        if (psychologist.status === 'pending' && cpf && cpf.replace(/\D/g, '').length >= 11) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 14);
            await psychologist.update({
                status: 'active',
                plano: 'Essencial',
                planExpiresAt: trialEndDate
            });
        }

        // --- GAMIFICATION HOOK (BADGE AUTÊNTICO) ---
        await gamificationService.checkProfileCompletion(psychologist.id);

        res.json({
            id: psychologist.id,
            slug: finalSlug, // Retorna o novo slug para atualizar a tela
            nome: psychologist.nome,
            email: psychologist.email,
            status: psychologist.status, // Adicionado
            modalidade: psychologist.modalidade,
            plano: psychologist.plano, // Adicionado
            fotoUrl: psychologist.fotoUrl
        });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        console.error('Detalhes do erro (Message):', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
            // Mapeia o campo técnico para uma mensagem amigável
            const field = error.fields ? Object.keys(error.fields)[0] : 'desconhecido';
            let userMessage = 'Este dado já está em uso por outra conta.';
            if (field === 'slug') {
                userMessage = 'Este link personalizado já está em uso. Por favor, escolha outro.';
            } else if (field === 'crp') {
                userMessage = 'Este CRP já está cadastrado em outra conta.';
            } else if (field === 'cpf') {
                userMessage = 'Este CPF já está cadastrado em outra conta.';
            } else if (field === 'email') {
                userMessage = 'Este e-mail já está em uso por outra conta.';
            }
            return res.status(400).json({ error: userMessage });
        }
        res.status(500).json({ error: 'Erro ao atualizar perfil' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/waiting-list/invite
// ----------------------------------------------------------------------
exports.inviteFromWaitlist = async (req, res) => {
    try {
        const { waitingListId } = req.body;

        if (!waitingListId) {
            return res.status(400).json({ error: 'ID do candidato na lista de espera é obrigatório.' });
        }

        const candidate = await db.WaitingList.findOne({
            where: { id: waitingListId, status: { [Op.in]: ['pending', 'invited'] } }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato não encontrado.' });
        }

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Expira em 7 dias

        await candidate.update({
            status: 'invited',
            invitationToken: invitationToken,
            invitationExpiresAt: expirationDate,
        });

        const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
        const invitationLink = `${frontendUrl}/psi-registro?token=${invitationToken}&email=${encodeURIComponent(candidate.email)}`;
        
        const emailService = require('../services/emailService');
        const htmlContent = `<h2>Olá, ${candidate.nome}!</h2><p>Temos uma ótima notícia: uma vaga foi liberada para você na Yelo!</p><p>Clique no link abaixo para concluir seu cadastro e começar a atender pacientes:</p><a href="${invitationLink}" style="display:inline-block; padding:10px 20px; background:#1B4332; color:#fff; text-decoration:none; border-radius:5px;">Concluir Cadastro</a><p>Seja bem-vindo(a)!</p>`;
        
        try {
            if (typeof emailService.sendInvitationEmail === 'function') {
                await emailService.sendInvitationEmail(candidate, invitationLink);
            } else if (typeof emailService.sendEmail === 'function') {
                await emailService.sendEmail(candidate.email, "Seu convite para a Yelo chegou! 🎉", htmlContent);
            }
            res.status(200).json({ message: `Convite enviado com sucesso para ${candidate.email}.` });
        } catch (emailErr) {
            console.error('Erro ao enviar e-mail de convite:', emailErr);
            res.status(200).json({ message: `Status atualizado, mas houve uma falha ao disparar o e-mail via SMTP para ${candidate.email}. O Link de cadastro manual é: ${invitationLink}` });
        }
    } catch (error) {
        console.error('Erro ao enviar convite manual:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/password
// ----------------------------------------------------------------------
exports.updatePsychologistPassword = async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }

        const psychologistWithPassword = await db.Psychologist.findByPk(req.psychologist.id);

        const isMatch = await bcrypt.compare(senha_atual, psychologistWithPassword.senha);
        if (!isMatch) {
            return res.status(401).json({ error: 'A senha atual está incorreta.' });
        }

        psychologistWithPassword.senha = await bcrypt.hash(nova_senha, 10);
        await psychologistWithPassword.save();

        res.status(200).json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Erro ao alterar senha do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/complete-profile
// ----------------------------------------------------------------------
exports.completeSocialProfile = async (req, res) => {
    try {
        const psychologist = req.psychologist;

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado ou não autenticado.' });
        }

        if (psychologist.crp) {
            return res.status(400).json({ error: 'Este perfil já está completo.' });
        }

        const { crp, telefone } = req.body;

        if (!crp) {
            return res.status(400).json({ error: 'O número do CRP é obrigatório.' });
        }

        await psychologist.update({
            crp,
            telefone,
            status: 'active' 
        });

        res.status(200).json({ message: 'Perfil completado com sucesso!' });
    } catch (error) {
        console.error('Erro ao completar perfil do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/unread-count
// ----------------------------------------------------------------------
exports.getUnreadMessageCount = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;

        const count = await db.Message.count({
            where: { 
                recipientId: psychologistId, 
                recipientType: 'psychologist',
                isRead: false 
            }
        });
        res.status(200).json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar contagem de mensagens.' });
    }
};

exports.updateProfilePhoto = async (req, res) => {
    try {
        // 1. Validação
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado, psicólogo não identificado.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
        }

        const psychologistToUpdate = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologistToUpdate) {
            return res.status(404).json({ error: 'Psicólogo não encontrado no banco de dados.' });
        }

        // 2. Upload para o Cloudinary
        // O arquivo está em req.file.path (salvo temporariamente pelo multer)
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'yelo/profiles', // Pasta no Cloudinary
            public_id: `profile-${psychologistToUpdate.id}`, // ID fixo para substituir a foto antiga automaticamente
            overwrite: true,
            transformation: [
                { width: 500, height: 500, crop: 'fill', gravity: 'face' }, // Foca no rosto e corta quadrado
                { quality: 'auto' }, // Otimização automática de qualidade
                { fetch_format: 'auto' } // Converte para WebP/AVIF se o navegador suportar
            ]
        });

        // 3. Atualiza o banco com a URL segura do Cloudinary
        await psychologistToUpdate.update({ fotoUrl: result.secure_url });

        // --- GAMIFICATION HOOK (BADGE AUTÊNTICO) ---
        await gamificationService.checkProfileCompletion(psychologistToUpdate.id);

        // 4. Limpeza: Remove o arquivo local temporário
        try {
            await fs.unlink(req.file.path);
        } catch (e) { console.warn("Erro ao deletar arquivo local:", e); }

        // 5. Resposta
        res.status(200).json({
            message: 'Foto atualizada com sucesso!',
            fotoUrl: result.secure_url
        });

    } catch (error) {
        console.error('Erro ao fazer upload da foto:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao fazer upload da foto.' });
    }
};


// ----------------------------------------------------------------------
// Rota: DELETE /api/psychologists/me (BLINDADA CONTRA COBRANÇA INDEVIDA)
// ----------------------------------------------------------------------
exports.deletePsychologistAccount = async (req, res) => {
    try {
        // 1. Recebe senha e dados da pesquisa de saída
        // Nota: Adicionei sugestao e avaliacao caso você ajuste o front para enviar também
        const { senha, motivo, sugestao, avaliacao } = req.body;

        if (!senha) {
            return res.status(400).json({ error: 'A senha é obrigatória para excluir a conta.' });
        }

        // 2. Busca o usuário com dados sensíveis para validação
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);

        if (!psychologist) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // 3. Verifica a senha
        const isMatch = await bcrypt.compare(senha, psychologist.senha);
        if (!isMatch) {
            return res.status(403).json({ error: 'Senha incorreta. A conta não foi excluída.' });
        }

        // --- PONTO CRÍTICO: CANCELAMENTO NO ASAAS ---
        if (psychologist.stripeSubscriptionId) {
            try {
                console.log(`[EXIT] Cancelando assinatura Asaas: ${psychologist.stripeSubscriptionId}`);
                await fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.stripeSubscriptionId}`, {
                    method: 'DELETE',
                    headers: { 'access_token': ASAAS_API_KEY }
                });
            } catch (asaasError) {
                console.error("Erro ao cancelar no Asaas (prosseguindo com exclusão local):", asaasError);
                // Decisão de Produto: Não impedimos a exclusão se o Stripe falhar, 
                // mas logamos o erro para auditoria manual se necessário.
            }
        }

        // 4. Salvar Feedback de Saída (Via Modelo Sequelize)
        if (motivo) {
            try {
                // Verifica se o modelo foi carregado antes de tentar usar
                if (db.ExitSurvey) {
                    await db.ExitSurvey.create({
                        psychologistId: psychologist.id,
                        motivo: motivo,
                        avaliacao: avaliacao ? parseInt(avaliacao) : null,
                        sugestao: sugestao || 'Não informado'
                    });
                } else {
                    console.warn("Modelo ExitSurvey ainda não carregado.");
                }
            } catch (surveyError) {
                console.error("Erro ao salvar ExitSurvey:", surveyError);
            }
        }

        // --- GAMIFICATION: Libera o slot da badge 'Pioneiro' se o usuário tiver ---
        if (psychologist.badges && psychologist.badges.pioneiro) {
            const currentBadges = { ...psychologist.badges };
            delete currentBadges.pioneiro;
            await psychologist.update({ badges: currentBadges });
            console.log(`[GAMIFICATION] Slot de badge 'Pioneiro' liberado pelo usuário ${psychologist.email}.`);
        }

        // 5. Exclusão da Conta (Soft Delete se o Model for Paranoid, ou Hard Delete)
        await psychologist.destroy();

        console.log(`[EXIT] Conta ${psychologist.email} encerrada com sucesso.`);
        res.status(200).json({ message: 'Sua conta e assinatura foram encerradas com sucesso.' });

    } catch (error) {
        console.error('Erro crítico ao excluir conta do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/matches (Rota Protegida - Usuário Logado)
// ----------------------------------------------------------------------
exports.getPatientMatches = async (req, res) => {
    try {
        const patient = req.patient;

        if (!patient) {
            return res.status(401).json({ error: 'Paciente não autenticado.' });
        }

        // Monta o objeto de preferências padrão baseado no perfil salvo do paciente
        const patientPreferences = {
            valor_sessao_faixa: patient.valor_sessao_faixa,
            temas_buscados: patient.temas_buscados || [],
            estilo_desejado: patient.abordagem_desejada || [], 
            genero_profissional: patient.genero_profissional,
            praticas_desejadas: patient.praticas_afirmativas || [],
            // Assumindo que salvamos idade no perfil do paciente, senão ignoramos
            idade_paciente: patient.idade || '' 
        };

        // Validação rápida se o perfil está vazio
        const hasData = patientPreferences.valor_sessao_faixa || patientPreferences.temas_buscados.length > 0;
        if (!hasData) {
            return res.status(200).json({
                message: 'Por favor, preencha o questionário para encontrar psicólogos compatíveis.',
                matchTier: 'none',
                results: []
            });
        }

        // --- A MÁGICA ACONTECE AQUI ---
        const matchResult = await matchService.calculateMatches(patientPreferences);

        // --- LOG DE EVENTO DE MATCH ---
        if (matchResult && matchResult.results && matchResult.results.length > 0) {
            const matchEvents = matchResult.results.map(psi => ({
                psychologistId: psi.id,
                patientId: patient.id, // Temos o ID do paciente logado
                matchScore: psi.matchScore,
                source: 'patient_dashboard'
            }));
            try {
                // O modelo db.MatchEvent pode não existir, então usamos SQL puro e garantimos as colunas
                await db.sequelize.query(`ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER, ADD COLUMN IF NOT EXISTS "source" VARCHAR(255);`).catch(() => {});
                for (const event of matchEvents) {
                    await db.sequelize.query(
                        `INSERT INTO "MatchEvents" ("psychologistId", "patientId", "matchScore", "source", "createdAt", "updatedAt") VALUES (:psychologistId, :patientId, :matchScore, :source, NOW(), NOW())`,
                        { replacements: event, type: db.sequelize.QueryTypes.INSERT }
                    );
                }
                console.log(`[MATCH DEBUG] Patient Match: Created ${matchEvents.length} MatchEvents via SQL.`);
            } catch (err) {
                console.error("Erro ao registrar MatchEvents (logado):", err);
            }
        }

        res.status(200).json({
            message: matchResult.matchTier === 'ideal' ? 'Psicólogos compatíveis encontrados!' : 'Psicólogos próximos encontrados!',
            matchTier: matchResult.matchTier,
            results: matchResult.results,
            compromiseText: matchResult.compromiseText
        });

    } catch (error) {
        console.error('Erro ao encontrar psicólogos compatíveis (Logado):', error);
        res.status(500).json({ error: 'Erro interno no servidor ao buscar psicólogos compatíveis.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/match (Endpoint Público - Anônimo)
// ----------------------------------------------------------------------
exports.getAnonymousMatches = async (req, res) => {
    try {
        const patientAnswers = req.body;

        // Normalização dos dados vindos do Frontend (questionario.js)
        // O front manda chaves ligeiramente diferentes do banco, normalizamos aqui.
        const patientPreferences = {
            valor_sessao_faixa: patientAnswers.faixa_valor,
            temas_buscados: patientAnswers.temas || [],
            estilo_desejado: patientAnswers.experiencia_desejada || [],
            genero_profissional: patientAnswers.pref_genero_prof,
            praticas_desejadas: patientAnswers.caracteristicas_prof || [],
            idade_paciente: patientAnswers.idade,
            modalidade_preferida: patientAnswers.modalidade_atendimento
        };

        if (!patientPreferences.valor_sessao_faixa) {
             return res.status(400).json({ error: 'Faixa de valor é obrigatória.' });
        }

        // Reutiliza a MESMA lógica do usuário logado
        const matchResult = await matchService.calculateMatches(patientPreferences);

        // --- SUPER DEBUG ---
        console.log('[MATCH SUPER DEBUG] Reached getAnonymousMatches after calculateMatches.');
        if (matchResult && matchResult.results) {
            console.log('[MATCH SUPER DEBUG] matchResult.results.length:', matchResult.results.length);
        } else {
            console.log('[MATCH SUPER DEBUG] matchResult or matchResult.results is undefined.');
        }
        // --- FIM SUPER DEBUG ---

        // --- LOG DE EVENTO DE MATCH (ANÔNIMO) ---
        if (matchResult && matchResult.results && matchResult.results.length > 0) {
            console.log('[MATCH SUPER DEBUG] Entering the if block to create MatchEvents.');
            const matchEvents = matchResult.results.map(psi => ({
                psychologistId: psi.id,
                patientId: null, // Usuário anônimo
                matchScore: psi.matchScore,
                source: 'questionnaire'
            }));
            try {
                await db.sequelize.query(`ALTER TABLE "MatchEvents" ADD COLUMN IF NOT EXISTS "patientId" INTEGER, ADD COLUMN IF NOT EXISTS "source" VARCHAR(255);`).catch(() => {});
                for (const event of matchEvents) {
                    await db.sequelize.query(
                        `INSERT INTO "MatchEvents" ("psychologistId", "patientId", "matchScore", "source", "createdAt", "updatedAt") VALUES (:psychologistId, :patientId, :matchScore, :source, NOW(), NOW())`,
                        { replacements: event, type: db.sequelize.QueryTypes.INSERT }
                    );
                }
                console.log(`[MATCH DEBUG] Anonymous Match: Created ${matchEvents.length} MatchEvents via SQL.`);
            } catch (err) {
                console.error("Erro ao registrar MatchEvents (anônimo):", err);
            }
        }

        res.status(200).json(matchResult);

    } catch (error) {
        console.error('Erro ao processar match anônimo:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao buscar recomendações.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/showcase
// ----------------------------------------------------------------------
exports.getShowcasePsychologists = async (req, res) => {
    try {
        const psychologists = await db.Psychologist.findAll({
            where: {
                status: 'active',
                fotoUrl: { [Op.ne]: null }
            },
            order: db.sequelize.random(), 
            limit: 20, 
            attributes: ['id', 'nome', 'fotoUrl', 'status', 'createdAt', 'planExpiresAt', 'is_exempt'] 
        });

        const agora = new Date();
        const validPsychologists = psychologists.filter(psy => {
            const isVip = psy.is_exempt === true || String(psy.is_exempt).toLowerCase() === 'true' || psy.is_exempt === 1;
            if (isVip) return true;
            
            if (!psy.planExpiresAt) return false;
            return new Date(psy.planExpiresAt) > agora;
        }).slice(0, 4);

        while (validPsychologists.length < 4) {
            validPsychologists.push({
                id: 0,
                nome: "Em breve",
                fotoUrl: "https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
            });
        }

        res.status(200).json(validPsychologists);
    } catch (error) {
        console.error('Erro ao buscar psicólogos para vitrine:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/slug/:slug (NOVA ROTA)
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/slug/:slug (VERSÃO DESTRAVADA PARA DEV)
// ----------------------------------------------------------------------
exports.getProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`\n[VISITA] Buscando perfil: "${slug}"`);

    // 1. Busca pelo slug (Case Insensitive)
    const psychologist = await db.Psychologist.findOne({
      where: { slug: { [Op.iLike]: slug } }, // Case insensitive
      attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires', 'cpf'] },
    });

    if (!psychologist) {
      console.log(`❌ Perfil não existe no banco.`);
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    // --- BLOQUEIO DE CRIADORES DE CONTEÚDO ---
    if (psychologist.status === 'content_creator') {
        console.log(`🚫 [BLOQUEIO] Perfil de criador de conteúdo oculto.`);
        return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    // --- LÓGICA DE TRAVAS (COMENTADA PARA VOCÊ CONSEGUIR TRABALHAR) ---
    // Em produção, você deve descomentar isso para bloquear inadimplentes.
    
    const hoje = new Date();
    // FIX: Usa a coluna correta 'planExpiresAt'
    const validade = psychologist.planExpiresAt ? new Date(psychologist.planExpiresAt) : null;
    const status = psychologist.status;
    const isVip = psychologist.is_exempt === true || String(psychologist.is_exempt).toLowerCase() === 'true' || psychologist.is_exempt === 1;

    // Log para você saber a saúde do perfil
        console.log(`🔎 Status: ${status} | VIP: ${isVip ? 'Sim' : 'Não'} | Validade: ${validade ? validade.toLocaleDateString() : 'NENHUMA'}`);

    // BLOQUEIO ATIVADO: Inadimplentes e inativos não podem ser acessados publicamente
    if (!isVip) {
        if (!validade || validade <= hoje) {
            console.log(`🚫 [BLOQUEIO] Pagamento vencido. Ocultando perfil.`);
            return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
        }
    }
    
    if (status !== 'active') {
        console.log(`🚫 [BLOQUEIO] Status inválido (${status}).`);
        return res.status(404).json({ error: 'Perfil indisponível no momento.' });
    }
   
    // ------------------------------------------------------------------

    // Busca reviews
    const reviews = await db.Review.findAll({
      where: { psychologistId: psychologist.id },
      include: [{
        model: db.Patient,
        as: 'patient',
        attributes: ['nome']
      }],
      order: [['createdAt', 'DESC']]
    });

    const responseData = {
      ...psychologist.toJSON(),
      reviews: reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        patientName: r.patient?.nome || 'Anônimo',
        createdAt: r.createdAt
      }))
    };

    res.status(200).json(responseData);

  } catch (error) {
    console.error('[ERRO CRÍTICO] Falha ao buscar perfil:', error);
    res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};


// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/:id
// DESCRIÇÃO: Busca o perfil de um psicólogo específico. (CORRIGIDO)
// ----------------------------------------------------------------------
exports.getPsychologistProfile = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Busca o psicólogo (SEM O INCLUDE QUE ESTAVA QUEBRANDO)
        const psychologist = await db.Psychologist.findByPk(id, {
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] }
        });

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        // --- BLOQUEIO ATIVADO (Travas de Vencimento Faltantes) ---
        const isVip = psychologist.is_exempt === true || String(psychologist.is_exempt).toLowerCase() === 'true' || psychologist.is_exempt === 1;
        const hoje = new Date();
        const validade = psychologist.planExpiresAt ? new Date(psychologist.planExpiresAt) : null;
        
        if (!isVip) {
            if (!validade || validade <= hoje) {
                return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
            }
        }
        
        if (psychologist.status !== 'active') {
            return res.status(404).json({ error: 'Perfil indisponível no momento.' });
        }

        // 2. Busca as avaliações (reviews) SEPARADAMENTE
        const reviews = await db.Review.findAll({
            where: { psychologistId: id },
            include: [{
                model: db.Patient,
                as: 'patient',
                attributes: ['nome']
            }],
            order: [['createdAt', 'DESC']]
        });

        // 3. Calcula a média (Req 1)
        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const average_rating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;
        const review_count = reviews.length;

        // 4. Monta o objeto de resposta final
        const psychologistData = {
            ...psychologist.toJSON(),
            average_rating,
            review_count,
            reviews: reviews // Anexa as avaliações
        };

        res.status(200).json(psychologistData);

    } catch (error) {
        console.error('Erro ao buscar perfil do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/crp-document
// ----------------------------------------------------------------------
exports.uploadCrpDocument = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado, psicólogo não identificado.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo foi enviado.' });
        }

        const psychologistToUpdate = await db.Psychologist.findByPk(req.psychologist.id);

        const crpDocumentUrl = req.file.path;

        await psychologistToUpdate.update({
            crpDocumentUrl: crpDocumentUrl,
            status: 'pending' 
        });

        res.status(200).json({
            message: 'Documento enviado com sucesso!',
        });
    } catch (error) {
        console.error('Erro no upload do documento CRP:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao processar o arquivo.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/:id/reviews
// Descrição: Retorna todas as reviews para um psicólogo.
// ----------------------------------------------------------------------
exports.getPsychologistReviews = async (req, res) => {
    try {
        // 1. Pega o ID do psicólogo da URL
        const { id } = req.params;

        // 2. Busca todas as Reviews
        // - where: Filtra pelo ID do psicólogo.
        // - include: Traz os dados do Paciente que escreveu a review (para mostrar o nome/foto).
        // - order: Ordena da mais nova para a mais antiga.
        const reviews = await db.Review.findAll({
            where: { psychologistId: id },
            
            // ⚠️ IMPORTANTE: Certifique-se de que a associação "as: 'patient'" está correta no seu modelo Review
            include: [{ 
                model: db.Patient, 
                as: 'patient', 
                attributes: ['nome', 'fotoUrl'] // Busca apenas os campos necessários do paciente
            }], 
            
            order: [['createdAt', 'DESC']]
        });

        // 3. Retorna a lista de reviews (pode ser vazia, mas não é um erro 500)
        return res.json({ reviews }); 

    } catch (error) {
        // Se houver um erro de banco de dados (ex: tabela Review não existe), ele será pego aqui.
        console.error('Erro ao buscar reviews para o psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao buscar avaliações.' });
    }
};
// COLE ESTA FUNÇÃO NO FINAL DE backend/controllers/psychologistController.js

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/qna-unanswered-count (NOVA ROTA)
// Descrição: Busca a contagem de perguntas da comunidade que o psicólogo logado ainda não respondeu.
// ----------------------------------------------------------------------
exports.getUnansweredQuestionsCount = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;

        // 1. Pega os IDs de todas as perguntas que este psicólogo JÁ respondeu
        const answeredQuestionIds = await db.Answer.findAll({
            where: { psychologistId: psychologistId },
            attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('questionId')), 'questionId']]
        });
        const answeredIds = answeredQuestionIds.map(a => a.questionId);

        // 2. Conta todas as perguntas que estão 'approved' ou 'answered'
        //    E que NÃO ESTÃO na lista de perguntas já respondidas por este psicólogo
        const count = await db.Question.count({
            where: {
                status: { [db.Op.in]: ['approved', 'answered'] }, // Perguntas visíveis
                id: { [db.Op.notIn]: answeredIds } // Exclui as que o 'psi' já respondeu
            }
        });

        res.status(200).json({ count });

    } catch (error) {
        console.error('Erro ao buscar contagem de Q&A não respondidas:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};
// ... (código existente) ...

/**
 * Salva a pesquisa de saída do Psicólogo
 */
exports.saveExitSurvey = async (req, res) => {
    try {
        const { motivo, avaliacao, sugestao } = req.body;
        // Tenta pegar o ID do psi logado (se o middleware de auth estiver ativo)
        const psychologistId = req.user ? req.user.id : null; 

        console.log("Salvando Exit Survey:", req.body);

        await db.sequelize.query(`
            INSERT INTO "ExitSurveys" ("psychologistId", "motivo", "avaliacao", "sugestao", "createdAt", "updatedAt")
            VALUES (:uid, :mot, :aval, :sug, NOW(), NOW())
        `, {
            replacements: { 
                uid: psychologistId, 
                mot: motivo, 
                aval: avaliacao ? parseInt(avaliacao) : null, 
                sug: sugestao 
            },
            type: db.sequelize.QueryTypes.INSERT
        });

        res.json({ message: "Feedback salvo." });
    } catch (error) {
        console.error("Erro ao salvar exit survey:", error);
        // Não retorna erro 500 para não travar a exclusão da conta
        res.json({ message: "Seguindo..." }); 
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/cancel-subscription (CORRIGIDO V2)
// ----------------------------------------------------------------------
exports.cancelSubscription = async (req, res) => {
    try {
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        
        if (!psychologist) return res.status(404).json({ error: 'Psi não encontrado' });

        // [CORREÇÃO] Verifica ambas as colunas possíveis para o ID da assinatura
        const subId = psychologist.stripeSubscriptionId || psychologist.subscriptionId;

        if (!subId) {
             // [CORREÇÃO DEFINITIVA] FALLBACK DE SEGURANÇA:
             // Se chegou aqui, o usuário quer cancelar. Se não temos ID para o Asaas,
             // cancelamos localmente para não prender o usuário.
             await psychologist.update({
                status: 'inactive',
                plano: null,
                planExpiresAt: new Date(0),
                cancelAtPeriodEnd: false,
                stripeSubscriptionId: null,
                subscriptionId: null
             });
             return res.status(200).json({ message: 'Assinatura cancelada localmente (Vínculo de pagamento não encontrado).' });
        }

        // 1. Busca dados da assinatura no Asaas para verificar data de criação
        const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const subText = await subResponse.text();
        const subData = subText ? JSON.parse(subText) : {};

        if (!subData.id) {
             console.warn(`[CANCELAMENTO LOCAL] Assinatura ${subId} não encontrada na API Asaas. Status: ${subResponse.status}. Resp: ${subText}`);
             // Se não achou no Asaas, assume cancelamento manual local e limpa tudo
             await psychologist.update({ 
                 status: 'inactive',
                 plano: null,
                 planExpiresAt: new Date(0),
                 cancelAtPeriodEnd: false,
                 stripeSubscriptionId: null
             });
             return res.json({ message: 'Assinatura cancelada localmente (Não encontrada no provedor).' });
        }

        // 2. Verifica regra de 7 dias (Direito de Arrependimento)
        // [CORREÇÃO] Usa UTC para garantir precisão de dias e verifica pagamentos reais
        const dateCreated = new Date(subData.dateCreated);
        const now = new Date();
        const utcCreated = Date.UTC(dateCreated.getFullYear(), dateCreated.getMonth(), dateCreated.getDate());
        const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.floor((utcNow - utcCreated) / (1000 * 60 * 60 * 24));

        let isEligibleForRefund = diffDays <= 7;

        // [CORREÇÃO] Se a assinatura parecer antiga (ex: conta restaurada), verifica se o pagamento é recente
        if (!isEligibleForRefund) {
             try {
                 const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}/payments`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const paymentsText = await paymentsRes.text();
                const paymentsData = paymentsText ? JSON.parse(paymentsText) : {};
                // Filtra apenas pagamentos confirmados
                const confirmedPayments = (paymentsData.data || []).filter(p => ['CONFIRMED', 'RECEIVED'].includes(p.status));
                
                // Se tiver APENAS 1 pagamento confirmado e ele for recente (<= 7 dias), permite estorno
                if (confirmedPayments.length === 1) {
                    const paymentDate = new Date(confirmedPayments[0].paymentDate || confirmedPayments[0].dateCreated);
                    const utcPayment = Date.UTC(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
                    const diffPaymentDays = Math.floor((utcNow - utcPayment) / (1000 * 60 * 60 * 24));
                    
                    if (diffPaymentDays <= 7) {
                        isEligibleForRefund = true;
                    }
                }
             } catch(e) { console.error("Erro ao verificar pagamentos extras:", e); }
        }

        if (isEligibleForRefund) {
            // A. Busca pagamentos confirmados para estornar
            const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}/payments`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const paymentsText = await paymentsRes.text();
            const paymentsData = paymentsText ? JSON.parse(paymentsText) : {};
            
            if (paymentsData.data) {
                for (const payment of paymentsData.data) {
                    if (['CONFIRMED', 'RECEIVED'].includes(payment.status)) {
                        // Estorna o pagamento
                        await fetch(`${ASAAS_API_URL}/payments/${payment.id}/refund`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                            body: JSON.stringify({ value: payment.value, description: "Cancelamento no prazo de 7 dias (Arrependimento)" })
                        });
                    }
                }
            }

            // B. Cancela a assinatura imediatamente (DELETE)
            await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}`, {
                method: 'DELETE',
                headers: { 'access_token': ASAAS_API_KEY }
            });

            // C. Atualiza Banco Local (Revoga acesso imediatamente)
            const currentBadges = psychologist.badges || {};
            if (currentBadges.pioneiro) {
                delete currentBadges.pioneiro;
                console.log(`[GAMIFICATION] Slot de badge 'Pioneiro' liberado (cancelamento < 7 dias) por ${psychologist.email}.`);
            }

            await psychologist.update({
                status: 'inactive',
                plano: null,
                planExpiresAt: new Date(0), // Expira já
                cancelAtPeriodEnd: false,
                stripeSubscriptionId: null, // FIX: Limpa o ID para impedir que o webhook reative
                subscriptionId: null, // Limpa também a coluna legada se existir
                badges: currentBadges // Atualiza as badges
            });

            // D. Envia E-mail de Cancelamento
            // [OTIMIZAÇÃO] Não espera o envio do e-mail para responder ao usuário (ganha ~2s)
            sendSubscriptionCancelledEmail(psychologist).catch(e => console.error("Erro email cancelamento:", e));

            return res.json({ message: 'Assinatura cancelada e valor estornado.' });

        } else {
            // --- CENÁRIO B: CANCELAMENTO AGENDADO (> 7 DIAS) ---
            if (subData.nextDueDate) {
                // Atualiza a assinatura definindo o fim para a próxima cobrança
                await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify({ endDate: subData.nextDueDate })
                });
            }

            // 2. ATUALIZA O BANCO LOCAL
            const updateData = { cancelAtPeriodEnd: true };
            if (subData.nextDueDate) {
                updateData.planExpiresAt = subData.nextDueDate;
            }
            await psychologist.update(updateData);

            res.json({ message: 'Renovação automática cancelada. Seu acesso continua até o fim do período.' });
        }

    } catch (error) {
        console.error('Erro ao cancelar:', error);
        res.status(500).json({ error: 'Erro interno.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/reactivate-subscription
// Descrição: Remove o agendamento de cancelamento no Stripe e mantém o plano ativo.
// ----------------------------------------------------------------------
exports.reactivateSubscription = async (req, res) => {
    try {
        // 1. Identificação segura (usando seu padrão req.psychologist)
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);

        // [CORREÇÃO] Verifica ambas as colunas
        const subId = psychologist.stripeSubscriptionId || psychologist.subscriptionId;

        if (!subId) {
             return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });
        }

        // 1. Tenta remover a data de fim no Asaas (Reativar recorrência)
        const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify({ endDate: null }) // null remove a data de encerramento
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        // Se der erro (ex: assinatura já deletada), forçamos o usuário a assinar de novo
        if (response.status !== 200 || data.errors) {
            return res.status(400).json({ error: 'Não foi possível reativar automaticamente. Por favor, assine novamente.' });
        }

        // 2. Atualiza banco local
        await psychologist.update({ cancelAtPeriodEnd: false });

        res.json({ message: 'Assinatura reativada com sucesso! A cobrança automática voltará a ocorrer.' });

    } catch (error) {
        console.error('Erro ao reativar assinatura:', error);
        res.status(500).json({ error: 'Erro ao processar reativação.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/stats (NOVA - OTIMIZADA)
// ----------------------------------------------------------------------
exports.getStats = async (req, res) => {
    try {
        console.time('⏱️ Psi Stats Load');
        const psychologistId = req.psychologist.id;
        console.log(`[STATS DEBUG] Iniciando getStats para Psychologist ID: ${psychologistId}`);
        const { period } = req.query; 

        // --- PERSONALIZAÇÃO: Busca os temas do psicólogo logado ---
        const psychologist = await db.Psychologist.findByPk(psychologistId, { attributes: ['temas_atuacao'] });
        const psiTemas = psychologist?.temas_atuacao || [];

        // Filtro de Data (Padrão: Últimos 30 dias)
        let dateCondition = "";
        const replacements = { psiId: psychologistId };

        if (period === 'last30days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '30 days'`;
        } else if (period === 'last7days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '7 days'`;
        } else if (period === 'last90days') {
            dateCondition = `AND "createdAt" >= NOW() - INTERVAL '90 days'`;
        }
        // 'all_time' não adiciona filtro

        // Adiciona os temas do psicólogo aos replacements para a query
        /// a query só será personalizada se o psicólogo tiver temas cadastrados
        if (psiTemas.length > 0) {
            replacements.psiTemas = psiTemas;
        }

        // --- OTIMIZAÇÃO: PARALELISMO (Promise.all) ---
        // Executa todas as contagens ao mesmo tempo
        const [
            clicksResult,
            appearancesResult,
            favoritesResult,
            topDemandsResult,
            totalDemandsResult,
            xpHistoryResult,
            blogPostCount,
            forumPostCount,
            forumCommentCount,
            answerCount,
            matchesResult,
            blogLikesResult
        ] = await Promise.all([
            // 1. Cliques no WhatsApp (Tabela de Logs)
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "psychologistId" = :psiId ${dateCondition}`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "PsychologistId" = :psiId ${dateCondition}`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(err => {
                console.error("[DEBUG KPIs] Erro na query WhatsappClickLogs:", err.message);
                return [{ count: 0 }];
            }),

            // 2. Aparições no Perfil (Tabela de Logs)
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :psiId ${dateCondition}`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "PsychologistId" = :psiId ${dateCondition}`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(err => {
                console.error("[DEBUG KPIs] Erro na query ProfileAppearanceLogs:", err.message);
                return [{ count: 0 }];
            }),

            // 3. Favoritos (Tabela de Associação)
            // Nota: Verifica se a tabela existe para não quebrar
            // CORREÇÃO: A contagem de favoritos é um total, não por período.
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "PsychologistId" = :psiId`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "psychologistId" = :psiId`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(err => { console.error("KPI Error (Favorites):", err.message); return [{ count: 0 }]; }),

            // 4. Top Demandas (Tendências) - Otimizado E PERSONALIZADO
            /// a query agora filtra buscas que contenham pelo menos um dos temas de atuação do psicólogo.
            db.sequelize.query(
                `SELECT value as name, COUNT(*) as count
                 FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value
                 WHERE status = 'completed' ${dateCondition} 
                 AND jsonb_typeof("searchParams"->'temas') = 'array'
                 ${psiTemas.length > 0 ? `AND "searchParams"->'temas' ?| array[:psiTemas]` : ''}
                 GROUP BY value ORDER BY count DESC LIMIT 3`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => []),

            // 5. Total de Demandas com Temas (para cálculo de %) - PERSONALIZADO
            db.sequelize.query(
                `SELECT COUNT(*) as total
                 FROM "DemandSearches"
                 WHERE status = 'completed' ${dateCondition} AND "searchParams"->'temas' IS NOT NULL AND jsonb_typeof("searchParams"->'temas') = 'array' AND jsonb_array_length("searchParams"->'temas') > 0
                 ${psiTemas.length > 0 ? `AND "searchParams"->'temas' ?| array[:psiTemas]` : ''}`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => [{ total: 0 }]),

            // 6. Histórico de XP (Agrupado por dia)
            db.sequelize.query(
                `SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, SUM("points") as points
                 FROM "GamificationLogs"
                 WHERE "psychologistId" = :psiId ${dateCondition}
                 GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
                 ORDER BY date ASC`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, SUM("points") as points
                     FROM "GamificationLogs"
                     WHERE "PsychologistId" = :psiId ${dateCondition}
                     GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
                     ORDER BY date ASC`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(err => []),
            
            // 7. Contagens do Game para a Rota de Stats
            db.Post ? db.Post.count({ where: { psychologistId } }).catch(() => db.Post.count({ where: { psychologist_id: psychologistId } }).catch(() => 0)) : Promise.resolve(0),
            db.ForumPost ? db.ForumPost.count({ where: { PsychologistId: psychologistId } }).catch(() => db.ForumPost.count({ where: { psychologistId } }).catch(() => 0)) : Promise.resolve(0),
            db.ForumComment ? db.ForumComment.count({ where: { PsychologistId: psychologistId } }).catch(() => db.ForumComment.count({ where: { psychologistId } }).catch(() => 0)) : Promise.resolve(0),
            db.Answer ? db.Answer.count({ where: { psychologistId } }).catch(() => 0) : Promise.resolve(0),
            
            // NOVO: Aparições no Match
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :psiId`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT COUNT(*) as count FROM "MatchEvents" WHERE "PsychologistId" = :psiId`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(err => {
                console.error("[DEBUG KPIs] Erro na query MatchEvents:", err.message);
                return [{ count: 0 }];
            }),

            // NOVO: Curtidas no Blog
            db.sequelize.query(
                `SELECT SUM(curtidas) as sum FROM "posts" WHERE "psychologist_id" = :psiId`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(() => 
                db.sequelize.query(
                    `SELECT SUM(curtidas) as sum FROM "posts" WHERE "psychologistId" = :psiId`,
                    { replacements, type: db.sequelize.QueryTypes.SELECT }
                )
            ).catch(() => [{ sum: 0 }])
        ]);

        console.log(`[STATS DEBUG] Raw result from MatchEvents query:`, matchesResult);

        // Processamento dos KPIs numéricos
        const whatsappClicks = parseInt(clicksResult[0]?.count || 0, 10);
        const profileViews = parseInt(appearancesResult[0]?.count || 0, 10);
        const matchImpressions = parseInt(matchesResult[0]?.count || 0, 10);
        const favoritesCount = parseInt(favoritesResult[0]?.count || 0, 10);
        const blogLikes = parseInt(blogLikesResult[0]?.sum || 0, 10);

        console.log(`[DEBUG KPIs] Psicólogo ID: ${psychologistId} | Período: ${period}`);
        console.log(`[STATS DEBUG] Parsed matchImpressions: ${matchImpressions}`);
        console.log(`[DEBUG KPIs] Match Impressions DB:`, matchesResult[0]);
        console.log(`[DEBUG KPIs] Profile Views DB:`, appearancesResult[0]);
        console.log(`[DEBUG KPIs] Whatsapp Clicks DB:`, clicksResult[0]);

        const safeCalc = (numerator, denominator) => {
            if (!denominator || denominator <= 0) return 'N/A';
            return parseFloat(((numerator / denominator) * 100).toFixed(1));
        };

        const funnelRates = {
            choiceRate: safeCalc(profileViews, matchImpressions),
            profileConversion: safeCalc(whatsappClicks, profileViews),
            finalConversion: safeCalc(whatsappClicks, matchImpressions)
        };

        // Processamento das Demandas (Otimizado)
        const totalDemands = parseInt(totalDemandsResult[0]?.total || 0, 10);
        const topDemands = topDemandsResult.map(demanda => ({
            name: demanda.name,
            count: parseInt(demanda.count, 10),
            percentage: totalDemands > 0 ? Math.round((parseInt(demanda.count, 10) / totalDemands) * 100) : 0
        }));

        const myEngagement = psychologist.xp || 0;
        const [betterThanResult] = await db.sequelize.query(`
            SELECT COALESCE(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active'), 0), 0) as percentage
            FROM "Psychologists" WHERE status = 'active' AND xp < :myEngagement
        `, { replacements: { myEngagement }, type: db.sequelize.QueryTypes.SELECT });
        const betterThanPercentage = Math.round(parseFloat(betterThanResult?.percentage || 0));

        let lastPostDate = null, lastForumDate = null, lastCommentDate = null;
        try {
            const [postRes] = await db.sequelize.query(`SELECT MAX(COALESCE(created_at, "createdAt")) as last_date FROM posts WHERE psychologist_id = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT });
            lastPostDate = postRes?.last_date;
        } catch(e) {
            try {
                const [postRes2] = await db.sequelize.query(`SELECT MAX("createdAt") as last_date FROM posts WHERE "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT });
                lastPostDate = postRes2?.last_date;
            } catch(e2) {}
        }
        try {
            const [forumRes] = await db.sequelize.query(`SELECT MAX("createdAt") as last_date FROM "ForumPosts" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT });
            lastForumDate = forumRes?.last_date;
        } catch(e) {}
        try {
            const [commentRes] = await db.sequelize.query(`SELECT MAX("createdAt") as last_date FROM "ForumComments" WHERE "PsychologistId" = :psiId OR "psychologistId" = :psiId`, { replacements: { psiId: psychologistId }, type: db.sequelize.QueryTypes.SELECT });
            lastCommentDate = commentRes?.last_date;
        } catch(e) {}

        const stats = {
            whatsappClicks,
            profileViews,
            matchImpressions,
            favoritesCount,
            funnelRates,
            topDemands,
            betterThanPercentage,
            xpHistory: xpHistoryResult, // <--- NOVO: Envia para o frontend
            lastInteractions: {
                blog: lastPostDate,
                forum: lastForumDate,
                comment: lastCommentDate
            },
            gamificationProgress: {
                blogPostCount,
                forumActivityCount: forumPostCount + forumCommentCount,
                answerCount,
                semeador: blogPostCount,
                vozAtiva: forumPostCount + forumCommentCount,
                conselheiro: answerCount
            },
            blogPostCount,
            forumActivityCount: forumPostCount + forumCommentCount,
            answerCount,
            blogLikes,
            forumPosts: forumPostCount,
            forumComments: forumCommentCount
        };

        console.timeEnd('⏱️ Psi Stats Load');
        res.json(stats);

    } catch (error) {
        console.error("Erro ao buscar KPIs do psicólogo:", error);
        // Retorna zerado em vez de erro 500 para não quebrar o dashboard
        res.json({ 
            whatsappClicks: 0, 
            profileViews: 0, 
            matchImpressions: 0, 
            favoritesCount: 0, 
            topDemands: [],
            funnelRates: { choiceRate: 'N/A', profileConversion: 'N/A', finalConversion: 'N/A' }
        });
    }
};

// ----------------------------------------------------------------------
// KPIs: Incremento de Métricas (WhatsApp e Aparições)
// ----------------------------------------------------------------------
exports.incrementWhatsappClick = async (req, res) => {
    try {
        const { slug } = req.params;
        const psychologist = await db.Psychologist.findOne({ where: { slug } });

        if (psychologist) {
            // --- GAMIFICATION: CLIQUE WHATSAPP (10 pts) ---
            gamificationService.processAction(psychologist.id, 'whatsapp_click').catch(e => console.error(e));

            // NOVO: Insere no Log para o Funil
            await db.sequelize.query(
                `INSERT INTO "WhatsappClickLogs" ("psychologistId", "createdAt", "updatedAt") VALUES (:id, NOW(), NOW())`,
                { replacements: { id: psychologist.id }, type: db.sequelize.QueryTypes.INSERT }
            ).catch(e => console.error("Erro ao inserir WhatsappClickLog:", e.message));
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao contabilizar clique WhatsApp:', error);
        // Não retorna erro 500 para não travar o front, apenas loga
        res.status(200).json({ success: false });
    }
};

exports.incrementProfileAppearance = async (req, res) => {
    try {
        const { id } = req.params;
        // Incrementa a coluna profile_appearances onde o ID corresponde
        await db.Psychologist.increment('profile_appearances', { where: { id } });
        
        // NOVO: Insere na tabela de logs para controle de período do dashboard
        await db.sequelize.query(
            `INSERT INTO "ProfileAppearanceLogs" ("psychologistId", "createdAt", "updatedAt") VALUES (:id, NOW(), NOW())`,
            { replacements: { id }, type: db.sequelize.QueryTypes.INSERT }
        ).catch(e => console.error("Erro ao inserir ProfileAppearanceLog:", e.message));

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao contabilizar aparição:', error);
        res.status(200).json({ success: false });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/psychologists/me/analytics (NOVA)
// Descrição: Busca dados agregados para a página de Métricas & Mercado.
// ----------------------------------------------------------------------
exports.getAnalyticsData = async (req, res) => {
    try {
        const psychologistId = req.psychologist.id;

        // --- 1. Price Comparison ---
        const psychologist = await db.Psychologist.findByPk(psychologistId);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const myPrice = psychologist.valor_sessao_numero || 0;

        const [cityAvgResult] = await db.sequelize.query(
            `SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE "cidade" = :city AND status = 'active' AND "valor_sessao_numero" > 0`,
            { replacements: { city: psychologist.cidade }, type: db.sequelize.QueryTypes.SELECT }
        );
        const cityAverage = parseFloat(cityAvgResult?.avg || 0);

        const [platformAvgResult] = await db.sequelize.query(
            `SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE status = 'active' AND "valor_sessao_numero" > 0`,
            { type: db.sequelize.QueryTypes.SELECT }
        );
        const platformAverage = parseFloat(platformAvgResult?.avg || 0);

        // --- 2. Top Topics ---
        const [topTopics] = await db.sequelize.query(`
            SELECT value as topic, COUNT(*) as count
            FROM "DemandSearches",
            jsonb_array_elements_text("searchParams"->'temas') as value
            WHERE "createdAt" >= NOW() - INTERVAL '30 days'
            AND jsonb_typeof("searchParams"->'temas') = 'array'
            GROUP BY value
            ORDER BY count DESC
            LIMIT 5;
        `);

        // --- 3. Visibility ---
        const [visibilityRaw] = await db.sequelize.query(`
            SELECT TO_CHAR(d.day, 'DD/MM') as label, COALESCE(COUNT(p.id), 0) as appearances
            FROM (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 days',
                    CURRENT_DATE,
                    '1 day'
                )::date AS day
            ) d
            LEFT JOIN "ProfileAppearanceLogs" p ON p."createdAt"::date = d.day AND p."psychologistId" = :psychologistId
            GROUP BY d.day
            ORDER BY d.day ASC;
        `, { replacements: { psychologistId } });
        
        const visibility = {
            labels: visibilityRaw.map(v => v.label),
            appearances: visibilityRaw.map(v => parseInt(v.appearances, 10))
        };

        // --- 4. Profile Strength (Simplified) ---
        const myReviews = await db.Review.findAll({ where: { psychologistId }, attributes: [[db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating']] });
        
        let myPostCount = 0;
        if (db.Post) {
            myPostCount = await db.Post.count({ where: { psychologistId } }).catch(async () => await db.Post.count({ where: { psychologist_id: psychologistId } }).catch(() => 0));
        }
        
        const myEngagement = psychologist.xp || 0;
        const myCompletion = (psychologist.badges && psychologist.badges.autentico) ? 10 : 5;
        const myAvgRating = parseFloat(myReviews[0]?.dataValues.avgRating || 0);

        const [platformStrength] = await db.sequelize.query(`
            SELECT
                AVG(xp) as avgEngagement,
                (SELECT AVG(rating) FROM "Reviews") as avgRating,
                (SELECT CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM "Psychologists" WHERE status='active') FROM posts) as avgPosts
            FROM "Psychologists" WHERE status = 'active'
        `);
        
        // --- NOVA LÓGICA: Calcular "Seu perfil está melhor que X% dos psicólogos" ---
        const [betterThanResult] = await db.sequelize.query(`
            SELECT 
                COALESCE(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active'), 0), 0) as percentage
            FROM "Psychologists" 
            WHERE status = 'active' AND xp < :myEngagement
        `, { replacements: { myEngagement }, type: db.sequelize.QueryTypes.SELECT });
        
        const betterThanPercentage = Math.round(parseFloat(betterThanResult?.percentage || 0));

        const normalize = (value, avg, max) => Math.min(10, Math.max(0, (value / (avg * 1.5 || max)) * 10));

        res.json({
            priceComparison: { myPrice, cityAverage, platformAverage },
            topTopics,
            visibility,
            betterThanPercentage,
            profileStrength: {
                myScores: [myCompletion, normalize(myAvgRating, parseFloat(platformStrength?.avgRating || 0), 5), normalize(myEngagement, parseFloat(platformStrength?.avgEngagement || 0), 5000), normalize(myPostCount, parseFloat(platformStrength?.avgPosts || 0), 10), 8],
                averageScores: [7, normalize(parseFloat(platformStrength?.avgRating || 0), parseFloat(platformStrength?.avgRating || 0), 5), normalize(parseFloat(platformStrength?.avgEngagement || 0), parseFloat(platformStrength?.avgEngagement || 0), 5000), normalize(parseFloat(platformStrength?.avgPosts || 0), parseFloat(platformStrength?.avgPosts || 0), 10), 7]
            }
        });

    } catch (error) {
        console.error("Erro ao buscar dados de analytics:", error);
        res.status(500).json({ error: 'Erro interno ao buscar dados de análise.' });
    }
};

/**
 * Busca todos os avisos e o status de leitura para o psicólogo logado.
 */
exports.getAnnouncements = async (req, res) => {
    try {
        const psychologistId = req.psychologist?.id || req.userDecoded?.id || req.user?.id;

        // Busca avisos globais e avisos direcionados especificamente a este psicólogo
        const avisos = await db.Aviso.findAll({
            where: { 
                status: 'published',
                [Op.or]: [{ psychologistId: null }, { psychologistId }]
            },
            order: [['createdAt', 'DESC']]
        });

        // Busca os IDs dos avisos que o psicólogo já leu
        const avisosLidos = await db.AvisoLido.findAll({
            where: { psychologistId },
            attributes: ['avisoId']
        });

        const lidosIds = new Set(avisosLidos.map(l => l.avisoId));

        // Mapeia os avisos adicionando o status 'read'
        const responseData = avisos.map(aviso => ({
            ...aviso.toJSON(),
            read: lidosIds.has(aviso.id)
        }));

        res.status(200).json(responseData);

    } catch (error) {
        console.error('Erro ao buscar avisos:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Marca um aviso como lido para o psicólogo logado.
 */
exports.markAnnouncementAsRead = async (req, res) => {
    try {
        const psychologistId = req.psychologist?.id || req.userDecoded?.id || req.user?.id;
        const { avisoId } = req.params;

        // Usa findOrCreate para evitar erro de constraint se já existir
        await db.AvisoLido.findOrCreate({ where: { psychologistId, avisoId } });

        res.status(200).json({ message: 'Aviso marcado como lido.' });
    } catch (error) {
        console.error('Erro ao marcar aviso como lido:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};