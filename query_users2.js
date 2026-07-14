const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function run() {
    try {
        console.log("--- BUSCANDO REGINA ---");
        const reginas = await db.Psychologist.findAll({
            where: { nome: { [Op.iLike]: '%Regina%' } },
            raw: true,
            paranoid: false // Inclui soft deleted
        });
        reginas.forEach(r => console.log(`ID: ${r.id}, Nome: ${r.nome}, Status: ${r.status}, Deleted: ${r.deletedAt}, Criado: ${r.createdAt}, Telefone: ${r.telefone}`));

        console.log("\n--- BUSCANDO PAULO ---");
        const paulos = await db.Psychologist.findAll({
            where: { nome: { [Op.iLike]: '%Paulo%' } },
            raw: true,
            paranoid: false
        });
        paulos.forEach(p => console.log(`ID: ${p.id}, Nome: ${p.nome}, Status: ${p.status}, Deleted: ${p.deletedAt}, Criado: ${p.createdAt}, Telefone: ${p.telefone}`));

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
