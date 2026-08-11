const db = require('./backend/models');
async function check() {
    const statuses = await db.sequelize.query(`SELECT DISTINCT "dealClosed", COUNT(*) as count FROM "WhatsAppClickLogs" GROUP BY "dealClosed"`, { type: db.sequelize.QueryTypes.SELECT });
    console.log(statuses);
    process.exit(0);
}
check();
