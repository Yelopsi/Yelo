const db = require('./backend/models');
async function run() {
    const ligia = await db.Psychologist.findOne({ where: { email: 'ligia_carraro@hotmail.com' }});
    console.log("Ligia payments count:", ligia.subscription_payments_count);
    console.log("Ligia planExpiresAt:", ligia.planExpiresAt);
    process.exit(0);
}
run();
