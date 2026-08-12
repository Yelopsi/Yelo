const adminGrowthController = require('./backend/controllers/adminGrowthController');
const adminDashboardController = require('./backend/controllers/adminDashboardController');

const db = require('./backend/models');

async function checkLTV() {
    // How CRM (old) calculates LTV
    const crm_ltv_code = `
    const mrr = activePsychologists.reduce(...);
    const pagantesAtivos = activePsychologists.filter(...).length;
    
    // In getFinancials
    `;
    
    // Let's run a DB check to mimic them
    process.exit();
}
checkLTV();
