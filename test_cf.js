require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./backend/models');
const adminUsersController = require('./backend/controllers/adminUsersController');
const adminController = require('./backend/controllers/adminController');

async function run() {
    try {
        console.log("Conectando ao banco de dados...");
        const psi = await db.Psychologist.findOne({ where: { id: 1 } });
        
        if (!psi) {
            console.error("Psicólogo Anderson Costa não encontrado.");
            process.exit(1);
        }

        console.log("Limpando histórico de memória e ativando perfil...");
        psi.aiOptimizationHistory = [];
        psi.status = 'active';
        psi.changed('aiOptimizationHistory', true);
        await psi.save();
        
        console.log("Injetando 2 cliques perdidos...");
        await db.WhatsAppClickLog.create({
            psychologistId: 1,
            guestName: 'Teste 1',
            status: 'completed',
            feedbackGiven: true,
            dealClosed: 'no',
            createdAt: new Date()
        });
        
        await db.WhatsAppClickLog.create({
            psychologistId: 1,
            guestName: 'Teste 2',
            status: 'completed',
            feedbackGiven: true,
            dealClosed: 'talking',
            createdAt: new Date()
        });
        
        console.log("Buscando Pending Actions...");
        let pendingResults = null;
        const resPending = {
            json: (data) => { pendingResults = data; },
            status: () => resPending
        };
        await adminUsersController.getPendingActions({}, resPending);
        
        const cfAction = pendingResults.find(p => p.id === 1 && p.actionType === 'conversion_failure');
        
        if (cfAction) {
            console.log("✅ ALERTA FUNCIONANDO! Motivo:", cfAction.reason);
        } else {
            console.error("❌ Alerta de falha de conversão não disparou.");
            process.exit(1);
        }
        
        console.log("\\nGerando mensagem de IA para falha de conversão...");
        let aiMessage = null;
        const reqAi = { params: { id: 1 } };
        const resAi = {
            json: (data) => { aiMessage = data; },
            status: () => resAi
        };
        
        await adminController.generateAiConversionFailure(reqAi, resAi);
        
        console.log("\\n================ MENSAGEM GERADA ================\\n");
        console.log(aiMessage.whatsappCopy || aiMessage.error);
        console.log("\\n=================================================\\n");
        
    } catch (e) {
        console.error("Erro durante o teste:", e);
    } finally {
        process.exit();
    }
}

run();
