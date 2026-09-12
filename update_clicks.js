const db = require('./backend/models');

async function run() {
    try {
        console.log("Conectando ao banco de dados...");
        const psi = await db.Psychologist.findOne({ where: { id: 1 } });
        
        if (!psi) {
            console.error("Psicólogo não encontrado.");
            process.exit(1);
        }
        
        // Atualiza temporariamente para testar a rota "sem gargalos"
        psi.whatsapp_clicks = 25;
        await psi.save();
        console.log('Atualizado para 25 cliques.');
        
    } catch (e) {
        console.error("Exceção não tratada:", e);
        process.exit(1);
    }
}
run();
