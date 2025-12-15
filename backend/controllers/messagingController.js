const { SupportMessage, Psychologist } = require('../models'); // Importa os modelos
// Nota: Se der erro aqui, verifique se você tem um modelo 'Psychologist' já criado.
// Se não tiver, o código vai funcionar, mas precisamos ajustar apenas a busca do nome.

exports.getConversations = async (req, res) => {
  // Para o MVP de suporte, retornamos uma "conversa fixa" com o Admin
  // No futuro, aqui buscaremos a lista de pacientes
  try {
    const conversas = [
      {
        id: 'suporte_admin',
        type: 'support',
        participant: {
          nome: 'Suporte Yelo',
          role: 'Administração'
        },
        lastMessage: 'Canal direto com a administração.',
        updatedAt: new Date()
      }
    ];
    res.json(conversas);
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    // Pegamos o ID do psicólogo logado (vindo do token de autenticação)
    // Se o seu req.user.id for diferente (ex: req.userId), ajuste aqui.
    const psiId = req.user ? req.user.id : null; 

    if (!psiId) return res.status(401).json({ error: 'Usuário não autenticado' });

    // Busca as mensagens no banco ordenadas por data
    const messages = await SupportMessage.findAll({
      where: { psychologist_id: psiId },
      order: [['created_at', 'ASC']]
    });

    // Formata para o frontend (camelCase)
    const formattedMessages = messages.map(msg => ({
      id: msg.id,
      content: msg.content,
      senderType: msg.sender_type,
      createdAt: msg.created_at
    }));

    res.json(formattedMessages);
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const psiId = req.user ? req.user.id : null;
    const { content } = req.body;

    if (!psiId) return res.status(401).json({ error: 'Não autorizado' });
    if (!content) return res.status(400).json({ error: 'Mensagem vazia' });

    // Salva no banco
    const newMessage = await SupportMessage.create({
      psychologist_id: psiId,
      sender_type: 'psychologist', // Quem está enviando é o psi
      content: content,
      created_at: new Date()
    });

    res.json({ success: true, message: newMessage });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
};