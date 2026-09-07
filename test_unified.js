const db = require('./backend/models');
async function run() {
    try {
        const query = `
            SELECT topic, COUNT(*) as count FROM (
                SELECT jsonb_array_elements_text("searchParams"->'temas') as topic 
                FROM "DemandSearches" 
                WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'array'
                UNION ALL
                SELECT "searchParams"->>'temas' as topic 
                FROM "DemandSearches" 
                WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'string'
            ) sub 
            GROUP BY topic 
            ORDER BY count DESC 
            LIMIT 5;
        `;
        const [results] = await db.sequelize.query(query);
        console.log("Unified results:", results);
    } catch(e) {
        console.error(e);
    }
}
run().then(() => process.exit(0));
