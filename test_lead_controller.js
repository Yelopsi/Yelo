const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function test() {
    console.log("Testing Lead and WaitingList fetch...");
    try {
        const psychologists = await db.Psychologist.findAll({
            attributes: ['email', 'telefone']
        });
        const registeredEmails = new Set(psychologists.map(p => p.email?.toLowerCase()).filter(Boolean));
        const registeredPhones = new Set(psychologists.map(p => p.telefone?.replace(/\D/g, '')).filter(Boolean));

        const waitingList = await db.WaitingList.findAll({
            order: [['createdAt', 'DESC']]
        });
        
        let inboundCount = 0;
        waitingList.forEach(w => {
            const email = w.email?.toLowerCase();
            const phone = w.telefone?.replace(/\D/g, '');
            if (!registeredEmails.has(email) && !registeredPhones.has(phone)) {
                inboundCount++;
            }
        });
        
        console.log(`Found ${waitingList.length} total WaitingList, ${inboundCount} are purely pending (not registered).`);
    } catch(e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
test();
