const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('postgresql://yelopsi_db_user:y0HIi5A7onT11TSfSrpSTaLvsp3lEdl3@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', { dialect: 'postgres', dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }, logging: false });

async function runProjection(trialConv, churnOverride) {
    const activePaidQuery = `SELECT SUM(CASE WHEN ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false) THEN 1 ELSE 0 END) as renewable_base, COUNT(*) as paid_access_base FROM "Psychologists" WHERE "deletedAt" IS NULL AND (("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0))`;
    const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
    const renewableSubscriberBase = parseInt(activePaidRes.renewable_base || 0);
    const activePaidAccessBase = parseInt(activePaidRes.paid_access_base || 0);
    const knownScheduledChurn = activePaidAccessBase - renewableSubscriberBase;

    const b2cClicks90dQuery = `SELECT COUNT(*) as wpp_clicks FROM "WhatsAppClickLogs" WHERE "createdAt" >= NOW() - INTERVAL '90 days'`;
    const [b2cClicksRes] = await sequelize.query(b2cClicks90dQuery, { type: sequelize.QueryTypes.SELECT });
    const b2cClicks90d = parseInt(b2cClicksRes.wpp_clicks || 0);
    const contactsPerPaidPsiMonth = activePaidAccessBase > 0 ? ((b2cClicks90d / 3) / activePaidAccessBase) : 3;
    const verifiedOrganicContacts = 0; 
    const newOrganicActive = 0; 

    let histMetaMonthlySpendAvg = 3000;
    
    const cacMeta = 150;
    const arpu = 160;
    const monthlyChurn = churnOverride || 0.05;
    const reinvestRate = 0.50;
    const cplGoogle = 22.13;
    const assumedTrialConversion = trialConv || 0.15;
    const extraCash = 0;

    let currentBase = activePaidAccessBase;
    let currentRenewable = renewableSubscriberBase;
    let rolloverCash = 0;

    let results = [];
    for (let m = 1; m <= 12; m++) {
        let baseStart = currentBase;
        let baseStartRenewable = currentRenewable;

        const mrr = currentBase * arpu;
        
        const totalContactDemand = currentBase * contactsPerPaidPsiMonth;
        const requiredGoogleContacts = Math.max(0, totalContactDemand - verifiedOrganicContacts);
        const googleMaintenanceCost = requiredGoogleContacts * cplGoogle;
        
        const contributionAfterGoogle = Math.max(0, mrr - googleMaintenanceCost);
        const growthFund = (contributionAfterGoogle * reinvestRate) + (m === 1 ? extraCash : 0) + rolloverCash;

        const metaHardCap = histMetaMonthlySpendAvg * 3.5;
        let projectedMetaBudget = growthFund * 0.80; 
        
        const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / histMetaMonthlySpendAvg));
        const metaCACPenalized = cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
        
        const trialsPerPaid = 1 / assumedTrialConversion;
        const trialDurationFraction = 0.5;
        const trialContactDemand = contactsPerPaidPsiMonth * trialDurationFraction;
        const avgGoogleCostPerTrial = trialContactDemand * cplGoogle;
        
        const trialGoogleCostPerPaid = trialsPerPaid * avgGoogleCostPerTrial;
        const blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

        const maxPaidByCash = Math.floor(growthFund / blendedAcquisitionCost);
        const maxPaidByMeta = Math.floor(metaHardCap / metaCACPenalized);
        const newPaidActive = Math.min(maxPaidByCash, maxPaidByMeta);
        
        const actualMetaSpend = newPaidActive * metaCACPenalized;
        const actualTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
        const actualGrowthSpend = actualMetaSpend + actualTrialGoogleSpend;
        
        rolloverCash = growthFund - actualGrowthSpend;

        let monthKnownChurn = m === 1 ? knownScheduledChurn : 0;
        let expectedChurn = currentRenewable * monthlyChurn;
        let churnLoss = expectedChurn + monthKnownChurn;

        currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
        currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;

        results.push({
            m,
            mrr,
            googleMaintenanceCost,
            actualMetaSpend,
            actualTrialGoogleSpend,
            blendedAcquisitionCost,
            newPaidActive,
            newOrganicActive,
            monthKnownChurn,
            expectedChurn,
            rolloverCash,
            currentBase
        });
    }
    return results;
}

async function run() {
    console.log("=== MAIN PROJECTION (TrialConv: 15%, Churn: 5%) ===");
    const main = await runProjection(0.15, 0.05);
    console.log("| Mês | Base Final | MRR | Meta Spend | Google Maintenance | Trial Cost Total | Blended CAC | Paid Acq | Org Acq | Known Churn | Exp. Churn | Rollover |");
    console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
    for(let r of main) {
        console.log(`| M${r.m} | ${r.currentBase.toFixed(2)} (${Math.round(r.currentBase)}) | R$ ${r.mrr.toFixed(2)} | R$ ${r.actualMetaSpend.toFixed(2)} | R$ ${r.googleMaintenanceCost.toFixed(2)} | R$ ${r.actualTrialGoogleSpend.toFixed(2)} | R$ ${r.blendedAcquisitionCost.toFixed(2)} | +${r.newPaidActive} | +${r.newOrganicActive} | -${r.monthKnownChurn} | -${r.expectedChurn.toFixed(2)} | R$ ${r.rolloverCash.toFixed(2)} |`);
    }

    console.log("\n=== SENSITIVITY MATRIX ===");
    console.log("| Trial Conv \\ Churn | 2% Churn | 5% Churn | 8% Churn |");
    console.log("|---|---|---|---|");
    
    for(let tc of [0.10, 0.15, 0.20]) {
        let row = `| ${tc*100}% |`;
        for(let ch of [0.02, 0.05, 0.08]) {
            const res = await runProjection(tc, ch);
            const m12 = res[11];
            row += ` Base: ${Math.round(m12.currentBase)} (R$ ${m12.mrr.toFixed(0)}) |`;
        }
        console.log(row);
    }
    process.exit(0);
}
run();
