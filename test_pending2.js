const adminUsersController = require('./backend/controllers/adminUsersController');

(async () => {
    try {
        const req = { hostname: 'localhost' };
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(data) { 
                if (data.error) console.log("API ERROR:", data.error);
                else {
                    console.log("IS ARRAY:", Array.isArray(data));
                    console.log("LENGTH:", data.length);
                    console.log("TYPES:", data.map(d => d.actionType).join(', '));
                }
            }
        };
        await adminUsersController.getPendingActions(req, res);
    } catch(e) {
        console.error("FATAL ERROR:", e);
    }
})();
