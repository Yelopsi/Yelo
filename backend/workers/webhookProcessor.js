const db = require('../models');
const PaymentStateService = require('../services/paymentStateService');

class WebhookProcessor {
    /**
     * Busca um lote de webhooks pendentes e os processa
     */
    static async processPendingWebhooks() {
        try {
            // Utilizamos Transaction isolation para o SKIP LOCKED
            const webhooks = await db.sequelize.transaction(async (t) => {
                const pendingWebhooks = await db.WebhookInbox.findAll({
                    where: {
                        status: {
                            [db.Sequelize.Op.in]: ['PENDING', 'ERROR']
                        },
                        [db.Sequelize.Op.or]: [
                            { nextRetryAt: null },
                            { nextRetryAt: { [db.Sequelize.Op.lte]: new Date() } }
                        ]
                    },
                    order: [['receivedAt', 'ASC']],
                    limit: 10,
                    lock: t.LOCK.UPDATE,
                    skipLocked: true,
                    transaction: t
                });

                if (pendingWebhooks.length > 0) {
                    // Atualiza status para evitar que outro worker pegue os mesmos eventos caso a transaction caia
                    const ids = pendingWebhooks.map(w => w.eventId);
                    await db.WebhookInbox.update({
                        status: 'PROCESSING',
                        processingStartedAt: new Date()
                    }, {
                        where: { eventId: { [db.Sequelize.Op.in]: ids } },
                        transaction: t
                    });
                }
                
                return pendingWebhooks;
            });

            if (webhooks.length === 0) return 0;

            let processedCount = 0;
            // Processa individualmente para não derrubar o lote inteiro caso um falhe
            for (const webhook of webhooks) {
                await this.processSingleWebhook(webhook);
                processedCount++;
            }

            return processedCount;
        } catch (error) {
            console.error('❌ Erro crítico no Webhook Processor:', error);
            return 0;
        }
    }

    static async processSingleWebhook(webhook) {
        try {
            const payload = webhook.payload;
            
            // Chama a lógica de negócio
            await PaymentStateService.processAsaasEvent(payload);

            // Sucesso!
            await db.WebhookInbox.update({
                status: 'PROCESSED',
                processedAt: new Date(),
                lastError: null,
                attempts: webhook.attempts + 1
            }, {
                where: { eventId: webhook.eventId }
            });
            
            console.log(`✅ Webhook ${webhook.eventId} processado com sucesso.`);
        } catch (error) {
            console.error(`❌ Erro ao processar Webhook ${webhook.eventId}:`, error.message);
            
            const attempts = webhook.attempts + 1;
            let nextStatus = 'ERROR';
            let nextRetryAt = null;

            // Exponential backoff
            if (attempts < 5) {
                const now = new Date();
                if (attempts === 1) nextRetryAt = new Date(now.getTime() + 60 * 1000); // 1 minuto
                else if (attempts === 2) nextRetryAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos
                else if (attempts === 3) nextRetryAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutos
                else if (attempts === 4) nextRetryAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hora
            } else {
                console.error(`🚨 Webhook ${webhook.eventId} atingiu limite máximo de retentativas. Marcado como falha permanente.`);
                nextStatus = 'FAILED';
            }

            await db.WebhookInbox.update({
                status: nextStatus,
                nextRetryAt,
                lastError: error.message || error.toString(),
                attempts
            }, {
                where: { eventId: webhook.eventId }
            });
        }
    }

    /**
     * Job Recovery
     * Localiza eventos que ficaram travados em PROCESSING (ex: worker crash) por mais de 5 minutos
     * e os devolve para PENDING
     */
    static async recoverStalledWebhooks() {
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
        try {
            const [updatedRows] = await db.WebhookInbox.update({
                status: 'PENDING',
                processingStartedAt: null
            }, {
                where: {
                    status: 'PROCESSING',
                    processingStartedAt: {
                        [db.Sequelize.Op.lte]: fiveMinsAgo
                    }
                }
            });
            
            if (updatedRows > 0) {
                console.warn(`🔄 Recuperados ${updatedRows} webhooks travados em PROCESSING.`);
            }
        } catch (error) {
            console.error('Erro na recuperação de webhooks travados:', error);
        }
    }
}

module.exports = WebhookProcessor;
