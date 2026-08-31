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
    if (!event || !event.event) {
        return res.status(400).json({ error: 'Payload de webhook inválido ou incompleto.' });
    }
    
    // Pix Automático retries could use paymentInstruction or payment
    const paymentData = event.payment || event.paymentInstruction;
    if (!paymentData || !paymentData.id) {
        return res.status(400).json({ error: 'Objeto payment ou paymentInstruction ausente.' });
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

        // Garantir que o evento fique registrado no Dashboard de Logs
        if (db.SystemLog) {
            const customerStr = paymentData.customer || 'Desconhecido';
            await db.SystemLog.create({
                level: 'info',
                message: `[ASAAS WEBHOOK BRUTO] Evento recebido: ${event.event}`,
                meta: { userEmail: customerStr, eventId: eventId }
            });
        }

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

exports.validateWithdrawal = async (req, res) => {
    try {
        console.log("🛡️ [ASAAS WEBHOOK] Recebida solicitação de validação de saque...");
        
        // 1. Validação de segurança com Token
        const asaasToken = req.headers['asaas-access-token'];
        const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
        
        if (!expectedToken) {
            console.error("🚨 ERRO CRÍTICO DE CONFIGURAÇÃO: ASAAS_WEBHOOK_TOKEN ausente. Negando validação (Fail-Closed).");
            return res.json({ status: "REFUSED", refuseReason: "Configuração do servidor incorreta." });
        }
        
        if (asaasToken !== expectedToken) {
            console.error("🚨 [ALERTA DE SEGURANÇA] Validação de saque recusada: Token inválido.");
            return res.json({ status: "REFUSED", refuseReason: "Token de acesso inválido." });
        }
        
        const payload = req.body;
        
        // 2. Validação do tipo de operação
        if (!payload || payload.type !== 'TRANSFER' || !payload.transfer || !payload.transfer.id) {
            console.error("⚠️ [ASAAS WEBHOOK] Tipo de operação inválido ou ID de transferência ausente.");
            return res.json({ status: "REFUSED", refuseReason: "Estrutura de payload inválida ou não é TRANSFER." });
        }
        
        const transferId = payload.transfer.id;
        
        // 3. Verifica no banco se fomos nós que solicitamos (comparando com o SystemLog)
        // Procuramos por logs recentes que mencionem esse transferId no meta.
        const recentLogs = await db.SystemLog.findAll({
            where: { level: 'info' },
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        
        const isLegit = recentLogs.find(log => log.meta && log.meta.transferId === transferId);
        
        if (isLegit) {
            console.log(`✅ [ASAAS WEBHOOK] Saque ${transferId} reconhecido pelo nosso sistema. Autorizando...`);
            return res.json({ status: "APPROVED" });
        } else {
            console.warn(`🚨 [ASAAS WEBHOOK] Saque ${transferId} NÃO ENCONTRADO nos nossos registros recentes. Recusando operação.`);
            return res.json({ status: "REFUSED", refuseReason: "Transferência não encontrada no nosso sistema." });
        }
        
    } catch (error) {
        console.error("❌ [ASAAS WEBHOOK] Erro ao validar saque:", error);
        // Em caso de erro na nossa ponta, recusamos por segurança.
        return res.json({ status: "REFUSED", refuseReason: "Erro interno no servidor de validação." });
    }
};