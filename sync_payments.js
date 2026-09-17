const db = require('./backend/models');
const { Op } = require('sequelize');

async function sync() {
    const psis = await db.Psychologist.findAll({ paranoid: false });
    const payments = await db.Payment.findAll({
        where: { status: { [Op.in]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] } }
    });

    const counts = {};
    payments.forEach(p => {
        counts[p.psychologistId] = (counts[p.psychologistId] || 0) + 1;
    });

    let updated = 0;
    for (const psy of psis) {
        const count = counts[psy.id] || 0;
        if (psy.subscription_payments_count !== count) {
            await psy.update({ subscription_payments_count: count });
            updated++;
        }
    }
    console.log(`Synced subscription_payments_count for ${updated} psychologists.`);
    process.exit(0);
}
sync();
