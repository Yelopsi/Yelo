const db = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');
const path = require('path');
const fs = require('fs').promises;
const gamificationService = require('../services/gamificationService'); // Importa o serviço
const { verifyGoogleToken } = require('./authController');

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
        const crp = req.body.crp;
        // REVERTIDO: Volta a ler apenas o CPF
        const cpf = req.body.cpf || req.body.documento;
        const { googleToken } = req.body;

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
        if (!crp) return res.status(400).json({ error: 'O CRP é obrigatório.' });
        if (!cpf) return res.status(400).json({ error: 'O CPF é obrigatório.' });

        // --- 2. Validação de Formato e Comprimento ---
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return res.status(400).json({ error: 'Formato de e-mail inválido.' });
        if (passwordInput.length < 6) return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });

        // REVERTIDO: Limpeza simples de CPF
        const cleanCpf = cpf.replace(/\D/g, '');

        // --- 3. VERIFICAÇÃO DE DUPLICIDADE ---
        const existingUser = await db.Psychologist.findOne({
            where: {
                [Op.or]: [
                    { email: email },
                    { crp: crp },
                    { cpf: cleanCpf }
                ]
            }
        });

        if (existingUser) {
            if (existingUser.email === email) return res.status(400).json({ error: 'E-mail já cadastrado.' });
            if (existingUser.crp === crp) return res.status(400).json({ error: 'CRP já cadastrado.' });
            if (existingUser.cpf === cleanCpf) return res.status(400).json({ error: 'CPF já cadastrado.' });
        }

        // [RESTRIÇÃO] Verifica se já existe como Paciente
        const existingPatient = await db.Patient.findOne({ where: { email } });
        if (existingPatient) {
            return res.status(400).json({ error: 'Este e-mail já está em uso por uma conta de Paciente.' });
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

        // --- 6. CRIAÇÃO NO BANCO (USANDO COLUNAS REAIS) ---
        const newPsychologist = await db.Psychologist.create({
            nome,
            email,
            senha: hashedPassword,
            crp,
            slug: generatedSlug,
            status: 'active',
            cpf: cleanCpf // Salva na coluna CPF
        });

        // --- 7. Token ---
        const token = generateToken(newPsychologist.id);

        // --- 8. E-mail de Boas-vindas ---
        await sendWelcomeEmail(newPsychologist, 'psychologist');

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
        await db.SystemLog.create({
            level: 'error',
            message: `Erro no registro de Psicólogo: ${error.message}`
        });
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({ error: 'Dados duplicados (E-mail, CRP ou Documento).' });
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
        let psychologist = await db.Psychologist.findOne({ where: { email } });
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

        // --- FIX: Permite login de ativos E criadores de conteúdo ---
        if (psychologist.status !== 'active' && psychologist.status !== 'content_creator') {
            return res.status(403).json({ error: 'Esta conta está inativa.' });
        }

        // 4. Define o tipo de token e redirecionamento se for Admin
        if (psychologist.isAdmin) {
            userType = 'admin';
            redirectUrl = '/admin/admin.html';
        }

        const token = generateToken(psychologist.id, userType);

        // --- GAMIFICATION: LOGIN DIÁRIO (1 pt) ---
        if (userType === 'psychologist') {
            gamificationService.processAction(psychologist.id, 'login').catch(e => console.error(e));
        }

        res.json({
            id: psychologist.id,
            nome: psychologist.nome,
            email: psychologist.email,
            slug: psychologist.slug,
            fotoUrl: psychologist.fotoUrl,
            is_exempt: psychologist.is_exempt, // Retorna flag VIP no login
            token: token,
            redirect: redirectUrl, // Frontend deve usar isso para navegar
            type: userType
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
        const psychologist = await db.Psychologist.findOne({ where: { email } });

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
                resetPasswordExpires: { [db.Sequelize.Op.gt]: Date.now() }
            }
        });

        if (!psychologist) {
            return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
        }

        // Se o token for válido, atualiza a senha
        psychologist.senha = await bcrypt.hash(req.body.nova_senha, 10);
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

