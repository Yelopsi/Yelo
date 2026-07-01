require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const [patients] = await db.sequelize.query('SELECT email FROM "Patients" WHERE email LIKE \'%toyama%\'');
  const [psis] = await db.sequelize.query('SELECT email FROM "Psychologists" WHERE email LIKE \'%toyama%\'');
  console.log('Patients:', patients);
  console.log('Psychologists:', psis);
  process.exit(0);
}
test();
