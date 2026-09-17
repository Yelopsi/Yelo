const { db } = require('./backend/models');
const adminUsersController = require('./backend/controllers/adminUsersController');

(async () => {
    try {
        const req = {
            query: { status: 'pending_expiring_trial', page: 1, limit: 10 }
        };
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(data) { console.log("SUCCESS:", data); }
        };
        await adminUsersController.getAllPsychologists(req, res);
    } catch(e) {
        console.error("ERROR:", e);
    }
})();
