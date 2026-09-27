const { sequelize } = require('./backend/models');
async function test() {
  const q = `
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    GROUP BY status
  `;
  const res = await sequelize.query(q, { type: sequelize.QueryTypes.SELECT });
  console.log('Total de psicólogos pagantes por status:');
  console.log(res);
  
  const q2 = `
    SELECT status, COUNT(*)
    FROM "Psychologists"
    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
    AND "deletedAt" IS NULL
    AND "canceledAt" IS NOT NULL
    GROUP BY status
  `;
  const res2 = await sequelize.query(q2, { type: sequelize.QueryTypes.SELECT });
  console.log('\nCom canceledAt preenchido por status:');
  console.log(res2);

  process.exit();
}
test();
