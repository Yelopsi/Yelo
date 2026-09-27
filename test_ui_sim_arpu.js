const fs = require('fs');

// We simulate the logic that the UI now runs
const activePaidAccessBase = 29;
const renewableSubscriberBase = 26;
const knownScheduledChurn = 3;

const trialConversionRate = 0.15;
const cacMeta = 150;
const arpu = 103.5;
const contactsPerPaidPsiMonth = 3.0;
const cplGoogle = 22.13;
const monthlyChurn = 0.05;
const histMetaMonthlySpendAvg = 3000;
const reinvestRate = 50;
const extraCash = 0;
const verifiedOrganicContacts = 0; 
const newOrganicActive = 0; 

const targetMonths = 12;
let currentBase = activePaidAccessBase;
let currentRenewable = renewableSubscriberBase;
let rolloverCash = 0;

let mrrAt12 = 0;
let baseAt12 = 0;
let metaBudgetAt12 = 0;
let googleBudgetAt12 = 0;

let actionMetaSpend = 0;
let actionGoogleMaintenance = 0;
let actionTrialGoogleSpend = 0;
let actionUnspentCash = 0;

for (let m = 1; m <= targetMonths; m++) {
    const mrr = currentBase * arpu;
    const totalContactDemand = currentBase * contactsPerPaidPsiMonth;
    const requiredGoogleContacts = Math.max(0, totalContactDemand - verifiedOrganicContacts);
    const googleMaintenanceCost = requiredGoogleContacts * cplGoogle;
    
    const contributionAfterGoogle = Math.max(0, mrr - googleMaintenanceCost);
    const growthFund = (contributionAfterGoogle * (reinvestRate / 100)) + (m === 1 ? extraCash : 0) + rolloverCash;

    const metaHardCap = histMetaMonthlySpendAvg * 3.5;
    let projectedMetaBudget = growthFund * 0.80;
    
    const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / (histMetaMonthlySpendAvg || 1)));
    const metaCACPenalized = cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
    
    const trialsPerPaid = 1 / trialConversionRate;
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
    
    const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;

    if (m === 1) {
        actionMetaSpend = actualMetaSpend;
        actionGoogleMaintenance = googleMaintenanceCost;
        actionTrialGoogleSpend = actualTrialGoogleSpend;
        actionUnspentCash = rolloverCash;
        console.log(`M1 Base: ${currentBase}`);
        console.log(`M1 Meta Spend: ${actionMetaSpend}`);
        console.log(`M1 Google Maintenance: ${actionGoogleMaintenance}`);
        console.log(`M1 Google Trial: ${actionTrialGoogleSpend}`);
        console.log(`M1 Rollover: ${actionUnspentCash}`);
    }
    
    if (m === 12) {
        mrrAt12 = mrr;
        baseAt12 = currentBase;
        metaBudgetAt12 = actualMetaSpend;
        googleBudgetAt12 = totalGoogleBudget;
    }
}
console.log(`\nM12 MRR: ${mrrAt12}`);
console.log(`M12 Base: ${baseAt12}`);
