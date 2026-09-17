const { db } = require('./backend/models');
const adminUsersController = require('./backend/controllers/adminUsersController');

(async () => {
    try {
        const req = {};
        const res = {
            status: function(s) { this.statusCode = s; return this; },
            json: function(data) { 
                console.log("TOTAL PENDING ACTIONS:", data.pendingActions.length);
                const counts = { expiring_trial: 0, paid_churn: 0, incomplete: 0 };
                data.pendingActions.forEach(a => {
                    if (a.actionType === 'expiring_trial') counts.expiring_trial++;
                    if (a.actionType === 'incomplete') counts.incomplete++;
                    if (['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType)) counts.paid_churn++;
                });
                console.log(counts);
            }
        };
        await adminUsersController.getPendingActions(req, res);
    } catch(e) {
        console.error("ERROR:", e);
    }
})();
