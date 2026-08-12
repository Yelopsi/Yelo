const db = require('./backend/models');
async function run() {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    
    // Count all DemandSearches that created MatchEvents recently
    const matches = await db.MatchEvent.findAll({ 
        where: { createdAt: { [db.Sequelize.Op.gte]: periodStart } },
        raw: true
    });
    
    // In Yelo, the MatchEvent doesn't have a demandSearchId. 
    // Wait, let's look at DemandSearch statuses in the last 30 days.
    const allDS = await db.DemandSearch.findAll({
        where: { createdAt: { [db.Sequelize.Op.gte]: periodStart } },
        raw: true
    });
    
    const countByStatus = {};
    for (let ds of allDS) {
        countByStatus[ds.status] = (countByStatus[ds.status] || 0) + 1;
    }
    
    console.log("DemandSearch count by status:", countByStatus);
    console.log("Total MatchEvents:", matches.length);
    process.exit();
}
run();
