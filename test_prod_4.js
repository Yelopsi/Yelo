const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
  dialect: 'postgres',
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  logging: false
});
async function run() {
  try {
    const classQuery = `
      SELECT 
        CASE 
          WHEN is_exempt = true THEN 'Cortesia/VIP'
          WHEN "subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false THEN 'Assinatura Ativa (Pagante)'
          WHEN "subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = true THEN 'Cancelamento Agendado (Acesso Válido)'
          WHEN "subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0 THEN 'Pagante PIX / Avulso Ativo'
          WHEN "subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0) THEN 'Trial (Acesso Válido)'
          WHEN "planExpiresAt" <= NOW() AND status = 'active' THEN 'Inadimplente / Expirado (Retido como Ativo)'
          WHEN "planExpiresAt" <= NOW() AND status = 'inactive' THEN 'Expirado / Inativo Corretamente'
          WHEN "planExpiresAt" <= NOW() AND status = 'canceled' THEN 'Cancelado (Acesso Encerrado)'
          ELSE 'Indeterminado'
        END as classification,
        COUNT(*) as qtd
      FROM "Psychologists"
      WHERE "deletedAt" IS NULL
      GROUP BY classification
      ORDER BY qtd DESC
    `;
    const classification = await sequelize.query(classQuery, { type: sequelize.QueryTypes.SELECT });
    console.log("CLASSIFICATION:", classification);
    process.exit(0);
  } catch (e) {
    console.error(e); process.exit(1);
  }
}
run();
