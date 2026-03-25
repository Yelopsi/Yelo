// c:\Users\Anderson\Desktop\Yelo\set-vip.js

const path = require('path');
// Força o carregamento do .env da pasta backend
const envPath = path.resolve(__dirname, 'backend', '.env');
const result = require('dotenv').config({ path: envPath });
if (result.error) {
    require('dotenv').config(); 
}
const db = require('./backend/models');

// --- CONFIGURAÇÃO ---
// Coloque o e-mail do psicólogo que você quer tornar VIP aqui
const userEmail = 'yelo@psi.com'; 
// --------------------

async function setVipStatus() {
    console.log(`🚀 Procurando psicólogo com o e-mail: ${userEmail}`);

    try {
        const psychologist = await db.Psychologist.findOne({
            where: { email: userEmail }
        });

        if (!psychologist) {
            console.error(`❌ Erro: Psicólogo com e-mail "${userEmail}" não encontrado.`);
            return;
        }

        // Atualiza para VIP, define o melhor plano e ativa a conta
        await psychologist.update({ 
            is_exempt: true,
            plano: 'REFERENCE', // Concede o plano mais alto como cortesia
            status: 'active'
        });

        console.log(`✅ Sucesso! O psicólogo "${psychologist.nome}" (${psychologist.email}) agora é VIP.`);
        console.log("Pode fazer login com esta conta para testar a isenção na página de assinatura.");

    } catch (error) {
        console.error("❌ Erro ao conectar ou atualizar o banco de dados:", error);
    } finally {
        await db.sequelize.close();
    }
}

setVipStatus();