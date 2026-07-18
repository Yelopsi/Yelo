const db = require('./backend/models');
async function run() {
  const logs = await db.sequelize.query(`
    SELECT id, "createdAt", "guestName", "feedbackGiven", "dealClosed", "adminWppReminderSentAt", "adminWppReminderCount"
    FROM "WhatsAppClickLogs"
    WHERE "feedbackGiven" = false
    ORDER BY "createdAt" DESC
    LIMIT 10
  `);
  console.log("NOVA TABELA (WhatsAppClickLogs):", logs[0]);

  const oldLogs = await db.sequelize.query(`
    SELECT id, "createdAt", "guestName", "feedbackGiven", "dealClosed", "adminWppReminderSentAt", "adminWppReminderCount"
    FROM "WhatsAppClickLog"
    WHERE "feedbackGiven" = false
    ORDER BY "createdAt" DESC
    LIMIT 10
  `).catch(e => console.log("Erro na tabela antiga:", e.message));

  console.log("OLD LOGS:", oldLogs ? oldLogs[0] : "none");
  process.exit();
}
run();
