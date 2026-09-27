const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  const cols = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name='SystemSettings'`, { type: sequelize.QueryTypes.SELECT });
  console.log("Settings cols:", cols.map(c=>c.column_name));
  process.exit();
}
run();
