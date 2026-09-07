const db = require('./backend/models');
async function run() {
    try {
        const query = `SELECT value as topic, COUNT(*) as count FROM "DemandSearches", jsonb_array_elements_text("searchParams"->'temas') as value WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND jsonb_typeof("searchParams"->'temas') = 'array' GROUP BY value ORDER BY count DESC LIMIT 5;`;
        
        const [results] = await db.sequelize.query(query);
        console.log("Results from DB:", JSON.stringify(results, null, 2));
        
        // Also let's check how many DemandSearches exist in total
        const [total] = await db.sequelize.query(`SELECT COUNT(*) FROM "DemandSearches"`);
        console.log("Total DemandSearches in DB:", total);
        
        // Let's check how many have 'temas'
        const [withTemas] = await db.sequelize.query(`SELECT COUNT(*) FROM "DemandSearches" WHERE "searchParams"->'temas' IS NOT NULL`);
        console.log("Total DemandSearches with temas:", withTemas);

    } catch(e) {
        console.error("Query failed:", e.message);
    }
}
run().then(() => process.exit(0));
