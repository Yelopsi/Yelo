const ReconciliationService = require('../services/reconciliationService');
const db = require('../models');

exports.runAudit = async (req, res) => {
    try {
        const result = await ReconciliationService.runFullAudit();
        if (!result.success) {
            return res.status(409).json({ message: 'Falha ou Lock não adquirido', detail: result });
        }
        return res.status(200).json({ message: 'Reconciliação executada com sucesso', runId: result.runId });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro interno ao disparar reconciliação' });
    }
};

exports.getAuditReport = async (req, res) => {
    try {
        const { status, severity } = req.query;
        const whereClause = {};
        
        if (status === 'open') {
            whereClause.resolvedAt = null;
        } else if (status === 'resolved') {
            whereClause.resolvedAt = { [db.Sequelize.Op.not]: null };
        }

        if (severity) {
            whereClause.severity = severity;
        }

        const audits = await db.ReconciliationAudit.findAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit: 100
        });

        return res.status(200).json(audits);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao buscar relatório de auditoria' });
    }
};
