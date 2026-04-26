const db = require('../models');

/**
 * Rota: POST /api/tracking/visit
 * Registra a chegada do paciente e salva a origem (UTMs)
 */
exports.registerVisit = async (req, res) => {
    try {
        const { page, utm_source, utm_medium, utm_campaign } = req.body;
        
        // Cria tabela separada apenas para as páginas de conversão (Landing Pages)
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "LandingVisits" (
                id SERIAL PRIMARY KEY,
                page VARCHAR(255),
                utm_source VARCHAR(255),
                utm_medium VARCHAR(255),
                utm_campaign VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await db.sequelize.query(
            `INSERT INTO "LandingVisits" (page, utm_source, utm_medium, utm_campaign) VALUES (:page, :utm_source, :utm_medium, :utm_campaign)`,
            { replacements: { 
                page: page || 'home', 
                utm_source: utm_source || 'direto', 
                utm_medium: utm_medium || null, 
                utm_campaign: utm_campaign || null 
            } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar visita:', error);
        res.status(500).json({ error: 'Internal error' });
    }
};

/**
 * Rota: POST /api/tracking/questionario-step
 * Registra ou atualiza até qual etapa o usuário chegou antes de desistir.
 */
exports.registerQuestionnaireStep = async (req, res) => {
    try {
        const { searchId, step, utms } = req.body;
        
        await db.sequelize.query(`
            CREATE TABLE IF NOT EXISTS "TrackingLogs" (
                id SERIAL PRIMARY KEY,
                "searchId" VARCHAR(255),
                step VARCHAR(255),
                type VARCHAR(50),
                utm_source VARCHAR(255),
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Ao invés de salvar todos os passos, apagamos o passo anterior deste mesmo usuário.
        // Assim, o banco guarda sempre apenas o ÚLTIMO passo que ele viu (o real Drop-off).
        if (searchId) {
            await db.sequelize.query(
                `DELETE FROM "TrackingLogs" WHERE "searchId" = :searchId`,
                { replacements: { searchId: String(searchId) } }
            );
        }

        const source = (utms && utms.utm_source) ? utms.utm_source : 'direto';

        await db.sequelize.query(
            `INSERT INTO "TrackingLogs" ("searchId", step, type, utm_source) VALUES (:searchId, :step, 'questionario_dropoff', :utm_source)`,
            { replacements: { searchId: String(searchId), step, utm_source: source } }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro ao registrar dropoff:', error);
        res.status(500).json({ error: 'Internal error' });
    }
};