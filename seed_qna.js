// seed_qna.js
const path = require('path');

// 1. TENTA CARREGAR O .ENV DA PASTA BACKEND
// (O arquivo original estava procurando na raiz e não achava as senhas)
const envPath = path.resolve(__dirname, 'backend', '.env');
const result = require('dotenv').config({ path: envPath });

if (result.error) {
    // Se falhar, tenta na raiz como fallback
    require('dotenv').config(); 
}

// Debug: Mostra se carregou o usuário (sem mostrar a senha)
console.log("Tentando conectar com usuário:", process.env.DB_USER || process.env.POSTGRES_USER || "NÃO DEFINIDO (Vai dar erro 'Anderson')");

const db = require('./backend/models'); 

async function seed() {
    try {
        console.log("Conectando ao banco para criar perguntas de teste...");
        
        // Sincroniza tabelas
        await db.sequelize.sync({ alter: true });

        // 1. Busca ou cria um Paciente Fictício
        let patient = await db.Patient.findOne();
        if (!patient) {
            console.log("Criando paciente de teste...");
            patient = await db.Patient.create({
                nome: "Paciente Anônimo",
                email: "anonimo@teste.com",
                senha: "123",
                telefone: "11999999999"
            });
        }

        // 2. Cria Pergunta APROVADA (Deve aparecer pro Psi)
        // Usamos 'upsert' ou verificação simples para não duplicar se rodar 2x
        const [q1, created1] = await db.Question.findOrCreate({
            where: { title: "Ansiedade no trabalho remoto" },
            defaults: {
                content: "Sinto que não consigo desligar depois do expediente. Meu coração acelera quando recebo notificação. Isso é normal?",
                status: "approved", 
                PatientId: patient.id
            }
        });
        if(created1) console.log("✅ Pergunta APROVADA criada.");
        else console.log("ℹ️ Pergunta APROVADA já existia.");

        // 3. Cria Pergunta PENDENTE (NÃO deve aparecer pro Psi)
        const [q2, created2] = await db.Question.findOrCreate({
            where: { title: "Pergunta ainda em análise" },
            defaults: {
                content: "O admin ainda não aprovou esta dúvida.",
                status: "pending_review",
                PatientId: patient.id
            }
        });
        if(created2) console.log("✅ Pergunta PENDENTE criada.");
        else console.log("ℹ️ Pergunta PENDENTE já existia.");

        console.log("Processo finalizado com sucesso!");
        process.exit(0);

    } catch (error) {
        console.error("Erro ao rodar seed:", error);
        process.exit(1);
    }
}

seed();