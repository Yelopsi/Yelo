const db = require('./backend/models');

async function run() {
    try {
        console.log("Conectando ao banco de dados...");
        const psi = await db.Psychologist.findOne({ where: { id: 1 } }); // Anderson Costa mock
        
        if (!psi) {
            console.error("Psicólogo não encontrado.");
            process.exit(1);
        }
        
        // Mocking previous history
        const now = new Date();
        now.setDate(now.getDate() - 15); // 15 days ago

        psi.aiOptimizationHistory = [
            {
                sentAt: now.toISOString(),
                action: 'analysis',
                contentSnippet: 'Na nossa última análise, notamos que o seu perfil tinha muitas visualizações, mas poucos cliques. Sugerimos que você utilizasse o Manual de Conversão para melhorar a sua bio e atrair mais pacientes para o WhatsApp.'
            }
        ];
        
        psi.changed('aiOptimizationHistory', true);
        await psi.save();
        
        console.log('Histórico injetado com sucesso.');
        
    } catch (e) {
        console.error("Exceção não tratada:", e);
    } finally {
        process.exit();
    }
}
run();
