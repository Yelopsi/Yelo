const db = require('./backend/models');
async function run() {
    try {
        const [samples] = await db.sequelize.query(`SELECT "createdAt", "searchParams"->'temas' as temas FROM "DemandSearches" WHERE "searchParams"->'temas' IS NOT NULL ORDER BY "createdAt" DESC LIMIT 5`);
        console.log("Samples:", JSON.stringify(samples, null, 2));
    } catch(e) {
        console.error("Query failed:", e.message);
    }
}
run().then(() => process.exit(0));
