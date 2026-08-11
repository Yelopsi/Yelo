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

const YeloExpense = sequelize.define('YeloExpense', {
    name: DataTypes.STRING,
    amount: DataTypes.DECIMAL,
    monthYear: DataTypes.STRING,
    category: DataTypes.STRING,
    createdAt: DataTypes.DATE
});

const SystemSetting = sequelize.define('SystemSetting', {
    price_Essencial: DataTypes.DECIMAL,
    price_Clínico: DataTypes.DECIMAL,
    price_sol: DataTypes.DECIMAL
});

async function testMarketing() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PROD DB!');

        const periodDays = 30;
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        console.log('Fetching YeloExpenses...');
        const expenses = await YeloExpense.findAll({
            where: { createdAt: { [Op.gte]: periodStart } }
        });
        console.log('Expenses:', expenses.length);

        console.log('Success!');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit(0);
    }
}
testMarketing();
