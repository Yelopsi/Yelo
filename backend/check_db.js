const db = require('./models');

async function check() {
  try {
    const psis = await db.Psychologist.findAll();
    console.log("Psychologists in DB:", JSON.stringify(psis, null, 2));
    const patients = await db.Patient.findAll();
    console.log("Patients in DB:", JSON.stringify(patients, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
check();
