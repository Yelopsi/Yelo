const db = require('../models');
const bcrypt = require('bcryptjs');
const { sendSubscriptionCancelledEmail } = require('../services/emailService');
const PaymentStateService = require('../services/paymentStateService');
const pricingLaunch = require('../utils/pricingLaunch');

const getAsaasApiUrl = () => PaymentStateService.getAsaasApiUrl();
const getAsaasApiKey = () => (process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '');

// ----------------------------------------------------------------------
// Rota: DELETE /api/psychologists/me (BLINDADA CONTRA COBRANÇA INDEVIDA)
// ----------------------------------------------------------------------
exports.deletePsychologistAccount = async (req, res) => {
    try {
        // 1. Recebe senha e dados da pesquisa de saída
        // Nota: Adicionei sugestao e avaliacao caso você ajuste o front para enviar também
        const { senha, motivo, sugestao, avaliacao } = req.body;

        if (!senha) {
            return res.status(400).json({ error: 'A senha é obrigatória para excluir a conta.' });
        }

        // 2. Busca o usuário com dados sensíveis para validação
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);

        if (!psychologist) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Verifica googleId via SQL direto pois a coluna pode não estar no model
        const [rawPsychologist] = await db.sequelize.query(
            `SELECT "googleId" FROM "Psychologists" WHERE id = :id LIMIT 1`,
            { replacements: { id: req.psychologist.id }, type: db.sequelize.QueryTypes.SELECT }
        );
        const isGoogleBypass = rawPsychologist && rawPsychologist.googleId && senha.trim().toUpperCase() === 'EXCLUIR';

        if (!isGoogleBypass) {
            const isMatch = await bcrypt.compare(senha, psychologist.senha);
            if (!isMatch) {
                return res.status(403).json({ error: 'Senha ou confirmação incorreta. A conta não foi excluída.' });
            }
        }

        // --- PONTO CRÍTICO: CANCELAMENTO NO ASAAS ---
        if (psychologist.subscriptionId && psychologist.subscriptionId.startsWith('sub_')) {
            try {
                await PaymentStateService.cancelAndPurgeSubscription(psychologist.subscriptionId, {
                    psychologistId: psychologist.id
                });
            } catch (asaasError) {
                // Log error but continue deletion
            }
        } else if (psychologist.subscriptionId) {
            await db.Subscription.update(
                { status: 'CANCELED' },
                { where: { id: psychologist.subscriptionId } }
            ).catch(() => {});
        }

        // 4. Salvar Feedback de Saída (Via Modelo Sequelize)
        if (motivo) {
            try {
                // Verifica se o modelo foi carregado antes de tentar usar
                if (db.ExitSurvey) {
                    await db.ExitSurvey.create({
                        psychologistId: psychologist.id,
                        motivo: motivo,
                        avaliacao: avaliacao ? parseInt(avaliacao) : null,
                        sugestao: sugestao || 'Não informado'
                    });
                } else {
                }
            } catch (surveyError) {
            }
        }

        // --- GAMIFICATION: Libera o slot da badge 'Pioneiro' se o usuário tiver ---
        if (psychologist.badges && psychologist.badges.pioneiro) {
            const currentBadges = { ...psychologist.badges };
            delete currentBadges.pioneiro;
            await psychologist.update({ badges: currentBadges });
        }

        // 5. Exclusão da Conta (Soft Delete se o Model for Paranoid, ou Hard Delete)
        await psychologist.destroy();

        res.status(200).json({ message: 'Sua conta e assinatura foram encerradas com sucesso.' });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/cancel-subscription (CORRIGIDO V2)
// ----------------------------------------------------------------------
exports.cancelSubscription = async (req, res) => {
    try {
        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);
        
        if (!psychologist) return res.status(404).json({ error: 'Psi não encontrado' });

        // [CORREÇÃO] Verifica ambas as colunas possíveis para o ID da assinatura
        const subId = psychologist.subscriptionId;

        if (!subId) {
             // [CORREÇÃO DEFINITIVA] FALLBACK DE SEGURANÇA:
             // Se chegou aqui, o usuário quer cancelar. Se não temos ID para o Asaas,
             // cancelamos localmente para não prender o usuário.
             await db.Payment.update({ status: 'CANCELED' }, {
                 where: {
                     psychologistId: psychologist.id,
                     status: ['PENDING', 'OVERDUE']
                 }
             }).catch(() => {});
             if (pricingLaunch.isNewPricingActive()) {
                 await psychologist.update({
                    plano: 'Comunidade',
                    planExpiresAt: null,
                    cancelAtPeriodEnd: true,
                    canceledAt: new Date(),
                    subscriptionId: null
                 });
             } else {
                 await psychologist.update({
                    cancelAtPeriodEnd: true,
                    canceledAt: new Date()
                 });
             }
             return res.status(200).json({ message: 'Assinatura cancelada localmente (Vínculo de pagamento não encontrado).' });
        }

        // 1. Trial tokenizado (sem cobrança ainda)
        if (subId.startsWith('trial_tok_')) {
            await db.Subscription.update(
                { status: 'CANCELED' },
                { where: { id: subId } }
            ).catch(() => {});

            await psychologist.update({
                plano: 'Comunidade',
                planExpiresAt: null,
                cancelAtPeriodEnd: false,
                canceledAt: new Date(),
                subscriptionId: null
            });
            return res.json({ message: 'Período de teste cancelado sem nenhuma cobrança no cartão. Você voltou para o Plano Comunidade (Grátis).' });
        }

        // 2. Plano parcelado no cartão (Trimestral ou Semestral) ou cobrança avulsa
        if (!subId.startsWith('sub_')) {
            const asaasApiUrl = getAsaasApiUrl();
            const asaasApiKey = getAsaasApiKey();
            const isSinglePayment = String(subId).startsWith('pay_');
            let isEligibleForRefund = false;
            let paymentToRefund = null;

            try {
                if (isSinglePayment) {
                    const payRes = await fetch(`${asaasApiUrl}/payments/${subId}`, {
                        headers: { 'access_token': asaasApiKey }
                    });
                    const payData = await payRes.json().catch(() => ({}));
                    if (payData && payData.id && payData.dateCreated) {
                        paymentToRefund = payData;
                        const diffDays = Math.floor((Date.now() - new Date(payData.dateCreated).getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays <= 7) isEligibleForRefund = true;
                    }
                } else {
                    const instRes = await fetch(`${asaasApiUrl}/payments?installment=${encodeURIComponent(subId)}&limit=1`, {
                        headers: { 'access_token': asaasApiKey }
                    });
                    const instData = await instRes.json().catch(() => ({}));
                    const firstPay = Array.isArray(instData.data) && instData.data.length > 0 ? instData.data[0] : null;
                    if (firstPay && firstPay.dateCreated) {
                        paymentToRefund = firstPay;
                        const diffDays = Math.floor((Date.now() - new Date(firstPay.dateCreated).getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays <= 7) isEligibleForRefund = true;
                    }
                }
            } catch (e) {}

            if (isEligibleForRefund && paymentToRefund) {
                const refundUrl = isSinglePayment
                    ? `${asaasApiUrl}/payments/${paymentToRefund.id}/refund`
                    : `${asaasApiUrl}/installments/${subId}/refund`;
                const refundBody = isSinglePayment
                    ? JSON.stringify({ value: paymentToRefund.value, description: "Cancelamento no prazo de 7 dias (Arrependimento)" })
                    : JSON.stringify({});

                let refundSucceeded = false;
                let refundErrMsg = 'Não foi possível concluir o estorno automático no gateway. Tente novamente em instantes.';
                try {
                    const refundRes = await fetch(refundUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
                        body: refundBody
                    });
                    const refundText = await refundRes.text();
                    const refundData = refundText ? JSON.parse(refundText) : {};
                    if (refundRes.ok && !refundData.errors) {
                        refundSucceeded = true;
                    } else if (refundData.errors && refundData.errors[0]?.description) {
                        refundErrMsg = refundData.errors[0].description;
                    }
                } catch (e) {}

                if (!refundSucceeded) {
                    return res.status(400).json({ error: refundErrMsg });
                }

                await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: subId } }).catch(() => {});
                if (isSinglePayment && paymentToRefund.id) {
                    await db.Payment.update({ status: 'REFUNDED' }, { where: { id: paymentToRefund.id } }).catch(() => {});
                }
                await db.Payment.update({ status: 'CANCELED' }, {
                    where: { psychologistId: psychologist.id, status: ['PENDING', 'OVERDUE'] }
                }).catch(() => {});

                if (pricingLaunch.isNewPricingActive()) {
                    await psychologist.update({
                        plano: 'Comunidade',
                        planExpiresAt: null,
                        cancelAtPeriodEnd: false,
                        canceledAt: new Date(),
                        subscriptionId: null
                    });
                } else {
                    await psychologist.update({
                        status: 'inactive',
                        planExpiresAt: new Date(),
                        cancelAtPeriodEnd: true,
                        canceledAt: new Date(),
                        subscriptionId: null
                    });
                }
                return res.json({ message: 'Plano cancelado e valor estornado no cartão com sucesso.' });
            }

            const dataFim = psychologist.planExpiresAt ? new Date(psychologist.planExpiresAt).toLocaleDateString('pt-BR') : '';
            const subRow = await db.Subscription.findByPk(subId);
            const subMeta = PaymentStateService.parseSubscriptionPlanMeta(subRow ? subRow.plan : null);
            const hasAutoRenewInstallment = Boolean(subMeta && (subMeta.cycle === 'QUARTERLY' || subMeta.cycle === 'SEMIANNUAL') && subMeta.token);

            if (hasAutoRenewInstallment) {
                await subRow.update({
                    plan: PaymentStateService.buildInstallmentPlanMeta({ ...subMeta, autoRenew: false })
                });
                await psychologist.update({
                    cancelAtPeriodEnd: true,
                    canceledAt: new Date()
                });
                return res.json({
                    message: `Renovação automática cancelada. Seu acesso permanece ativo até ${dataFim || 'o fim do ciclo contratado'}, sem nova cobrança após este ciclo.`
                });
            }

            await psychologist.update({ cancelAtPeriodEnd: false });
            return res.json({
                message: `Seu plano é parcelado no cartão com vigência garantida até ${dataFim}. Não há renovação automática pendente.`
            });
        }

        // 3. Assinatura recorrente mensal pré-2027: mantém 100% o fluxo atual em produção (purga faturas abertas e encerra assinatura na hora no Asaas)
        if (!pricingLaunch.isNewPricingActive()) {
            await PaymentStateService.cancelAndPurgeSubscription(subId, {
                psychologistId: psychologist.id
            });
            await db.Payment.update({ status: 'CANCELED' }, {
                where: {
                    psychologistId: psychologist.id,
                    status: ['PENDING', 'OVERDUE']
                }
            }).catch(() => {});
            await psychologist.update({ cancelAtPeriodEnd: true, canceledAt: new Date() });
            await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: subId } }).catch(() => {});
            sendSubscriptionCancelledEmail(psychologist).catch(e => {});
            return res.json({ message: 'Renovação automática cancelada. Seu acesso continua até o fim do período já pago.' });
        }

        // 3B. Assinatura recorrente mensal pós-2027: limpa faturas em aberto, agenda fim do ciclo no Asaas (permitindo reativação até o vencimento) ou purga se já vencida
        const now = new Date();
        const hasRemainingPaidPeriod = Boolean(
            psychologist.status === 'active' &&
            psychologist.planExpiresAt &&
            new Date(psychologist.planExpiresAt) > now
        );

        let scheduledGracefully = false;
        if (hasRemainingPaidPeriod) {
            await PaymentStateService.purgeOpenSubscriptionInvoices(subId, {
                psychologistId: psychologist.id
            });

            const endLimitMs = Math.max(now.getTime(), new Date(psychologist.planExpiresAt).getTime() - 24 * 60 * 60 * 1000);
            const endDateStr = new Date(endLimitMs - 10800000).toISOString().split('T')[0];

            try {
                const putRes = await fetch(`${getAsaasApiUrl()}/subscriptions/${subId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'access_token': getAsaasApiKey() },
                    body: JSON.stringify({ endDate: endDateStr })
                });
                const putText = await putRes.text();
                const putData = putText ? JSON.parse(putText) : {};
                if (putRes.ok && !putData.errors && !putData.deleted) {
                    scheduledGracefully = true;
                }
            } catch (endErr) {
                console.warn(`[ASAAS] Não foi possível agendar endDate em ${subId}, realizando purga imediata:`, endErr.message);
            }
        }

        if (!scheduledGracefully) {
            await PaymentStateService.cancelAndPurgeSubscription(subId, {
                psychologistId: psychologist.id
            });
            await db.Subscription.update({ status: 'INACTIVE' }, { where: { id: subId } }).catch(() => {});
        }

        await db.Payment.update({ status: 'CANCELED' }, {
            where: {
                psychologistId: psychologist.id,
                status: ['PENDING', 'OVERDUE']
            }
        }).catch(() => {});

        if (!hasRemainingPaidPeriod && pricingLaunch.isNewPricingActive()) {
            await psychologist.update({
                plano: 'Comunidade',
                planExpiresAt: null,
                subscriptionId: null,
                cancelAtPeriodEnd: false,
                canceledAt: now
            });
        } else {
            await psychologist.update({ cancelAtPeriodEnd: true, canceledAt: now });
        }

        sendSubscriptionCancelledEmail(psychologist).catch(e => {});

        res.json({ message: 'Renovação automática cancelada. Seu acesso continua até o fim do período já pago.' });

    } catch (error) {
        res.status(500).json({ error: 'Erro interno.' });
    }
};

// ----------------------------------------------------------------------
// Rota: POST /api/psychologists/me/reactivate-subscription
// Descrição: Remove o agendamento de cancelamento no Asaas e mantém o plano ativo.
// ----------------------------------------------------------------------
exports.reactivateSubscription = async (req, res) => {
    try {
        // 1. Identificação segura (usando seu padrão req.psychologist)
        if (!req.psychologist || !req.psychologist.id) {
            return res.status(401).json({ error: 'Não autorizado.' });
        }

        const psychologist = await db.Psychologist.findByPk(req.psychologist.id);

        const subId = psychologist.subscriptionId;

        if (!subId) {
             return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });
        }

        if (psychologist.status !== 'active' || !psychologist.planExpiresAt || new Date(psychologist.planExpiresAt) <= new Date()) {
             return res.status(400).json({ error: 'Assinatura anterior expirou. Por favor, assine novamente.' });
        }

        if (!String(subId).startsWith('sub_')) {
             const subRow = await db.Subscription.findByPk(subId);
             const subMeta = PaymentStateService.parseSubscriptionPlanMeta(subRow ? subRow.plan : null);
             const canReactivateInstallment = Boolean(
                 subRow && subMeta && (subMeta.cycle === 'QUARTERLY' || subMeta.cycle === 'SEMIANNUAL') && subMeta.token
             );
             if (!canReactivateInstallment) {
                 return res.status(400).json({ error: 'Não há renovação automática elegível para reativação neste plano. Por favor, assine novamente.' });
             }

             await subRow.update({
                 status: 'ACTIVE',
                 plan: PaymentStateService.buildInstallmentPlanMeta({ ...subMeta, autoRenew: true })
             });
             await psychologist.update({
                 cancelAtPeriodEnd: false,
                 canceledAt: null,
                 reactivatedAt: new Date()
             });
             return res.json({
                 message: 'Renovação automática reativada com sucesso! Ao fim do ciclo atual seu plano será renovado automaticamente.'
             });
        }

        // 1. Tenta remover a data de fim no Asaas (Reativar recorrência)
        const asaasApiUrl = getAsaasApiUrl();
        const asaasApiKey = getAsaasApiKey();
        const response = await fetch(`${asaasApiUrl}/subscriptions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
            body: JSON.stringify({ endDate: null }) // null remove a data de encerramento
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        // Se der erro (ex: assinatura já deletada), forçamos o usuário a assinar de novo
        if (response.status !== 200 || data.errors || data.deleted) {
            return res.status(400).json({ error: 'Não foi possível reativar automaticamente. Por favor, assine novamente.' });
        }

        // Reativa notificações do cliente no Asaas caso tenham sido desativadas no cancelamento
        if (data.customer) {
            await fetch(`${asaasApiUrl}/customers/${data.customer}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
                body: JSON.stringify({ notificationDisabled: false })
            }).catch(() => {});
        }

        // 2. Atualiza banco local
        await psychologist.update({ cancelAtPeriodEnd: false, canceledAt: null, reactivatedAt: new Date() });
        await db.Subscription.update({ status: 'ACTIVE' }, { where: { id: subId } }).catch(() => {});

        res.json({ message: 'Assinatura reativada com sucesso! A cobrança automática voltará a ocorrer.' });

    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar reativação.' });
    }
};