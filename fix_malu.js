require('dotenv').config();
const { Client } = require('pg');
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  const res = await client.query(`
    UPDATE "Psychologists"
    SET plano = 'Essencial'
    WHERE email = 'schmidt.malu.a@gmail.com'
  `);
  
  console.log("Updated:", res.rowCount);
  await client.end();
}
run().catch(console.error);
