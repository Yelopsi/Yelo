const db = require('./models');
async function check() {
    const psis = await db.Psychologist.findAll({
        attributes: ['crp'],
        where: { crp: { [db.Sequelize.Op.not]: null } },
        limit: 10
    });
    console.log(psis.map(p => p.crp));
    process.exit(0);
}
check();
