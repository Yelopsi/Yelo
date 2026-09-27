const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT status, "plano", "subscriptionId", "subscription_payments_count"
    FROM "Psychologists"
    WHERE "updatedAt" >= '2026-09-15 00:00:00' AND "updatedAt" < '2026-09-16 00:00:00'
    AND status = 'inactive'
    LIMIT 5
  `, { type: sequelize.QueryTypes.SELECT });
  console.log(users);
  process.exit();
}
test();
