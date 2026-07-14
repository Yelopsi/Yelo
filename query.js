const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const res = await client.query(`
    SELECT * 
    FROM "TrackingLogs"
    WHERE EXTRACT(MONTH FROM "createdAt") = 7 
      AND EXTRACT(DAY FROM "createdAt") >= 5 
      AND EXTRACT(DAY FROM "createdAt") <= 11;
  `);
  console.log(res.rows);
  await client.end();
}

run().catch(console.error);
