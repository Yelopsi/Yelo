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
    SELECT 
      id, 
      nome, 
      cpf,
      "valor_sessao_numero",
      "valor_mensal_numero",
      "tipo_cobranca"
    FROM "Psychologists"
    WHERE id = 94;
  `;
  
  const res = await client.query(query);
  console.table(res.rows);
  
  await client.end();
}

main().catch(console.error);
