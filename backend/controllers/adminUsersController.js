const db = require('../models');
const { Op } = require('sequelize');
const gamificationService = require('../services/gamificationService');

/**
 * Rota: GET /api/admin/verifications (NOVA)
 * Descrição: Busca psicólogos com status 'pending' para verificação.
 */
exports.getPendingVerifications = async (req, res) => {
    try {
        const pending = await db.Psychologist.findAll({
            where: { status: 'pending' },
            attributes: ['id', 'nome', 'email', 'crp', 'cpf', 'createdAt']
        });
        res.status(200).json(pending);
    } catch (error) {
        console.error('Erro em getPendingVerifications:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

/**
 * Rota: PUT /api/admin/psychologists/:id/moderate (NOVA)
 * Descrição: Modera (aprova/rejeita) um psicólogo.
 */
exports.moderatePsychologist = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'active' ou 'rejected'

        if (!['active', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido. Use "active" ou "rejected".' });
        }

        console.log(`[Admin] Moderando psicólogo ${id} para ${status}`);
        
        const psychologist = await db.Psychologist.findByPk(id);
        if (psychologist) {
            await psychologist.update({ status });
            res.status(200).json({ message: `Psicólogo ${status} com sucesso.` });
        } else {
            res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }
    } catch (error) {
        console.error('Erro em moderatePsychologist:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

/**
 * Rota: PATCH /api/admin/psychologists/:id/vip
 * Descrição: Ativa ou desativa o status VIP (isento) de um psicólogo.
 */
exports.updateVipStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { plan } = req.body; // Recebe 'ESSENTIAL', 'CLINICAL', 'REFERENCE', ou null

        const psychologist = await db.Psychologist.findByPk(id);

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        let message;
        let newExemptStatus;
        let newPlan;
        let updatePayload = {};

        if (plan) {
            newExemptStatus = true;
            newPlan = plan;
            message = `Isenção do plano ${plan} concedida com sucesso.`;
            updatePayload.status = 'active'; 
        } else {
            newExemptStatus = false;
            newPlan = null;
            message = 'Isenção removida com sucesso.';
            
            if (!psychologist.stripeSubscriptionId) {
                updatePayload.status = 'inactive';
            }
        }

        updatePayload.is_exempt = newExemptStatus;
        updatePayload.plano = newPlan;

        await psychologist.update(updatePayload);

        // --- GAMIFICATION: Tenta atribuir a badge de Pioneiro se virou VIP ---
        if (plan) {
            gamificationService.assignPioneerBadge(psychologist.id).catch(e => console.error("Erro no hook de badge Pioneiro (VIP):", e));
        }

        res.status(200).json({
            message,
            is_exempt: newExemptStatus,
            plano: newPlan
        });

    } catch (error) {
        console.error('Erro ao atualizar status VIP:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: GET /api/admin/psychologists/:id/full-details
 * Descrição: Busca TODOS os dados relacionados a um psicólogo (Visão 360º).
 */
exports.getPsychologistFullDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const psychologist = await db.Psychologist.findByPk(id, {
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] },
            paranoid: false 
        });

        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const numericId = parseInt(id, 10);

        let blogPosts = await db.sequelize.query(
            `SELECT * FROM posts WHERE psychologist_id = :id ORDER BY created_at DESC`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        let forumPosts = await db.sequelize.query(
            `SELECT * FROM "ForumPosts" WHERE "PsychologistId" = :id ORDER BY "createdAt" DESC`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        let forumComments = await db.sequelize.query(
            `SELECT fc.*, fp.title as "postTitle"
             FROM "ForumComments" fc
             LEFT JOIN "ForumPosts" fp ON fc."ForumPostId" = fp.id
             WHERE fc."PsychologistId" = :id
             ORDER BY fc."createdAt" DESC`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => []);

        const reviews = await db.Review.findAll({
            where: { psychologistId: id },
            order: [['createdAt', 'DESC']]
        }).catch(() => []);

        let matches = await db.sequelize.query(
            `SELECT id, "psychologistId", "matchScore", "createdAt", "updatedAt", "patientId", "source" FROM "MatchEvents" WHERE "psychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => db.sequelize.query(
            `SELECT id, "PsychologistId", "matchScore", "createdAt", "updatedAt", "patientId", "source" FROM "MatchEvents" WHERE "PsychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        )).catch(() => []);
        
        const matchesCount = matches.length;

        if (matches && Array.isArray(matches)) {
            matches.sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
        } else {
            matches = [];
        }

        const whatsappStats = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "psychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsappClickLogs" WHERE "PsychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        )).catch(() => [{ count: 0 }]);
        
        res.json({
            psychologist,
            stats: {
                matches: matchesCount,
                whatsappClicks: whatsappStats[0] ? parseInt(whatsappStats[0].count) : 0,
                forumActivities: forumPosts.length + forumComments.length
            },
            blogPosts,
            forumPosts,
            forumComments: forumComments.map(c => c.toJSON ? { ...c.toJSON(), postTitle: c.ForumPost?.titulo } : c),
            reviews,
            matches: matches.map(m => ({ ...m, createdAt: m.createdAt || m.created_at })) || []
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes completos do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

/**
 * Rota: POST /api/admin/psychologists/grant-trial-all
 * Descrição: Libera 14 dias de teste (Premium) para todos os psicólogos pendentes/inativos.
 */
exports.grantTrialToAll = async (req, res) => {
    try {
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const [updatedRows, metadata] = await db.sequelize.query(`
            UPDATE "Psychologists" 
            SET status = 'active', 
                plano = 'Essencial', 
                "planExpiresAt" = :trialEndDate 
            WHERE status IN ('pending', 'inactive') 
            AND ("is_exempt" IS NULL OR "is_exempt" = false) 
            AND "stripeSubscriptionId" IS NULL
        `, { replacements: { trialEndDate } });

        console.log(`[Admin] 14 dias de teste liberados para os psicólogos.`);
        res.status(200).json({ message: `Sucesso! 14 dias liberados para os profissionais pendentes e inativos.` });
    } catch (error) {
        console.error('Erro ao conceder 14 dias para todos:', error);
        res.status(500).json({ error: 'Erro interno ao processar a liberação em massa.' });
    }
};

exports.getAllPsychologists = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { search, status, plano, isVip, notAnalyzed } = req.query;
        const whereClause = {};
        let isParanoid = true; 
        if (search) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                { crp: { [Op.iLike]: `%${search}%` } }
            ];
        }
        if (status) {
            if (status === 'deleted') {
                whereClause.deletedAt = { [Op.ne]: null };
                isParanoid = false; 
            } else if (status === 'active_paying') {
                whereClause.status = 'active';
                whereClause[Op.or] = [
                    { stripeSubscriptionId: { [Op.ne]: null } },
                    { subscriptionId: { [Op.ne]: null } }
                ];
            } else if (status === 'active_trial') {
                whereClause.status = 'active';
                whereClause.stripeSubscriptionId = null;
                whereClause.subscriptionId = null;
                whereClause.is_exempt = { [Op.or]: [null, false] };
            } else {
                whereClause.status = status;
            }
        }
        if (plano) whereClause.plano = plano;
        if (isVip === 'true') whereClause.is_exempt = true;
        if (notAnalyzed === 'true') {
            whereClause.isProfileAnalyzed = { [Op.ne]: true };
            whereClause.status = { [Op.in]: ['active', 'pending'] }; // Foca nos reais
        }

        const kpisQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'active' AND ("stripeSubscriptionId" IS NOT NULL OR "subscriptionId" IS NOT NULL)) as active_paying,
                COUNT(*) FILTER (WHERE status = 'active' AND ("stripeSubscriptionId" IS NULL AND "subscriptionId" IS NULL) AND (is_exempt IS NULL OR is_exempt = false)) as active_trial,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
                COUNT(*) FILTER (WHERE is_exempt = true) as vip,
                COUNT(*) FILTER (WHERE (status = 'active' OR status = 'pending') AND ("isProfileAnalyzed" IS NULL OR "isProfileAnalyzed" = false)) as fila_cs
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL AND ("isAdmin" IS NULL OR "isAdmin" = false)
        `;
        const [kpiResults] = await db.sequelize.query(kpisQuery, { type: db.sequelize.QueryTypes.SELECT });

        const { count, rows } = await db.Psychologist.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] },
            order: [['createdAt', 'DESC']],
            paranoid: isParanoid
        });
        const totalPages = Math.ceil(count / limit);
        res.status(200).json({
            data: rows,
            totalPages,
            currentPage: page,
            totalCount: count,
            kpis: kpiResults || { total: 0, active: 0, pending: 0, inactive: 0, vip: 0, fila_cs: 0 }
        });
    } catch (error) {
        console.error('Erro ao buscar lista de psicólogos:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.getAllPatients = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const offset = (page - 1) * limit;
        const { search, status } = req.query;
        const whereClause = {};
        let isParanoid = true; 

        if (search) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (status === 'deleted') {
            whereClause.deletedAt = { [Op.ne]: null };
            isParanoid = false; 
        }

        const { count, rows } = await db.Patient.findAndCountAll({
            where: whereClause,
            limit,
            offset,
            attributes: { exclude: ['senha', 'resetPasswordToken', 'resetPasswordExpires'] },
            order: [['createdAt', 'DESC']],
            paranoid: isParanoid
        });

        const dataWithId = rows.map(p => {
            const patientJson = p.toJSON();
            patientJson.nome = `[ID: ${patientJson.id}] ${patientJson.nome}`;
            return patientJson;
        });

        res.status(200).json({ data: dataWithId, totalPages: Math.ceil(count / limit), currentPage: page, totalCount: count });
    } catch (error) {
        console.error('Erro ao buscar lista de pacientes:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.updatePsychologistStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['active', 'inactive', 'pending'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }
        await psychologist.update({ status });
        res.status(200).json(psychologist);
    } catch (error) {
        console.error('Erro ao atualizar status do psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.updatePatientStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Status inválido.' });
        }
        const patient = await db.Patient.findByPk(id);
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });
        
        await patient.update({ status });
        res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar status do paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.deletePsychologist = async (req, res) => {
    try {
        const { id } = req.params;
        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        await psychologist.destroy();
        res.status(200).json({ message: 'Psicólogo excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir psicólogo:', error);
        res.status(500).json({ error: 'Erro interno no servidor.' });
    }
};

exports.forceDeletePsychologist = async (req, res) => {
    try {
        const { id } = req.params;
        const psychologist = await db.Psychologist.findByPk(id, { paranoid: false });
        if (!psychologist) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        await psychologist.destroy({ force: true });
        res.status(200).json({ message: 'Psicólogo excluído permanentemente com sucesso. O e-mail agora está liberado.' });
    } catch (error) {
        console.error('Erro ao excluir psicólogo permanentemente:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao realizar a exclusão permanente.' });
    }
};

exports.deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id);
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });
        await patient.destroy();
        res.status(200).json({ message: 'Paciente excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao excluir o paciente.' });
    }
};

exports.forceDeletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id, { paranoid: false });
        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado.' });
        await patient.destroy({ force: true });
        res.status(200).json({ message: 'Paciente excluído permanentemente com sucesso. O e-mail agora está liberado.' });
    } catch (error) {
        console.error('Erro ao excluir paciente permanentemente:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao realizar a exclusão permanente.' });
    }
};

exports.restorePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const patient = await db.Patient.findByPk(id, { paranoid: false });

        if (!patient) return res.status(404).json({ error: 'Paciente não encontrado na lixeira.' });
        if (!patient.deletedAt) return res.status(400).json({ error: 'Este paciente não está na lixeira.' });

        await patient.restore();
        res.status(200).json({ message: 'Paciente restaurado com sucesso.' });
    } catch (error) {
        console.error('Erro ao restaurar paciente:', error);
        res.status(500).json({ error: 'Erro interno no servidor ao restaurar paciente.' });
    }
};

/**
 * Rota: GET /api/admin/pending-actions
 * Descrição: Busca psicólogos que precisam de contato manual (Follow-up)
 */
exports.getPendingActions = async (req, res) => {
    try {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        const pendingList = [];

        // 1. Análise (Cadastrado > 24h E perfil preenchido E msg_analysis_sent_at NULA)
        const analysisCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: oneDayAgo },
                fotoUrl: { [Op.ne]: null },
                bio: { [Op.ne]: null },
                status: 'active',
                plano: 'trial',
                msg_analysis_sent_at: null
            },
            attributes: ['id', 'nome', 'telefone', 'createdAt', 'fotoUrl', 'bio']
        });
        analysisCandidates.forEach(p => pendingList.push({ ...p.toJSON(), actionType: 'analysis', reason: 'Perfil preenchido há mais de 24h' }));

        // 2. Perfil Incompleto (Cadastrado > 24h E (foto NULA OU bio NULA) E msg_incomplete_profile_sent_at NULA)
        const incompleteCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: oneDayAgo },
                status: 'pending',
                [Op.or]: [
                    { fotoUrl: null },
                    { bio: null },
                    { bio: '' }
                ],
                msg_incomplete_profile_sent_at: null
            },
            attributes: ['id', 'nome', 'telefone', 'createdAt']
        });
        incompleteCandidates.forEach(p => pendingList.push({ ...p.toJSON(), actionType: 'incomplete', reason: 'Perfil incompleto há mais de 24h' }));

        // 3. Churn de trial (Trial expirado há >= 3 dias, E msg_churn_followup_sent_at NULA, STATUS inactive)
        const churnCandidates = await db.Psychologist.findAll({
            where: {
                status: 'inactive',
                plano: 'trial',
                planExpiresAt: { [Op.lte]: threeDaysAgo },
                msg_churn_followup_sent_at: null,
                deletedAt: null
            },
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt', 'plano', 'profile_appearances', 'whatsapp_clicks']
        });

        if (churnCandidates.length > 0) {
            const churnIds = churnCandidates.map(c => c.id);
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: { [Op.in]: churnIds } },
                attributes: ['psychologistId', 'dealClosed']
            });
            
            const matchEventsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "psychologistId" IN (:churnIds) 
                GROUP BY "psychologistId"
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

            const profileViewsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:churnIds) 
                GROUP BY "psychologistId"
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

            churnCandidates.forEach(p => {
                const logs = wppLogs.filter(l => l.psychologistId === p.id);
                const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
                const dealClosedCount = closedDeals.length;
                
                const clicks = logs.length;
                
                const matchEv = matchEventsCount.find(m => m.psychologistId == p.id);
                let appearances = matchEv ? parseInt(matchEv.count, 10) : 0;
                
                const profView = profileViewsCount.find(v => v.psychologistId == p.id);
                let views = profView ? parseInt(profView.count, 10) : 0;
                
                // Fallbacks seguros caso os logs antigos não existam, usa o consolidado do psicólogo
                if (appearances === 0) appearances = p.profile_appearances || 0;
                if (clicks === 0) clicks = p.whatsapp_clicks || 0;

                pendingList.push({ 
                    ...p.toJSON(), 
                    actionType: 'churn', 
                    reason: 'Trial expirado há >3 dias',
                    metrics: { appearances, views, clicks, dealClosedCount }
                });
            });
        }

        // 4. Feedback / Cobrança (Clique WhatsApp > 24h E adminWppReminderSentAt NULA E feedbackGiven = false)
        if (db.WhatsAppClickLog) {
            const clicksQuery = `
                SELECT DISTINCT ON (w."psychologistId") 
                    w."psychologistId", 
                    w."guestName", 
                    w."feedbackToken",
                    p.nome as "patientName"
                FROM "WhatsAppClickLogs" w
                LEFT JOIN "Patients" p ON w."patientId" = p.id
                WHERE w."createdAt" <= :oneDayAgo
                  AND w."feedbackGiven" = false
                  AND w."adminWppReminderSentAt" IS NULL
                ORDER BY w."psychologistId", w."createdAt" DESC
            `;
            const clickedIdsObj = await db.sequelize.query(clicksQuery, {
                replacements: { oneDayAgo },
                type: db.sequelize.QueryTypes.SELECT
            }).catch(() => []);
            
            // Filtra os IDs
            const clickedIds = clickedIdsObj.map(row => row.psychologistId || row.PsychologistId).filter(id => id);

            if (clickedIds.length > 0) {
                const billingCandidates = await db.Psychologist.findAll({
                    where: {
                        id: { [Op.in]: clickedIds }
                    },
                    attributes: ['id', 'nome', 'telefone']
                });
                
                billingCandidates.forEach(p => {
                    const clickData = clickedIdsObj.find(r => (r.psychologistId || r.PsychologistId) === p.id);
                    const pName = clickData ? (clickData.patientName || clickData.guestName || 'um paciente') : 'um paciente';
                    const token = clickData ? clickData.feedbackToken : '';
                    pendingList.push({ 
                        ...p.toJSON(), 
                        actionType: 'billing_feedback', 
                        reason: 'Recebeu clique há mais de 24h',
                        patientName: pName,
                        feedbackToken: token
                    });
                });
            }
        }

        // 5. Expirando Trial (Ativos, Trial, expirando em <= 3 dias e >= -2 dias, admin_billing_sent_at NULA)
        const expirationUpperBound = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const expirationLowerBound = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
        
        const expiringCandidates = await db.Psychologist.findAll({
            where: {
                status: 'active',
                plano: 'trial',
                planExpiresAt: {
                    [Op.lte]: expirationUpperBound,
                    [Op.gte]: expirationLowerBound
                },
                admin_billing_sent_at: null
            },
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt', 'plano', 'profile_appearances', 'whatsapp_clicks']
        });

        if (expiringCandidates.length > 0) {
            const expIds = expiringCandidates.map(c => c.id);
            const wppLogsExp = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: { [Op.in]: expIds } },
                attributes: ['psychologistId', 'dealClosed']
            });
            
            const matchEventsExpCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "psychologistId" IN (:expIds) 
                GROUP BY "psychologistId"
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);
            
            const profileViewsExpCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:expIds) 
                GROUP BY "psychologistId"
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => []);

            expiringCandidates.forEach(p => {
                const logs = wppLogsExp.filter(l => l.psychologistId === p.id);
                const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
                const dealClosed = closedDeals.length > 0;
                const closedDealsCount = closedDeals.length;
                
                const matchEv = matchEventsExpCount.find(m => m.psychologistId == p.id);
                const profView = profileViewsExpCount.find(m => m.psychologistId == p.id);
                
                let appearances = p.profile_appearances || 0;
                let views = 0;
                if (matchEv) appearances = Math.max(appearances, parseInt(matchEv.count));
                if (profView) views = parseInt(profView.count);
                const clicks = Math.max(p.whatsapp_clicks || 0, logs.length);
                
                // dias restantes
                const diffTime = new Date(p.planExpiresAt) - now;
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                pendingList.push({
                    ...p.toJSON(),
                    actionType: 'expiring_trial',
                    reason: 'Trial expira em ' + daysLeft + ' dia(s)',
                    metrics: {
                        appearances,
                        views,
                        clicks,
                        dealClosed,
                        closedDealsCount,
                        daysLeft
                    }
                });
            });
        }

        res.status(200).json(pendingList);
    } catch (error) {
        console.error('Erro em getPendingActions:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

/**
 * Rota: PATCH /api/admin/psychologists/:id/action-sent
 * Descrição: Marca que uma ação de follow-up foi realizada
 */
exports.markActionSent = async (req, res) => {
    try {
        const { id } = req.params;
        const { actionType } = req.body;

        const psychologist = await db.Psychologist.findByPk(id);
        if (!psychologist) {
            return res.status(404).json({ error: 'Psicólogo não encontrado.' });
        }

        const now = new Date();
        if (actionType === 'analysis') {
            await psychologist.update({ msg_analysis_sent_at: now });
        } else if (actionType === 'incomplete') {
            await psychologist.update({ msg_incomplete_profile_sent_at: now });
        } else if (actionType === 'churn') {
            await psychologist.update({ msg_churn_followup_sent_at: now });
        } else if (actionType === 'billing_feedback') {
            if (db.WhatsAppClickLog) {
                await db.WhatsAppClickLog.update(
                    { adminWppReminderSentAt: now, adminWppReminderCount: 1 }, 
                    { where: { psychologistId: id, feedbackGiven: false, adminWppReminderSentAt: null } }
                );
            }
        } else if (actionType === 'expiring_trial') {
            await psychologist.update({ admin_billing_sent_at: now });
        } else {
            return res.status(400).json({ error: 'Tipo de ação inválido.' });
        }

        res.status(200).json({ message: 'Ação registrada com sucesso!' });
    } catch (error) {
        console.error('Erro em markActionSent:', error);
        res.status(500).json({ error: 'Erro no servidor' });
    }
};

exports.resetCrm = async (req, res) => {
    try {
        const Op = db.Sequelize.Op;
        await db.Psychologist.update({
            msg_analysis_sent_at: null,
            msg_incomplete_profile_sent_at: null,
            msg_churn_followup_sent_at: null,
            admin_billing_sent_at: null
        }, {
            where: {
                [Op.or]: [
                    { msg_analysis_sent_at: { [Op.ne]: null } },
                    { msg_incomplete_profile_sent_at: { [Op.ne]: null } },
                    { msg_churn_followup_sent_at: { [Op.ne]: null } },
                    { admin_billing_sent_at: { [Op.ne]: null } }
                ]
            }
        });
        if (db.WhatsAppClickLog) {
            await db.WhatsAppClickLog.update({
                adminWppReminderSentAt: null,
                adminWppReminderCount: 0
            }, {
                where: {
                    adminWppReminderSentAt: { [Op.ne]: null }
                }
            });
        }
        res.status(200).json({ message: 'CRM resetado com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao resetar CRM' });
    }
};