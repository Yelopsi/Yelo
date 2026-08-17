const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db?ssl=true', { logging: false, dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } });

async function run() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.addColumn('Psychologists', 'firstPaidAt', { type: Sequelize.DATE, allowNull: true });
        await queryInterface.addColumn('Psychologists', 'canceledAt', { type: Sequelize.DATE, allowNull: true });
        await queryInterface.addColumn('Psychologists', 'reactivatedAt', { type: Sequelize.DATE, allowNull: true });
        await queryInterface.addColumn('Psychologists', 'lifetimeRevenue', { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 });
        console.log("Columns added successfully!");
    } catch(e) {
        console.error(e.message);
    } finally {
        await sequelize.close();
    }
}
run();
