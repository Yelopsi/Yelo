const crypto = require('crypto');

// Função para criptografar dados sensíveis (Exigência do Facebook para LGPD)
const hashData = (data) => {
    if (!data) return null;
    return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
};

exports.sendCAPIEvent = async (eventName, user, req, customData = {}, eventId = null) => {
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;

    // Se não tiver configurado no .env, não faz nada (não quebra o site)
    if (!pixelId || !token) {
        console.log(`[META CAPI] Ignorado: Chaves não configuradas no .env`);
        return;
    }

    // Pega o IP real e o Navegador do usuário para o Facebook saber quem é
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim(); // Pega apenas o primeiro IP caso haja proxies
    
    const userAgent = req.headers['user-agent'];

    const payload = {
        data: [
            {
                event_name: eventName,
                event_time: Math.floor(Date.now() / 1000),
                action_source: "website",
                user_data: {
                    em: [hashData(user.email)], // E-mail criptografado
                    ph: user.telefone ? [hashData(user.telefone.replace(/\D/g, '55$1'))] : [], // Telefone c/ DDI
                    client_ip_address: ip,
                    client_user_agent: userAgent
                },
                custom_data: customData
            }
        ]
    };

    // O 'event_id' precisa estar na raiz do evento (junto com 'event_name') para a desduplicação funcionar com o Pixel
    if (eventId) {
        payload.data[0].event_id = eventId;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`✅ [META CAPI] Evento '${eventName}' enviado com sucesso!`);
    } catch (err) {
        console.error('❌ [META CAPI] Erro ao enviar evento:', err);
    }
};