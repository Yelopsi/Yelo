// backend/controllers/qnaController.js

const db = require('../models');
const gamificationService = require('../services/gamificationService');

/**
 * Processa o envio de uma resposta de um psicólogo a uma pergunta da comunidade.
 */
exports.submitAnswer = async (req, res) => {
    const { questionId, content } = req.body;
    const psychologistId = req.user.id; // ID do psicólogo logado (obtido via token JWT)

    try {
        // 1. Cria a resposta no banco de dados
        const answer = await db.Answer.create({
            content,
            QuestionId: questionId,
            PsychologistId: psychologistId,
        });

        // 2. Busca a pergunta original para encontrar o paciente associado
        const question = await db.Question.findByPk(questionId, { include: db.Patient });

        // 3. LÓGICA DE VINCULAÇÃO CORRIGIDA
        if (question && question.Patient) {
            // VERIFICAÇÃO DE SEGURANÇA:
            // Só cria o vínculo se o paciente NÃO for o "Anônimo" genérico.
            // (O e-mail deve ser o mesmo usado pelo seu sistema para criar o placeholder)
            if (question.Patient.email !== 'anonimo@yelo.com.br' && question.Patient.nome !== 'Anônimo') {
                await db.PatientPsychologistLink.findOrCreate({
                    where: { PatientId: question.Patient.id, PsychologistId: psychologistId }
                });
            }
        }

        // 4. Adiciona pontos de gamificação pela resposta (lógica existente)
        await gamificationService.processAction(psychologistId, 'forum_reply');

        res.status(201).json(answer);
    } catch (error) {
        console.error("Erro ao submeter resposta:", error);
        res.status(500).json({ error: 'Falha ao salvar a resposta.' });
    }
};