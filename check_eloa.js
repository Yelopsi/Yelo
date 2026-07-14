const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
      await client.connect();
      const res = await client.query(`
        SELECT id, nome, status, profile_appearances, whatsapp_clicks
        FROM "Psychologists" 
        WHERE nome ILIKE '%Karim%';
      `);
      console.log("Karim:", res.rows);
      
      if(res.rows.length > 0) {
          const id = res.rows[0].id;
          
          const matches = await client.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = $1;`, [id]);
          console.log("MatchEvents Count lowercase:", matches.rows[0].count);

          const matches2 = await client.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "PsychologistId" = $1;`, [id]).catch(e => console.log("Uppercase Failed"));
          if (matches2) console.log("MatchEvents Count uppercase:", matches2.rows[0].count);
          
          const views = await client.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = $1;`, [id]);
          console.log("Profile Views Count:", views.rows[0].count);
      }

  } catch (e) {
      console.error(e);
  } finally {
      await client.end();
  }
}

run();
