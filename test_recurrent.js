const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = await sequelize.query(`
            SELECT id, nome, email, "subscriptionId", "cancelAtPeriodEnd", "planExpiresAt", "status", plano, is_exempt
            FROM "Psychologists"
            WHERE status = 'active'
        `, { type: sequelize.QueryTypes.SELECT });

        const now = new Date();

        const recurrent = query.filter(p => p.subscriptionId && !p.cancelAtPeriodEnd && !p.is_exempt && p.plano !== 'VIP' && (!p.planExpiresAt || new Date(p.planExpiresAt) > now));

        console.log(`Recurrent: ${recurrent.length}`);
        console.log(recurrent.map(p => p.id).join(', '));
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
