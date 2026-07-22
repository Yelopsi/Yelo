const db = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

// Variável e Promessa para garantir que a tabela seja sincronizada uma única vez sem conflitos
let isTableSynced = false;
let syncPromise = null;

const ensureTableExists = async () => {
    if (!isTableSynced && db.WhatsAppClickLog) {
        if (!syncPromise) {
            syncPromise = db.WhatsAppClickLog.sync({ alter: true })
                .then(() => { isTableSynced = true; })
                .catch(err => console.error('Erro no sync da WhatsAppClickLog:', err));
        }
        await syncPromise;
    }
};

// 1. Registra o clique vindo da página pública do psicólogo
exports.registerClick = async (req, res) => {
    try {
        await ensureTableExists();
        const { psychologistId, guestName, utmSource } = req.body;

        if (!psychologistId) {
            return res.status(400).json({ error: 'psychologistId é obrigatório.' });
        }

        const clickLog = await db.WhatsAppClickLog.create({
            psychologistId,
            guestName: guestName || 'um paciente',
            utmSource: utmSource || null,
            feedbackGiven: false,
            feedbackToken: uuidv4()
        });

        res.status(201).json(clickLog);
    } catch (error) {
        console.error('Erro ao registrar clique do WhatsApp:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// 2. Busca se há algum feedback pendente para o psicólogo logado
exports.getPendingFeedback = async (req, res) => {
    try {
        await ensureTableExists();
        
        // Pega o ID de forma robusta, dependendo do middleware utilizado
        const psychologistId = req.psychologist?.id || req.user?.id || req.userDecoded?.id; 
        if (!psychologistId) {
            return res.status(401).json({ error: 'Usuário não autenticado no getPendingFeedback.' });
        }
        // Time gate: só mostra cliques com mais de 24 horas
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // Busca TODOS os cliques pendentes (mais antigos que 24h)
        const pendingClicks = await db.WhatsAppClickLog.findAll({
            where: {
                psychologistId,
                feedbackGiven: false,
                createdAt: {
                    [Op.lt]: twentyFourHoursAgo
                }
            },
            order: [['createdAt', 'ASC']]
        });

        if (pendingClicks && pendingClicks.length > 0) {
            res.status(200).json({ pending: pendingClicks });
        } else {
            res.status(200).json({ pending: [] });
        }
    } catch (error) {
        console.error('❌ ERRO NO FEEDBACK PENDENTE:', error);
        res.status(500).json({ error: 'Erro interno no servidor.', details: error.message });
    }
};

// 3. Salva a resposta do psicólogo preenchida no modal
exports.submitFeedback = async (req, res) => {
    try {
        await ensureTableExists();
        
        const psychologistId = req.psychologist?.id || req.user?.id || req.userDecoded?.id;
        if (!psychologistId) {
            return res.status(401).json({ error: 'Usuário não autenticado no submitFeedback.' });
        }
        
        const { clickLogId, contact_received, deal_closed } = req.body;

        const clickLog = await db.WhatsAppClickLog.findOne({
            where: { id: clickLogId, psychologistId }
        });

        if (!clickLog) {
            return res.status(404).json({ error: 'Registro de clique não encontrado.' });
        }

        // Salva as respostas vindas do frontend e marca como respondido
        clickLog.contactReceived = contact_received;
        clickLog.dealClosed = deal_closed;
        clickLog.feedbackGiven = true;
        
        await clickLog.save();

        res.status(200).json({ message: 'Feedback salvo com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar feedback:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// 4. Busca histórico completo de cliques e feedbacks para o psicólogo logado
exports.getContactHistory = async (req, res) => {
    try {
        await ensureTableExists();
        
        const psychologistId = req.psychologist?.id || req.user?.id || req.userDecoded?.id;
        if (!psychologistId) {
            return res.status(401).json({ error: 'Usuário não autenticado no getContactHistory.' });
        }
        
        const history = await db.WhatsAppClickLog.findAll({
            where: { psychologistId },
            order: [['createdAt', 'DESC']],
            attributes: ['id', 'guestName', 'feedbackGiven', 'contactReceived', 'dealClosed', 'createdAt']
        });

        res.status(200).json(history);
    } catch (error) {
        console.error('Erro ao buscar histórico de contatos:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// 5. Rota Pública: Busca os dados do clique usando apenas o token (Magic Link)
exports.getPublicFeedbackByToken = async (req, res) => {
    try {
        await ensureTableExists();
        const { token } = req.params;

        if (!token) return res.status(400).json({ error: 'Token inválido' });

        const clickLog = await db.WhatsAppClickLog.findOne({
            where: { feedbackToken: token }
        });

        if (!clickLog) {
            return res.status(404).json({ error: 'Feedback não encontrado ou link inválido.' });
        }

        // Busca TODOS os cliques pendentes deste psicólogo para permitir responder tudo de uma vez
        const pendingClicks = await db.WhatsAppClickLog.findAll({
            where: {
                psychologistId: clickLog.psychologistId,
                feedbackGiven: false
            },
            include: [{
                model: db.Psychologist,
                as: 'psychologist',
                attributes: ['nome']
            }],
            order: [['createdAt', 'ASC']]
        });

        res.status(200).json({ pending: pendingClicks });
    } catch (error) {
        console.error('Erro ao buscar feedback público:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// 6. Rota Pública: Salva a resposta usando apenas o token (Magic Link)
exports.submitPublicFeedback = async (req, res) => {
    try {
        await ensureTableExists();
        const { token } = req.params;
        const { contact_received, deal_closed } = req.body;

        if (!token) return res.status(400).json({ error: 'Token inválido' });

        const clickLog = await db.WhatsAppClickLog.findOne({
            where: { feedbackToken: token }
        });

        if (!clickLog) {
            return res.status(404).json({ error: 'Feedback não encontrado ou link inválido.' });
        }

        clickLog.contactReceived = contact_received;
        clickLog.dealClosed = deal_closed;
        clickLog.feedbackGiven = true;
        
        await clickLog.save();

        res.status(200).json({ message: 'Feedback salvo com sucesso!' });
    } catch (error) {
        console.error('Erro ao salvar feedback público:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};
