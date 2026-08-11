const { Sequelize, DataTypes } = require('sequelize');

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

const SystemSetting = sequelize.define('SystemSetting', {
    price_Essencial: DataTypes.DECIMAL,
    price_Clínico: DataTypes.DECIMAL,
    price_sol: DataTypes.DECIMAL
});

async function test() {
    try {
        await sequelize.authenticate();
        await SystemSetting.findOne();
        console.log('Success!');
    } catch (e) {
        console.error('ERROR MESSAGE:', e.message);
    } finally {
        process.exit(0);
    }
}
test();
