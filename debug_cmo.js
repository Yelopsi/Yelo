const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

// Mock db object
const db = {
    sequelize,
    Sequelize,
    Psychologist: sequelize.define('Psychologist', {}, { timestamps: false }),
    Payment: sequelize.define('Payment', {}, { timestamps: false }),
    ManualAdMetric: sequelize.define('ManualAdMetric', {}, { timestamps: false }),
};

// We just need to load cmoRoutes.js and run the route
// Wait, cmoRoutes.js is an Express router. It's easier to just start the server and curl it!
