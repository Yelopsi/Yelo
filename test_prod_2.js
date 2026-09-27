const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  try {
    const cols = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Subscriptions'
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("Subscriptions columns:", cols.map(c => c.column_name));

    const hookCols = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='WebhookInbox'
    `, { type: sequelize.QueryTypes.SELECT });
    console.log("WebhookInbox columns:", hookCols.map(c => c.column_name));
    process.exit(0);
  } catch (e) {
    console.error(e); process.exit(1);
  }
}
run();
