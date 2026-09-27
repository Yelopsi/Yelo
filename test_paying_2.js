const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = await sequelize.query(`
            SELECT id, nome, is_exempt, plano, "subscriptionId", "subscription_payments_count", "status"
            FROM "Psychologists"
            WHERE status = 'active'
            AND (is_exempt IS NULL OR is_exempt != true)
            AND (plano NOT IN ('VIP', 'Cortesia') OR plano IS NULL)
            AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
        `, { type: sequelize.QueryTypes.SELECT });

        console.log(`Count: ${query.length}`);
        query.forEach(p => console.log(p.id, p.nome, p.plano, p.subscriptionId, p.subscription_payments_count));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
