const db = require('../models');
const { Op } = require('sequelize');

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
        const { psychologistId, guestName } = req.body;

        if (!psychologistId) {
            return res.status(400).json({ error: 'psychologistId é obrigatório.' });
        }

        const clickLog = await db.WhatsAppClickLog.create({
            psychologistId,
            guestName: guestName || 'um paciente',
            feedbackGiven: false
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
        
        // Calcula o horário de 2 horas atrás (ALTERADO TEMPORARIAMENTE PARA TESTE: 1 minuto no futuro)
        const twoHoursAgo = new Date(Date.now() + 60 * 1000);

        // Busca o clique mais antigo que ainda não teve feedback 
        // e que ocorreu há mais de 2h
        const pendingClick = await db.WhatsAppClickLog.findOne({
            where: {
                psychologistId,
                feedbackGiven: false,
                createdAt: {
                    [Op.lte]: twoHoursAgo // <= 2 horas atrás
                }
            },
            order: [['createdAt', 'ASC']] // Pega o mais antigo pendente primeiro
        });

        if (pendingClick) {
            res.status(200).json(pendingClick);
        } else {
            res.status(200).json({ message: 'Nenhum feedback pendente no momento.' });
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
