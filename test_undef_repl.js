const db = require('./backend/models');
async function run() {
    try {
        const city = undefined;
        await db.sequelize.query('SELECT 1 as val WHERE :city IS NULL', { replacements: { city: city }, type: db.sequelize.QueryTypes.SELECT });
        console.log("undefined replacement success");
    } catch(e) {
        console.error("undefined replacement failed:", e.message);
    }
}
run().then(() => process.exit(0));
