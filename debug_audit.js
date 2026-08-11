const db = require('./backend/models');
const { Op } = require('sequelize');

async function runAudit() {
    console.log("Starting audit...");
    try {
        const periodDays = 30;
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. DEMAND FUNNEL
        const visitas = await db.SiteVisit.count({ where: { createdAt: { [Op.gte]: periodStart } } });
        const startedCount = await db.DemandSearch.count({ where: { createdAt: { [Op.gte]: periodStart }, status: 'started' } });
        const matchedCount = await db.DemandSearch.count({ where: { createdAt: { [Op.gte]: periodStart }, status: { [Op.in]: ['completed', 'matched'] } } });
        console.log(`Demand: Visitas=${visitas}, status=started=${startedCount}, status=completed/matched=${matchedCount}`);
        
        // 2. CAC
        const expenses = await db.YeloExpense.findAll({ where: { createdAt: { [Op.gte]: periodStart } } });
        console.log(`Marketing Expenses Found: ${expenses.length}`);
        
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
runAudit();
