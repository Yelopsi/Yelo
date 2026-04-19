const path = require('path');
const envPath = path.resolve(__dirname, 'backend', '.env');
const result = require('dotenv').config({ path: envPath });
if (result.error) {
    require('dotenv').config(); 
}
const db = require('./backend/models');
const bcrypt = require('bcryptjs');

const adminEmail = 'admin@yelo.com.br'; 

async function setAdminStatus() {
    console.log(`🚀 Configurando acesso Admin para o e-mail: ${adminEmail}`);

    try {
        const senhaProvisoria = 'admin123';
        const hashedPassword = await bcrypt.hash(senhaProvisoria, 10);

        let psychologist = await db.Psychologist.findOne({
            where: { email: adminEmail },
            paranoid: false // Busca até os deletados, para restaurar se preciso
        });

        if (!psychologist) {
            console.log(`- Conta não encontrada. Criando uma nova conta de Admin...`);
            psychologist = await db.Psychologist.create({
                email: adminEmail,
                nome: 'Admin Yelo',
                senha: hashedPassword,
                slug: 'admin-yelo-test',
                status: 'active',
                isAdmin: true
            });
        } else {
            console.log(`- Conta encontrada. Atualizando para Admin e redefinindo a senha...`);
            if (psychologist.deletedAt) await psychologist.restore();
            await psychologist.update({ senha: hashedPassword, isAdmin: true, status: 'active' });
        }

        console.log(`\n✅ Sucesso! O usuário "${psychologist.nome}" (${psychologist.email}) agora é um Administrador.`);
        console.log(`   Senha provisória: ${senhaProvisoria}`);
    } catch (error) {
        console.error("❌ Erro ao conectar ou atualizar o banco de dados:", error);
    } finally {
        await db.sequelize.close();
    }
}

setAdminStatus();