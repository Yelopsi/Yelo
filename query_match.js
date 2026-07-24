const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  await client.connect();
  
  const query = `
    WITH MatchCounts AS (
      SELECT 
        p.id,
        p.nome,
        COUNT(m.id) as match_count
      FROM "Psychologists" p
      LEFT JOIN "MatchEvents" m 
        ON p.id = m."psychologistId" 
        AND m."createdAt" >= NOW() - INTERVAL '7 days'
      WHERE p.status = 'active'
      GROUP BY p.id, p.nome
    )
    SELECT 
      match_count, 
      COUNT(*) as qtd_profissionais
    FROM MatchCounts
    GROUP BY match_count
    ORDER BY match_count ASC;
  `;
  
  const res = await client.query(query);
  console.log("--- Distribution of MatchEvents ---");
  console.table(res.rows);
  
  const stats = await client.query(`
    WITH MatchCounts AS (
      SELECT 
        p.id,
        COUNT(m.id) as match_count
      FROM "Psychologists" p
      LEFT JOIN "MatchEvents" m 
        ON p.id = m."psychologistId" 
        AND m."createdAt" >= NOW() - INTERVAL '7 days'
      WHERE p.status = 'active'
      GROUP BY p.id
    )
    SELECT 
      MIN(match_count) as min_matches,
      MAX(match_count) as max_matches,
      ROUND(AVG(match_count), 2) as avg_matches,
      SUM(match_count) as total_matches,
      COUNT(*) as total_active_prof
    FROM MatchCounts;
  `);
  console.log('Statistics for MatchEvents:');
  console.table(stats.rows);

  // ProfileAppearanceLogs
  const query2 = `
    WITH AppCounts AS (
      SELECT 
        p.id,
        COUNT(a.id) as app_count
      FROM "Psychologists" p
      LEFT JOIN "ProfileAppearanceLogs" a
        ON p.id = a."psychologistId" 
        AND a."createdAt" >= NOW() - INTERVAL '7 days'
      WHERE p.status = 'active'
      GROUP BY p.id
    )
    SELECT 
      app_count, 
      COUNT(*) as qtd_profissionais
    FROM AppCounts
    GROUP BY app_count
    ORDER BY app_count ASC;
  `;
  const res2 = await client.query(query2);
  console.log("\n--- Distribution of ProfileAppearanceLogs ---");
  console.table(res2.rows);

  await client.end();
}

main().catch(console.error);
