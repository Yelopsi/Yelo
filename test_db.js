const { Sequelize, Op } = require('sequelize');

async function run() {
    const sequelize = new Sequelize("postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db", {
        dialect: 'postgres',
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        logging: false
    });
    
    const [payments] = await sequelize.query(`SELECT * FROM "Payments" WHERE "psychologistId" = 1157`);
    console.log(payments);
    
    process.exit(0);
}
run();
