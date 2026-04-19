const emailService = require('../services/emailService');

exports.sendSupportContact = async (req, res) => {
    try {
        const { subject, message, to } = req.body;
        
        // Identifica o usuário logado (o seu middleware 'protect' geralmente salva em req.psychologist ou req.user)
        const userEmail = req.psychologist ? req.psychologist.email : (req.user ? req.user.email : 'Email não identificado');
        const userName = req.psychologist ? req.psychologist.nome : (req.user ? req.user.nome : 'Usuário Yelo');

        const html = `
            <h2>Nova solicitação de suporte: ${subject}</h2>
            <p><strong>De:</strong> ${userName} (${userEmail})</p>
            <br/>
            <p><strong>Mensagem:</strong><br/>${message.replace(/\n/g, '<br>')}</p>
        `;

        // Usa a função que acabamos de exportar para disparar o e-mail
        await emailService.sendEmail(to, `Suporte Yelo: ${subject}`, html);

        res.status(200).json({ success: true, message: 'Mensagem enviada com sucesso.' });
    } catch (error) {
        console.error('Erro ao enviar e-mail de suporte:', error);
        res.status(500).json({ error: 'Erro interno ao processar sua solicitação.' });
    }
};