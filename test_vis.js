const db = require('./backend/models');
async function run() {
    try {
        const psychologistId = 1; // Assuming we use 1 for testing
        const [visibilityRaw] = await db.sequelize.query(`SELECT TO_CHAR(d.day, 'DD/MM') as label, COALESCE(COUNT(p.id), 0) as appearances FROM (SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day')::date AS day) d LEFT JOIN "ProfileAppearanceLogs" p ON p."createdAt"::date = d.day AND p."psychologistId" = :psychologistId GROUP BY d.day ORDER BY d.day ASC;`, { replacements: { psychologistId } });
        console.log("Visibility:", visibilityRaw);
    } catch(e) {
        console.error(e);
    }
}
run().then(() => process.exit(0));
