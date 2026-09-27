const { sequelize } = require('./backend/models');
async function test() {
  const dateEnd90 = new Date();
  const dateStart90 = new Date();
  dateStart90.setDate(dateStart90.getDate() - 90);
  
  const q = `
    WITH RiskPopulation AS (
        SELECT 
            id, 
            status, 
            COALESCE("firstPaidAt", "createdAt") as start_date,
            COALESCE("canceledAt", "updatedAt") as end_date
        FROM "Psychologists"
        WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
        AND "deletedAt" IS NULL
    )
    SELECT 
        COUNT(*) as at_risk,
        SUM(CASE 
            WHEN status IN ('inactive', 'canceled') 
                 AND end_date >= :dateStart 
                 AND end_date <= :dateEnd 
            THEN 1 ELSE 0 
        END) as churned
    FROM RiskPopulation
    WHERE start_date <= :dateEnd
    AND (status = 'active' OR end_date >= :dateStart)
  `;
  const res = await sequelize.query(q, { 
    replacements: { dateStart: dateStart90, dateEnd: dateEnd90 },
    type: sequelize.QueryTypes.SELECT 
  });
  console.log('Churn Result:', res);
  process.exit();
}
test();