// ==============================================================================
// ALGORITMO DE MATCH (INTELIGÊNCIA YELO)
// ==============================================================================
async function calculateMatches(preferences) {
    const {
        valor_sessao_faixa,
        temas_buscados = [],
        estilo_desejado = [], // Antigo 'abordagem_desejada' / 'experiencia_desejada'
        genero_profissional,
        praticas_desejadas = [], // Antigo 'praticas_afirmativas' / 'caracteristicas_prof'
        idade_paciente,
        modalidade_preferida
    } = preferences;

    // 1. Busca todos os psicólogos ativos
    const candidates = await db.Psychologist.findAll({
        where: { status: 'active' },
        attributes: { exclude: ['senha', 'resetPasswordToken'] }
    });

    const { min, max } = parsePriceRange(valor_sessao_faixa);

    // 2. Pontuação e Filtragem
    const scoredCandidates = candidates.map(psi => {
        let score = 0;
        let details = [];
        let isViable = true;

        // A. FILTRO RÍGIDO: Modalidade (Se o paciente escolheu Online, o Psi tem que atender Online)
        // Se modalidade_preferida for indefinido, assume que aceita tudo.
        if (modalidade_preferida && modalidade_preferida !== 'Indiferente') {
            const psiMods = Array.isArray(psi.modalidade) ? psi.modalidade : [];
            if (!psiMods.includes(modalidade_preferida) && !psiMods.includes('Indiferente')) {
                // Penalidade leve em vez de exclusão total para não zerar resultados
                score -= 50; 
            }
        }

        // B. PREÇO (Peso: 20)
        const psiPrice = psi.valor_sessao_numero || 0;
        if (psiPrice >= min && psiPrice <= max) {
            score += 20;
            details.push("Dentro do orçamento");
        } else if (psiPrice < min) {
            score += 20; // Mais barato também serve
            details.push("Valor acessível");
        } else if (psiPrice < max * 1.3) {
            score += 10; // Até 30% acima do orçamento ganha alguns pontos
        }

        // C. TEMAS (Peso: 25)
        const psiTemas = psi.temas_atuacao || [];
        const commonTemas = temas_buscados.filter(t => psiTemas.includes(t));
        if (commonTemas.length > 0) {
            score += 25;
            details.push(`Especialista em ${commonTemas[0]}`);
        }

        // D. IDENTIDADE E PRÁTICAS (Peso: 30 - O "Fit" Cultural)
        const psiPraticas = psi.praticas_inclusivas || [];
        const commonPraticas = praticas_desejadas.filter(p => psiPraticas.includes(p));
        if (commonPraticas.length > 0) {
            score += 30;
            details.push("Identidade compatível");
        }

        // E. ESTILO DE TERAPIA (Peso: 15)
        const psiEstilo = psi.estilo_terapia || [];
        const commonEstilo = estilo_desejado.filter(e => psiEstilo.includes(e));
        if (commonEstilo.length > 0) {
            score += 15;
            details.push("Estilo alinhado");
        }

        // F. GÊNERO (Peso: 10)
        if (genero_profissional && genero_profissional !== 'Indiferente') {
            if (psi.genero_identidade === genero_profissional) score += 10;
        } else {
            score += 10;
        }

        return {
            ...psi.toJSON(),
            matchScore: Math.max(0, Math.min(score, 99)), // Garante entre 0 e 99
            matchDetails: details
        };
    });

    // 3. Ordenação e Retorno
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
    const topResults = scoredCandidates.slice(0, 3); // Top 3
    const matchTier = topResults.length > 0 && topResults[0].matchScore > 75 ? 'ideal' : 'near';

    return { matchTier, results: topResults };
}

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

        res.status(200).json(psychologist);

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
        const { nome, email, crp, genero_identidade, valor_sessao_faixa, temas_atuacao, praticas_afirmativas, abordagens_tecnicas } = req.body;

        // Validação básica dos dados recebidos
        if (!email || !crp || !genero_identidade || !valor_sessao_faixa || !temas_atuacao || !praticas_afirmativas) {
            return res.status(400).json({ error: 'Dados insuficientes para verificar a demanda.' });
        }

        // --- LÓGICA DE VERIFICAÇÃO DE DEMANDA (CORRIGIDA) ---
        const DEMAND_TARGET = 0; 
        const { min: psyMinPrice, max: psyMaxPrice } = parsePriceRange(valor_sessao_faixa);

        // 2. Define a cláusula para buscar PACIENTES compatíveis
        const whereClause = {
            valor_sessao_faixa: { [Op.ne]: null }, 
            temas_buscados: {
                [Op.overlap]: temas_atuacao
            },
            genero_profissional: {
                [Op.or]: [genero_identidade, 'Indiferente']
            }
        };

        // 3. Conta quantos pacientes existem com essas preferências
        const count = await db.Patient.count({ where: whereClause });

        console.log(`[CHECK DEMAND] Nicho verificado. Pacientes encontrados: ${count}. Alvo: ${DEMAND_TARGET}.`);

        if (count >= DEMAND_TARGET) {
            res.status(200).json({ status: 'approved', message: 'Há demanda para este perfil.' });
        } else {
            res.status(200).json({ status: 'waitlisted', message: 'Perfil adicionado à lista de espera.' });
        }
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
        const { nome, email, crp, genero_identidade, valor_sessao_faixa, temas_atuacao, praticas_afirmativas, abordagens_tecnicas } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'O e-mail é obrigatório para entrar na lista de espera.' });
        }

        const [waitlistEntry, created] = await db.WaitingList.findOrCreate({
            where: { email },
            defaults: {
                nome,
                email,
                crp,
                genero_identidade,
                valor_sessao_faixa,
                temas_atuacao,
                praticas_afirmativas,
                abordagens_tecnicas,
                status: 'pending'
            }
        });

        console.log(`[WAITLIST] E-mail ${email} ${created ? 'adicionado' : 'já estava'} na lista de espera.`);
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
            linkedin_url, instagram_url, facebook_url, tiktok_url, x_url,
            slug // <--- AGORA ESTAMOS LENDO O CAMPO SLUG QUE VEM DO FORMULÁRIO
        } = req.body;

        // --- CORREÇÃO ROBUSTA DE ARRAYS ---
        // Garante que qualquer campo que deva ser array, SEJA array, mesmo se vier como string JSON.
        const parseArrayField = (fieldValue) => {
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
        await psychologist.update({
            slug: finalSlug,
            nome, telefone, bio, crp, cep, cidade, estado,
            valor_sessao_numero: valor_sessao_numero ? parseFloat(valor_sessao_numero) : null,
            genero_identidade,
            linkedin_url, instagram_url, facebook_url, tiktok_url, x_url,
            
            // Passamos os Arrays JS diretamente. O Sequelize fará a serialização correta para JSONB.
            temas_atuacao, 
            abordagens_tecnicas, 
            modalidade, 
            publico_alvo, 
            estilo_terapia, 
            praticas_inclusivas, 
            disponibilidade_periodo
        });

        // --- GAMIFICATION HOOK (BADGE AUTÊNTICO) ---
        // Recarrega o objeto para garantir que a verificação use os dados mais recentes do banco
        await psychologist.reload();
        await checkProfileCompletionLocal(psychologist);

        res.json({
            id: psychologist.id,
            slug: finalSlug, // Retorna o novo slug para atualizar a tela
            nome: psychologist.nome,
            email: psychologist.email,
            modalidade: psychologist.modalidade,
            fotoUrl: psychologist.fotoUrl
        });

    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        console.error('Detalhes do erro (Message):', error.message);
        if (error.name === 'SequelizeUniqueConstraintError') {
             return res.status(400).json({ error: 'Dados duplicados (Link ou CRP já existem).' });
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
            where: { id: waitingListId, status: 'pending' }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidato não encontrado ou já convidado.' });
        }

        const invitationToken = crypto.randomBytes(32).toString('hex');
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7); // Expira em 7 dias

        await candidate.update({
            status: 'invited',
            invitationToken: invitationToken,
            invitationExpiresAt: expirationDate,
        });

        const invitationLink = `http://127.0.0.1:5500/psi_registro.html?token=${invitationToken}&email=${candidate.email}`;
        await require('../services/emailService').sendInvitationEmail(candidate, invitationLink); // Placeholder

        res.status(200).json({ message: `Convite enviado com sucesso para ${candidate.email}.` });
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
        await psychologistToUpdate.reload();
        await checkProfileCompletionLocal(psychologistToUpdate);

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
        const matchResult = await calculateMatches(patientPreferences);

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
        const matchResult = await calculateMatches(patientPreferences);

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
            limit: 4, 
            attributes: ['id', 'nome', 'fotoUrl'] 
        });

        while (psychologists.length < 4) {
            psychologists.push({
                id: 0,
                nome: "Em breve",
                fotoUrl: "https://images.pexels.com/photos/3769021/pexels-photo-3769021.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
            });
        }

        res.status(200).json(psychologists);
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
    const validade = psychologist.subscription_expires_at ? new Date(psychologist.subscription_expires_at) : null;
    const status = psychologist.status;

    // Log para você saber a saúde do perfil
    console.log(`🔎 Status: ${status} | Validade: ${validade ? validade.toLocaleDateString() : 'NENHUMA'}`);

    /* // --- BLOQUEIO ORIGINAL (Desativado temporariamente) ---
    if (!validade || validade < hoje) {
        console.log(`🚫 [BLOQUEIO IGNORADO] Pagamento vencido, mas liberado para DEV.`);
        // return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
    }

    if (status !== 'active') {
        console.log(`🚫 [BLOQUEIO IGNORADO] Status pendente, mas liberado para DEV.`);
        // return res.status(404).json({ error: 'Perfil em análise.' });
    }
    */
   
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

        // 1. AVISA O ASAAS (Soft Cancel: Define data de fim para não renovar)
        if (psychologist.stripeSubscriptionId) {
            try {
                // Busca dados da assinatura para saber o vencimento
                const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.stripeSubscriptionId}`, {
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                const subData = await subResponse.json();

                if (subData.id && subData.nextDueDate) {
                    // Atualiza a assinatura definindo o fim para a próxima cobrança
                    await fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.stripeSubscriptionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                        body: JSON.stringify({ endDate: subData.nextDueDate })
                    });
                }

            } catch (asaasErr) {
                console.error("Erro Asaas:", asaasErr);
            }
        }

        // 2. ATUALIZA O BANCO LOCAL (Agora temos o campo certo!)
        await psychologist.update({
            cancelAtPeriodEnd: true // <--- Isso vai mudar o visual no Dashboard
        });

        res.json({ message: 'Renovação cancelada. Acesso mantido até o fim do ciclo.' });

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

        if (!psychologist.stripeSubscriptionId) {
             return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });
        }

        // 1. Tenta remover a data de fim no Asaas (Reativar recorrência)
        const response = await fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.stripeSubscriptionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify({ endDate: null }) // null remove a data de encerramento
        });

        const data = await response.json();

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
        const { period } = req.query; 

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

        // --- OTIMIZAÇÃO: PARALELISMO (Promise.all) ---
        // Executa todas as contagens ao mesmo tempo
        const [
            clicksResult,
            appearancesResult,
            favoritesResult,
            demandsResult,
            xpHistoryResult // <--- NOVO: Resultado do histórico de XP
        ] = await Promise.all([
            // 1. Cliques no WhatsApp (Tabela de Logs)
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "psychologistId" = :psiId ${dateCondition}`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => [{ count: 0 }]),

            // 2. Aparições no Perfil (Tabela de Logs)
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :psiId ${dateCondition}`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => [{ count: 0 }]),

            // 3. Favoritos (Tabela de Associação)
            // Nota: Verifica se a tabela existe para não quebrar
            // CORREÇÃO: A contagem de favoritos é um total, não por período.
            db.sequelize.query(
                `SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "PsychologistId" = :psiId`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => { console.error("KPI Error (Favorites):", err.message); return [{ count: 0 }]; }),

            // 4. Demandas (Tendências Gerais)
            // Busca as últimas 100 buscas concluídas para calcular tendências
            db.sequelize.query(
                `SELECT "searchParams" FROM "DemandSearches" WHERE status = 'completed' ${dateCondition} ORDER BY "createdAt" DESC LIMIT 100`,
                { type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => []),

            // 5. Histórico de XP (Agrupado por dia)
            db.sequelize.query(
                `SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, SUM("points") as points
                 FROM "GamificationLogs"
                 WHERE "psychologistId" = :psiId ${dateCondition}
                 GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
                 ORDER BY date ASC`,
                { replacements, type: db.sequelize.QueryTypes.SELECT }
            ).catch(err => [])
        ]);

        // Processamento das Demandas (Em memória, pois JSON é complexo de agregar no SQL puro de forma portável)
        const demandCounts = {};
        let totalDemands = 0;
        
        if (demandsResult) {
            demandsResult.forEach(row => {
                const params = row.searchParams || {};
                let temas = params.temas;
                
                // Tratamento para string JSON
                if (typeof temas === 'string') {
                    try { temas = JSON.parse(temas); } catch(e) {}
                }
                
                if (Array.isArray(temas)) {
                    temas.forEach(t => {
                        demandCounts[t] = (demandCounts[t] || 0) + 1;
                        totalDemands++;
                    });
                }
            });
        }

        // Top 3 Demandas
        const topDemands = Object.entries(demandCounts)
            .map(([name, count]) => ({ 
                name, 
                count, 
                percentage: totalDemands > 0 ? Math.round((count / totalDemands) * 100) : 0 
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);

        const stats = {
            whatsappClicks: parseInt(clicksResult[0]?.count || 0, 10),
            profileAppearances: parseInt(appearancesResult[0]?.count || 0, 10),
            favoritesCount: parseInt(favoritesResult[0]?.count || 0, 10),
            topDemands,
            xpHistory: xpHistoryResult // <--- NOVO: Envia para o frontend
        };

        console.timeEnd('⏱️ Psi Stats Load');
        res.json(stats);

    } catch (error) {
        console.error("Erro ao buscar KPIs do psicólogo:", error);
        // Retorna zerado em vez de erro 500 para não quebrar o dashboard
        res.json({ whatsappClicks: 0, profileAppearances: 0, favoritesCount: 0, topDemands: [] });
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
        }

        // A contagem de cliques agora é feita pela tabela de logs (WhatsappClickLogs),
        // então o incremento direto na tabela de psicólogos não é mais necessário.
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao contabilizar clique WhatsApp:', error);
        // Não retorna erro 500 para não travar o front, apenas loga
        res.status(200).json({ success: false });
    }
};

// ----------------------------------------------------------------------
// FUNÇÃO AUXILIAR: VERIFICAÇÃO DE PERFIL COMPLETO (BADGE AUTÊNTICO)
// ----------------------------------------------------------------------
async function checkProfileCompletionLocal(psychologist) {
    try {
        // Critérios: Todos os campos obrigatórios preenchidos
        // EXCEÇÕES: Razão Social, Redes Sociais (LinkedIn, Instagram, etc)
        const requiredFields = [
            'nome', 'bio', 'crp', 'telefone', 'cep', 'cidade', 'estado', 
            'fotoUrl', 'valor_sessao_numero', 'genero_identidade'
        ];
        const requiredArrays = [
            'temas_atuacao', 'abordagens_tecnicas', 'modalidade', 
            'publico_alvo', 'estilo_terapia', 'praticas_inclusivas', 
            'disponibilidade_periodo'
        ];

        let isComplete = true;

        // 1. Verifica campos de texto/número
        for (const field of requiredFields) {
            const value = psychologist[field];
            // Rejeita null, undefined e strings vazias, mas permite o número 0.
            if (value == null || (typeof value === 'string' && value.trim() === '')) {
                isComplete = false;
                // Log para depuração no servidor
                console.log(`[VERIFICAÇÃO BADGE AUTÊNTICO] Falha no campo obrigatório: '${field}' está vazio.`);
                break;
            }
        }

        // 2. Verifica arrays (apenas se passou na fase 1)
        if (isComplete) {
            for (const field of requiredArrays) {
                const val = psychologist[field];
                if (!val || !Array.isArray(val) || val.length === 0) {
                    isComplete = false;
                    break;
                }
            }
        }

        // 3. Atualiza Badge e XP
        // Clona o objeto de badges para garantir detecção de mudança pelo Sequelize
        let currentBadges = psychologist.badges ? JSON.parse(JSON.stringify(psychologist.badges)) : {};
        let changed = false;

        if (isComplete && !currentBadges.autentico) {
            currentBadges.autentico = true;
            psychologist.xp = (psychologist.xp || 0) + 500; // +500 XP
            changed = true;
        } else if (!isComplete && currentBadges.autentico) {
            delete currentBadges.autentico; // Remove se apagar info obrigatória
            changed = true;
        }

        if (changed) {
            await psychologist.update({ badges: currentBadges, xp: psychologist.xp });
        }
    } catch (error) {
        console.error("Erro na verificação local de perfil:", error);
    }
}

exports.incrementProfileAppearance = async (req, res) => {
    try {
        const { id } = req.params;
        // Incrementa a coluna profile_appearances onde o ID corresponde
        await db.Psychologist.increment('profile_appearances', { where: { id } });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao contabilizar aparição:', error);
        res.status(200).json({ success: false });
    }
};