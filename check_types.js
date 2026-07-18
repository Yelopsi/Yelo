const db = require('./backend/models');
async function run() {
  const [psiResults] = await db.sequelize.query(`
      SELECT w."feedbackGiven" FROM "WhatsAppClickLogs" w LIMIT 1
  `);
  console.log("Type of feedbackGiven:", typeof psiResults[0].feedbackGiven, psiResults[0].feedbackGiven);
  process.exit();
}
run();
