// c:/Users/Anderson/Desktop/Yelo/backend/controllers/adminMessageController.js

const db = require('../models');
const { Op } = require('sequelize');

// Helper para corrigir URLs de imagem (converte caminho absoluto em relativo)
const sanitizeFotoUrl = (url) => {
	if (!url) return null;
	if (url.startsWith('http') || url.startsWith('/')) return url;
	if (url.includes('uploads')) {
		const parts = url.split(/uploads/i);
		return '/uploads' + parts[parts.length - 1].replace(/\\/g, '/');
	}
	return url;
};

// GET /api/admin/conversations
exports.getAllConversations = async (req, res) => {
    try {
        const { search, filter } = req.query;
        let results;
        
        // --- LÓGICA DE FILTRO CORRIGIDA ---
        let statusCondition;
        if (filter === 'all') {
            // "Todas" = ativas ou nulas (não arquivadas, não deletadas)
            statusCondition = { [Op.or]: ['active', null] };
        } else if (filter === 'archived') {
            // "Arquivadas" = apenas arquivadas
            statusCondition = 'archived';
        } else {
            // "Não Lidas" = Busca em todos os status (exceto deletadas) e filtra depois
            // Inclui ativas, nulas e arquivadas.
            statusCondition = { [Op.notIn]: ['deleted_by_admin'] };
        }

        if (search && search.trim() !== '') {
            // MODO BUSCA: Encontra psicólogos e verifica se já existe uma conversa.
            const psychologists = await db.Psychologist.findAll({
                where: {
                    nome: { [Op.iLike]: `%${search}%` },
                    isAdmin: { [Op.ne]: true } // Não mostra o próprio admin na busca
                },
                limit: 15
            });

            results = await Promise.all(psychologists.map(async (psy) => {
                const conversation = await db.Conversation.findOne({
                    where: { psychologistId: psy.id, patientId: null }
                });

                // Lógica de filtro para a busca
                const status = conversation?.status || 'active';
                if (status === 'deleted_by_admin') return null;

                if (filter === 'all' && status === 'archived') return null;
                if (filter === 'archived' && status !== 'archived') return null;
                // Para 'unread', não filtramos por status aqui.

                let lastMessage = null;
                let unreadCount = 0;

                if (conversation) {
                    lastMessage = await db.Message.findOne({
                        where: { conversationId: conversation.id },
                        order: [['createdAt', 'DESC']]
                    });

                    unreadCount = await db.Message.count({
                        where: {
                            conversationId: conversation.id,
                            isRead: false,
                            senderType: 'psychologist'
                        }
                    });
                }

                // Sanitiza foto
                const psyJson = psy.toJSON();
                if (psyJson.fotoUrl) psyJson.fotoUrl = sanitizeFotoUrl(psyJson.fotoUrl);

                return {
                    id: conversation ? conversation.id : `new-${psy.id}`,
                    psychologist: psyJson,
                    lastMessage: lastMessage ? lastMessage.toJSON() : { content: 'Inicie uma nova conversa...' },
                    updatedAt: conversation ? conversation.updatedAt : psy.createdAt,
                    unreadCount: unreadCount,
                    status: status
                };
            }));
            
            // Remove nulos gerados pelo filtro
            results = results.filter(r => r !== null);

        } else {
            // MODO PADRÃO: Lista as conversas existentes com o admin.
            let conversations;
            try {
                // Tenta buscar com o filtro de status (Ideal)
                conversations = await db.Conversation.findAll({
                    where: { 
                        patientId: null,
                        status: statusCondition 
                    },
                    include: [{ model: db.Psychologist, required: true, attributes: ['id', 'nome', 'fotoUrl'] }],
                    order: [['updatedAt', 'DESC']]
                });
            } catch (dbError) {
                // Fallback: Se der erro (ex: coluna status não existe), busca sem o filtro
                conversations = await db.Conversation.findAll({
                    where: { patientId: null },
                    include: [{ model: db.Psychologist, required: true, attributes: ['id', 'nome', 'fotoUrl'] }],
                    order: [['updatedAt', 'DESC']]
                });
            }

            results = await Promise.all(conversations.map(async (convo) => {
                const lastMessage = await db.Message.findOne({
                    where: { conversationId: convo.id },
                    order: [['createdAt', 'DESC']]
                });
                
                // Contagem de Não Lidas
                const unreadCount = await db.Message.count({
                    where: {
                        conversationId: convo.id,
                        isRead: false,
                        senderType: 'psychologist'
                    }
                });

                const plainConvo = convo.toJSON();
                
                // CORREÇÃO: Obtém o objeto do psicólogo e sanitiza a URL da foto
                const psy = plainConvo.Psychologist || plainConvo.psychologist;
                if (psy && psy.fotoUrl) {
                    psy.fotoUrl = sanitizeFotoUrl(psy.fotoUrl);
                }

                return {
                    id: plainConvo.id,
                    psychologist: psy,
                    updatedAt: plainConvo.updatedAt,
                    lastMessage: lastMessage ? lastMessage.toJSON() : null,
                    unreadCount: unreadCount,
                    status: plainConvo.status || 'active'
                };
            }));
        }

        // Filtro de "Não Lidas" (aplicado em memória após buscar as ativas)
        if (filter === 'unread') {
            results = results.filter(c => c.unreadCount > 0);
        }

        res.json(results);
    } catch (error) {
        console.error("Erro ao buscar conversas de admin:", error);
        res.status(500).json({ error: 'Erro interno no servidor: ' + error.message });
    }
};

