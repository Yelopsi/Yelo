const { Sequelize, Op } = require('sequelize');

async function run() {
    const sequelize = new Sequelize("postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db", {
        dialect: 'postgres',
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        logging: false
    });
    
    const [psis] = await sequelize.query(`SELECT count(*) as count FROM "Psychologists" WHERE status = 'active' AND ("subscriptionId" IS NOT NULL OR subscription_payments_count > 0);`);
    console.log("Total active with payments or subId (including VIPs):", psis[0].count);
    
    process.exit(0);
}
run();
