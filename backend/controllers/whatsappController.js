const db = require('../models');
const jwt = require('jsonwebtoken');
const gamificationService = require('../services/gamificationService');

/**
 * Endpoint unificado para o Teste A/B de WhatsApp.
 * Consolida TODAS as responsabilidades que antes eram distribuídas entre:
 *   - /api/public/psychologists/:slug/whatsapp-click (publicRoutes.js)
 *   - /api/public/whatsapp-click-log (psychologistRoutes.js)
 *
 * Rota: GET /api/public/whatsapp/link/:psychologistId?utm_source=...&guest_name=...
 */
exports.getWhatsAppLink = async (req, res) => {
    try {
        const { psychologistId } = req.params;

        // 1. Busca o psicólogo
        const psi = await db.Psychologist.findOne({
            where: { id: psychologistId },
            attributes: ['id', 'nome', 'telefone', 'slug', 'status', 'is_exempt', 'whatsapp_clicks']
        });

        if (!psi || !psi.telefone) {
            return res.status(404).json({ success: false, error: 'Psicólogo ou telefone não encontrado.' });
        }

        // 2. Proteção Anti Auto-Clique (psicólogo clicando em si mesmo)
        const authHeader = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
        if (authHeader && authHeader !== 'null' && authHeader !== 'cookie_auth_active') {
            try {
                const decoded = jwt.verify(authHeader, process.env.JWT_SECRET);
                if (decoded.id === psi.id) {
                    console.log(`[A/B] Auto-clique ignorado: Psicólogo ${psi.id}`);
                    const numLimpo = psi.telefone.replace(/\D/g, '');
                    return res.json({ success: true, url: `https://wa.me/55${numLimpo}`, variant: null, skipped: true });
                }
            } catch (e) { /* Token inválido — continua como visitante */ }
        }

        // 3. Proteção de Idempotência (Cookie de 24h — bloqueia duplo-clique)
        const cookieName = `ab_clicked_${psi.id}`;
        if (req.cookies && req.cookies[cookieName]) {
            console.log(`[A/B] Clique duplicado bloqueado (cookie): Psicólogo ${psi.id}`);
            const numLimpo = psi.telefone.replace(/\D/g, '');
            return res.json({ success: true, url: `https://wa.me/55${numLimpo}`, variant: null, skipped: true });
        }
        res.cookie(cookieName, 'true', { maxAge: 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'Lax' });

        // 4. Captura UTM e nome do visitante (enviados pelo frontend via querystring)
        const utmSource = req.query.utm_source || null;
        const guestName = req.query.guest_name || 'um paciente';

        // 5. Lógica de Sorteio 50/50 do Teste A/B
        const primeiroNome = psi.nome.split(' ')[0];
        const numeroLimpo = psi.telefone.replace(/\D/g, '');
        const isVariantA = Math.random() > 0.5;
        const variantId = isVariantA ? 'A' : 'B';
        const mensagem = isVariantA
            ? `Olá, ${primeiroNome}! Encontrei seu perfil na Yelo e gostaria de tirar algumas dúvidas sobre como funciona o seu atendimento.`
            : `Olá, ${primeiroNome}! Encontrei seu perfil na Yelo e gostaria de saber se você tem horários disponíveis para novos pacientes.`;

        // 6. Salva o log completo no banco (fonte única de verdade)
        await db.WhatsAppClickLog.create({
            psychologistId: psi.id,
            ab_variant: variantId,
            guestName,
            utmSource,
            feedbackGiven: false
        });

        // 7. Incrementa o contador agregado no perfil do psicólogo (usado p/ trial limit e gamificação)
        const clicksAtuais = psi.whatsapp_clicks || 0;
        await db.sequelize.query(
            `UPDATE "Psychologists" SET "whatsapp_clicks" = COALESCE("whatsapp_clicks", 0) + 1 WHERE id = :id`,
            { replacements: { id: psi.id } }
        );

        // 8. Dispara gamificação (fire-and-forget)
        gamificationService.processAction(psi.id, 'whatsapp_click').catch(e => console.error('[A/B] Gamification error:', e));

        // 9. E-mail de primeiro lead
        if (clicksAtuais === 0) {
            const emailService = require('../services/emailService');
            emailService.sendFirstLeadEmail(psi).catch(e => console.error('[A/B] Email erro:', e));
        }

        // 10. Monta e retorna a URL
        const url = `https://wa.me/55${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
        return res.json({ success: true, url, variant: variantId });

    } catch (error) {
        console.error('[A/B] Erro no getWhatsAppLink:', error);
        return res.status(500).json({ success: false, error: 'Erro interno ao gerar o link.' });
    }
};
