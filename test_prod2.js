const { Sequelize, DataTypes, Op } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

const Psychologist = sequelize.define('Psychologist', {
    status: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    valor_mensal_numero: DataTypes.FLOAT,
    plano: DataTypes.STRING,
    planExpiresAt: DataTypes.DATE,
    cancelAtPeriodEnd: DataTypes.BOOLEAN,
    stripeSubscriptionId: DataTypes.STRING,
    subscriptionId: DataTypes.STRING,
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE
}, { paranoid: true, timestamps: true });

const WhatsAppClickLog = sequelize.define('WhatsAppClickLog', {
    psychologistId: DataTypes.INTEGER,
    createdAt: DataTypes.DATE
});

const SystemSetting = sequelize.define('SystemSetting', {
    price_Essencial: DataTypes.DECIMAL,
    price_Clínico: DataTypes.DECIMAL,
    price_sol: DataTypes.DECIMAL
});

async function testOverview() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PROD DB!');

        const periodDays = 30;
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        const activeFilter = {
            status: 'active',
            is_exempt: { [Op.or]: [false, null] }
        };

        console.log('Fetching pagantes ativos...');
        const pagantesAtivos = await Psychologist.findAll({
            where: {
                ...activeFilter,
                [Op.or]: [
                    { stripeSubscriptionId: { [Op.not]: null } },
                    { subscriptionId: { [Op.not]: null } }
                ]
            },
            attributes: ['id', 'valor_mensal_numero', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd']
        });
        console.log('Pagantes ativos:', pagantesAtivos.length);

        console.log('Fetching trials ativos...');
        const trialsAtivos = await Psychologist.count({
            where: {
                ...activeFilter,
                stripeSubscriptionId: null,
                subscriptionId: null,
                planExpiresAt: { [Op.gte]: now }
            }
        });
        console.log('Trials ativos:', trialsAtivos);

        console.log('Fetching churn...');
        const churn = await Psychologist.count({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { status: 'inactive', updatedAt: { [Op.gte]: periodStart } },
                    { cancelAtPeriodEnd: true, planExpiresAt: { [Op.gte]: periodStart, [Op.lte]: now } }
                ]
            }
        });
        console.log('Churn:', churn);

        console.log('Success all queries!');
    } catch (e) {
        console.error('ERROR IN PROD:', e);
    } finally {
        process.exit(0);
    }
}
testOverview();
