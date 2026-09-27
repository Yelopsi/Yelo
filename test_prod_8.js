const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});

async function run() {
    const classQuery = `
      SELECT status, COUNT(*) as qtd
      FROM "Psychologists"
      WHERE "deletedAt" IS NULL
      AND (
        ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR
        ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0)
      )
      GROUP BY status
    `;
    const res = await sequelize.query(classQuery, { type: sequelize.QueryTypes.SELECT });
    console.log(res);
    process.exit(0);
}
run();
