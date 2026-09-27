const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = `
            SELECT COUNT(*) as wpp_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '90 days'
        `;
        const res = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
        console.log(`90d clicks: ${res[0].wpp_clicks}`);
        
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}
run();
