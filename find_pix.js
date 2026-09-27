const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = await sequelize.query(`
            SELECT id, nome, email, "planExpiresAt", "createdAt"
            FROM "Psychologists"
            WHERE status = 'active' AND "subscriptionId" IS NULL AND is_exempt = false AND plano != 'VIP'
        `, { type: sequelize.QueryTypes.SELECT });
        
        const now = new Date();
        const nonTrials = query.filter(p => {
            const exp = new Date(p.planExpiresAt);
            const created = new Date(p.createdAt);
            // Se a diferença entre expiração e criação for maior que 14 dias, não é trial
            return (exp - created) / (1000 * 60 * 60 * 24) > 15;
        });

        console.log(nonTrials);
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
