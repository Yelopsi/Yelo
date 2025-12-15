const db = require('../models');
// ADICIONE ESTA LINHA ABAIXO:
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');
const { findMatches } = require('../services/matchService'); // Importa o novo serviço de match

// ----------------------------------------------------------------------
// Função Auxiliar: Gera o Token JWT para Psicólogo
// ----------------------------------------------------------------------
const generateToken = (id) => {
    return jwt.sign({ id, type: 'psychologist' }, process.env.JWT_SECRET, {
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

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/register
// Rota: POST /api/psychologists/register (VERSÃO COM REATIVAÇÃO AUTOMÁTICA)
// ----------------------------------------------------------------------
exports.registerPsychologist = async (req, res) => {
    try {
        const {
            nome, email, senha, crp, documento,
            genero_identidade, valor_sessao_faixa, temas_atuacao,
            abordagens_tecnicas, praticas_vivencias, modalidade, cep
        } = req.body;

        // Validação Básica
        if (!nome || !email || !senha || !crp || !documento) {
            return res.status(400).json({ error: 'Nome, email, senha, CRP e Documento (CPF/CNPJ) são obrigatórios.' });
        }

        // --- 1. LÓGICA DE DETECÇÃO CPF vs CNPJ ---
        const docClean = documento.replace(/\D/g, ''); 
        let cpfToSave = null;
        let cnpjToSave = null;

        if (docClean.length === 11) {
            cpfToSave = documento; 
        } else if (docClean.length === 14) {
            cnpjToSave = documento;
        } else {
            return res.status(400).json({ error: 'Documento inválido. Deve ser CPF (11 dígitos) ou CNPJ (14 dígitos).' });
        }

        // --- 2. VERIFICAÇÃO INTELIGENTE (INCLUINDO EXCLUÍDOS) ---
        // Buscamos se já existe alguém com esses dados, MESMO SE ESTIVER DELETADO (paranoid: false)
        const checkConditions = [{ email }, { crp }];
        if (cpfToSave) checkConditions.push({ cpf: cpfToSave });
        if (cnpjToSave) checkConditions.push({ cnpj: cnpjToSave });

        const existingPsychologist = await db.Psychologist.findOne({
            where: { [Op.or]: checkConditions },
            paranoid: false // <--- O PULO DO GATO: Olha na lixeira também!
        });

        // Hash da nova senha (será usado tanto para criar quanto para reativar)
        const hashedPassword = await bcrypt.hash(senha, 10);

        // --- CENÁRIO A: USUÁRIO EXISTE ---
        if (existingPsychologist) {
            
            // Caso 1: Usuário está ATIVO (Não foi excluído) -> Erro de duplicidade
            if (!existingPsychologist.deletedAt) {
                if (existingPsychologist.email === email) return res.status(409).json({ error: 'Este email já está cadastrado.' });
                if (existingPsychologist.crp === crp) return res.status(409).json({ error: 'Este CRP já está cadastrado.' });
                return res.status(409).json({ error: 'Este documento (CPF/CNPJ) já está cadastrado.' });
            }

            // Caso 2: Usuário está NA LIXEIRA (Reativação)
            console.log(`[REATIVAÇÃO] Recuperando conta antiga: ${existingPsychologist.email}`);
            
            // Restaura o registro (remove o deletedAt)
            await existingPsychologist.restore();

            // Atualiza com os dados novos que a pessoa preencheu no formulário
            await existingPsychologist.update({
                nome, 
                email, // Atualiza o email caso ele esteja tentando voltar com um novo
                senha: hashedPassword, // Reseta a senha para a nova
                crp,
                cpf: cpfToSave,
                cnpj: cnpjToSave,
                status: 'pending', // Volta para aprovação/pendente
                genero_identidade,
                valor_sessao_faixa,
                temas_atuacao: temas_atuacao || [],
                abordagens_tecnicas: abordagens_tecnicas ? [abordagens_tecnicas] : [],
                praticas_vivencias: praticas_vivencias || [],
                modalidade,
                cep
            });

            return res.status(200).json({ 
                message: 'Sua conta antiga foi localizada e reativada com sucesso!', 
                userId: existingPsychologist.id,
                reactivated: true 
            });
        }

        // --- CENÁRIO B: NOVO USUÁRIO (Criação Normal) ---
        const newPsychologist = await db.Psychologist.create({
            nome, email, crp,
            cpf: cpfToSave,  
            cnpj: cnpjToSave,
            senha: hashedPassword,
            slug: generateSlug(nome),
            status: 'pending',
            subscription_expires_at: null,
            genero_identidade, 
            valor_sessao_faixa,
            temas_atuacao: temas_atuacao || [],
            abordagens_tecnicas: abordagens_tecnicas ? [abordagens_tecnicas] : [],
            praticas_vivencias: praticas_vivencias || [], 
            modalidade, 
            cep,
        });

        res.status(201).json({ message: 'Psicólogo cadastrado com sucesso!', userId: newPsychologist.id });

    } catch (error) {
        console.error('Erro ao registrar psicólogo:', error);
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
        
        const resetLink = `http://127.0.0.1:5500/redefinir_senha.html?token=${resetToken}&type=psychologist`;
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

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/login
// ----------------------------------------------------------------------
exports.loginPsychologist = async (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log(`[LOGIN_PSY] 1. Tentativa de login recebida para o e-mail: ${email}`);

        if (!email || !senha) {
            console.log(`[LOGIN_PSY] 2. Falha: E-mail ou senha não fornecidos na requisição.`);
            return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }

        const psychologist = await db.Psychologist.findOne({ where: { email: email } });

        if (!psychologist) {
            console.log(`[LOGIN_PSY] 2. Falha: Nenhum psicólogo encontrado com o e-mail ${email}.`);
            return res.status(401).json({ error: 'Email ou senha inválidos.' });
        }

        console.log(`[LOGIN_PSY] 2. Sucesso: Psicólogo ${email} encontrado. Comparando senhas...`);
        const isPasswordMatch = await bcrypt.compare(senha, psychologist.senha);

        if (isPasswordMatch) {
            console.log(`[LOGIN_PSY] 3. Sucesso: Senha correta para ${email}. Gerando token.`);
            res.status(200).json({
                id: psychologist.id,
                nome: psychologist.nome,
                email: psychologist.email,
                token: generateToken(psychologist.id)
            });
        } else {
            console.log(`[LOGIN_PSY] 3. Falha: Senha incorreta para o e-mail ${email}.`);
            res.status(401).json({ error: 'Email ou senha inválidos.' });
        }
    } catch (error) {
        console.error('Erro no login do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
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


// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me (VERSÃO DIAGNÓSTICO)
// ----------------------------------------------------------------------
exports.updatePsychologistProfile = async (req, res) => {
    try {
        console.log("\n--- [DEBUG] INICIANDO ATUALIZAÇÃO DE PERFIL ---");
        
        const psychologistToUpdate = await db.Psychologist.findByPk(req.psychologist.id);
        if (!psychologistToUpdate) return res.status(404).json({ error: 'Psi não encontrado.' });

        const body = req.body;

        // Verifica se o slug mudou e se já existe
        if (body.slug && body.slug !== psychologistToUpdate.slug) {
            const slugExists = await db.Psychologist.findOne({ where: { slug: body.slug } });
            if (slugExists) {
                return res.status(409).json({ error: 'Este link personalizado já está em uso.' });
            }
        }

        // --- ANÁLISE FORENSE DOS DADOS ---
        console.log("1. DADOS BRUTOS RECEBIDOS:", JSON.stringify(body, null, 2));

        const arrayFields = ['temas_atuacao', 'abordagens_tecnicas', 'praticas_vivencias', 'disponibilidade_periodo'];
        const stringFields = ['genero_identidade'];

        console.log("2. VERIFICAÇÃO DE TIPOS:");
        arrayFields.forEach(field => {
            const val = body[field];
            console.log(`   - ${field}: Valor="${val}" | Tipo=${typeof val} | É Array? ${Array.isArray(val)}`);
        });
        
        stringFields.forEach(field => {
            const val = body[field];
            console.log(`   - ${field}: Valor="${val}" | Tipo=${typeof val} | É Array? ${Array.isArray(val)}`);
        });

        // --- TENTATIVA DE CORREÇÃO AUTOMÁTICA (SANITIZAÇÃO) ---
        // Se o banco espera Array mas veio String, converte.
        const safeArrays = {};
        arrayFields.forEach(field => {
            let val = body[field];
            if (!val) {
                safeArrays[field] = [];
            } else if (Array.isArray(val)) {
                safeArrays[field] = val;
            } else if (typeof val === 'string') {
                // Se vier "Ansiedade,Depressão", vira ["Ansiedade", "Depressão"]
                safeArrays[field] = val.split(',').map(s => s.trim()).filter(s => s);
            } else {
                safeArrays[field] = [];
            }
        });

        console.log("3. DADOS SANITIZADOS (PARA O BANCO):", JSON.stringify(safeArrays, null, 2));

        // Atualiza
        const updatedPsychologist = await psychologistToUpdate.update({
            ...body, // Pega campos normais (nome, email...)
            ...safeArrays, // Sobrescreve com os arrays corrigidos
            slug: body.slug || psychologistToUpdate.slug // Garante que o slug seja salvo
        });

        console.log("--- [DEBUG] SUCESSO NA ATUALIZAÇÃO! ---\n");
        res.status(200).json({ message: 'Perfil atualizado!', psychologist: updatedPsychologist });

    } catch (error) {
        console.error("\n--- [DEBUG] ERRO FATAL NO SEQUELIZE ---");
        console.error("Mensagem:", error.message);
        console.error("Stack:", error.stack); 
        res.status(500).json({ error: 'Erro interno (ver logs).' });
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

// ----------------------------------------------------------------------
// Rota: PUT /api/psychologists/me/photo
// ----------------------------------------------------------------------
exports.updateProfilePhoto = async (req, res) => {
    try {
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado, psicólogo não identificado.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Nenhum arquivo de imagem foi enviado.' });
        }

        const fotoUrl = req.file.path;
        const psychologistToUpdate = await db.Psychologist.findByPk(req.psychologist.id);

        if (!psychologistToUpdate) {
            return res.status(404).json({ error: 'Psicólogo não encontrado no banco de dados.' });
        }

        await psychologistToUpdate.update({ fotoUrl });

        res.status(200).json({
            message: 'Foto de perfil atualizada com sucesso!',
            fotoUrl: fotoUrl 
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

        // --- PONTO CRÍTICO: CANCELAMENTO NO STRIPE ---
        if (psychologist.stripeSubscriptionId) {
            try {
                console.log(`[EXIT] Cancelando assinatura Stripe: ${psychologist.stripeSubscriptionId}`);
                await stripe.subscriptions.cancel(psychologist.stripeSubscriptionId);
            } catch (stripeError) {
                console.error("Erro ao cancelar no Stripe (prosseguindo com exclusão local):", stripeError);
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
            abordagem_desejada: patient.abordagem_desejada || [], // Agora o service sabe traduzir isso!
            genero_profissional: patient.genero_profissional,
            praticas_afirmativas: patient.praticas_afirmativas || [],
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
        // Chamamos o serviço centralizado.
        // Se precisar passar o ID do paciente para verificar favoritos, podemos alterar o service depois.
        const matchResult = await findMatches(patientPreferences);

        // Se houver lógica extra de favoritos (isFavorited), injetamos aqui:
        if (matchResult.results.length > 0) {
            // Exemplo rápido: checar se o ID do psi está na lista de favoritos do paciente
            // const favoritos = await db.Favorite.findAll({ where: { patientId: patient.id } });
            // const favIds = favoritos.map(f => f.psychologistId);
            // matchResult.results.forEach(r => r.isFavorited = favIds.includes(r.id));
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
            // O front manda "experiencia_desejada" (Texto longo), o Service vai traduzir
            abordagem_desejada: patientAnswers.experiencia_desejada || [],
            genero_profissional: patientAnswers.pref_genero_prof,
            // O front manda "caracteristicas_prof", mapeamos para praticas
            praticas_afirmativas: patientAnswers.caracteristicas_prof || [],
        };

        if (!patientPreferences.valor_sessao_faixa) {
             return res.status(400).json({ error: 'Faixa de valor é obrigatória.' });
        }

        // Reutiliza a MESMA lógica do usuário logado
        const matchResult = await findMatches(patientPreferences);

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
// Rota: GET /api/psychologists/slug/:slug (VERSÃO DIAGNÓSTICA)
// ----------------------------------------------------------------------
exports.getProfileBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`\n[DIAGNÓSTICO] Iniciando busca pelo perfil: "${slug}"`);

    // 1. Busca SOMENTE pelo slug primeiro (sem travas de status/data)
    // Isso nos diz se o link existe, independente de estar pago ou não.
    const psychologist = await db.Psychologist.findOne({
      where: { slug: { [Op.iLike]: slug } }, // Case insensitive
      attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires', 'cpf'] },
    });

    // Cenario 1: Slug errado (Link inexistente)
    if (!psychologist) {
      console.log(`❌ [DIAGNÓSTICO] Perfil não encontrado no banco de dados. Verifique se o slug está correto.`);
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    // Coleta dados para análise
    const hoje = new Date();
    const validade = psychologist.subscription_expires_at ? new Date(psychologist.subscription_expires_at) : null;
    const status = psychologist.status;
    const nome = psychologist.nome;

    console.log(`🔎 [DIAGNÓSTICO] Usuário encontrado: ${nome}`);
    console.log(`   - Status no Banco: ${status}`);
    console.log(`   - Validade do Pagamento: ${validade ? validade.toLocaleString() : 'NENHUMA (NULL)'}`);
    console.log(`   - Data de Hoje (Servidor): ${hoje.toLocaleString()}`);

    // Cenario 2: Falta de Pagamento (Data nula ou vencida)
    // Nota: Se validade for null, consideramos vencido.
    if (!validade || validade < hoje) {
        console.log(`🚫 [BLOQUEIO] O pagamento está vencido ou inexistente.`);
        return res.status(404).json({ error: 'Perfil indisponível (Assinatura inativa).' });
    }

    // Cenario 3: Status Pendente (Mesmo pago, está oculto?)
    if (status !== 'active') {
        console.log(`🚫 [BLOQUEIO] O status do usuário não é 'active'. Status atual: '${status}'.`);
        // Opcional: Se você quiser que o pagamento ative automaticamente, descomente a linha abaixo:
        // await psychologist.update({ status: 'active' }); 
        return res.status(404).json({ error: 'Perfil em análise.' });
    }

    // Se chegou aqui, está TUDO CERTO (Pago e Ativo)
    console.log(`✅ [SUCESSO] Perfil aprovado para exibição pública!`);

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

        // 1. AVISA O STRIPE
        if (psychologist.stripeSubscriptionId) {
            try {
                await stripe.subscriptions.update(psychologist.stripeSubscriptionId, {
                    cancel_at_period_end: true
                });
            } catch (stripeErr) {
                console.error("Erro Stripe:", stripeErr);
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

        if (!psychologist || !psychologist.stripeSubscriptionId) {
            return res.status(404).json({ error: 'Assinatura não encontrada para reativação.' });
        }

        // 2. Mágica do Stripe: "Não cancele mais no final do período"
        await stripe.subscriptions.update(psychologist.stripeSubscriptionId, {
            cancel_at_period_end: false,
        });

        // 3. Atualiza o banco local para o front saber que está tudo bem
        // Nota: Ajustamos para garantir que o status fique ativo e flags de cancelamento sejam limpas
        await psychologist.update({
            cancelAtPeriodEnd: false, // Certifique-se que sua tabela tem essa coluna, ou ignore se não tiver
            status: 'active'
        });

        res.status(200).json({ message: 'Assinatura reativada com sucesso! A renovação automática foi restaurada.' });

    } catch (error) {
        console.error('Erro ao reativar assinatura:', error);
        res.status(500).json({ error: 'Erro ao processar reativação no Stripe.' });
    }
};