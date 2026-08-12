require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    // 1. Migração Geral: garante que ninguém ficou com 'sub_' travado em stripeSubscriptionId
    console.log('1. Executando varredura e migração final de IDs...');
    const migrationRes = await client.query(`
      UPDATE "Psychologists"
      SET "subscriptionId" = "stripeSubscriptionId",
          "stripeSubscriptionId" = NULL
      WHERE "stripeSubscriptionId" LIKE 'sub_%'
      RETURNING id, nome, "subscriptionId";
    `);
    
    if (migrationRes.rows.length > 0) {
        console.log(`✅ ${migrationRes.rows.length} psicólogos tiveram seus IDs migrados corretamente do campo legado para o novo.`);
    } else {
        console.log('✅ Nenhum ID perdido encontrado. Banco de dados já estava limpo.');
    }

    // 2. Resolve a duplicidade da Tainá
    console.log('\n2. Removendo cobrança duplicada da Tainá...');
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    // Exclui a fatura 'pay_g28k2hij0vb3gol9' (mantendo a pay_ni2oh5qw5wk73guh)
    const delRes = await fetch(`${ASAAS_API_URL}/payments/pay_g28k2hij0vb3gol9`, {
        method: 'DELETE',
        headers: { 'access_token': ASAAS_API_KEY }
    });
    
    if (delRes.ok) {
        console.log('✅ Cobrança duplicada excluída com sucesso no Asaas.');
    } else {
        console.log('⚠️ Erro ao excluir duplicidade:', delRes.status, await delRes.text());
    }

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await client.end();
  }
}

run();
