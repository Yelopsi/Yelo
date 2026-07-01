require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const email = 'contato@toyamaconsultoria.com.br';
  const psy = await db.Psychologist.findOne({ where: { email } });
  const pat = await db.Patient.findOne({ where: { email } });
  
  console.log('Psy:', psy ? { id: psy.id, email: psy.email } : 'None');
  console.log('Pat:', pat ? { id: pat.id, email: pat.email } : 'None');
  process.exit(0);
}
test();
