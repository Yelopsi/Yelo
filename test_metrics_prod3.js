const { db } = require('./backend/models');
const adminDashboardController = require('./backend/controllers/adminDashboardController');

(async () => {
    try {
        const req = {};
        const res = {
            status: function(s) {
                this.statusCode = s;
                return this;
            },
            json: function(data) {
                console.log("SUCCESS:", JSON.stringify(data, null, 2).slice(0, 500));
            }
        };
        await adminDashboardController.getFounderMetrics(req, res);
    } catch(e) {
        console.error("ERROR:", e);
    }
})();
