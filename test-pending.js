const { db } = require('./backend/models');
const adminUsersController = require('./backend/controllers/adminUsersController');

async function test() {
    try {
        await require('./backend/models/index');
        const req = {};
        const res = {
            status: (code) => { console.log('STATUS:', code); return res; },
            json: (data) => { console.log('JSON:', data); return res; }
        };
        await adminUsersController.getPendingActions(req, res);
    } catch(e) {
        console.error(e);
    }
}
test();
