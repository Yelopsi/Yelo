const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const payingCondition = {
            [Op.and]: [
                { is_exempt: { [Op.ne]: true } },
                { plano: { [Op.notIn]: ['VIP', 'Cortesia'] } },
                { 
                    [Op.or]: [
                        { subscriptionId: { [Op.ne]: null } }, 
                        { subscription_payments_count: { [Op.gt]: 0 } }
                    ] 
                }
            ]
        };

        const payingPsis = await sequelize.models.Psychologist.findAll({
            where: {
                status: 'active',
                ...payingCondition
            },
            attributes: ['id', 'nome', 'plano', 'subscriptionId', 'subscription_payments_count', 'is_exempt']
        });

        console.log(`Paying Count: ${payingPsis.length}`);
        payingPsis.forEach(p => console.log(p.id, p.nome, p.plano, p.subscriptionId, p.subscription_payments_count));

        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
const db = require('./backend/models'); // Load models to use sequelize.models.Psychologist
db.sequelize.authenticate().then(() => run());
