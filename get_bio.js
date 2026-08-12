const db = require('./backend/models');
async function run() {
    const psi = await db.Psychologist.findOne({
        where: { bio: { [db.Sequelize.Op.like]: '%Fernanda Kawai Shiga%' } }
    });
    if (psi) {
        console.log("RAW BIO FROM DB:");
        console.log(psi.bio);
    } else {
        console.log("Not found");
    }
    process.exit();
}
run();
