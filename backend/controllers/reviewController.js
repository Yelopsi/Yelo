// Arquivo: backend/controllers/reviewController.js

const db = require('../models');

/**
 * @desc    Criar uma nova avaliação
 * @route   POST /api/reviews
 * @access  Privado (Apenas Pacientes)
 */
exports.createReview = async (req, res) => {
    try {
        // 1. O middleware 'protect' já nos deu o 'req.patient'
        const patient = req.patient;

        if (!patient) {
            return res.status(401).json({ error: 'Apenas pacientes logados podem deixar avaliações.' });
        }

        // 2. Pega os dados do corpo da requisição
        const { psychologistId, rating, comment } = req.body;

        if (!psychologistId || !rating) {
            return res.status(400).json({ error: 'ID do psicólogo e nota são obrigatórios.' });
        }

        // Opcional: Verificar se este paciente já avaliou este psicólogo
        const existingReview = await db.Review.findOne({
            where: {
                patientId: patient.id,
                psychologistId: psychologistId
            }
        });

        if (existingReview) {
            return res.status(409).json({ error: 'Você já avaliou este profissional.' });
        }

        // 3. Cria a avaliação no banco de dados
        const newReview = await db.Review.create({
            patientId: patient.id,
            psychologistId: psychologistId,
            rating: parseInt(rating, 10),
            comment: comment || null // Permite comentários vazios
        });

        res.status(201).json({ message: 'Avaliação criada com sucesso!', review: newReview });

    } catch (error) {
        console.error('Erro ao criar avaliação:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao salvar avaliação.' });
    }
};