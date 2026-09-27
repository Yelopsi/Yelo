const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Connected to PROD DB");

    // Check Tables
    const tables = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public'
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("Tables:", tables.map(t => t.table_name));

    // Priority 1: Psychologists
    const psys = await sequelize.query(`
      SELECT 
        status, 
        COUNT(*) as total,
        SUM(CASE WHEN "planExpiresAt" > NOW() THEN 1 ELSE 0 END) as not_expired,
        SUM(CASE WHEN "subscription_payments_count" > 0 THEN 1 ELSE 0 END) as has_payments,
        SUM(CASE WHEN "subscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as has_sub_id
      FROM "Psychologists"
      WHERE "deletedAt" IS NULL
      GROUP BY status
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("PROD PSYCHOLOGISTS STATUS:", psys);
    
    // Check Subscriptions
    const subs = await sequelize.query(`
      SELECT status, COUNT(*) FROM "Subscriptions" GROUP BY status
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("PROD SUBSCRIPTIONS:", subs);

    // Check Payments
    const pays = await sequelize.query(`
      SELECT status, COUNT(*) FROM "Payments" GROUP BY status
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("PROD PAYMENTS:", pays);

    // Check Sept 15
    const sept15 = await sequelize.query(`
      SELECT status, COUNT(*)
      FROM "Psychologists"
      WHERE "updatedAt" >= '2026-09-15 00:00:00' AND "updatedAt" < '2026-09-16 00:00:00'
      AND "deletedAt" IS NULL
      GROUP BY status
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("PROD SEPT 15 UPDATES:", sept15);

    // Check WebhookInbox
    const webhooks = await sequelize.query(`
      SELECT type, COUNT(*) FROM "WebhookInbox" GROUP BY type
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("PROD WEBHOOKS:", webhooks);
    
    // AdSpends
    const adSpends = await sequelize.query(`
      SELECT COUNT(*) FROM "AdSpends"
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("PROD ADSPENDS:", adSpends);
    
    // Google UTMs
    const utms = await sequelize.query(`
      SELECT "utmSource", COUNT(*) as c
      FROM "WhatsAppClickLogs"
      WHERE "createdAt" >= NOW() - INTERVAL '90 days'
      GROUP BY "utmSource"
      ORDER BY c DESC LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("PROD UTMS:", utms);

    process.exit(0);
  } catch (error) {
    console.error("Error connecting to PROD:", error);
    process.exit(1);
  }
}
run();
