const { sequelize } = require('./backend/models');
async function test() {
  const users = await sequelize.query(`
    SELECT id, status, "createdAt", "updatedAt", "canceledAt", "planExpiresAt"
    FROM "Psychologists"
    WHERE status IN ('inactive', 'canceled')
    LIMIT 20
  `, { type: sequelize.QueryTypes.SELECT });
  console.log(users);
  process.exit();
}
test();
