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