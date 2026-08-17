const db = require('./backend/models');
db.Psychologist.findAll({ where: { plano: { [db.Sequelize.Op.ne]: null }, status: 'active' }, raw: true }).then(users => {
    console.log(`Found ${users.length} active users with plano`);
    const paying = users.filter(psy => !psy.is_exempt && (!!psy.subscriptionId || psy.subscription_payments_count > 0));
    console.log(`Paying users: ${paying.length}`);
    if (paying.length > 0) {
       console.log('First paying user is_exempt:', paying[0].is_exempt, 'plano:', paying[0].plano, 'status:', paying[0].status, 'subId:', paying[0].subscriptionId, 'payments_count:', paying[0].subscription_payments_count);
    }
    process.exit(0);
});
