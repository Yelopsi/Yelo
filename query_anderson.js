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
    SELECT 
        id, 
        nome, 
        temas_atuacao, 
        abordagens_tecnicas, 
        valor_sessao_numero, 
        valor_mensal_numero, 
        tipo_cobranca,
        status, 
        LENGTH(bio) as bio_length,
        CASE WHEN "fotoUrl" IS NOT NULL AND "fotoUrl" != '' THEN 'Sim' ELSE 'Não' END as tem_foto
    FROM "Psychologists"
    WHERE id = 94;
  `;
  
  try {
    const res = await client.query(query);
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
