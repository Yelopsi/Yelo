const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class ReconciliationService {

    static async acquireLock(t, lockId = 999912) {
        const res = await db.sequelize.query(`SELECT pg_try_advisory_xact_lock(${lockId}) as locked`, { 
            type: db.Sequelize.QueryTypes.SELECT,
            transaction: t
        });
        return res[0].locked;
    }

    static getAsaasApiUrl() {
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        return ASAAS_API_URL;
    }

    static async fetchAsaas(endpoint) {
        const url = `${this.getAsaasApiUrl()}${endpoint}`;
        const res = await fetch(url, {
            headers: {
                'access_token': process.env.ASAAS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) throw new Error(`Asaas API Error: ${res.status} on ${endpoint}`);
        return await res.json();
    }

    static async reportAnomaly(runId, type, entityId, diffType, asaasSt, yeloSt, severity) {
        try {
            await db.ReconciliationAudit.create({
                reconciliationRunId: runId,
                entityType: type,
                entityId: entityId.toString(),
                differenceType: diffType,
                asaasState: asaasSt,
                yeloState: yeloSt,
                severity: severity
            });
            console.log(`[RECONCILIATION] Alerta ${severity}: ${diffType} em ${type} ${entityId}`);
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                // Idempotente
            } else {
                console.error(`Erro ao reportar anomalia ${diffType} para ${entityId}:`, error);
            }
        }
    }

    static async runFullAudit() {
        const runId = uuidv4();
        
        try {
            return await db.sequelize.transaction(async (t) => {
                const locked = await this.acquireLock(t, 999912);
                if (!locked) {
                    console.log(`[RECONCILIATION] Outra instância já está rodando a reconciliação. Abortando silenciosamente.`);
                    return { success: false, reason: 'LOCKED' };
                }

                console.log(`[RECONCILIATION] Iniciando Full Audit (Run: ${runId})`);

                await this.auditAsaasToYelo(runId);
                await this.auditYeloToAsaas(runId);
                await this.auditPayments(runId);
                await this.auditIntents(runId);

                console.log(`[RECONCILIATION] Full Audit Concluído.`);
                return { success: true, runId };
            });
        } catch (error) {
            console.error(`[RECONCILIATION] Erro Crítico no Job:`, error);
            return { success: false, error: error.message };
        }
    }

    static async auditAsaasToYelo(runId) {
        try {
            const asaasData = await this.fetchAsaas('/subscriptions?status=ACTIVE&limit=100');
            const asaasSubs = asaasData.data || [];

            for (const sub of asaasSubs) {
                let localPsi = null;
                if (sub.externalReference) {
                    localPsi = await db.Psychologist.findByPk(sub.externalReference);
                }
                if (!localPsi) {
                    localPsi = await db.Psychologist.findOne({ where: { subscriptionId: sub.id } });
                }

                if (!localPsi) {
                    await this.reportAnomaly(runId, 'SUBSCRIPTION', sub.id, 'CRITICAL_ORPHAN', sub, null, 'CRITICAL');
                } else if (localPsi.status !== 'active') {
                    await this.reportAnomaly(runId, 'PSYCHOLOGIST', localPsi.id, 'STATUS_MISMATCH', sub, { status: localPsi.status }, 'CRITICAL');
                } else if (localPsi.subscriptionId !== sub.id) {
                    await this.reportAnomaly(runId, 'PSYCHOLOGIST', localPsi.id, 'SUBSCRIPTION_MISMATCH', sub, { subscriptionId: localPsi.subscriptionId }, 'HIGH');
                }
            }
        } catch (error) {
            console.error('[RECONCILIATION] Erro em auditAsaasToYelo:', error);
        }
    }

    static async auditYeloToAsaas(runId) {
        try {
            const activePsis = await db.Psychologist.findAll({
                where: { status: 'active', subscriptionId: { [Op.not]: null } },
                attributes: ['id', 'email', 'status', 'subscriptionId']
            });

            for (const psi of activePsis) {
                try {
                    const subData = await this.fetchAsaas(`/subscriptions/${psi.subscriptionId}`);
                    if (subData.status !== 'ACTIVE') {
                        await this.reportAnomaly(runId, 'PSYCHOLOGIST', psi.id, 'STATUS_MISMATCH', subData, { status: psi.status }, 'HIGH');
                    }
                } catch (err) {
                    await this.reportAnomaly(runId, 'PSYCHOLOGIST', psi.id, 'SUBSCRIPTION_NOT_FOUND', null, psi.toJSON(), 'CRITICAL');
                }
            }
        } catch (error) {
            console.error('[RECONCILIATION] Erro em auditYeloToAsaas:', error);
        }
    }

    static async auditPayments(runId) {
        try {
            const d = new Date();
            d.setDate(d.getDate() - 3);
            const dateFilter = d.toISOString().split('T')[0];

            const payData = await this.fetchAsaas(`/payments?dateCreated[ge]=${dateFilter}&limit=100`);
            const payments = payData.data || [];

            for (const p of payments) {
                const localPayment = await db.Payment.findOne({ where: { id: p.id } });
                if (!localPayment && ['CONFIRMED', 'RECEIVED'].includes(p.status)) {
                    await this.reportAnomaly(runId, 'PAYMENT', p.id, 'MISSING_PAYMENT', p, null, 'CRITICAL');
                } else if (localPayment && localPayment.status !== p.status) {
                    let severity = 'MEDIUM';
                    if (p.status === 'REFUNDED' || p.status === 'CHARGEBACK_REQUESTED') severity = 'HIGH';
                    await this.reportAnomaly(runId, 'PAYMENT', p.id, 'PAYMENT_STATUS_MISMATCH', p, localPayment.toJSON(), severity);
                }
            }
        } catch (error) {
            console.error('[RECONCILIATION] Erro em auditPayments:', error);
        }
    }

    static async auditIntents(runId) {
        try {
            const staleThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 minutos atrás
            
            const staleIntents = await db.SubscriptionIntent.findAll({
                where: {
                    status: { [Op.in]: ['CREATING', 'SENT_TO_ASAAS', 'RECONCILIATION_REQUIRED'] },
                    updatedAt: { [Op.lte]: staleThreshold }
                }
            });

            for (const intent of staleIntents) {
                // Tenta buscar no Asaas se foi criada uma assinatura com essa idempotencyKey ou para este customer recém criado
                // No Asaas, não temos como buscar por IdempotencyKey nativamente.
                // Mas podemos marcar para atenção.
                await this.reportAnomaly(runId, 'INTENT', intent.id, 'STALE_INTENT', null, intent.toJSON(), 'HIGH');
                
                // Em passos futuros, aqui faremos a marcação como FAILED_LOCAL automática 
                // se comprovarmos a ausência no Asaas.
            }
        } catch (error) {
            console.error('[RECONCILIATION] Erro em auditIntents:', error);
        }
    }
}

module.exports = ReconciliationService;
