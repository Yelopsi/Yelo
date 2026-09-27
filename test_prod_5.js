const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  try {
    const metrics = await sequelize.query(`
      SELECT * FROM "ManualAdMetrics" ORDER BY "createdAt" DESC LIMIT 5
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("ManualAdMetrics:", metrics);
    
    // Check if there is any other cache table
    const settings = await sequelize.query(`
      SELECT * FROM "SystemSettings" WHERE key ILIKE '%meta%' OR key ILIKE '%ad%'
    `, { type: sequelize.QueryTypes.SELECT }).catch(e => e.message);
    console.log("SystemSettings Cache:", settings);

    process.exit(0);
  } catch (e) {
    console.error(e); process.exit(1);
  }
}
run();
