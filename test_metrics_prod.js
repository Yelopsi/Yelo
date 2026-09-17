const { Sequelize, Op } = require('sequelize');

async function run() {
    const sequelize = new Sequelize("postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db", {
        dialect: 'postgres',
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        logging: false
    });
    
    // We fetch raw data from DB to simulate the Metrics logic and find discrepancies
    const [psis] = await sequelize.query(`SELECT id, nome, status, is_exempt, plano, "subscriptionId", subscription_payments_count, "canceledAt", "updatedAt" FROM "Psychologists"`);
    
    // Inadimplentes are users with hasPaidCustomer() = true and status = 'inactive'
    let inadimplentes = 0;
    let churnedPaid = 0;
    let churnedTrial = 0;
    
    let now = new Date();
    let start30d = new Date();
    start30d.setDate(start30d.getDate() - 30);
    
    psis.forEach(psy => {
        const hasPaid = !!psy.subscriptionId || (psy.subscription_payments_count > 0);
        if (hasPaid && psy.status === 'inactive') {
            inadimplentes++;
        }
        
        let deactivatedDate = psy.canceledAt ? new Date(psy.canceledAt) : (psy.status === 'inactive' ? new Date(psy.updatedAt) : null);
        if (deactivatedDate && deactivatedDate >= start30d) {
            if (hasPaid) churnedPaid++;
            else churnedTrial++;
        }
    });
    
    console.log("Calculated Inadimplentes:", inadimplentes);
    console.log("Calculated Churned Paid (30d):", churnedPaid);
    console.log("Calculated Churned Trial (30d):", churnedTrial);
    
    process.exit(0);
}
run();
