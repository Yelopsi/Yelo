const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT 
      status, 
      COUNT(*) as total,
      SUM(CASE WHEN "planExpiresAt" > NOW() THEN 1 ELSE 0 END) as not_expired,
      SUM(CASE WHEN "planExpiresAt" <= NOW() THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN "planExpiresAt" IS NULL THEN 1 ELSE 0 END) as null_expire,
      SUM(CASE WHEN "subscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as has_sub_id,
      SUM(CASE WHEN "firstPaidAt" IS NOT NULL THEN 1 ELSE 0 END) as has_first_paid
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log('--- PAYERS BY STATUS ---');
  console.log(users);
  
  const sept15 = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE "updatedAt" >= '2026-09-15 00:00:00' AND "updatedAt" < '2026-09-16 00:00:00'
    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log('--- UPDATED ON SEPT 15 ---');
  console.log(sept15);

  process.exit();
}
test();
