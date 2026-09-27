const { sequelize } = require('./backend/models');
async function test() {
  const q = `
    SELECT COUNT(*) as active
    FROM "Psychologists"
    WHERE status = 'active'
    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
  `;
  const res = await sequelize.query(q, { type: sequelize.QueryTypes.SELECT });
  console.log('Query de ativos (que eu acho que é):', res);
  process.exit();
}
test();
