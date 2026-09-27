const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function run() {
    try {
        const activePaidQuery = `SELECT SUM(CASE WHEN ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false) THEN 1 ELSE 0 END) as renewable_base, COUNT(*) as paid_access_base FROM "Psychologists" WHERE "deletedAt" IS NULL AND (("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0))`;
        const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
        const renewableSubscriberBase = parseInt(activePaidRes.renewable_base || 0);
        const activePaidAccessBase = parseInt(activePaidRes.paid_access_base || 0);
        const knownScheduledChurn = activePaidAccessBase - renewableSubscriberBase;
        
        let histMetaMonthlySpendAvg = 0;
        let metaState = 'VALID';
        const fallbackMeta = await sequelize.query(`SELECT * FROM "ManualAdMetrics" WHERE platform = 'meta' ORDER BY "createdAt" DESC LIMIT 1`, { type: sequelize.QueryTypes.SELECT });
        if (fallbackMeta.length > 0) {
            histMetaMonthlySpendAvg = parseFloat(fallbackMeta[0].spend) || 0;
            metaState = 'STALE';
        } else {
            histMetaMonthlySpendAvg = 3000;
            metaState = 'UNAVAILABLE';
        }
        
        const cacMeta = 150;
        const arpu = 160;
        const monthlyChurn = 0.05;
        const reinvestmentRate = 0.50;
        const trialsPerPaidUser = 1 / 0.15;
        
        let currentBase = activePaidAccessBase;
        let currentRenewable = renewableSubscriberBase;
        let rolloverCash = 0;
        let organicActive90d = 12; // Placeholder
        const organicActivePerMonth = organicActive90d / 3;
        
        console.log(`| Mês | Base Inicial | Base Renovável | Receita Reconhecida | Known Scheduled Churn | Assumed Churn Esperado | Aquisições (Paid+Org) | Base Final Esperada (Arredondada) |`);
        console.log(`|---|---|---|---|---|---|---|---|`);

        for (let m = 1; m <= 12; m++) {
            const histMetaSpend = histMetaMonthlySpendAvg;
            const maxHealthyMetaBudget = histMetaSpend * 3.5;
            
            const reinvestmentCash = (currentBase * arpu) * reinvestmentRate;
            let totalBudget = reinvestmentCash + rolloverCash;
            let maintenanceGoogle = (currentBase / 50) * 150;
            let availableForAcquisition = totalBudget - maintenanceGoogle;

            let smartMetaBudget = availableForAcquisition * 0.80;
            let penaltyRate = 0;
            
            if (smartMetaBudget > maxHealthyMetaBudget) {
                const excess = smartMetaBudget - maxHealthyMetaBudget;
                smartMetaBudget = maxHealthyMetaBudget + (excess * (1 - 0.20));
                penaltyRate = 0.20;
            }

            const trueCac = cacMeta * (1 + penaltyRate);
            const newPaidActive = Math.floor(smartMetaBudget / trueCac);
            rolloverCash = availableForAcquisition - smartMetaBudget;
            
            const newOrganicActive = Math.floor(organicActivePerMonth);

            let monthKnownChurn = m === 1 ? knownScheduledChurn : 0;
            let expectedChurn = currentRenewable * monthlyChurn;
            let churnLoss = expectedChurn + monthKnownChurn;

            let baseStart = currentBase;
            let baseStartRenewable = currentRenewable;
            const mrr = currentBase * arpu;

            currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
            currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;

            console.log(`| Mês ${m} | ${baseStart.toFixed(2)} (${Math.round(baseStart)}) | ${baseStartRenewable.toFixed(2)} | R$ ${mrr.toFixed(2)} | -${monthKnownChurn} | -${expectedChurn.toFixed(2)} | +${newPaidActive + newOrganicActive} | ${currentBase.toFixed(2)} (${Math.round(currentBase)}) |`);
        }
        
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
}
run();
