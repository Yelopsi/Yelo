const db = require('./backend/models');
async function test() {
  const payers = await db.Psychologist.findAll({
    where: {
      [db.Sequelize.Op.or]: [
        { subscribedAt: { [db.Sequelize.Op.not]: null } },
        { subscription_payments_count: { [db.Sequelize.Op.gt]: 0 } }
      ]
    },
    attributes: ['id', 'nome', 'createdAt', 'subscribedAt', 'subscription_payments_count'],
    order: [['createdAt', 'DESC']],
    limit: 10
  });
  console.log(JSON.stringify(payers, null, 2));
}
test();
