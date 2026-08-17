const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    subscription_payments_count: DataTypes.INTEGER
}, { tableName: 'Psychologists', timestamps: true, paranoid: false });

async function run() {
    try {
        const users = await Psychologist.findAll({ where: { id: [195, 218] }, raw: true });
        console.log(users);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();
