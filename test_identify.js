require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const email = 'contato@toyamaconsultoria.com.br';
  const [patients] = await db.sequelize.query('SELECT 1 FROM "Patients" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
  const [psis] = await db.sequelize.query('SELECT 1 FROM "Psychologists" WHERE email ILIKE :email LIMIT 1', { replacements: { email: email.trim() } });
  
  console.log('Patients:', patients);
  console.log('Psis:', psis);
  process.exit(0);
}
test();
