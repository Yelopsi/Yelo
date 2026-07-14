const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
      await client.connect();
      // Count patients grouped by day for the last 15 days
      const res1 = await client.query(`
        SELECT DATE("createdAt") as date, COUNT(*) as count 
        FROM "Patients" 
        WHERE "createdAt" >= current_date - interval '30 days' 
        GROUP BY DATE("createdAt") 
        ORDER BY date DESC
      `);
      console.log("Patients per day (Last 30 days):");
      console.table(res1.rows);
      
      const res2 = await client.query(`
        SELECT COUNT(*) as total_psi FROM "Psychologists" WHERE status != 'inactive'
      `);
      console.log("Total active psychologists:", res2.rows[0].total_psi);

  } catch (e) {
      console.error(e);
  } finally {
      await client.end();
  }
}

run();
