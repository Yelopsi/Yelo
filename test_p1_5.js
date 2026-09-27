const { sequelize } = require('./backend/models');
async function test() {
  const subs = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Subscriptions"
    GROUP BY status
  `, { type: sequelize.QueryTypes.SELECT });
  console.log("SUBSCRIPTIONS STATUSES:", subs);
  
  const activeSubs = await sequelize.query(`
    SELECT "psychologistId", status, "endDate"
    FROM "Subscriptions"
    WHERE status IN ('ACTIVE', 'active')
    OR "endDate" > NOW()
  `, { type: sequelize.QueryTypes.SELECT });
  console.log("Active Subscriptions count:", activeSubs.length);

  // Cross reference Psychologists
  const psyIds = activeSubs.map(s => s.psychologistId);
  const psys = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE id IN (:ids)
    GROUP BY status
  `, { replacements: { ids: psyIds.length ? psyIds : [0] }, type: sequelize.QueryTypes.SELECT });
  console.log("Psychologists with active subscriptions status:", psys);

  process.exit();
}
test();
