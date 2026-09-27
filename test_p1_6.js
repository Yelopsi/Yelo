const { sequelize } = require('./backend/models');
async function test() {
  const activeSubs = await sequelize.query(`
    SELECT "psychologistId", status
    FROM "Subscriptions"
    WHERE status IN ('ACTIVE', 'active')
  `, { type: sequelize.QueryTypes.SELECT });
  
  const psyIds = activeSubs.map(s => s.psychologistId);
  const psys = await sequelize.query(`
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE id IN (:ids)
    GROUP BY status
  `, { replacements: { ids: psyIds.length ? psyIds : [0] }, type: sequelize.QueryTypes.SELECT });
  
  console.log("Psychologists with ACTIVE Subscriptions in Gateway status:");
  console.log(psys);
  
  process.exit();
}
test();
