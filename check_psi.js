const db = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
    try {
        const psis = await db.Psychologist.findAll({ 
            where: { status: 'inactive' },
            order: [['updatedAt', 'DESC']],
            limit: 5,
            paranoid: false
        });
        
        console.log("=== ÚLTIMOS 5 PSICÓLOGOS INATIVOS ===");
        psis.forEach(p => {
            console.log(`Nome: ${p.nome} | Email: ${p.email} | Expires: ${p.planExpiresAt}`);
        });

    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

run();
