const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    AND "planExpiresAt" > NOW()
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log('PAYERS WITH PLAN NOT EXPIRED');
  console.log(users);
  process.exit();
}
test();
