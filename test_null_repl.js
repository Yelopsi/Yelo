const db = require('./backend/models');
async function run() {
    try {
        await db.sequelize.query('SELECT 1 as val WHERE :city IS NULL', { replacements: { city: null }, type: db.sequelize.QueryTypes.SELECT });
        console.log("null replacement success");
    } catch(e) {
        console.error("null replacement failed:", e.message);
    }
}
run().then(() => process.exit(0));
