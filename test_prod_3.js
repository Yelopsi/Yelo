const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  try {
    const payloads = await sequelize.query(`
      SELECT payload->>'event' as evt, COUNT(*) 
      FROM "WebhookInbox" 
      GROUP BY payload->>'event'
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("Events:", payloads);
    process.exit(0);
  } catch (e) {
    console.error(e); process.exit(1);
  }
}
run();
