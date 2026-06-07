const express = require('express');
const router = express.Router();
const db = require('../models');
const { verifyTokenLocal } = require('../middlewares/localAuth');
const adminDashboardController = require('../controllers/adminDashboardController');
const demandController = require('../controllers/demandController');

// =============================================================
// ROTA DE ANALYTICS (SESSÃO ANÔNIMA)
// =============================================================
router.post('/analytics/session-end', async (req, res) => {
    try {
        const { sessionId, duration } = req.body;
        if (sessionId && duration && duration > 0) {
            await db.sequelize.query(
                `INSERT INTO "AnonymousSessions" ("sessionId", "durationInSeconds", "endedAt", "createdAt", "updatedAt")
                 VALUES (:sessionId, :duration, NOW(), NOW(), NOW())
                 ON CONFLICT ("sessionId") DO UPDATE SET
                 "durationInSeconds" = :duration, "endedAt" = NOW(), "updatedAt" = NOW();`,
                { replacements: { sessionId, duration: parseInt(duration, 10) }, type: db.sequelize.QueryTypes.INSERT }
            );
        }
        res.status(204).send();
    } catch (error) { res.status(204).send(); }
});

// ROTA DE ANALYTICS (INSTALAÇÃO PWA)
router.post('/analytics/pwa-install', async (req, res) => {
    try {
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const { platform } = req.body; 
        await db.sequelize.query(
            `INSERT INTO "PwaInstallLogs" ("userAgent", "platform", "createdAt") VALUES (:ua, :plat, NOW())`,
            { replacements: { ua: userAgent, plat: platform || 'unknown' } }
        );
        res.status(200).send('OK');
    } catch (error) {
        console.error("Erro ao registrar PWA install:", error);
        res.status(500).send('Erro');
    }
});

// =============================================================
// ROTA DE TELEMETRIA (SHADOW TRACKING)
// =============================================================
router.post('/tracking/uso-feature', verifyTokenLocal, async (req, res) => {
    try {
        const { feature } = req.body;
        const psiId = req.userDecoded.id;
        if (!feature) return res.status(400).send('Feature não informada');
        await db.sequelize.query(
            `INSERT INTO "FeatureTrackingLogs" ("psychologistId", "feature", "createdAt") VALUES (:psiId, :feature, NOW())`,
            { replacements: { psiId, feature }, type: db.sequelize.QueryTypes.INSERT }
        );
        res.status(200).send('Tracked');
    } catch (error) { res.status(500).send('Erro interno'); }
});

// =============================================================
// ROTA DE ANÁLISE DE FUNIL E VISITAS (ADMIN)
// =============================================================
router.get('/admin/analytics/funnel', verifyTokenLocal, adminDashboardController.getFunnelAnalytics);

router.get('/admin/analytics/visits', verifyTokenLocal, async (req, res) => {
    try {
        if (req.userDecoded.role !== 'admin' && req.userDecoded.type !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
        
        const { startDate, endDate } = req.query;
        let dateFilter = ''; const replacements = {};
        if (startDate) { dateFilter += ' AND "createdAt" >= :startDate'; replacements.startDate = startDate; }
        if (endDate) { dateFilter += ' AND "createdAt" <= :endDate'; replacements.endDate = new Date(endDate + 'T23:59:59.999Z').toISOString(); }

        const results = await db.sequelize.query(`
            SELECT COUNT(*) as total FROM "SiteVisits" 
            WHERE (url = '/' OR url LIKE '/?%' OR url = '/terapia-online' OR url LIKE '/terapia-online?%') ${dateFilter}
        `, { type: db.sequelize.QueryTypes.SELECT, replacements });
        res.json({ total: parseInt(results[0]?.total || 0) });
    } catch (error) { res.status(500).json({ error: 'Erro interno' }); }
});

router.get('/admin/stats/pwa', verifyTokenLocal, async (req, res) => {
    try {
        if (req.userDecoded.role !== 'admin' && req.userDecoded.type !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
        const [totalResult] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "PwaInstallLogs"`, { type: db.sequelize.QueryTypes.SELECT });
        const byPlatform = await db.sequelize.query(`SELECT platform, COUNT(*) as count FROM "PwaInstallLogs" GROUP BY platform`, { type: db.sequelize.QueryTypes.SELECT });
        res.json({ total: parseInt(totalResult?.count || 0), byPlatform: byPlatform });
    } catch (error) { res.status(500).json({ error: 'Erro interno' }); }
});

// =============================================================
// FEEDBACKS E EXIT SURVEYS (ADMIN)
// =============================================================
router.get('/admin/feedbacks', demandController.getRatings);
router.get('/admin/exit-surveys', async (req, res) => {
    try {
        const { motivo, nota, startDate, endDate } = req.query;
        let whereClause = 'WHERE 1=1'; const replacements = {};
        if (motivo) { whereClause += ' AND "motivo" ILIKE :motivo'; replacements.motivo = `%${motivo}%`; }
        if (nota) { whereClause += ' AND "avaliacao" = :nota'; replacements.nota = parseInt(nota); }
        if (startDate) { whereClause += ' AND "createdAt" >= :startDate'; replacements.startDate = startDate; }
        if (endDate) { whereClause += ' AND "createdAt" <= :endDate'; replacements.endDate = new Date(endDate + 'T23:59:59.999Z').toISOString(); }
        const statsQuery = `SELECT COUNT(*) as total, AVG(avaliacao)::numeric(10,1) as media, COALESCE(MODE() WITHIN GROUP (ORDER BY motivo), 'Sem dados') as "topReason" FROM "ExitSurveys" ${whereClause}`;
        const listQuery = `SELECT * FROM "ExitSurveys" ${whereClause} ORDER BY "createdAt" DESC LIMIT 100`;
        const [stats] = await db.sequelize.query(statsQuery, { replacements });
        const [list] = await db.sequelize.query(listQuery, { replacements });
        res.json({ stats: stats[0], list });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
});

module.exports = router;