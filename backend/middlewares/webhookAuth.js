const crypto = require('crypto');

const verifyWhatsAppSignature = (req, res, next) => {
    // Check if the secret is configured
    const META_APP_SECRET = process.env.META_APP_SECRET;
    
    if (!META_APP_SECRET) {
        console.error("🚨 [WHATSAPP WEBHOOK] ERRO CRÍTICO: META_APP_SECRET não configurado.");
        return res.status(500).json({ error: 'Configuração do servidor ausente.' });
    }

    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        console.error("🚨 [WHATSAPP WEBHOOK] Requisição bloqueada: Assinatura ausente.");
        return res.status(401).json({ error: 'Assinatura ausente.' });
    }

    const [algorithm, hash] = signature.split('=');
    if (algorithm !== 'sha256' || !hash) {
        console.error("🚨 [WHATSAPP WEBHOOK] Requisição bloqueada: Assinatura malformada.");
        return res.status(401).json({ error: 'Assinatura malformada.' });
    }

    const rawBody = req.rawBody; // req.rawBody is injected by express.json in server.js
    if (!rawBody) {
        console.error("🚨 [WHATSAPP WEBHOOK] Requisição bloqueada: Raw body indisponível.");
        return res.status(401).json({ error: 'Falha interna ao acessar corpo da requisição.' });
    }

    try {
        const expectedHash = crypto.createHmac('sha256', META_APP_SECRET).update(rawBody).digest('hex');
        const expectedBuffer = Buffer.from(expectedHash, 'utf-8');
        const providedBuffer = Buffer.from(hash, 'utf-8');

        // Verify length before timingSafeEqual to prevent length mismatch errors
        if (expectedBuffer.length !== providedBuffer.length) {
            console.error("🚨 [WHATSAPP WEBHOOK] Requisição bloqueada: Tamanho da assinatura incorreto.");
            return res.status(401).json({ error: 'Assinatura incorreta.' });
        }

        if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
            console.error("🚨 [WHATSAPP WEBHOOK] Requisição bloqueada: Assinatura incorreta.");
            return res.status(401).json({ error: 'Assinatura incorreta.' });
        }

    } catch (e) {
        console.error("🚨 [WHATSAPP WEBHOOK] Erro durante a validação da assinatura:", e.message);
        return res.status(401).json({ error: 'Erro na validação da assinatura.' });
    }

    next();
};

module.exports = { verifyWhatsAppSignature };
