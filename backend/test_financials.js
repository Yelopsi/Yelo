require('dotenv').config({path: '../.env'});
const adminDashboardController = require('./controllers/adminDashboardController');
const db = require('./models');

async function runTest() {
  try {
    const req = {
      query: { startDate: '2024-01-01', endDate: '2026-08-31' }
    };
    const res = {
      json: (data) => console.log(JSON.stringify(data.kpis, null, 2)),
      status: (code) => ({ json: (err) => console.error(code, err) })
    };
    await adminDashboardController.getFinancials(req, res);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
runTest();
