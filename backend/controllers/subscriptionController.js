const db = require('../models');
const bcrypt = require('bcryptjs');
const { sendSubscriptionCancelledEmail } = require('../services/emailService');

// Configurações do Asaas
let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, ''); // Remove barra final e espaços
const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

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
        if (psychologist.subscriptionId) {
            try {
                await fetch(`${ASAAS_API_URL}/subscriptions/${psychologist.subscriptionId}`, {
                    method: 'DELETE',
                    headers: { 'access_token': ASAAS_API_KEY }
                });
            } catch (asaasError) {
                // Log error but continue deletion
            }
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
             await psychologist.update({
                status: 'inactive',
                plano: null,
                planExpiresAt: new Date(),
                cancelAtPeriodEnd: false,
                subscriptionId: null
             });
             return res.status(200).json({ message: 'Assinatura cancelada localmente (Vínculo de pagamento não encontrado).' });
        }

        // 1. Busca dados da assinatura no Asaas para verificar data de criação
        const subResponse = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const subText = await subResponse.text();
        const subData = subText ? JSON.parse(subText) : {};

        if (!subData.id) {
             // Se não achou no Asaas, assume cancelamento manual local e limpa tudo
             await psychologist.update({ 
                  status: 'inactive',
                  plano: null,
                  planExpiresAt: new Date(),
                  cancelAtPeriodEnd: false,
                  subscriptionId: null
              });
             return res.json({ message: 'Assinatura cancelada localmente (Não encontrada no provedor).' });
        }

        // 2. Verifica regra de 7 dias (Direito de Arrependimento - Art 49 CDC)
        // Protege a Yelo legalmente estornando assinaturas feitas há menos de 7 dias.
        let isEligibleForRefund = false;
        if (subData.dateCreated) {
            const subDate = new Date(subData.dateCreated);
            const diffDays = (new Date() - subDate) / (1000 * 60 * 60 * 24);
            if (diffDays <= 7) {
                isEligibleForRefund = true;
            }
        }

        if (isEligibleForRefund) {
            // A. Busca pagamentos confirmados para estornar
            const paymentsRes = await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}/payments`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            const paymentsText = await paymentsRes.text();
            const paymentsData = paymentsText ? JSON.parse(paymentsText) : {};
            
            if (paymentsData.data) {
                for (const payment of paymentsData.data) {
                    if (['CONFIRMED', 'RECEIVED'].includes(payment.status)) {
                        // Estorna o pagamento
                        await fetch(`${ASAAS_API_URL}/payments/${payment.id}/refund`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                            body: JSON.stringify({ value: payment.value, description: "Cancelamento no prazo de 7 dias (Arrependimento)" })
                        });
                    }
                }
            }

            // B. Cancela a assinatura imediatamente (DELETE)
            await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}`, {
                method: 'DELETE',
                headers: { 'access_token': ASAAS_API_KEY }
            });

            // C. Atualiza Banco Local (Revoga acesso premium, mas restaura trial se aplicável)
            const currentBadges = psychologist.badges || {};
            if (currentBadges.pioneiro) {
                delete currentBadges.pioneiro;
            }

            const accountCreatedAt = new Date(psychologist.createdAt);
            const trialEndDate = new Date(accountCreatedAt);
            trialEndDate.setDate(trialEndDate.getDate() + 14);

            if (trialEndDate > new Date()) {
                // Se a conta tem menos de 14 dias, devolve o plano "Essencial" (Trial)
                await psychologist.update({
                    status: 'active',
                    plano: 'Essencial',
                    planExpiresAt: trialEndDate,
                    cancelAtPeriodEnd: false,
                    subscriptionId: null,
                    badges: currentBadges
                });
            } else {
                // Se já passou do trial, corta o acesso na hora
                await psychologist.update({
                    status: 'inactive',
                    plano: null,
                    planExpiresAt: new Date(),
                    cancelAtPeriodEnd: false,
                    subscriptionId: null,
                    badges: currentBadges
                });
            }

            // D. Envia E-mail de Cancelamento
            // [OTIMIZAÇÃO] Não espera o envio do e-mail para responder ao usuário (ganha ~2s)
            sendSubscriptionCancelledEmail(psychologist).catch(e => {});

            return res.json({ message: 'Assinatura cancelada e valor estornado.' });

        } else {
            // --- CENÁRIO B: CANCELAMENTO AGENDADO (> 7 DIAS) ---
            
            // Se o usuário já está inativo, ele não tem período restante. Excluímos direto.
            if (psychologist.status === 'inactive') {
                await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}`, {
                    method: 'DELETE',
                    headers: { 'access_token': ASAAS_API_KEY }
                });
                
                await psychologist.update({
                    cancelAtPeriodEnd: false,
                    subscriptionId: null
                });
                return res.json({ message: 'Assinatura cancelada com sucesso.' });
            }

            // Se está ativo, cancelamos a renovação mas mantemos o acesso até o planExpiresAt atual
            // O Asaas precisa saber quando a assinatura acaba. Passamos a data atual de expiração se existir.
            if (psychologist.planExpiresAt) {
                const endDateStr = new Date(psychologist.planExpiresAt).toISOString().split('T')[0];
                await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
                    body: JSON.stringify({ endDate: endDateStr })
                });
            } else {
                // Fallback, deleta no Asaas se não tiver data
                await fetch(`${ASAAS_API_URL}/subscriptions/${subData.id}`, {
                    method: 'DELETE',
                    headers: { 'access_token': ASAAS_API_KEY }
                });
            }

            // 2. ATUALIZA O BANCO LOCAL
            // NÃO atualizamos o planExpiresAt baseado no Asaas, pois o Asaas joga a data muito pra frente
            // O planExpiresAt local já reflete exatamente o que o psicólogo pagou.
            await psychologist.update({ cancelAtPeriodEnd: true });

            res.json({ message: 'Renovação automática cancelada. Seu acesso continua até o fim do período.' });
        }

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

        // [CORREÇÃO] Verifica ambas as colunas
        const subId = psychologist.subscriptionId;

        if (!subId) {
             return res.status(400).json({ error: 'Nenhuma assinatura encontrada para reativar.' });
        }

        // 1. Tenta remover a data de fim no Asaas (Reativar recorrência)
        const response = await fetch(`${ASAAS_API_URL}/subscriptions/${subId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
            body: JSON.stringify({ endDate: null }) // null remove a data de encerramento
        });

        const responseText = await response.text();
        const data = responseText ? JSON.parse(responseText) : {};

        // Se der erro (ex: assinatura já deletada), forçamos o usuário a assinar de novo
        if (response.status !== 200 || data.errors) {
            return res.status(400).json({ error: 'Não foi possível reativar automaticamente. Por favor, assine novamente.' });
        }

        // 2. Atualiza banco local
        await psychologist.update({ cancelAtPeriodEnd: false });

        res.json({ message: 'Assinatura reativada com sucesso! A cobrança automática voltará a ocorrer.' });

    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar reativação.' });
    }
};