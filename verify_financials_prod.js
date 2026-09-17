const { Sequelize, Op } = require('sequelize');
const db = require('./backend/models');

async function run() {
    try {
        const sequelize = new Sequelize("postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db", {
            dialect: 'postgres',
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
            logging: false
        });

        // Use standard models with new connection!
        db.sequelize = sequelize;
        const MetricsService = require('./backend/services/metricsService');

        let end = new Date();
        let start = new Date(new Date().setDate(end.getDate() - 30));
        let sixtyDaysAgo = new Date(new Date().setDate(end.getDate() - 60));
        let prevStart = sixtyDaysAgo;
        let prevEnd = new Date(start.getTime() - 1);

        const metrics = await MetricsService.getMetrics(start, end);
        const prevMetrics = await MetricsService.getMetrics(prevStart, prevEnd);
        
        console.log("=== KPI METRICS ===");
        console.log("MRR:", metrics.mrrTotal, "Prev:", prevMetrics.mrrTotal);
        console.log("Paid Churn Rate:", metrics.weightedChurnRate, "Prev:", prevMetrics.weightedChurnRate);
        console.log("Trial Churn Count:", metrics.trialChurnCount, "Prev:", prevMetrics.trialChurnCount);
        console.log("Paid Churn Count:", metrics.paidChurnCount, "Prev:", prevMetrics.paidChurnCount);
        console.log("Inadimplentes Count:", metrics.inadimplentesCount, "Prev:", prevMetrics.inadimplentesCount);
        console.log("LTV Projetado:", metrics.ltvProjetado);
        console.log("LTV Observado:", metrics.ltvObservado);
        console.log("Ticket Medio (ARPU):", metrics.arpu);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
