const { Op } = require('sequelize');
const db = require('./backend/models');
async function run() {
    const psis = await db.Psychologist.findAll({ where: { nome: { [Op.iLike]: '%Ana Ferreira%' } } });
    for (const psi of psis) {
        console.log("ID:", psi.id);
        console.log("Nome:", psi.nome);
        console.log("Plano:", psi.plano);
        console.log("Status:", psi.status);
        console.log("SubscribedAt:", psi.subscribedAt);
        console.log("PlanExpiresAt:", psi.planExpiresAt);
        console.log("SubscriptionId:", psi.subscriptionId);
        console.log("StripeSubscriptionId:", psi.stripeSubscriptionId);
        console.log("CancelAtPeriodEnd:", psi.cancelAtPeriodEnd);
        console.log("subscription_payments_count:", psi.subscription_payments_count);
    }
    if (psis.length === 0) console.log("Not found.");
    await db.sequelize.close();
}
run();
