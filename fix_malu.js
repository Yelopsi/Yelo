const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
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
