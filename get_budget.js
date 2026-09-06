const { Psychologist, DemandSearch, WhatsAppClickLog } = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
  try {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);

    const activePsyCount = await Psychologist.count({ where: { status: 'active', deletedAt: null } });
    const totalDemand = await DemandSearch.count({ where: { createdAt: { [Op.between]: [start, end] }, deletedAt: null } });

    const wppLogs = await WhatsAppClickLog.findAll({
      where: { createdAt: { [Op.between]: [start, end] } }
    });
    
    let totalLeads = wppLogs.length;
    
    let conversionRate = totalDemand > 0 ? (totalLeads / totalDemand) : 0.05;
    if (conversionRate === 0) conversionRate = 0.05;
    
    const totalWppClicks30 = totalLeads;
    const avgClicksPerPsy30 = activePsyCount > 0 ? (totalWppClicks30 / activePsyCount) : 10;
    
    const leadAuthenticityRate = 0.80;
    const clicksForOneRealLead = 1 / leadAuthenticityRate;

    const TARGET_REAL_LEADS_MONTHLY = Math.max(1, Math.round(avgClicksPerPsy30 * leadAuthenticityRate));
    const TARGET_CLICKS_PER_PSY_MONTHLY = Math.ceil(clicksForOneRealLead * TARGET_REAL_LEADS_MONTHLY);

    const msInDay = 1000 * 60 * 60 * 24;
    const periodDays = Math.max(1, (end - start) / msInDay);
    const periodTargetClicks = (TARGET_CLICKS_PER_PSY_MONTHLY / 30) * periodDays;

    const totalClicksNeeded = activePsyCount * periodTargetClicks;
    const idealCapacity = Math.ceil(totalClicksNeeded / conversionRate);
    
    const missingDemand = idealCapacity > totalDemand ? idealCapacity - totalDemand : 0;
    
    const { Expense } = require('./backend/models');
    // Pegamos despesas categorizadas como marketing B2C
    const expensesList = await Expense.findAll({
      where: {
         // data: { [Op.between]: [start, end] }, // ignorando filtro de data por hora para ver se existe
         categoria: { [Op.iLike]: '%Google%' } // ou %B2C%
      }
    });

    console.log("Gastos encotrados:", expensesList.length);

    console.log({
        activePsyCount,
        totalDemand,
        totalLeads,
        conversionRate,
        idealCapacity,
        missingDemand,
    });
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
run();
