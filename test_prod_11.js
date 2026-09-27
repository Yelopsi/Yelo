const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = `
            SELECT COUNT(*) as total_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '30 days'
            AND "psychologistId" IN (
                SELECT id FROM "Psychologists" WHERE status = 'active'
            )
        `;
        const res = await sequelize.query(query, { type: sequelize.QueryTypes.SELECT });
        const totalClicks = parseInt(res[0].total_clicks || 0);
        
        const orgQuery = `
            SELECT COUNT(*) as org_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '30 days'
            AND ("utmSource" IS NULL OR "utmSource" = 'organico')
        `;
        const resOrg = await sequelize.query(orgQuery, { type: sequelize.QueryTypes.SELECT });
        const orgClicks = parseInt(resOrg[0].org_clicks || 0);
        
        console.log(`Total clicks last 30d: ${totalClicks}. Avg per psi (26 base): ${totalClicks / 26}`);
        console.log(`Org clicks: ${orgClicks}`);
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}
run();
