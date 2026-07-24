const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  
  const tables = ['MatchEvents', 'Psychologists', 'ProfileAppearanceLogs'];
  
  for (let table of tables) {
    console.log(`\n--- Schema for ${table} ---`);
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1
    `, [table]);
    console.log(res.rows);
  }
  
  await client.end();
}

main().catch(console.error);
