const { db } = require('./backend/models');
async function test() {
    try {
        const tables = await db.sequelize.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        console.log(tables[0].map(t => t.table_name));
    } catch(e) { console.error(e); }
    process.exit(0);
}
test();
