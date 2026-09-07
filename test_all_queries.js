const db = require('./backend/models');
async function run() {
    const psychologistId = 1; // dummy
    const city = "São Paulo";
    const myEngagement = 100;
    
    const queries = {
        cityAvg: {
            query: `SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE "cidade" = :city AND status = 'active' AND "valor_sessao_numero" > 0`,
            replacements: { city }
        },
        platformAvg: {
            query: `SELECT AVG("valor_sessao_numero") as avg FROM "Psychologists" WHERE status = 'active' AND "valor_sessao_numero" > 0`,
            replacements: {}
        },
        topTopics: {
            query: `SELECT value as topic, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 5;`,
            replacements: {}
        },
        visibility: {
            query: `SELECT TO_CHAR(d.day, 'DD/MM') as label, COALESCE(COUNT(p.id), 0) as appearances FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS day) d LEFT JOIN "ProfileAppearanceLogs" p ON p."createdAt"::date = d.day AND p."psychologistId" = :psychologistId GROUP BY d.day ORDER BY d.day ASC;`,
            replacements: { psychologistId }
        },
        platformStrength: {
            query: `SELECT AVG(xp) as avgEngagement, (SELECT AVG(rating) FROM "Reviews") as avgRating, (SELECT CAST(COUNT(*) AS FLOAT) / (SELECT COUNT(*) FROM "Psychologists" WHERE status='active') FROM posts) as avgPosts FROM "Psychologists" WHERE status = 'active'`,
            replacements: {}
        },
        betterThan: {
            query: `SELECT COALESCE(COUNT(*) * 100.0 / NULLIF((SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active'), 0), 0) as percentage FROM "Psychologists" WHERE status = 'active' AND xp < :myEngagement`,
            replacements: { myEngagement }
        }
    };
    
    for (const [name, q] of Object.entries(queries)) {
        try {
            await db.sequelize.query(q.query, { replacements: q.replacements, type: db.sequelize.QueryTypes.SELECT });
            console.log(`✅ ${name} success`);
        } catch(e) {
            console.error(`❌ ${name} failed:`, e.message);
        }
    }
    
    try {
        await db.Review.findAll({ where: { psychologistId }, attributes: [[db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating']] });
        console.log(`✅ reviews success`);
    } catch(e) {
        console.error(`❌ reviews failed:`, e.message);
    }
    
}
run().then(() => process.exit(0));
