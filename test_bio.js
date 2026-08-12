const db = require('./backend/models');
async function run() {
    const p = await db.Psychologist.findOne({ where: { nome: 'Fernanda Kawai Shiga' }});
    console.log(p.bio);
    process.exit();
}
run();
