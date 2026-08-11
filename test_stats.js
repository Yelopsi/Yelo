const db = require('./backend/models');

async function test() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const searches = await db.sequelize.query(`SELECT COUNT(*) as count FROM "DemandSearches" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: {start, end}, type: db.sequelize.QueryTypes.SELECT });
    
    const clicks = await db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "createdAt" BETWEEN :start AND :end`, { replacements: {start, end}, type: db.sequelize.QueryTypes.SELECT });

    const activePsy = await db.Psychologist.count({ where: { status: 'active' } });

    console.log(`Searches: ${searches[0].count}`);
    console.log(`Clicks: ${clicks[0].count}`);
    console.log(`Active Psy: ${activePsy}`);

    process.exit(0);
}
test();
