require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./backend/models');
const adminController = require('./backend/controllers/adminController');

async function run() {
    try {
        console.log("Conectando ao banco de dados...");
        const psi = await db.Psychologist.findOne({ where: { nome: { [db.Sequelize.Op.iLike]: '%Anderson Costa%' } } });
        
        if (!psi) {
            console.error("Psicólogo não encontrado.");
            process.exit(1);
        }
        
        console.log(`Psicólogo encontrado: ${psi.nome} (ID: ${psi.id})`);
        
        const req = {
            params: { id: psi.id }
        };
        
        const res = {
            status: function(s) {
                return this;
            },
            json: function(data) {
                if (data.error) {
                    console.error("Erro retornado:", data.error);
                } else if (data.message) {
                    console.log("\n================ MENSAGEM GERADA ================\n");
                    console.log(data.message);
                    console.log("\n=================================================\n");
                } else {
                    console.log("Retorno completo:", data);
                }
                process.exit(0);
            }
        };
        
        console.log("Rodando analyzeProfile...");
        await adminController.analyzeProfile(req, res);
        
    } catch (e) {
        console.error("Exceção não tratada:", e);
        process.exit(1);
    }
}

run();
