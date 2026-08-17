const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');

async function debug() {
    const users = await db.Psychologist.findAll({ raw: true, paranoid: false });
    const payingDb = users.filter(psy => psy.status === 'active' && psy.plano && (psy.subscriptionId || psy.subscription_payments_count > 0));
    console.log("Expected payingDb count:", payingDb.length);
    if(payingDb.length > 0) {
        console.log("First paying user:", payingDb[0]);
        console.log("isCurrentlyPaying returned:", MetricsService.isCurrentlyPaying(payingDb[0]));
    }
    process.exit(0);
}
debug();
