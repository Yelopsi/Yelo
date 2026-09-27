const { Sequelize, Op } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const query = await sequelize.query(`
            SELECT id, nome, email, "subscriptionId", "cancelAtPeriodEnd", "planExpiresAt", "status", plano, is_exempt
            FROM "Psychologists"
            WHERE status = 'active'
        `, { type: sequelize.QueryTypes.SELECT });

        const now = new Date();

        const recurrent = query.filter(p => p.subscriptionId && !p.cancelAtPeriodEnd && !p.is_exempt && p.plano !== 'VIP' && (!p.planExpiresAt || new Date(p.planExpiresAt) > now));
        const scheduledCancel = query.filter(p => p.subscriptionId && p.cancelAtPeriodEnd && new Date(p.planExpiresAt) > now);
        const pixManual = query.filter(p => !p.subscriptionId && !p.is_exempt && p.plano !== 'VIP' && new Date(p.planExpiresAt) > now && p.plano !== 'Trial');
        const vips = query.filter(p => p.is_exempt || p.plano === 'VIP');

        console.log(`\n=== 26 Assinaturas Recorrentes Normais (${recurrent.length}) ===`);
        recurrent.forEach(p => console.log(`- ID: ${p.id} | ${p.nome} | ${p.email} | Sub: ${p.subscriptionId}`));

        console.log(`\n=== 2 Assinaturas com Cancelamento Agendado (${scheduledCancel.length}) ===`);
        scheduledCancel.forEach(p => console.log(`- ID: ${p.id} | ${p.nome} | ${p.email} | Sub: ${p.subscriptionId} | Expira: ${p.planExpiresAt}`));

        console.log(`\n=== 1 Pagamento PIX/Manual (${pixManual.length}) ===`);
        pixManual.forEach(p => console.log(`- ID: ${p.id} | ${p.nome} | ${p.email} | Expira: ${p.planExpiresAt} | Plano: ${p.plano}`));

        console.log(`\n=== 2 VIP/Cortesia (${vips.length}) ===`);
        vips.forEach(p => console.log(`- ID: ${p.id} | ${p.nome} | ${p.email} | VIP: ${p.is_exempt}`));

        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
run();
