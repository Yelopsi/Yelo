const fs = require('fs');
const path = './backend/controllers/adminUsersController.js';
let content = fs.readFileSync(path, 'utf8');

const filterInjection = `
            } else if (status === 'pending_expiring_trial') {
                const now = new Date();
                const expirationUpperBound = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
                const expirationLowerBound = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
                whereClause.status = 'active';
                whereClause.subscriptionId = null;
                whereClause.planExpiresAt = {
                    [Op.lte]: expirationUpperBound,
                    [Op.gte]: expirationLowerBound
                };
                whereClause.admin_billing_sent_at = null;
                whereClause.deletedAt = null;
                whereClause.telefone = { [Op.ne]: null, [Op.not]: '' };
            } else if (status === 'pending_paid_churn') {
                const now = new Date();
                const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
                whereClause.status = 'inactive';
                whereClause.deletedAt = null;
                whereClause.msg_paid_churn_sent_at = null;
                if (!whereClause[Op.and]) whereClause[Op.and] = [];
                whereClause[Op.and].push({
                    subscription_payments_count: { [Op.gt]: 0 }
                });
                whereClause.planExpiresAt = { [Op.lte]: now };
                whereClause.telefone = { [Op.ne]: null, [Op.not]: '' };
            } else if (status === 'pending_incomplete') {
                const now = new Date();
                const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                whereClause.createdAt = { [Op.lte]: oneDayAgo };
                whereClause.status = 'pending';
                whereClause.msg_incomplete_profile_sent_at = null;
                whereClause.deletedAt = null;
                whereClause.telefone = { [Op.ne]: null, [Op.not]: '' };
`;

if (content.includes("else if (status === 'pending_expiring_trial')")) {
    console.log("Already patched.");
} else {
    content = content.replace("            } else {\n                whereClause.status = status;\n            }", filterInjection + "            } else {\n                whereClause.status = status;\n            }");
    fs.writeFileSync(path, content);
    console.log("Patched successfully.");
}
