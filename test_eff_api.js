const db = require('./backend/models');
const adminEficienciaController = require('./backend/controllers/adminEficienciaController');

async function test() {
    const req = {};
    const res = {
        json: (data) => {
            console.log(JSON.stringify(data, null, 2));
        },
        status: (code) => {
            console.log("Status:", code);
            return { json: (msg) => console.log(msg) };
        }
    };
    await adminEficienciaController.getEfficiencyDashboard(req, res);
    process.exit(0);
}
test();
