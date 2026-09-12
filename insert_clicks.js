const db = require('./backend/models');

async function run() {
    try {
        console.log("Inserindo 25 cliques no WhatsAppClickLog para ID 1...");
        
        const logs = [];
        for (let i = 0; i < 25; i++) {
            logs.push({
                psychologistId: 1,
                patientIp: '127.0.0.1',
                userAgent: 'Mozilla/5.0'
            });
        }
        
        await db.WhatsAppClickLog.bulkCreate(logs);
        console.log('Cliques inseridos.');
        
    } catch (e) {
        console.error("Exceção não tratada:", e);
    } finally {
        process.exit();
    }
}
run();
