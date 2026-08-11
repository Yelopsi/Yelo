const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
    dialect: 'postgres',
    logging: console.log,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    }
});

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PROD DB!');

        console.log('Testing column planExpiresAt and cancelAtPeriodEnd...');
        await sequelize.query(`
            SELECT "id", "planExpiresAt", "cancelAtPeriodEnd" 
            FROM "Psychologists" LIMIT 1;
        `);
        console.log('SUCCESS: Columns planExpiresAt and cancelAtPeriodEnd exist!');

    } catch (e) {
        console.error('FAILED:', e.message);
    } finally {
        process.exit(0);
    }
}
test();
