const { Sequelize, DataTypes, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

const Psychologist = sequelize.define('Psychologist', {
    id: { type: DataTypes.INTEGER, primaryKey: true },
    plano: DataTypes.STRING,
    is_exempt: DataTypes.BOOLEAN,
    subscriptionId: DataTypes.STRING,
    status: DataTypes.STRING
}, { tableName: 'Psychologists', timestamps: true, paranoid: false });

async function run() {
    try {
        const trials = await Psychologist.count({
            where: {
                plano: { [Op.ne]: null },
                status: 'inactive',
                is_exempt: { [Op.or]: [false, null] },
                subscriptionId: null
            }
        });
        console.log(`Users with plan, inactive, not exempt, and no subId: ${trials}`);
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();
