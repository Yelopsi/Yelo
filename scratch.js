const { Sequelize } = require('sequelize');
const db = require('./backend/models');

async function run() {
  try {
    const psi = await db.Psychologist.findOne();
    if (psi) {
        console.log("Found ID:", psi.id);
        const { generateAiPaidChurnMessage } = require('./backend/controllers/adminPerformanceController');
        const req = { params: { id: psi.id.toString() } };
        const res = { 
            status: function(code) { console.log('STATUS:', code); return this; }, 
            json: function(data) { console.log('JSON:', data); return this; } 
        };
        await generateAiPaidChurnMessage(req, res);
    } else {
        console.log("No psychologist found locally.");
    }
  } catch(e) {
    console.error(e);
  } finally {
    await db.sequelize.close();
  }
}
run();
