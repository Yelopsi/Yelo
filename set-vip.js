// c:\Users\Anderson\Desktop\Yelo\set-vip.js

const path = require('path');
// Força o carregamento do .env da pasta backend
const envPath = path.resolve(__dirname, 'backend', '.env');
const result = require('dotenv').config({ path: envPath });
if (result.error) {
    require('dotenv').config(); 
}
const db = require('./backend/models');
const bcrypt = require('bcryptjs');

// --- CONFIGURAÇÃO ---
// Coloque o e-mail do psicólogo que você quer tornar VIP aqui
const userEmail = 'yelo@psi.com'; 
// --------------------

async function setVipStatus() {
    console.log(`🚀 Procurando psicólogo com o e-mail: ${userEmail}`);

    try {
        const senhaProvisoria = 'yelo123';
        const hashedPassword = await bcrypt.hash(senhaProvisoria, 10);

        let psychologist = await db.Psychologist.findOne({
            where: { email: userEmail }
        });

        if (!psychologist) {
            console.log(`- Psicólogo não encontrado. Criando uma conta de teste...`);

            psychologist = await db.Psychologist.create({
                email: userEmail,
                nome: 'Psi Yelo (VIP)',
                senha: hashedPassword,
                slug: 'psi-yelo-vip-test',
                status: 'pending'
            });
            
            console.log(`- Conta criada com sucesso! A senha provisória é: ${senhaProvisoria}`);
        } else {
            console.log(`- Psicólogo encontrado. Redefinindo a senha para: ${senhaProvisoria}...`);
            await psychologist.update({ senha: hashedPassword });
        }

        // Atualiza para VIP, define o melhor plano e ativa a conta
        await psychologist.update({ 
            is_exempt: true,
            plano: 'REFERENCE', // Concede o plano mais alto como cortesia
            status: 'active',
            authority_level: 'nivel_mentor',
            xp: 20000,
            badges: {
                autentico: true,
                pioneiro: true,
                semeador: 'ouro',
                voz_ativa: 'ouro'
            }
        });

        console.log(`\n✅ Sucesso! O psicólogo "${psychologist.nome}" (${psychologist.email}) agora é VIP e tem uma assinatura ativa.`);
        console.log("   Pode fazer login com esta conta para testar todas as funcionalidades da plataforma.");

    } catch (error) {
        console.error("❌ Erro ao conectar ou atualizar o banco de dados:", error);
    } finally {
        await db.sequelize.close();
    }
}

setVipStatus();