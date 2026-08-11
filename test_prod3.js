const { Sequelize } = require('sequelize');

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

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Connected to PROD DB!');

        await sequelize.query(`
            SELECT "id", "subscribedAt"
            FROM "Psychologists" LIMIT 1;
        `);
        console.log('SUCCESS: Column subscribedAt exists!');
    } catch (e) {
        console.error('FAILED:', e.message);
    } finally {
        process.exit(0);
    }
}
test();
