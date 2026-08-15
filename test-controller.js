require('dotenv').config();
const db = require('./backend/models');
const adminGrowthController = require('./backend/controllers/adminGrowthController');

async function test() {
    try {
        const req = {};
        const res = {
            json: (data) => console.log("JSON:", JSON.stringify(data, null, 2)),
            status: (code) => ({ json: (data) => console.log(`STATUS ${code}:`, data) })
        };
        await adminGrowthController.getUpcomingTrials(req, res);
    } catch(e) { console.error("ERR:", e); }
}
test();
