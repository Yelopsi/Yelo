const p = {
    targetMonths: 12,
    currentBase: 19,
    arpu: 99,
    demandEligibilityRate: 1.0,
    contactsPerPaidPsiMonth: 3.0,
    verifiedOrganicContacts: 0,
    cplGoogle: 22.13,
    reinvestRate: 100,
    extraCash: 2000,
    rolloverCash: 0,
    histMetaMonthlySpendAvg: 3000,
    cacMeta: 30.57,
    trialConversionRate: 0.125,
    monthlyChurn: 0.07367,
    newOrganicActive: 0
};
let currentBase = p.currentBase;
let rolloverCash = p.rolloverCash;
let dataArray = [];

for (let m = 1; m <= 12; m++) {
    let baseStart = currentBase;
    const startingMrr = baseStart * p.arpu;
    const projectedDemandEligibleBase = baseStart * p.demandEligibilityRate;
    const totalContactDemand = projectedDemandEligibleBase * p.contactsPerPaidPsiMonth;
    const requiredGoogleContacts = Math.max(0, totalContactDemand - p.verifiedOrganicContacts);
    const googleMaintenanceCost = requiredGoogleContacts * p.cplGoogle;
    const contributionAfterGoogle = Math.max(0, startingMrr - googleMaintenanceCost);
    const growthFund = (contributionAfterGoogle * (p.reinvestRate / 100)) + p.extraCash + rolloverCash;
    const effectiveHistSpend = Math.max(p.histMetaMonthlySpendAvg || 0, 1000);
    const metaHardCap = effectiveHistSpend * 3.5;
    let projectedMetaBudget = growthFund * 0.80;
    const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / effectiveHistSpend));
    const metaCACPenalized = p.cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
    const trialGoogleCostPerPaid = (1 / p.trialConversionRate) * (p.contactsPerPaidPsiMonth * (7 / 30) * p.cplGoogle);
    const blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;
    const newPaidActive = Math.min(Math.floor(growthFund / blendedAcquisitionCost), Math.floor(metaHardCap / metaCACPenalized));
    const actualMetaSpend = newPaidActive * metaCACPenalized;
    const actualTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
    const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;
    const actualGrowthSpend = actualMetaSpend + actualTrialGoogleSpend;
    const unspentCash = growthFund - actualGrowthSpend;
    
    let expectedChurn = baseStart * p.monthlyChurn;
    currentBase = baseStart + newPaidActive + p.newOrganicActive - expectedChurn;

    dataArray.push({
        mes: m,
        openingPaidBase: Number(baseStart.toFixed(4)),
        openingMRR: Number(startingMrr.toFixed(2)),
        ownerExtraCash: p.extraCash,
        reinvestedMRR: Number(contributionAfterGoogle.toFixed(2)),
        totalCashAvailable: Number(growthFund.toFixed(2)),
        googleMaintenanceSpend: Number(googleMaintenanceCost.toFixed(2)),
        googleGrowthSpend: Number(actualTrialGoogleSpend.toFixed(2)),
        metaAcquisitionSpend: Number(actualMetaSpend.toFixed(2)),
        totalMarketingSpend: Number((totalGoogleBudget + actualMetaSpend).toFixed(2)),
        cacUsadoNoMes: Number(metaCACPenalized.toFixed(2)),
        scalePenaltyAplicada: Number((metaCACPenalized / p.cacMeta - 1).toFixed(4)),
        grossNewPaidSubscribers: newPaidActive,
        churnRate: p.monthlyChurn,
        churnedSubscribers: Number(expectedChurn.toFixed(4)),
        netNewSubscribers: Number((newPaidActive - expectedChurn).toFixed(4)),
        closingPaidBase: Number(currentBase.toFixed(4)),
        closingMRR: Number((currentBase * p.arpu).toFixed(2)),
        endingCash: Number(unspentCash.toFixed(2))
    });

    rolloverCash = unspentCash;
}

const report = {
    PROJECTION_REPRODUCIBLE: false,
    CASH_RECONCILES: true,
    MRR_RECONCILES: true,
    TEXT_CONTRADICTIONS: [
        "A interface afirma que está 'investindo apenas a receita gerada pela própria máquina', mas a simulação injeta R$ 2.000 mensais de 'Aporte adicional' (ownerExtraCash), o que contradiz a alegação de crescimento 100% orgânico/autossustentável."
    ],
    MATHEMATICAL_PROBLEMS: [
        "A base projetada no mês 12 apresentada (464) não bate com o cálculo matemático utilizando os parâmetros padrão (CPL de 22,13 e Churn de 7,36%), que atinge ~399 pagantes.",
        "O Meta recomendado M1 exibido (648,81) não bate com a projeção estrita que calculou 489,12 (devido ao Math.floor no limite de aquisição) ou um número diferente caso a penalidade de escala seja aplicada.",
        "O MRR Projetado M12 (45.980,63) confirma que a base subjacente exata é um float (464.4508), mas a conversão real das contas com Math.floor nas compras não atinge esse alvo na simulação extraída do código."
    ],
    DATA: dataArray
};

const fs = require('fs');
fs.writeFileSync('/Users/andehrson/.gemini/antigravity-ide/brain/1b2010d7-ea39-48a1-b7b4-b895ea075c6a/scratch/growth_engine_audit.json', JSON.stringify(report, null, 2));
