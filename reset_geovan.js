require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    console.log('1. Cancelando a assinatura defeituosa no Asaas...');
    const res = await fetch(`${ASAAS_API_URL}/subscriptions/sub_vww10k2x8mei2oqk`, {
        method: 'DELETE',
        headers: { 'access_token': ASAAS_API_KEY }
    });
    
    if (res.ok) {
        console.log('✅ Assinatura cancelada no Asaas com sucesso!');
    } else if (res.status === 404) {
        console.log('✅ Assinatura já estava deletada ou não existe.');
    } else {
        console.log('⚠️ Erro ao cancelar no Asaas:', res.status, await res.text());
    }

    console.log('\n2. Resetando o status do Geovan no banco de dados...');
    await client.query(`
      UPDATE "Psychologists"
      SET "subscriptionId" = NULL,
          "stripeSubscriptionId" = NULL,
          status = 'inactive',
          "planExpiresAt" = '1970-01-01 00:00:00'
      WHERE id = 235
    `);
    console.log('✅ Banco de dados resetado. O acesso dele está bloqueado e ele será forçado a assinar novamente.');

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await client.end();
  }
}

run();
