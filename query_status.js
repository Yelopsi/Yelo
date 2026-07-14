const db = require('./backend/models');
async function run() {
    const statuses = await db.sequelize.query('SELECT DISTINCT status FROM "Psychologists"', { type: db.sequelize.QueryTypes.SELECT });
    console.log(statuses);
    process.exit(0);
}
run();
