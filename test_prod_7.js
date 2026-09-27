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
        id,
        "planExpiresAt",
        "subscriptionId",
        "cancelAtPeriodEnd",
        "subscription_payments_count",
        is_exempt,
        status,
        CASE 
          WHEN is_exempt = true THEN 'Cortesia/VIP'
          WHEN "subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false THEN 'Assinatura Ativa'
          WHEN "subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = true THEN 'Cancelamento Agendado'
          WHEN "subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0 THEN 'PIX Ativo'
          ELSE 'Outro'
        END as classification
      FROM "Psychologists"
      WHERE "deletedAt" IS NULL
      AND (
        (is_exempt = true) OR
        ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR
        ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0)
      )
    `;
    const users = await sequelize.query(classQuery, { type: sequelize.QueryTypes.SELECT });
    console.log("PAYERS COUNT:", users.length);
    const summary = {};
    users.forEach(u => {
      summary[u.classification] = (summary[u.classification] || 0) + 1;
    });
    console.log("SUMMARY:", summary);

    // Any duplicates?
    const ids = new Set();
    let duplicates = 0;
    users.forEach(u => {
      if (ids.has(u.id)) duplicates++;
      ids.add(u.id);
    });
    console.log("DUPLICATES:", duplicates);

    process.exit(0);
  } catch (e) {
    console.error(e); process.exit(1);
  }
}
run();
