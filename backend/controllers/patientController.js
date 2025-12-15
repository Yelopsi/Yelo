const db = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../services/emailService');

// ----------------------------------------------------------------------
// Função Auxiliar: Gera o Token JWT para Paciente
// ----------------------------------------------------------------------
const generateToken = (id) => {
    return jwt.sign({ id, type: 'patient' }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// ----------------------------------------------------------------------
// Rota: POST /api/patients/register
// DESCRIÇÃO: Registra um novo paciente.
// ----------------------------------------------------------------------
exports.registerPatient = async (req, res) => {
    try {
        const { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
        }

        const existingPatient = await db.Patient.findOne({ where: { email } });
        if (existingPatient) {
            return res.status(409).json({ error: 'Este email já está cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(senha, 10);

        const newPatient = await db.Patient.create({
            nome,
            email,
            senha: hashedPassword,
        });

        res.status(201).json({
            id: newPatient.id,
            nome: newPatient.nome,
            email: newPatient.email,
            token: generateToken(newPatient.id),
            message: 'Cadastro realizado com sucesso!',
        });
    } catch (error) {
        console.error('Erro ao registrar paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/patients/forgot-password
// DESCRIÇÃO: Inicia o processo de redefinição de senha.
// ----------------------------------------------------------------------
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const patient = await db.Patient.findOne({ where: { email } });

        if (!patient) {
            // Resposta genérica para não confirmar se um e-mail existe ou não
            return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição foi enviado.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        patient.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        patient.resetPasswordExpires = Date.now() + 3600000; // 1 hora

        await patient.save();

        const resetLink = `http://127.0.0.1:5500/redefinir_senha.html?token=${resetToken}&type=patient`;
        await sendPasswordResetEmail(patient, resetLink);

        res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de redefinição foi enviado.' });

    } catch (error) {
        console.error('Erro ao solicitar redefinição de senha:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/patients/reset-password/:token
// DESCRIÇÃO: Efetivamente redefine a senha.
// ----------------------------------------------------------------------
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const patient = await db.Patient.findOne({
            where: {
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { [db.Sequelize.Op.gt]: Date.now() }
            }
        });

        if (!patient) {
            return res.status(400).json({ error: 'Token de redefinição inválido ou expirado.' });
        }

        patient.senha = await bcrypt.hash(req.body.senha, 10);
        patient.resetPasswordToken = null;
        patient.resetPasswordExpires = null;
        await patient.save();

        res.status(200).json({ message: 'Senha redefinida com sucesso!' });

    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/patients/login
// DESCRIÇÃO: Autentica um paciente e retorna um token.
// ----------------------------------------------------------------------
exports.loginPatient = async (req, res) => {
    try {
        const { email, senha } = req.body;
        console.log(`[LOGIN_PAT] 1. Tentativa de login recebida para o e-mail: ${email}`);

        if (!email || !senha) {
            console.log(`[LOGIN_PAT] 2. Falha: E-mail ou senha não fornecidos na requisição.`);
            return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
        }

        const patient = await db.Patient.findOne({ where: { email } });

        if (!patient) {
            console.log(`[LOGIN_PAT] 2. Falha: Nenhum paciente encontrado com o e-mail ${email}.`);
            return res.status(401).json({ error: 'Email ou senha inválidos.' });
        }

        console.log(`[LOGIN_PAT] 2. Sucesso: Paciente ${email} encontrado. Comparando senhas...`);
        const isPasswordMatch = await bcrypt.compare(senha, patient.senha);

        if (isPasswordMatch) {
            console.log(`[LOGIN_PAT] 3. Sucesso: Senha correta para ${email}. Gerando token.`);
            res.status(200).json({
                id: patient.id,
                nome: patient.nome,
                email: patient.email,
                token: generateToken(patient.id),
            });
        } else {
            console.log(`[LOGIN_PAT] 3. Falha: Senha incorreta para o e-mail ${email}.`);
            res.status(401).json({ error: 'Email ou senha inválidos.' });
        }
    } catch (error) {
        console.error('Erro no login do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: GET /api/patients/me
// DESCRIÇÃO: Busca os dados do paciente logado.
// ----------------------------------------------------------------------
exports.getPatientData = async (req, res) => {
    // O middleware `protect` já anexa `req.patient`
    if (req.patient) {
        res.status(200).json(req.patient);
    } else {
        res.status(404).json({ error: 'Paciente não encontrado.' });
    }
};

// ----------------------------------------------------------------------
// Rota: PUT /api/patients/answers
// DESCRIÇÃO: Atualiza o perfil do paciente com as respostas do questionário.
// ----------------------------------------------------------------------
exports.updatePatientAnswers = async (req, res) => {
    try {
        const patient = req.patient;
        if (!patient) {
            return res.status(401).json({ error: 'Paciente não autenticado.' });
        }

        const {
            nome,
            idade,
            identidade_genero,
            pref_genero_prof,
            motivacao,
            temas,
            terapia_anterior,
            experiencia_desejada,
            caracteristicas_prof,
            valor_sessao_faixa,
            whatsapp,
            avaliacao_ux
        } = req.body;

        await patient.update({
            nome: nome || patient.nome,
            faixa_etaria: idade,
            identidade_genero: identidade_genero,
            genero_profissional: pref_genero_prof,
            // Os campos 'motivacao', 'terapia_anterior' e 'avaliacao_ux' não existem no modelo Patient, então são ignorados.
            temas_buscados: temas,
            abordagem_desejada: experiencia_desejada,
            praticas_afirmativas: caracteristicas_prof,
            valor_sessao_faixa,
            telefone: whatsapp,
        });

        res.status(200).json({ message: 'Respostas salvas com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar respostas do questionário:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// As funções abaixo são placeholders para as rotas que você já criou.
// Elas podem ser implementadas posteriormente.
// ----------------------------------------------------------------------

exports.updatePatientDetails = async (req, res) => {
    try {
        const patient = req.patient;
        const { nome, email } = req.body;

        if (!nome || !email) {
            return res.status(400).json({ error: 'Nome e email são obrigatórios.' });
        }

        // Verifica se o novo email já está em uso por outro paciente
        if (email.toLowerCase() !== patient.email.toLowerCase()) {
            const existingEmail = await db.Patient.findOne({ where: { email } });
            if (existingEmail) {
                return res.status(409).json({ error: 'Este email já está em uso por outra conta.' });
            }
        }

        // Atualiza os dados no banco
        patient.nome = nome;
        patient.email = email;
        await patient.save();

        res.status(200).json({ 
            message: 'Dados atualizados com sucesso!',
            patient: {
                id: patient.id,
                nome: patient.nome,
                email: patient.email
            }
        });

    } catch (error) {
        console.error('Erro ao atualizar detalhes do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.getPatientReviews = async (req, res) => {
    try {
        const reviews = await db.Review.findAll({
            where: { patientId: req.patient.id },
            include: {
                model: db.Psychologist,
                as: 'psychologist',
                attributes: ['nome', 'fotoUrl']
            },
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(reviews);
    } catch (error) {
        console.error('Erro ao buscar avaliações do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.getFavorites = async (req, res) => {
    try {
        const patient = await db.Patient.findByPk(req.patient.id, {
            include: {
                model: db.Psychologist,
                as: 'favorites',
                attributes: ['id', 'nome', 'crp', 'fotoUrl'],
                through: { attributes: [] } // Não traz a tabela de junção
            }
        });
        res.status(200).json(patient.favorites);
    } catch (error) {
        console.error('Erro ao buscar favoritos:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.toggleFavorite = async (req, res) => {
    try {
        const { psychologistId } = req.body;
        const patient = req.patient;
        const psychologist = await db.Psychologist.findByPk(psychologistId);

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const isFavorited = await patient.hasFavorite(psychologist);

        if (isFavorited) {
            await patient.removeFavorite(psychologist);
            res.status(200).json({ message: 'Profissional removido dos favoritos.', favorited: false });
        } else {
            await patient.addFavorite(psychologist);
            res.status(200).json({ message: 'Profissional adicionado aos favoritos!', favorited: true });
        }
    } catch (error) {
        console.error('Erro ao alternar favorito:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.updatePatientPassword = async (req, res) => {
    try {
        const { senha_atual, nova_senha } = req.body;

        if (!senha_atual || !nova_senha) {
            return res.status(400).json({ error: 'Todos os campos de senha são obrigatórios.' });
        }

        // Busca o paciente novamente para ter acesso ao hash da senha
        const patientWithPassword = await db.Patient.findByPk(req.patient.id);

        const isMatch = await bcrypt.compare(senha_atual, patientWithPassword.senha);
        if (!isMatch) {
            return res.status(401).json({ error: 'A senha atual está incorreta.' });
        }

        patientWithPassword.senha = await bcrypt.hash(nova_senha, 10);
        await patientWithPassword.save();

        res.status(200).json({ message: 'Senha alterada com sucesso!' });
    } catch (error) {
        console.error('Erro ao alterar senha do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.deletePatientAccount = async (req, res) => {
    try {
        const { senha } = req.body;

        if (!senha) {
            return res.status(400).json({ error: 'A senha é obrigatória para excluir a conta.' });
        }

        const patientWithPassword = await db.Patient.findByPk(req.patient.id);
        const isMatch = await bcrypt.compare(senha, patientWithPassword.senha);
        if (!isMatch) {
            return res.status(401).json({ error: 'Senha incorreta. A conta não foi excluída.' });
        }

        await patientWithPassword.destroy();
        res.status(200).json({ message: 'Sua conta foi excluída com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir conta do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};
