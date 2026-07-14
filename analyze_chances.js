const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  
  const query = `
    WITH match_eligible AS (
        SELECT id, nome
        FROM "Psychologists"
        WHERE status = 'active'
          AND "fotoUrl" IS NOT NULL AND "fotoUrl" != ''
          AND (valor_sessao_numero IS NOT NULL OR valor_mensal_numero IS NOT NULL)
          AND jsonb_array_length(temas_atuacao) > 0
    ),
    appearances AS (
        SELECT 
            p.id, 
            p.nome, 
            COUNT(m.id) as qtd_match
        FROM match_eligible p
        LEFT JOIN "MatchEvents" m 
            ON m."psychologistId" = p.id 
            AND m."createdAt" >= NOW() - INTERVAL '5 days'
        GROUP BY p.id, p.nome
    )
    SELECT 
        (SELECT COUNT(*) FROM "Psychologists" WHERE status = 'active') as total_active,
        (SELECT COUNT(*) FROM match_eligible) as total_eligible,
        COUNT(*) as count_analyzed,
        MAX(qtd_match) as max_appearances,
        MIN(qtd_match) as min_appearances,
        AVG(qtd_match) as avg_appearances,
        SUM(CASE WHEN qtd_match = 0 THEN 1 ELSE 0 END) as zero_appearances,
        SUM(CASE WHEN qtd_match BETWEEN 1 AND 5 THEN 1 ELSE 0 END) as low_appearances,
        SUM(CASE WHEN qtd_match BETWEEN 6 AND 15 THEN 1 ELSE 0 END) as med_appearances,
        SUM(CASE WHEN qtd_match > 15 THEN 1 ELSE 0 END) as high_appearances
    FROM appearances;
  `;
  
  try {
    const res = await client.query(query);
    console.log("=== ANÁLISE GERAL ===");
    console.table(res.rows);

    const queryTop = `
        SELECT p.id, p.nome, COUNT(m.id) as qtd_match
        FROM "Psychologists" p
        LEFT JOIN "MatchEvents" m ON m."psychologistId" = p.id AND m."createdAt" >= NOW() - INTERVAL '5 days'
        WHERE p.status = 'active'
          AND p."fotoUrl" IS NOT NULL AND p."fotoUrl" != ''
          AND (p.valor_sessao_numero IS NOT NULL OR p.valor_mensal_numero IS NOT NULL)
          AND jsonb_array_length(p.temas_atuacao) > 0
        GROUP BY p.id, p.nome
        ORDER BY qtd_match DESC
        LIMIT 5;
    `;
    const resTop = await client.query(queryTop);
    console.log("\n=== TOP 5 MAIS MOSTRADOS ===");
    console.table(resTop.rows);

  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
