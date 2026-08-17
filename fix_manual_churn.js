const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    updatedAt: DataTypes.DATE,
}, { tableName: 'Psychologists', timestamps: false, paranoid: false });

async function run() {
    try {
        const dataAlvo = new Date('2026-04-10T12:00:00.000Z');
        
        await Psychologist.update({ updatedAt: dataAlvo }, { where: { id: [72, 74, 75] } });
        
        console.log("Datas de churn corrigidas manualmente para Solange, Juliana e Jéssica (10/04/2026)!");
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();
