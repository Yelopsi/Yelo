const db = require('../models');

exports.handleWebhook = async (req, res) => {
    // O Asaas envia o evento no corpo do request (JSON)
    const event = req.body;
    
    // Validação básica de segurança
    const asaasToken = req.headers['asaas-access-token'];
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    
    // FAIL-CLOSED OBRIGATÓRIO
    if (!expectedToken) {
        console.error("🚨 ERRO CRÍTICO DE CONFIGURAÇÃO: ASAAS_WEBHOOK_TOKEN ausente. Negando requisições por segurança (Fail-Closed).");
        return res.status(401).json({ error: 'Configuração de webhook ausente no servidor.' });
    }
    if (asaasToken !== expectedToken) {
        console.error("🚨 [ALERTA DE SEGURANÇA] Webhook bloqueado. Token esperado não confere com o recebido.");
        return res.status(401).json({ error: 'Token de Webhook inválido.' });
    }

    // --- ZERO TRUST: Validação de Payload ---
    if (!event || !event.payment || !event.payment.id || !event.event) {
        return res.status(400).json({ error: 'Payload de webhook inválido ou incompleto.' });
    }

    const eventId = event.id;
    if (!eventId) {
        return res.status(400).json({ error: 'event.id ausente no payload.' });
    }

    try {
        // --- INGESTÃO IDEMPOTENTE ---
        await db.WebhookInbox.create({
            eventId: eventId,
            status: 'PENDING',
            payload: event
        });
        console.log(`📥 [WEBHOOK] Evento ${eventId} (${event.event}) recebido com sucesso.`);
        return res.status(200).json({ received: true });
    } catch (error) {
        // Violação de Constraint UNIQUE = Evento duplicado
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log(`⚠️ [WEBHOOK] Evento ${eventId} duplicado. Ignorado.`);
            return res.status(200).json({ received: true, ignored: true, reason: 'Duplicate event' });
        }
        
        console.error(`❌ [WEBHOOK] Erro crítico ao salvar evento ${eventId}:`, error);
        return res.status(500).json({ error: 'Erro interno ao processar evento.' });
    }
};