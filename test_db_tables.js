const db = require('./backend/models');
async function run() {
  const patientLogs = await db.sequelize.query(`
    SELECT count(*) FROM "WhatsappClickLogs"
  `).catch(e => console.log("Erro WhatsappClickLogs:", e.message));
  console.log("WhatsappClickLogs count:", patientLogs ? patientLogs[0] : "none");

  const newLogs = await db.sequelize.query(`
    SELECT count(*) FROM "WhatsAppClickLogs"
  `).catch(e => console.log("Erro WhatsAppClickLogs:", e.message));
  console.log("WhatsAppClickLogs count:", newLogs ? newLogs[0] : "none");

  process.exit();
}
run();
