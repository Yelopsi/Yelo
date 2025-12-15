// backend/controllers/adminSupportController.js
const { SupportMessage, Psychologist } = require('../models');
const { Sequelize } = require('sequelize');

// 1. Listar TODOS os psicólogos que têm chamados abertos
exports.getConversations = async (req, res) => {
    try {
        // Busca IDs distintos de psicólogos que têm mensagens na tabela de suporte
        const messages = await SupportMessage.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('psychologist_id')), 'psychologist_id']
            ],
            raw: true
        });

        const psiIds = messages.map(m => m.psychologist_id);

        if (psiIds.length === 0) {
            return res.json([]);
        }

        // Busca os dados desses psicólogos (Nome, Foto, Email)
        const psychologists = await Psychologist.findAll({
            where: { id: psiIds },
            attributes: ['id', 'nome', 'email', 'fotoUrl']
        });

        // Opcional: Você pode adicionar lógica aqui para contar mensagens não lidas
        // Por enquanto, retornamos a lista simples
        res.json(psychologists);

    } catch (error) {
        console.error('Erro Admin Support (Conversas):', error);
        res.status(500).json({ error: 'Erro ao buscar conversas' });
    }
};

// 2. Pegar mensagens de um Psicólogo específico
exports.getMessages = async (req, res) => {
    try {
        const { psiId } = req.params;

        const messages = await SupportMessage.findAll({
            where: { psychologist_id: psiId },
            order: [['created_at', 'ASC']]
        });

        // Formata para o frontend
        const formatted = messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            senderType: msg.sender_type, // 'admin' ou 'psychologist'
            createdAt: msg.created_at
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Erro Admin Support (Mensagens):', error);
        res.status(500).json({ error: 'Erro ao buscar chat' });
    }
};

// 3. Admin envia resposta
exports.replyMessage = async (req, res) => {
    try {
        const { psiId } = req.params;
        const { content } = req.body;

        if (!content) return res.status(400).json({ error: 'Mensagem vazia' });

        await SupportMessage.create({
            psychologist_id: psiId,
            sender_type: 'admin', // IMPORTANTE: Agora é o admin falando
            content: content,
            created_at: new Date(),
            is_read: false
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Erro Admin Support (Enviar):', error);
        res.status(500).json({ error: 'Erro ao enviar resposta' });
    }
};