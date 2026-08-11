const db = require('./backend/models');

async function checkROI() {
    try {
        const clicks = await db.sequelize.query(`SELECT COUNT(*) as total FROM "WhatsAppClickLogs"`, { type: db.sequelize.QueryTypes.SELECT });
        const started = await db.sequelize.query(`SELECT COUNT(*) as total FROM "WhatsAppClickLogs" WHERE "dealClosed" = 'started'`, { type: db.sequelize.QueryTypes.SELECT });
        const talking = await db.sequelize.query(`SELECT COUNT(*) as total FROM "WhatsAppClickLogs" WHERE "dealClosed" = 'talking'`, { type: db.sequelize.QueryTypes.SELECT });
        
        console.log(`Total Clicks: ${clicks[0].total}`);
        console.log(`Started: ${started[0].total}`);
        console.log(`Talking: ${talking[0].total}`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkROI();
