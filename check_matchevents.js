const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
      await client.connect();
      const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'MatchEvents';
      `);
      console.log(res.rows.map(r => r.column_name));
  } catch (e) {
      console.error(e);
  } finally {
      await client.end();
  }
}

run();
