const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function run() {
    try {
        console.log("--- WAITING LIST: REGINA ---");
        const reginas = await db.WaitingList.findAll({
            where: { nome: { [Op.iLike]: '%Regina%' } },
            raw: true
        });
        reginas.forEach(r => console.log(`Nome: ${r.nome}, Status: ${r.status}, Criado: ${r.createdAt}, E-mail: ${r.email}, Telefone: ${r.telefone}`));

        console.log("\n--- WAITING LIST: PAULO ---");
        const paulos = await db.WaitingList.findAll({
            where: { nome: { [Op.iLike]: '%Paulo%' } },
            raw: true
        });
        paulos.forEach(p => console.log(`Nome: ${p.nome}, Status: ${p.status}, Criado: ${p.createdAt}, E-mail: ${p.email}, Telefone: ${p.telefone}`));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
