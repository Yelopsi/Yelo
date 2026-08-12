const db = require('./backend/models');
async function run() {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);
    const concluidos = await db.DemandSearch.count({
        where: { createdAt: { [db.Sequelize.Op.gte]: periodStart }, status: { [db.Sequelize.Op.in]: ['completed', 'matched'] } }
    });
    const matches = await db.MatchEvent.count({
        where: { createdAt: { [db.Sequelize.Op.gte]: periodStart } }
    });
    console.log(`Concluidos: ${concluidos}`);
    console.log(`Matches: ${matches}`);
    
    // Check if any MatchEvent has NO DemandSearch (orphan)? Wait, MatchEvent doesn't have a demandSearchId!
    // It only has psychologistId and patientId.
    console.log('MatchEvent schema:', Object.keys(db.MatchEvent.rawAttributes));
    process.exit();
}
run();
