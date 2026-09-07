const db = require('./backend/models');
async function run() {
    try {
        const [arrays] = await db.sequelize.query(`SELECT "createdAt" FROM "DemandSearches" WHERE jsonb_typeof("searchParams"->'temas') = 'array' ORDER BY "createdAt" DESC LIMIT 5`);
        console.log("Arrays dates:", arrays);
    } catch(e) {
        console.error(e);
    }
}
run().then(() => process.exit(0));
