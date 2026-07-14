const db = require('./backend/models');
async function run() {
    const lastLead = await db.Lead.findOne({ order: [['createdAt', 'DESC']] });
    console.log(lastLead ? lastLead.createdAt : 'No leads');
    process.exit(0);
}
run();
