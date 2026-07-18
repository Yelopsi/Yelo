const db = require('./backend/models');
async function run() {
  const nullLogs = await db.sequelize.query(`
    SELECT count(*) FROM "WhatsAppClickLogs" WHERE "feedbackGiven" IS NULL
  `);
  console.log("NULL feedbackGiven count:", nullLogs[0]);
  process.exit();
}
run();
