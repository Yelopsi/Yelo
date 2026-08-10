const db = require('../models');

/**
 * Endpoint para gerar URL de redirecionamento do WhatsApp com Teste A/B
 * Rota: GET /api/whatsapp/link/:psychologistId
 */
exports.getWhatsAppLink = async (req, res) => {
    try {
        const { psychologistId } = req.params;

        // 1. Busca o psicólogo e pega nome e telefone
        const psi = await db.Psychologist.findOne({
            where: { id: psychologistId },
            attributes: ['id', 'nome', 'telefone']
        });

        if (!psi || !psi.telefone) {
            return res.status(404).json({ success: false, error: 'Psicólogo ou telefone não encontrado.' });
        }

        // 2. Extrai apenas o primeiro nome
        const primeiroNome = psi.nome.split(' ')[0];

        // 3. Limpa o telefone (remove tudo que não for dígito)
        const numeroLimpo = psi.telefone.replace(/\D/g, '');

        // 4. Lógica de sorteio 50/50 do Teste A/B
        const isVariantA = Math.random() > 0.5;
        let variantId = '';
        let mensagem = '';

        if (isVariantA) {
            variantId = 'A';
            mensagem = `Olá, ${primeiroNome}! Encontrei seu perfil na Yelo e gostaria de tirar algumas dúvidas sobre como funciona o seu atendimento.`;
        } else {
            variantId = 'B';
            mensagem = `Olá, ${primeiroNome}! Encontrei seu perfil na Yelo e gostaria de saber se você tem horários disponíveis para novos pacientes.`;
        }

        // 5. Salva o log no banco de dados
        const guestName = 'um paciente'; // Poderia vir por querystring caso extraído do LocalStorage
        const utmSource = 'Direto/Orgânico'; 
        
        await db.WhatsAppClickLog.create({
            psychologistId: psi.id,
            ab_variant: variantId,
            guestName: guestName,
            utmSource: utmSource
        });

        // 6. Monta a URL
        const url = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;

        return res.json({ success: true, url: url, variant: variantId });

    } catch (error) {
        console.error('Erro no Teste A/B do WhatsApp:', error);
        return res.status(500).json({ success: false, error: 'Erro interno ao gerar o link.' });
    }
};
