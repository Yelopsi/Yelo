const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`SELECT id, nome, email, status, plano, "stripeSubscriptionId", "planExpiresAt", "subscriptionId" FROM "Psychologists" WHERE nome ILIKE $1`, ['%Raphaela Teles Brongar%']);
    console.log("Psychologist Data:", res.rows);
    
    if (res.rows.length > 0) {
      const logs = await client.query(`SELECT id, message, "createdAt" FROM "SystemLogs" WHERE message ILIKE $1 ORDER BY "createdAt" DESC LIMIT 10`, [`%${res.rows[0].email}%`]);
      console.log("System Logs:", logs.rows);
      
      const wh = await client.query(`SELECT * FROM "StripeWebhooks" WHERE data ILIKE $1 ORDER BY "createdAt" DESC LIMIT 5`, [`%${res.rows[0].email}%`]).catch(() => ({rows: []}));
      console.log("Webhooks:", wh.rows.map(w => w.type));

      const payments = await client.query(`SELECT * FROM "SubscriptionPayments" WHERE "psychologistId" = $1 ORDER BY "createdAt" DESC LIMIT 5`, [res.rows[0].id]).catch(() => ({rows: []}));
      console.log("Payments:", payments.rows);
      
      const pix = await client.query(`SELECT * FROM "PixCharges" WHERE "psychologistId" = $1 ORDER BY "createdAt" DESC LIMIT 5`, [res.rows[0].id]).catch(() => ({rows: []}));
      console.log("Pix:", pix.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
