const db = require('./backend/models');
async function run() {
    const matches = await db.MatchEvent.findAll({ raw: true });
    console.log(matches.map(m => m.source));
    process.exit();
}
run();
