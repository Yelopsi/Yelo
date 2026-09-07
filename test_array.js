const db = require('./backend/models');
async function run() {
    try {
        const [arrays] = await db.sequelize.query(`SELECT COUNT(*) FROM "DemandSearches" WHERE jsonb_typeof("searchParams"->'temas') = 'array'`);
        console.log("Arrays count:", arrays);
        const [strings] = await db.sequelize.query(`SELECT COUNT(*) FROM "DemandSearches" WHERE jsonb_typeof("searchParams"->'temas') = 'string'`);
        console.log("Strings count:", strings);
    } catch(e) {
        console.error(e);
    }
}
run().then(() => process.exit(0));
