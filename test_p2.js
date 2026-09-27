const { sequelize } = require('./backend/models');
async function test() {
  const qClicks = `
    SELECT "utmSource", COUNT(*) as count
    FROM "WhatsAppClickLogs"
    WHERE "createdAt" >= NOW() - INTERVAL '90 days'
    GROUP BY "utmSource"
    ORDER BY count DESC
  `;
  const clicks = await sequelize.query(qClicks, { type: sequelize.QueryTypes.SELECT });
  console.log("CLICKS 90d BY UTM:");
  console.log(clicks);

  const qSpend = `
    SELECT SUM(amount) as spend, platform
    FROM "AdSpends"
    WHERE "date" >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY platform
  `;
  const spends = await sequelize.query(qSpend, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
  console.log("SPENDS 90d:");
  console.log(spends);

  process.exit();
}
test();
