const db = require('./backend/models');
async function test() {
  try {
    const psiId = 1; // dummy
    // Test appointments
    console.log("Testing appointments...");
    await db.Appointment.findAll({ where: { psychologistId: psiId } });
    console.log("Appointments OK");
    
    // Test getStats queries
    console.log("Testing getStats queries...");
    const dateCondition = "";
    const replacements = { psiId };
    await db.sequelize.query(`SELECT COUNT(*) as count FROM "PatientFavorites" WHERE "PsychologistId" = :psiId`, { replacements, type: db.sequelize.QueryTypes.SELECT });
    console.log("Stats OK");
  } catch (err) {
    console.error("Crash:", err);
  } finally {
    process.exit();
  }
}
test();
