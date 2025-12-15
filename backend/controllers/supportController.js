const { SupportMessage, Psychologist } = require('../models');

// 1. LISTAR CONVERSAS (Correção para erro attr[0].includes)
exports.getConversations = async (req, res) => {
  try {
    // Se a rota for acessada pelo ADMIN, busca lista de psicólogos agrupada
    if (req.originalUrl && req.originalUrl.includes('/api/admin')) {
        
        // CORREÇÃO: Usamos 'group' para listar psicólogos únicos sem erro de sintaxe
        const senders = await SupportMessage.findAll({
            attributes: ['psychologist_id'],
            group: ['psychologist_id'],
            raw: true
        });

        const ids = senders.map(s => s.psychologist_id);
        
        if (ids.length === 0) return res.json([]);

        const psis = await Psychologist.findAll({
            where: { id: ids },
            attributes: ['id', 'nome', 'email', 'fotoUrl']
        });
        
        return res.json(psis);
    } 
    // Se for PSICÓLOGO, vê apenas o admin
    else {
        return res.json([{
            id: 'suporte_admin',
            type: 'support',
            participant: { nome: 'Suporte Yelo', role: 'Administração' }
        }]);
    }
  } catch (error) {
    console.error('Erro GetConversations:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

// 2. LER MENSAGENS
exports.getMessages = async (req, res) => {
  try {
    let psiId;

    // Se tem ID na URL (Admin acessando), usa ele. 
    if (req.params.psiId) {
        psiId = req.params.psiId;
    } else {
        // Se não (Psicólogo acessando), usa o ID do token.
        psiId = req.psychologist ? req.psychologist.id : (req.user ? req.user.id : null);
    }

    if (!psiId) return res.status(400).json({ error: 'ID indefinido' });

    const messages = await SupportMessage.findAll({
      where: { psychologist_id: psiId },
      order: [['created_at', 'ASC']]
    });

    // Formata para o frontend
    const formatted = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      senderType: msg.sender_type,
      createdAt: msg.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Erro GetMessages:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

// 3. ENVIAR / RESPONDER
exports.sendMessage = exports.replyMessage = async (req, res) => {
  try {
    let psiId, senderType;

    // Se tem ID na URL, é o Admin respondendo para aquele psicólogo
    if (req.params.psiId) {
        psiId = req.params.psiId;
        senderType = 'admin';
    } 
    // Senão, é o Psicólogo enviando pergunta
    else {
        psiId = req.psychologist ? req.psychologist.id : (req.user ? req.user.id : null);
        senderType = 'psychologist';
    }

    const { content } = req.body;
    
    if(!content) return res.status(400).json({ error: 'Conteúdo vazio' });

    await SupportMessage.create({
      psychologist_id: psiId,
      sender_type: senderType,
      content: content,
      created_at: new Date()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro SendMessage:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};