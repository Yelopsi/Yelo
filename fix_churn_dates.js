const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    updatedAt: DataTypes.DATE,
}, { tableName: 'Psychologists', timestamps: false, paranoid: false }); // timestamps: false so we can force update updatedAt

async function run() {
    try {
        await Psychologist.update({ updatedAt: new Date('2026-06-25T12:00:00.000Z') }, { where: { id: 195 } });
        await Psychologist.update({ updatedAt: new Date('2026-09-03T12:00:00.000Z') }, { where: { id: 218 } });
        console.log("Datas de churn corrigidas no banco de dados para Dr. José e Thais!");
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();
