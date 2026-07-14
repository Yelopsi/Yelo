const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function runAudit() {
    console.log("=== INICIANDO AUDITORIA DO CRM ===");
    
    try {
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const expirationUpperBound = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const expirationLowerBound = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

        // 1. AUDITORIA DE ANÁLISE DE PERFIL
        console.log("\n1. ANÁLISE DE PERFIL (analysis)");
        const analysisCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: sixHoursAgo },
                fotoUrl: { [Op.ne]: null },
                bio: { [Op.notIn]: [null, ''] },
                status: 'active',
                stripeSubscriptionId: null,
                subscriptionId: null,
                msg_analysis_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            }
        });
        
        const analysisAlreadySent = await db.Psychologist.count({
            where: { msg_analysis_sent_at: { [Op.ne]: null } }
        });

        console.log(`- Candidatos pendentes atuais (criados há mais de 6h): ${analysisCandidates.length}`);
        console.log(`- Total de psicólogos que já receberam a análise: ${analysisAlreadySent}`);
        
        // 2. AUDITORIA DE PERFIL INCOMPLETO
        console.log("\n2. PERFIL INCOMPLETO (incomplete)");
        const incompleteCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: fortyEightHoursAgo },
                [Op.or]: [
                    { status: 'pending' },
                    {
                        status: 'active',
                        [Op.or]: [
                            { fotoUrl: null },
                            { bio: null },
                            { bio: '' }
                        ]
                    }
                ],
                msg_incomplete_profile_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            },
            attributes: ['id', 'nome', 'status', 'fotoUrl', 'bio', 'telefone', 'crp', 'valor_sessao_numero', 'modalidade']
        });
        
        const incompleteAlreadySent = await db.Psychologist.count({
            where: { msg_incomplete_profile_sent_at: { [Op.ne]: null } }
        });

        console.log(`- Candidatos pendentes atuais (criados há mais de 48h): ${incompleteCandidates.length}`);
        console.log(`- Total que já recebeu aviso de incompletude: ${incompleteAlreadySent}`);

        // Detalhamento de campos faltantes
        let detalhamentoIncompletos = { falta1: 0, falta2: 0, falta3mais: 0 };
        incompleteCandidates.forEach(p => {
            let faltantes = [];
            if (!p.fotoUrl) faltantes.push('Foto');
            if (!p.bio || p.bio.trim() === '') faltantes.push('Bio');
            if (!p.telefone) faltantes.push('Telefone');
            if (!p.crp) faltantes.push('CRP');
            if (!p.valor_sessao_numero) faltantes.push('Valor da Sessão');
            if (!p.modalidade) faltantes.push('Modalidade');
            
            if (faltantes.length < 3 && faltantes.length > 0) {
                console.log(`  -> ID ${p.id} (${p.nome}) está incompleto. Faltam: ${faltantes.join(', ')}`);
                detalhamentoIncompletos[`falta${faltantes.length}`]++;
            } else if (faltantes.length >= 3) {
                detalhamentoIncompletos.falta3mais++;
            }
        });
        console.log(`- Resumo de campos faltantes: ${detalhamentoIncompletos.falta1} faltam 1, ${detalhamentoIncompletos.falta2} faltam 2, ${detalhamentoIncompletos.falta3mais} faltam 3 ou mais.`);


        // 3. AUDITORIA DE CHURN
        console.log("\n3. CHURN - TRIAL EXPIRADO (churn)");
        const churnCandidates = await db.Psychologist.findAll({
            where: {
                status: 'inactive',
                stripeSubscriptionId: null,
                subscriptionId: null,
                planExpiresAt: { [Op.lte]: threeDaysAgo },
                msg_churn_followup_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            }
        });
        
        const churnAlreadySent = await db.Psychologist.count({
            where: { msg_churn_followup_sent_at: { [Op.ne]: null } }
        });

        console.log(`- Candidatos pendentes para churn (expirado > 3 dias): ${churnCandidates.length}`);
        console.log(`- Total que já recebeu follow-up de churn: ${churnAlreadySent}`);


        // 4. AUDITORIA DE TRIAL EXPIRANDO
        console.log("\n4. TRIAL EXPIRANDO (expiring_trial)");
        const expiringCandidates = await db.Psychologist.findAll({
            where: {
                status: 'active',
                stripeSubscriptionId: null,
                subscriptionId: null,
                planExpiresAt: {
                    [Op.lte]: expirationUpperBound,
                    [Op.gte]: expirationLowerBound
                },
                admin_billing_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            }
        });
        
        const expiringAlreadySent = await db.Psychologist.count({
            where: { admin_billing_sent_at: { [Op.ne]: null } }
        });

        console.log(`- Candidatos pendentes (trial expira entre -2 e +3 dias): ${expiringCandidates.length}`);
        console.log(`- Total que já recebeu aviso de trial expirando: ${expiringAlreadySent}`);

        
        // 5. AUDITORIA DE FEEDBACK/COBRANÇA (CLIQUE WHATSAPP)
        console.log("\n5. FEEDBACK / COBRANÇA DE CONTATO (billing_feedback)");
        const pendingClicks = await db.WhatsAppClickLog.findAll({
            where: {
                createdAt: { [Op.lte]: fortyEightHoursAgo },
                feedbackGiven: { [Op.not]: true },
                adminWppReminderSentAt: null
            },
            order: [['psychologistId', 'ASC'], ['createdAt', 'DESC']]
        });
        
        const clicksAlreadySentReminder = await db.WhatsAppClickLog.count({
            where: { adminWppReminderSentAt: { [Op.ne]: null } }
        });
        
        const clicksAlreadyGivenFeedback = await db.WhatsAppClickLog.count({
            where: { feedbackGiven: true }
        });

        const uniquePsyIds = new Set(pendingClicks.map(c => c.psychologistId));

        console.log(`- Logs de clique pendentes de lembrete (> 48h): ${pendingClicks.length} (de ${uniquePsyIds.size} psicólogos)`);
        console.log(`- Total de cliques que já receberam lembrete: ${clicksAlreadySentReminder}`);
        console.log(`- Total de cliques com feedback já dado: ${clicksAlreadyGivenFeedback}`);

        console.log("\n=== AUDITORIA CONCLUÍDA ===");
    } catch (e) {
        console.error("Erro na auditoria:", e);
    } finally {
        process.exit(0);
    }
}

runAudit();
