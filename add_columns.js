const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        await sequelize.query('ALTER TABLE "Psychologists" ADD COLUMN IF NOT EXISTS "profileActivatedAt" TIMESTAMP WITH TIME ZONE;');
        await sequelize.query('ALTER TABLE "WhatsAppClickLogs" ADD COLUMN IF NOT EXISTS "therapyStartedReportedAt" TIMESTAMP WITH TIME ZONE;');
        console.log("Columns added successfully!");
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
