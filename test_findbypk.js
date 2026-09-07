const db = require('./backend/models');
async function run() {
    try {
        const id = undefined;
        await db.Psychologist.findByPk(id);
        console.log("findByPk(undefined) success");
    } catch(e) {
        console.error("findByPk(undefined) failed:", e.message);
    }
}
run().then(() => process.exit(0));
