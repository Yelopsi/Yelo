const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT "subscription_payments_count", COUNT(*)
    FROM "Psychologists"
    WHERE status = 'inactive'
    AND "deletedAt" IS NULL
    GROUP BY "subscription_payments_count"
    ORDER BY "subscription_payments_count" DESC
    LIMIT 10
  `, { type: sequelize.QueryTypes.SELECT });
  console.log("Inactive users by payments count:");
  console.log(users);
  
  const recents = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE "createdAt" > '2026-01-01'
    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log("Payers created in 2026 by status:");
  console.log(recents);

  process.exit();
}
test();
