require('dotenv').config();
const db = require('./backend/models');

async function test() {
  const avisos = await db.Aviso.findAll({
    order: [['createdAt', 'DESC']],
    limit: 5,
    raw: true
  });
  console.log(avisos);
  process.exit(0);
}
test();
