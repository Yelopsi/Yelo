const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT status, "subscription_payments_count", "planExpiresAt", "subscriptionId", "firstPaidAt", COUNT(*)
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status, "subscription_payments_count", "planExpiresAt", "subscriptionId", "firstPaidAt"
  `, { type: sequelize.QueryTypes.SELECT });
  // Just want a general count
  const counts = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log(counts);
  process.exit();
}
test();
