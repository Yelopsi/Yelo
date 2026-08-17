const db = require('./backend/models');
async function test() {
   const users = await db.Psychologist.findAll({
      where: { status: 'active', plano: { [db.Sequelize.Op.ne]: null } },
      raw: true, paranoid: false
   });
   console.log("Found " + users.length + " users.");
   for(let u of users) {
      console.log(u.id, u.plano, u.status, typeof u.subscriptionId, u.subscriptionId, typeof u.subscription_payments_count, u.subscription_payments_count);
   }
   process.exit(0);
}
test();
