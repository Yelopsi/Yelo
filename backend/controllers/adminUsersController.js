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
            updatePayload.planExpiresAt = new Date('2099-12-31T23:59:59.000Z');
            updatePayload.subscriptionId = null;
            updatePayload.stripeSubscriptionId = null;
        } else {
            newExemptStatus = false;
            newPlan = null;
            message = 'Isenção removida com sucesso.';
            
            if (!psychologist.subscriptionId) {
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
            `SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => db.sequelize.query(
            `SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "PsychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        )).catch(() => [{ count: 0 }]);
        
        const whatsappLogs = await db.sequelize.query(
            `SELECT * FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id ORDER BY "createdAt" DESC LIMIT 100`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => db.sequelize.query(
            `SELECT * FROM "WhatsAppClickLogs" WHERE "PsychologistId" = :id ORDER BY "createdAt" DESC LIMIT 100`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        )).catch(() => []);
        const profileViewsStats = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id`,
            { replacements: { id: numericId }, type: db.sequelize.QueryTypes.SELECT }
        ).catch(() => [{ count: 0 }]); // Fix: removed incorrect fallback to profile_appearances
        
        let matchesCountFixed = matches.length + (psychologist.profile_appearances || 0);
        
        let wpClicksFixed = (whatsappStats[0] ? parseInt(whatsappStats[0].count) : 0) + (psychologist.whatsapp_clicks || 0);
        
        let profileViewsFixed = profileViewsStats[0] ? parseInt(profileViewsStats[0].count) : 0;

        const payments = await db.Payment.findAll({
            where: { psychologistId: id },
            order: [['dueDate', 'DESC']]
        }).catch(() => []);

        res.json({
            psychologist,
            stats: {
                matches: matchesCountFixed,
                whatsappClicks: wpClicksFixed,
                forumActivities: forumPosts.length + forumComments.length,
                profileViews: profileViewsFixed
            },
            blogPosts,
            forumPosts,
            forumComments: forumComments.map(c => c.toJSON ? { ...c.toJSON(), postTitle: c.ForumPost?.titulo } : c),
            reviews,
            matches: matches.map(m => ({ ...m, createdAt: m.createdAt || m.created_at })) || [],
            whatsappLogs,
            payments
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
            AND "subscriptionId" IS NULL
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
        const { search, status, plano, isVip, notAnalyzed, utmChannel, startDate, endDate } = req.query;
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
                whereClause.is_exempt = { [Op.or]: [null, false] };
                whereClause.subscriptionId = { [Op.ne]: null };
                whereClause.planExpiresAt = { [Op.gt]: new Date() };
            } else if (status === 'active_trial') {
                whereClause.status = 'active';
                whereClause.is_exempt = { [Op.or]: [null, false] };
                whereClause.subscriptionId = null;
                whereClause.planExpiresAt = { [Op.gt]: new Date() };
            } else if (status === 'utm_whatsapp') {
                whereClause.utm_source = 'whatsapp';
            } else if (status === 'utm_meta') {
                whereClause.utm_source = { [Op.in]: ['meta_ads', 'facebook', 'instagram'] };
            } else if (status === 'utm_instagram_bio') {
                whereClause.utm_source = 'instagram_bio';
            } else if (status === 'utm_google') {
                whereClause.utm_source = 'google';
            } else if (status === 'utm_outros') {
                whereClause.utm_source = {
                    [Op.or]: [
                        { [Op.is]: null },
                        { [Op.notIn]: ['whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio'] }
                    ]
                };
            } else {
                whereClause.status = status;
            }
        }
        
        if (utmChannel) {
            if (utmChannel === 'utm_whatsapp') {
                whereClause.utm_source = 'whatsapp';
            } else if (utmChannel === 'utm_meta') {
                whereClause.utm_source = { [Op.in]: ['meta_ads', 'facebook', 'instagram'] };
            } else if (utmChannel === 'utm_instagram_bio') {
                whereClause.utm_source = 'instagram_bio';
            } else if (utmChannel === 'utm_google') {
                whereClause.utm_source = 'google';
            } else if (utmChannel === 'utm_outros') {
                whereClause.utm_source = {
                    [Op.or]: [
                        { [Op.is]: null },
                        { [Op.notIn]: ['whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio'] }
                    ]
                };
            }
        }
        
        if (startDate && endDate) {
            whereClause.createdAt = {
                [Op.between]: [new Date(startDate + 'T00:00:00.000Z'), new Date(endDate + 'T23:59:59.999Z')]
            };
        }
        
        if (plano) whereClause.plano = plano;
        if (isVip === 'true') whereClause.is_exempt = true;
        if (notAnalyzed === 'true') {
            whereClause.isProfileAnalyzed = { [Op.ne]: true };
            whereClause.status = { [Op.in]: ['active', 'pending'] }; // Foca nos reais
        }
        let dateFilterQuery = '';
        const replacements = {};
        if (startDate && endDate) {
            dateFilterQuery = ` AND "createdAt" BETWEEN :startDate AND :endDate `;
            replacements.startDate = new Date(startDate + 'T00:00:00.000Z');
            replacements.endDate = new Date(endDate + 'T23:59:59.999Z');
        }

        const kpisQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'active' AND ("subscriptionId" IS NOT NULL) AND (is_exempt IS NULL OR is_exempt = false) AND "planExpiresAt" > NOW()) as active_paying,
                COUNT(*) FILTER (WHERE status = 'active' AND (is_exempt IS NULL OR is_exempt = false) AND "subscriptionId" IS NULL AND "planExpiresAt" > NOW()) as active_trial,
                COUNT(*) FILTER (WHERE status = 'pending') as pending,
                COUNT(*) FILTER (WHERE status = 'inactive' OR ("status" = 'active' AND "planExpiresAt" < NOW())) as inactive,
                COUNT(*) FILTER (WHERE is_exempt = true) as vip,
                COUNT(*) FILTER (WHERE (status = 'active' OR status = 'pending') AND ("isProfileAnalyzed" IS NULL OR "isProfileAnalyzed" = false)) as fila_cs,
                COUNT(*) FILTER (WHERE utm_source = 'whatsapp') as utm_whatsapp,
                COUNT(*) FILTER (WHERE utm_source IN ('meta_ads', 'facebook', 'instagram')) as utm_meta,
                COUNT(*) FILTER (WHERE utm_source = 'instagram_bio') as utm_instagram_bio,
                COUNT(*) FILTER (WHERE utm_source = 'google') as utm_google,
                COUNT(*) FILTER (WHERE utm_source IS NULL OR utm_source NOT IN ('whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio')) as utm_outros,
                
                COUNT(*) FILTER (WHERE utm_source IN ('meta_ads', 'facebook', 'instagram') AND status = 'active' AND ("subscriptionId" IS NOT NULL) AND (is_exempt IS NULL OR is_exempt = false) AND "planExpiresAt" > NOW()) as meta_paying,
                COUNT(*) FILTER (WHERE utm_source IN ('meta_ads', 'facebook', 'instagram') AND status = 'active' AND (is_exempt IS NULL OR is_exempt = false) AND "subscriptionId" IS NULL AND "planExpiresAt" > NOW()) as meta_trial,
                COUNT(*) FILTER (WHERE utm_source = 'google' AND status = 'active' AND ("subscriptionId" IS NOT NULL) AND (is_exempt IS NULL OR is_exempt = false) AND "planExpiresAt" > NOW()) as google_paying,
                COUNT(*) FILTER (WHERE utm_source = 'google' AND status = 'active' AND (is_exempt IS NULL OR is_exempt = false) AND "subscriptionId" IS NULL AND "planExpiresAt" > NOW()) as google_trial
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL AND ("isAdmin" IS NULL OR "isAdmin" = false)
            ${dateFilterQuery}
        `;
        const [kpiResults] = await db.sequelize.query(kpisQuery, { type: db.sequelize.QueryTypes.SELECT, replacements });

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
        const { search, status, utmChannel, startDate, endDate } = req.query;
        const whereClause = {};
        let isParanoid = true; 

        if (search) {
            whereClause[Op.or] = [
                { nome: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (status) {
            if (status === 'deleted') {
                whereClause.deletedAt = { [Op.ne]: null };
                isParanoid = false; 
            } else if (status === 'utm_whatsapp') {
                whereClause.utm_source = 'whatsapp';
            } else if (status === 'utm_meta') {
                whereClause.utm_source = { [Op.in]: ['meta_ads', 'facebook', 'instagram'] };
            } else if (status === 'utm_instagram_bio') {
                whereClause.utm_source = 'instagram_bio';
            } else if (status === 'utm_google') {
                whereClause.utm_source = 'google';
            } else if (status === 'utm_outros') {
                whereClause.utm_source = {
                    [Op.or]: [
                        { [Op.is]: null },
                        { [Op.notIn]: ['whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio'] }
                    ]
                };
            } else {
                whereClause.status = status;
            }
        }
        
        if (utmChannel) {
            if (utmChannel === 'utm_whatsapp') {
                whereClause.utm_source = 'whatsapp';
            } else if (utmChannel === 'utm_meta') {
                whereClause.utm_source = { [Op.in]: ['meta_ads', 'facebook', 'instagram'] };
            } else if (utmChannel === 'utm_instagram_bio') {
                whereClause.utm_source = 'instagram_bio';
            } else if (utmChannel === 'utm_google') {
                whereClause.utm_source = 'google';
            } else if (utmChannel === 'utm_outros') {
                whereClause.utm_source = {
                    [Op.or]: [
                        { [Op.is]: null },
                        { [Op.notIn]: ['whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio'] }
                    ]
                };
            }
        }
        
        if (startDate && endDate) {
            whereClause.createdAt = {
                [Op.between]: [new Date(startDate + 'T00:00:00.000Z'), new Date(endDate + 'T23:59:59.999Z')]
            };
        }
        let dateFilterQuery = '';
        const replacements = {};
        if (startDate && endDate) {
            dateFilterQuery = ` AND "createdAt" BETWEEN :startDate AND :endDate `;
            replacements.startDate = new Date(startDate + 'T00:00:00.000Z');
            replacements.endDate = new Date(endDate + 'T23:59:59.999Z');
        }

        const kpisQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'active') as active,
                COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
                COUNT(*) FILTER (WHERE utm_source = 'whatsapp') as utm_whatsapp,
                COUNT(*) FILTER (WHERE utm_source IN ('meta_ads', 'facebook', 'instagram')) as utm_meta,
                COUNT(*) FILTER (WHERE utm_source = 'instagram_bio') as utm_instagram_bio,
                COUNT(*) FILTER (WHERE utm_source = 'google') as utm_google,
                COUNT(*) FILTER (WHERE utm_source IS NULL OR utm_source NOT IN ('whatsapp', 'meta_ads', 'facebook', 'instagram', 'google', 'instagram_bio')) as utm_outros,
                COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL) as deleted
            FROM "Patients"
            WHERE ("deletedAt" IS NULL OR "deletedAt" IS NOT NULL)
            ${dateFilterQuery}
        `;
        const [kpiResults] = await db.sequelize.query(kpisQuery, { type: db.sequelize.QueryTypes.SELECT, replacements });

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

        res.status(200).json({ 
            data: dataWithId, 
            totalPages: Math.ceil(count / limit), 
            currentPage: page, 
            totalCount: count,
            kpis: kpiResults || { total: 0, active: 0, inactive: 0, utm_whatsapp: 0, utm_meta: 0, utm_instagram_bio: 0, utm_google: 0, utm_outros: 0, deleted: 0 }
        });
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
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const pendingList = [];

        // 1. Análise (Cadastrado > 6h E status = active E msg_analysis_sent_at NULA)
        const analysisCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: sixHoursAgo },
                status: 'active',
                subscriptionId: null,
                subscriptionId: null,
                msg_analysis_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            },
            attributes: ['id', 'nome', 'telefone', 'createdAt', 'fotoUrl', 'bio']
        });
        analysisCandidates.forEach(p => pendingList.push({ ...p.toJSON(), actionType: 'analysis', reason: 'Perfil preenchido há mais de 6h' }));

        // 2. Perfil Incompleto (Cadastrado > 24h E status = pending E msg_incomplete_profile_sent_at NULA)
        const incompleteCandidates = await db.Psychologist.findAll({
            where: {
                createdAt: { [Op.lte]: oneDayAgo },
                status: 'pending',
                msg_incomplete_profile_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            },
            attributes: ['id', 'nome', 'telefone', 'createdAt']
        });
        incompleteCandidates.forEach(p => pendingList.push({ ...p.toJSON(), actionType: 'incomplete', reason: 'Perfil incompleto há mais de 24h' }));

        // 3. Churn de trial (Trial expirado há >= 3 dias, E msg_churn_followup_sent_at NULA, STATUS inactive)
        const churnCandidates = await db.Psychologist.findAll({
            where: {
                status: 'inactive',
                subscriptionId: null,
                planExpiresAt: { [Op.lte]: threeDaysAgo },
                msg_churn_followup_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
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
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "PsychologistId" IN (:churnIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);

            const profileViewsCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:churnIds) 
                GROUP BY "psychologistId"
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "PsychologistId" IN (:churnIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { churnIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);

            churnCandidates.forEach(p => {
                const logs = wppLogs.filter(l => l.psychologistId === p.id);
                const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
                const dealClosedCount = closedDeals.length;
                
                let clicks = logs.length;
                
                const matchEv = matchEventsCount.find(m => m.psychologistId == p.id);
                let appearances = matchEv ? parseInt(matchEv.count, 10) : 0;
                
                const profView = profileViewsCount.find(v => v.psychologistId == p.id);
                let views = profView ? parseInt(profView.count, 10) : 0;
                
                // Soma segura: Logs Novos + Histórico Antigo (evita zerar histórico quando o primeiro log novo entra)
                appearances += (p.profile_appearances || 0);
                clicks += (p.whatsapp_clicks || 0);

                pendingList.push({ 
                    ...p.toJSON(), 
                    actionType: 'churn', 
                    reason: 'Trial expirado há >3 dias',
                    metrics: { appearances, views, clicks, dealClosedCount }
                });
            });
        }

        // 4. Feedback / Cobrança (Clique WhatsApp > 48h E adminWppReminderSentAt NULA E feedbackGiven = false)
        if (db.WhatsAppClickLog) {
            const clicks = await db.WhatsAppClickLog.findAll({
                where: {
                    createdAt: { [Op.lte]: fortyEightHoursAgo },
                    feedbackGiven: { [Op.not]: true },
                    adminWppReminderSentAt: null
                },
                order: [['psychologistId', 'ASC'], ['createdAt', 'DESC']]
            });

            // Filtra o clique mais recente por psicólogo
            const uniqueClicks = [];
            const seenPsyIds = new Set();
            for (const c of clicks) {
                if (!seenPsyIds.has(c.psychologistId)) {
                    seenPsyIds.add(c.psychologistId);
                    uniqueClicks.push(c);
                }
            }

            const clickedIds = uniqueClicks.map(c => c.psychologistId);

            if (clickedIds.length > 0) {
                const billingCandidates = await db.Psychologist.findAll({
                    where: {
                        id: { [Op.in]: clickedIds },
                        deletedAt: null,
                        telefone: { [Op.ne]: null, [Op.not]: '' }
                    },
                    attributes: ['id', 'nome', 'telefone']
                });
                
                // Buscar todos os feedbacks pendentes para os candidatos, para saber o número total pendente
                const allPendingClicks = await db.WhatsAppClickLog.findAll({
                    where: {
                        psychologistId: { [Op.in]: clickedIds },
                        feedbackGiven: false
                    },
                    attributes: ['psychologistId', 'guestName', 'id']
                });

                // Buscar se o psicólogo já recebeu cobrança alguma vez (para saber se é 1ª vez ou recorrente)
                const remindedClicks = await db.WhatsAppClickLog.findAll({
                    where: {
                        psychologistId: { [Op.in]: clickedIds },
                        adminWppReminderSentAt: { [Op.ne]: null }
                    },
                    attributes: ['psychologistId']
                });
                const remindedPsyIds = new Set(remindedClicks.map(c => c.psychologistId));

                billingCandidates.forEach(p => {
                    const clickData = uniqueClicks.find(r => String(r.psychologistId) === String(p.id));
                    const psiPendingClicks = allPendingClicks.filter(c => String(c.psychologistId) === String(p.id));
                    const pendingCount = psiPendingClicks.length;
                    
                    const pName = clickData ? (clickData.guestName || 'um paciente') : 'um paciente';
                    const token = clickData ? clickData.feedbackToken : '';
                    const isFirstFeedbackRequest = !remindedPsyIds.has(p.id);

                    pendingList.push({ 
                        ...p.toJSON(), 
                        actionType: 'billing_feedback', 
                        reason: 'Recebeu clique há mais de 48h',
                        patientName: pName,
                        feedbackToken: token,
                        metrics: { pendingCount, isFirstFeedbackRequest }
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
                subscriptionId: null,
                planExpiresAt: {
                    [Op.lte]: expirationUpperBound,
                    [Op.gte]: expirationLowerBound
                },
                admin_billing_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
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
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "PsychologistId" IN (:expIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);
            
            const profileViewsExpCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:expIds) 
                GROUP BY "psychologistId"
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "PsychologistId" IN (:expIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { expIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);

            expiringCandidates.forEach(p => {
                const logs = wppLogsExp.filter(l => l.psychologistId === p.id);
                const closedDeals = logs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'talking');
                const dealClosed = closedDeals.length > 0;
                const closedDealsCount = closedDeals.length;
                
                const matchEv = matchEventsExpCount.find(m => m.psychologistId == p.id);
                const profView = profileViewsExpCount.find(m => m.psychologistId == p.id);
                
                let appearances = p.profile_appearances || 0;
                let views = 0;
                if (matchEv) appearances += parseInt(matchEv.count, 10);
                if (profView) views = parseInt(profView.count, 10);
                const clicks = (p.whatsapp_clicks || 0) + logs.length;
                
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

        // 6. Pix Vencido (Atraso 1 Dia) - Playbook expired_pix_fomo
        const yesterdayUpperBound = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const yesterdayLowerBound = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        
        const expiredPixCandidates = await db.Psychologist.findAll({
            where: {
                status: 'inactive', // Ao vencer, o cron passa para inactive
                planExpiresAt: {
                    [Op.lte]: yesterdayUpperBound,
                    [Op.gte]: yesterdayLowerBound
                },
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            },
            include: [{
                model: db.Payment,
                as: 'payments',
                where: {
                    billingType: 'PIX',
                    status: { [Op.in]: ['OVERDUE', 'PENDING'] }
                },
                required: true // Só traz quem tem um pagamento PIX pendente/vencido
            }],
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt', 'plano', 'profile_appearances', 'whatsapp_clicks', 'abordagens_tecnicas']
        });

        if (expiredPixCandidates.length > 0) {
            const expPixIds = expiredPixCandidates.map(c => c.id);
            const wppLogsExpPix = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: { [Op.in]: expPixIds } },
                attributes: ['psychologistId', 'dealClosed']
            });
            
            const matchEventsExpPixCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "psychologistId" IN (:expPixIds) 
                GROUP BY "psychologistId"
            `, { replacements: { expPixIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "MatchEvents" 
                WHERE "PsychologistId" IN (:expPixIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { expPixIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);
            
            const profileViewsExpPixCount = await db.sequelize.query(`
                SELECT "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "psychologistId" IN (:expPixIds) 
                GROUP BY "psychologistId"
            `, { replacements: { expPixIds }, type: db.sequelize.QueryTypes.SELECT }).catch(() => db.sequelize.query(`
                SELECT "PsychologistId" as "psychologistId", COUNT(*) as count 
                FROM "ProfileAppearanceLogs" 
                WHERE "PsychologistId" IN (:expPixIds) 
                GROUP BY "PsychologistId"
            `, { replacements: { expPixIds }, type: db.sequelize.QueryTypes.SELECT })).catch(() => []);

            expiredPixCandidates.forEach(p => {
                const logs = wppLogsExpPix.filter(l => l.psychologistId === p.id);
                
                const startedTherapyCount = logs.filter(l => l.dealClosed === 'yes').length;
                const negotiatingCount = logs.filter(l => l.dealClosed === 'talking').length;
                const noReplyCount = logs.filter(l => l.dealClosed !== 'yes' && l.dealClosed !== 'talking').length;
                
                const dealClosed = (startedTherapyCount + negotiatingCount) > 0;
                const closedDealsCount = startedTherapyCount + negotiatingCount;
                
                const matchEv = matchEventsExpPixCount.find(m => m.psychologistId == p.id);
                const profView = profileViewsExpPixCount.find(m => m.psychologistId == p.id);
                
                let appearances = p.profile_appearances || 0;
                let views = 0;
                if (matchEv) appearances += parseInt(matchEv.count, 10);
                if (profView) views = parseInt(profView.count, 10);
                const clicks = (p.whatsapp_clicks || 0) + logs.length;

                pendingList.push({
                    ...p.toJSON(),
                    actionType: 'expired_pix_fomo',
                    reason: 'PIX Vencido há 1 dia',
                    metrics: {
                        appearances,
                        views,
                        clicks,
                        dealClosed,
                        closedDealsCount,
                        startedTherapyCount,
                        negotiatingCount,
                        noReplyCount,
                        approach: p.abordagens_tecnicas || 'Psicologia'
                    }
                });
            });
        }

        // 6. Consultor IA (Performance Baixa)
        try {
            const perfController = require('./adminPerformanceController');
            if (perfController && perfController.getLowPerformanceData) {
                const perfData = await perfController.getLowPerformanceData();
                if (perfData && perfData.psychologists) {
                    perfData.psychologists.forEach(p => {
                        // Omitir se não tiver WhatsApp
                        if (!p.telefone || String(p.telefone).trim() === '') return;
                        
                        // Omitir se já foi contatado pela IA nos últimos 7 dias
                        if (p.aiOptimizationHistory && Array.isArray(p.aiOptimizationHistory)) {
                            const recentlySent = p.aiOptimizationHistory.some(entry => {
                                if (!entry.sentAt) return false;
                                const diffDays = (now - new Date(entry.sentAt)) / (1000 * 60 * 60 * 24);
                                return diffDays <= 7;
                            });
                            if (recentlySent) return;
                        }

                        pendingList.push({
                            ...p,
                            actionType: 'low_performance',
                            reason: 'Consultor IA: Baixa performance de acessos/conversão'
                        });
                    });
                }
            }
        } catch(e) {
            console.error('Erro ao buscar Consultor IA em getPendingActions:', e);
        }

        // 7. Churn de Pagantes (Assinatura não renovada ou cancelada)
        // Regra: ativo ou inativo, JÁ TEVE assinatura (subscriptionId NOT NULL),
        // planExpiresAt expirou antes de hoje, e msg_paid_churn_sent_at é NULL.
        const paidChurnCandidates = await db.Psychologist.findAll({
            where: {
                status: { [Op.in]: ['active', 'inactive'] },
                subscriptionId: { [Op.ne]: null },
                planExpiresAt: { [Op.lt]: startOfToday },
                msg_paid_churn_sent_at: null,
                deletedAt: null,
                telefone: { [Op.ne]: null, [Op.not]: '' }
            },
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt', 'plano', 'status']
        });

        paidChurnCandidates.forEach(p => {
            pendingList.push({
                id: p.id,
                nome: p.nome,
                telefone: p.telefone,
                status: p.status,
                plano: p.plano,
                planExpiresAt: p.planExpiresAt,
                actionType: 'paid_churn',
                reason: 'Churn de Pagante (Assinatura não renovada)'
            });
        });

        // 8. Negociação prolongada (dealClosed === 'talking' > 7 dias, adminWppReminderCount < 2)
        if (db.WhatsAppClickLog) {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const negotiationLogs = await db.WhatsAppClickLog.findAll({
                where: {
                    dealClosed: 'talking',
                    updatedAt: { [Op.lte]: sevenDaysAgo },
                    [Op.or]: [
                        { adminWppReminderCount: { [Op.lt]: 2 } },
                        { adminWppReminderCount: null }
                    ]
                },
                order: [['psychologistId', 'ASC'], ['updatedAt', 'ASC']]
            });

            const groupedNegotiations = {};
            negotiationLogs.forEach(log => {
                if (!groupedNegotiations[log.psychologistId]) {
                    groupedNegotiations[log.psychologistId] = [];
                }
                groupedNegotiations[log.psychologistId].push(log);
            });

            const negotiationPsiIds = Object.keys(groupedNegotiations);
            if (negotiationPsiIds.length > 0) {
                const negCandidates = await db.Psychologist.findAll({
                    where: {
                        id: { [Op.in]: negotiationPsiIds },
                        deletedAt: null,
                        telefone: { [Op.ne]: null, [Op.not]: '' }
                    },
                    attributes: ['id', 'nome', 'telefone']
                });

                negCandidates.forEach(p => {
                    const logs = groupedNegotiations[p.id];
                    const pendingCount = logs.length;
                    let pName = 'um paciente';
                    if (pendingCount > 1) {
                        pName = 'Alguns pacientes';
                    } else if (logs[0].guestName && logs[0].guestName !== 'Visitante' && logs[0].guestName.trim() !== '') {
                        pName = logs[0].guestName;
                    }
                    
                    const token = logs[0].feedbackToken || '';
                    const dataNeg = logs[0].updatedAt.toLocaleDateString('pt-BR');

                    pendingList.push({ 
                        ...p.toJSON(), 
                        actionType: 'negotiation', 
                        reason: `Em negociação > 7 dias (${pendingCount} leads)`,
                        patientName: pName,
                        feedbackToken: token,
                        metrics: { pendingCount, dataNeg }
                    });
                });
            }
        }

        // MOCK PARA TESTE LOCAL
        if (req.hostname === 'localhost' || req.hostname === '127.0.0.1') {
            pendingList.push({
                id: 99999,
                nome: 'MOCK CHURN - Dr. Local',
                telefone: '5511999999999',
                status: 'inactive',
                plano: 'premium_mensal',
                planExpiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                actionType: 'churn',
                reason: 'MOCK: Trial expirado há 5 dias (Apenas Local)',
                metrics: { appearances: 200, views: 15, clicks: 2, dealClosedCount: 1 }
            });

            pendingList.push({
                id: 99999,
                nome: 'MOCK EXPIRANDO - Dr. Local',
                telefone: '5511999999999',
                status: 'active',
                plano: 'premium_mensal',
                planExpiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                actionType: 'expiring_trial',
                reason: 'MOCK: Trial expira em 2 dias (Apenas Local)',
                metrics: { appearances: 180, views: 10, clicks: 3, dealClosedCount: 0, daysLeft: 2 }
            });

            pendingList.push({
                id: 99999,
                nome: 'MOCK BAIXA PERFORMANCE - Dr. Local',
                telefone: '5511999999999',
                status: 'active',
                plano: 'premium_mensal',
                planExpiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
                actionType: 'low_performance',
                reason: 'MOCK: Gargalo de Conversão (Apenas Local)',
                matches_30d: 150,
                views_30d: 20,
                clicks_30d: 0,
                ctr: 0
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
        const updateData = {};
        
        if (actionType === 'analysis') {
            updateData.msg_analysis_sent_at = now;
        } else if (actionType === 'incomplete') {
            updateData.msg_incomplete_profile_sent_at = now;
        } else if (actionType === 'churn') {
            updateData.msg_churn_followup_sent_at = now;
        } else if (actionType === 'paid_churn') {
            updateData.msg_paid_churn_sent_at = now;
        } else if (actionType === 'billing_feedback') {
            if (db.WhatsAppClickLog) {
                await db.WhatsAppClickLog.update(
                    { adminWppReminderSentAt: now, adminWppReminderCount: 1 }, 
                    { where: { psychologistId: id, feedbackGiven: false, adminWppReminderSentAt: null } }
                );
            }
        } else if (actionType === 'expiring_trial') {
            updateData.admin_billing_sent_at = now;
        } else if (actionType === 'low_performance') {
            let history = psychologist.aiOptimizationHistory ? [...psychologist.aiOptimizationHistory] : [];
            history.push({ sentAt: now, action: 'whatsapp_ai_diagnosis' });
            psychologist.aiOptimizationHistory = history;
            psychologist.changed('aiOptimizationHistory', true);
            await psychologist.save();
        } else if (actionType === 'negotiation') {
            if (db.WhatsAppClickLog) {
                await db.WhatsAppClickLog.update(
                    { adminWppReminderSentAt: now, adminWppReminderCount: 2 }, 
                    { where: { psychologistId: id, dealClosed: 'talking' } }
                );
            }
        } else {
            return res.status(400).json({ error: 'Tipo de ação inválido.' });
        }

        if (Object.keys(updateData).length > 0) {
            await psychologist.update(updateData);
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
            admin_billing_sent_at: null,
            msg_paid_churn_sent_at: null
        }, {
            where: {
                [Op.or]: [
                    { msg_analysis_sent_at: { [Op.ne]: null } },
                    { msg_incomplete_profile_sent_at: { [Op.ne]: null } },
                    { msg_churn_followup_sent_at: { [Op.ne]: null } },
                    { admin_billing_sent_at: { [Op.ne]: null } },
                    { msg_paid_churn_sent_at: { [Op.ne]: null } }
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

exports.debugCrm = async (req, res) => {
    try {
        const Op = db.Sequelize.Op;
        const result = {};
        
        result.totalPsychologists = await db.Psychologist.count();
        result.totalClickLogs = await db.WhatsAppClickLog ? await db.WhatsAppClickLog.count() : 0;
        
        result.withMsgAnalysis = await db.Psychologist.count({ where: { msg_analysis_sent_at: { [Op.ne]: null } } });
        result.withMsgIncomplete = await db.Psychologist.count({ where: { msg_incomplete_profile_sent_at: { [Op.ne]: null } } });
        result.withMsgChurn = await db.Psychologist.count({ where: { msg_churn_followup_sent_at: { [Op.ne]: null } } });
        result.withAdminBilling = await db.Psychologist.count({ where: { admin_billing_sent_at: { [Op.ne]: null } } });
        
        if (db.WhatsAppClickLog) {
            result.withWppReminder = await db.WhatsAppClickLog.count({ where: { adminWppReminderSentAt: { [Op.ne]: null } } });
            result.feedbacksNotTrue = await db.WhatsAppClickLog.count({ where: { feedbackGiven: { [Op.not]: true } } });
        }

        const clicksQuery = `
            SELECT DISTINCT ON (w."psychologistId") w."psychologistId"
            FROM "WhatsAppClickLogs" w
            WHERE w."feedbackGiven" IS NOT TRUE
              AND w."adminWppReminderSentAt" IS NULL
            ORDER BY w."psychologistId", w."createdAt" DESC
        `;
        result.rawFeedbackCandidates = await db.sequelize.query(clicksQuery, { type: db.sequelize.QueryTypes.SELECT });
        
        if (result.rawFeedbackCandidates && result.rawFeedbackCandidates.length > 0) {
            const psiIds = result.rawFeedbackCandidates.map(c => c.psychologistId);
            result.billingCandidatesFound = await db.Psychologist.findAll({
                where: { id: { [Op.in]: psiIds }, deletedAt: null },
                attributes: ['id', 'status', 'deletedAt']
            });
            result.billingCandidatesAll = await db.Psychologist.findAll({
                where: { id: { [Op.in]: psiIds } },
                paranoid: false,
                attributes: ['id', 'status', 'deletedAt']
            });
        }

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};