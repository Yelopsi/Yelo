const db = require('./backend/models');
const { Op } = require('sequelize');

async function run() {
    try {
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 dias

        let psy = await db.Psychologist.findOne({ where: { nome: 'Psi Trial Expirando' } });
        
        if (!psy) {
            psy = await db.Psychologist.create({
                nome: 'Psi Trial Expirando',
                email: 'trial.expirando@teste.com',
                telefone: '11999999998',
                senha: 'hash',
                status: 'active',
                plano: 'trial',
                createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), // cadastrou há 12 dias
                planExpiresAt: expiresAt,
                admin_billing_sent_at: null,
                whatsapp_clicks: 12,
                profile_appearances: 450
            });
            
            // Add a click log with a closed deal
            await db.WhatsAppClickLog.create({
                psychologistId: psy.id,
                guestName: 'Paciente Teste Trial',
                guestPhone: '11888888888',
                clickSource: 'profile',
                dealClosed: 'yes',
                createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
            });
            console.log('Mock criado com sucesso:', psy.id);
        } else {
            await psy.update({ 
                status: 'active',
                plano: 'trial',
                planExpiresAt: expiresAt,
                admin_billing_sent_at: null
            });
            console.log('Mock atualizado com sucesso:', psy.id);
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
