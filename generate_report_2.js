const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

const start = '2026-07-01T00:00:00.000Z';
const end = '2026-09-26T23:59:59.999Z';

async function run() {
  await client.connect();

  // 2. Conversão e Churn
  const newSubscribersRes = await client.query(`
    SELECT COUNT(*) 
    FROM "Psychologists"
    WHERE "firstPaidAt" >= $1 AND "firstPaidAt" <= $2
    AND (is_exempt IS NULL OR is_exempt = false)
    AND "deletedAt" IS NULL
  `, [start, end]);

  const churnRes = await client.query(`
    SELECT COUNT(*) 
    FROM "Psychologists"
    WHERE status = 'inactive'
    AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0 OR "firstPaidAt" IS NOT NULL)
    AND "updatedAt" >= $1 AND "updatedAt" <= $2
    AND "deletedAt" IS NULL
  `, [start, end]);

  // 3. Auditoria do Motor V5 (Pacientes)
  const leadsTotalRes = await client.query(`
    SELECT COUNT(*) as total
    FROM "WhatsAppClickLogs"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
  `, [start, end]);

  const leadsRespondedRes = await client.query(`
    SELECT "contactReceived", COUNT(*) as count
    FROM "WhatsAppClickLogs"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
    GROUP BY "contactReceived"
  `, [start, end]);

  const leadsDealRes = await client.query(`
    SELECT "dealClosed", COUNT(*) as count
    FROM "WhatsAppClickLogs"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
    GROUP BY "dealClosed"
  `, [start, end]);

  console.log("\n=== 2. Conversão e Churn (01/07 a 26/09) ===");
  console.log("Novos Assinantes:", newSubscribersRes.rows[0].count);
  console.log("Cancelamentos (Churn):", churnRes.rows[0].count);

  console.log("\n=== 3. Auditoria do Motor V5 (01/07 a 26/09) ===");
  console.log("Total de Leads Gerados:", leadsTotalRes.rows[0].total);
  
  console.log("\nLeads por Status de Resposta:");
  console.table(leadsRespondedRes.rows);

  console.log("\nLeads por Status de Negócio:");
  console.table(leadsDealRes.rows);

  await client.end();
}

run().catch(console.error);
