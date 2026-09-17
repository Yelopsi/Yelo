const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function run() {
    try {
        const sequelize = new Sequelize("postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db", {
            dialect: 'postgres',
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
            logging: false
        });
        db.sequelize = sequelize;
        const MetricsService = require('./backend/services/metricsService');
        
        let settings = await db.SystemSetting.findOne() || {};
        console.log("Settings prices:", settings.price_Essencial, settings.price_Clínico, settings.price_sol);

        const allPsychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });
        const allPayments = await db.Payment.findAll({ raw: true });
        const paymentsByPsy = {};
        for (const p of allPayments) {
            if (!paymentsByPsy[p.psychologistId]) paymentsByPsy[p.psychologistId] = [];
            paymentsByPsy[p.psychologistId].push(p);
        }

        let payingActiveCount = 0;
        for (const psy of allPsychologists) {
            if (MetricsService.isCurrentlyPaying(psy, paymentsByPsy)) {
                payingActiveCount++;
                console.log(psy.id, psy.nome, psy.plano, psy.status, psy.is_exempt);
            }
        }
        console.log(`Total active paying: ${payingActiveCount}`);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
