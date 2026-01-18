const db = require('../models');
const { Op } = require('sequelize');

// --- ÁREA PÚBLICA (PACIENTE) ---

// 1. Paciente envia pergunta
exports.createQuestion = async (req, res) => {
    try {
        const { conteudo } = req.body;
        
        if (!conteudo || conteudo.length < 10) {
            return res.status(400).json({ error: "Conteúdo muito curto." });
        }

        let patient = await db.Patient.findOne({ where: { email: 'anonimo@yelopsi.com.br' } });
        if (!patient) {
            patient = await db.Patient.create({
                nome: "Anônimo",
                email: "anonimo@yelopsi.com.br",
                senha: "123",
                telefone: "00000000000"
            });
        }

        const newQ = await db.Question.create({
            title: "Dúvida da Comunidade",
            content: conteudo,
            status: "approved",
            PatientId: patient.id,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.json({ success: true, message: "Pergunta enviada com sucesso!", data: newQ });

    } catch (error) {
        console.error("Erro ao criar pergunta:", error);
        res.status(500).json({ error: "Erro interno ao salvar pergunta." });
    }
};

// 2. Listar perguntas para o público
exports.getPublicQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({
            include: [
                {
                    model: db.Answer,
                    as: 'answers',
                    required: false,
                    include: [
                        { 
                            model: db.Psychologist, 
                            as: 'psychologist', 
                            attributes: ['nome', 'fotoUrl', 'crp', 'slug'] 
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']],
            limit: 20
        });

        res.json(questions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao buscar perguntas." });
    }
};

// --- ÁREA PRIVADA (PSICÓLOGO) ---

exports.getQuestions = async (req, res) => {
    try {
        const userObj = req.psychologist || req.user;
        const psychologistId = userObj ? userObj.id : null;
        const { page = 1, limit = 15 } = req.query; // Adiciona paginação
        const offset = (page - 1) * limit;

        // 1. Busca lista negra
        const ignoredList = await db.QuestionIgnore.findAll({
            where: { psychologistId: psychologistId },
            attributes: ['questionId']
        });
        const ignoredIds = ignoredList.map(item => item.questionId);

        // 2. Otimização: Busca em duas etapas para evitar subqueries complexas do Sequelize
        // Etapa A: Encontra os IDs das perguntas corretas com paginação
        const questionIds = await db.Question.findAll({
            where: { id: { [Op.notIn]: ignoredIds } },
            attributes: ['id'],
            order: [['createdAt', 'DESC']],
            limit: parseInt(limit),
            offset: offset
        });

        if (questionIds.length === 0) {
            return res.json([]);
        }
        const idsToFetch = questionIds.map(q => q.id);

        // Etapa B: Busca os dados completos apenas para os IDs selecionados
        const questions = await db.Question.findAll({
            where: { id: { [Op.in]: idsToFetch } },
            include: [
                { model: db.Patient, required: false, attributes: ['nome'] },
                { model: db.Answer, as: 'answers', required: false,
                  include: [{ model: db.Psychologist, as: 'psychologist', required: false, attributes: ['nome', 'fotoUrl'] }]
                }
            ],
            order: [['createdAt', 'DESC']] // Reordena para garantir a consistência
        });

        // Formatação (mantém a lógica anterior)
        const formatted = questions.map(q => {
            const qJson = q.toJSON(); 
            return {
                id: q.id,
                titulo: q.title, // Mantido para compatibilidade, se necessário
                conteudo: q.content,
                Patient: qJson.Patient || { nome: "Anônimo" }, 
                createdAt: q.createdAt,
                status: q.status,
                respondedByMe: qJson.answers?.some(a => a.psychologistId === psychologistId) || false,
                answers: qJson.answers || []
            };
        });

        res.json(formatted);
    } catch (error) { res.status(500).json({ error: 'Erro interno.' }); }
};

exports.answerQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { conteudo } = req.body; 
        const psychologistId = req.psychologist.id; 

        const question = await db.Question.findByPk(id);
        if (!question) return res.status(404).json({ error: 'Pergunta não encontrada.' });
        
        await db.Answer.create({
            content: conteudo,
            questionId: id,
            psychologistId: psychologistId
        });
        
        if (question.status !== 'rejected') {
            question.status = 'answered';
            await question.save();
        }
        
        res.json({ success: true, message: 'Resposta enviada!' });

    } catch (error) {
        console.error('Erro ao responder:', error);
        res.status(500).json({ error: 'Erro ao salvar resposta.' });
    }
};

// --- ÁREA ADMIN (Adicionada para evitar crash no adminRoutes.js) ---

exports.getPendingQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({
            where: { status: 'pending_review' },
            order: [['createdAt', 'DESC']]
        });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Erro admin" });
    }
};

exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await db.Question.findAll({ order: [['createdAt', 'DESC']] });
        res.json(questions);
    } catch (error) {
        res.status(500).json({ error: "Erro admin" });
    }
};

exports.moderateQuestion = async (req, res) => {
    res.json({ success: true, message: "Função placeholder" });
};

exports.deleteQuestion = async (req, res) => {
    try {
        await db.Question.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao deletar" });
    }
};

exports.ignoreQuestion = async (req, res) => {
    try {
        await db.QuestionIgnore.create({
            questionId: req.params.id,
            psychologistId: req.psychologist.id
        });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erro ao ignorar." }); }
};