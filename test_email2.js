require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const [patients] = await db.sequelize.query('SELECT id, email FROM "Patients" WHERE email ILIKE \'%toyama%\'');
  const [psis] = await db.sequelize.query('SELECT id, email FROM "Psychologists" WHERE email ILIKE \'%toyama%\'');
  
  console.log('Psis:', psis);
  console.log('Patients:', patients);
  process.exit(0);
}
test();
