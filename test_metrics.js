const adminDashboardController = require('./backend/controllers/adminDashboardController');

(async () => {
    try {
        const req = {};
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(data) { console.log(JSON.stringify(data, null, 2)); }
        };
        await adminDashboardController.getFounderMetrics(req, res);
    } catch(e) {
        console.error("ERROR:", e);
    }
})();