// GET /api/admin/messages/conversation/:id
exports.getMessagesForConversation = async (req, res) => {
    try {
        const messages = await db.Message.findAll({
            where: { conversationId: req.params.id },
            order: [['createdAt', 'ASC']]
        });

        res.json(messages);
    } catch (error) {
        console.error("Erro ao buscar mensagens da conversa:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

// POST /api/admin/messages/reply
exports.replyToConversation = async (req, res) => {
    try {
        const { conversationId, psychologistId, content } = req.body;
        const adminId = req.psychologist.id; // O middleware 'admin' garante que req.psychologist existe e é admin

        if (!content) {
            return res.status(400).json({ error: 'O conteúdo da mensagem é obrigatório.' });
        }

        let conversation;

        // CORREÇÃO: Lógica para criar ou encontrar a conversa
        if (conversationId && !String(conversationId).startsWith('new-')) {
            conversation = await db.Conversation.findByPk(conversationId);
        } else if (psychologistId) {
            [conversation] = await db.Conversation.findOrCreate({
                where: { psychologistId: psychologistId, patientId: null },
                defaults: { psychologistId: psychologistId, patientId: null, status: 'active' }
            });
        } else {
            return res.status(400).json({ error: 'ID da conversa ou do psicólogo é necessário.' });
        }

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada ou não pôde ser criada.' });

        // Se a conversa estava arquivada, reativa ela ao responder
        if (conversation.status === 'archived') {
            conversation.status = 'active';
            // Tenta salvar, mas ignora erro se a coluna não existir
            try { await conversation.save(); } catch (e) {}
        }

        const newMessage = await db.Message.create({
            conversationId: conversation.id,
            content,
            senderId: adminId,
            senderType: 'admin',
            recipientId: conversation.psychologistId, // O destinatário é sempre o psicólogo da conversa
            recipientType: 'psychologist',
            isRead: false,
            status: 'sent' // Status inicial
        });

        // Atualiza o 'updatedAt' da conversa para ela aparecer no topo da lista
        await conversation.update({ updatedAt: new Date() });

        res.status(201).json(newMessage);
    } catch (error) {
        console.error("Erro ao responder mensagem:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

// PATCH /api/admin/messages/conversation/:id/:action
exports.toggleArchiveConversation = async (req, res) => {
    try {
        const { id, action } = req.params; // action: 'archive' ou 'unarchive'
        const conversation = await db.Conversation.findByPk(id);

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        // Define o novo status
        const newStatus = (action === 'archive') ? 'archived' : 'active';
        
        conversation.status = newStatus;
        await conversation.save();

        res.json({ success: true, status: newStatus });
    } catch (error) {
        console.error("Erro ao arquivar conversa:", error);
        res.status(500).json({ error: 'Erro ao atualizar status da conversa' });
    }
};

// DELETE /api/admin/messages/conversation/:id
exports.deleteConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversation = await db.Conversation.findByPk(id);

        if (!conversation) return res.status(404).json({ error: 'Conversa não encontrada' });

        // Exclui todas as mensagens da conversa primeiro
        await db.Message.destroy({ where: { conversationId: id } });
        
        // Exclui a conversa
        await conversation.destroy();

        res.json({ success: true, message: 'Conversa excluída com sucesso' });
    } catch (error) {
        console.error("Erro ao excluir conversa:", error);
        res.status(500).json({ error: 'Erro ao excluir conversa' });
    }
};
