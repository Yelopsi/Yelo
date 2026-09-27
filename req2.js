const cacMeta = 150;
const arpu = 160;
const monthlyChurn = 0.05;
const reinvestmentRate = 0.50;
const trialsPerPaidUser = 1 / 0.15;
let currentBase = 29;
let currentRenewable = 26;
const knownScheduledChurn = 3;
let rolloverCash = 0;
const organicActivePerMonth = 4;
const histMetaMonthlySpendAvg = 3000;
const cplGoogle = 40;

console.log("| Mês | Base Esperada Inicial | Base Renovável | Receita Reconhecida | Rollover Inicial | Reinvestimento Gerado | Aporte Extra | Google Maintenance Budget | Caixa Disponível | Histórico Mensal Meta | Smart Cap Meta 3.5x | projectedMetaBudget | smartMetaBudget | Scale Factor | CAC Meta Base | CAC Meta Penalizado | PENALTY_RATE | Trial Conversion | Trials necessários | Google Cost per Trial | Google Cost novas aquisições | True CAC | Paid Acquisitions | Organic Acquisitions | Total Acquisitions | Gasto Meta efetivo | Gasto Google efetivo | Gasto total aquisição | Known Scheduled Churn | Expected Churn | Rollover Final | Base Esperada Final | MRR Final |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");

for (let m = 1; m <= 12; m++) {
    const baseStart = currentBase;
    const baseStartRenewable = currentRenewable;
    const mrr = currentBase * arpu;
    const rolloverIn = rolloverCash;
    const reinvestmentCash = mrr * reinvestmentRate;
    const aporteExtra = 0;
    
    let maintenanceGoogle = (currentBase / 50) * 150;
    let totalBudget = reinvestmentCash + rolloverCash;
    let availableForAcquisition = totalBudget - maintenanceGoogle;

    let projectedMetaBudget = availableForAcquisition * 0.80;
    let smartMetaBudget = projectedMetaBudget;
    
    const maxHealthyMetaBudget = histMetaMonthlySpendAvg * 3.5;
    
    let penaltyRate = 0;
    if (smartMetaBudget > maxHealthyMetaBudget) {
        const excess = smartMetaBudget - maxHealthyMetaBudget;
        smartMetaBudget = maxHealthyMetaBudget + (excess * 0.80); // (1 - 0.20)
        penaltyRate = 0.20;
    }

    const trueCac = cacMeta * (1 + penaltyRate);
    const newPaidActive = Math.floor(smartMetaBudget / trueCac);
    
    // In the CURRENT (buggy) implementation, Google Cost was IGNORED in True CAC!
    // True CAC is just cacMeta * (1 + penalty), and smartMetaBudget pays it entirely.
    const gastoMetaEfetivo = newPaidActive * trueCac;
    const gastoGoogleNovasAquisicoes = 0; // BUG in current implementation
    const googleCostPerTrial = 0; // BUG
    
    rolloverCash = availableForAcquisition - gastoMetaEfetivo;
    
    const newOrganicActive = Math.floor(organicActivePerMonth);

    let monthKnownChurn = m === 1 ? knownScheduledChurn : 0;
    let expectedChurn = currentRenewable * monthlyChurn;
    let churnLoss = expectedChurn + monthKnownChurn;

    currentBase = currentBase + newPaidActive + newOrganicActive - churnLoss;
    currentRenewable = currentRenewable + newPaidActive + newOrganicActive - expectedChurn;
    const mrrFinal = currentBase * arpu;

    console.log(`| M${m} | ${baseStart.toFixed(2)} | ${baseStartRenewable.toFixed(2)} | ${mrr.toFixed(2)} | ${rolloverIn.toFixed(2)} | ${reinvestmentCash.toFixed(2)} | ${aporteExtra.toFixed(2)} | ${maintenanceGoogle.toFixed(2)} | ${availableForAcquisition.toFixed(2)} | ${histMetaMonthlySpendAvg.toFixed(2)} | ${maxHealthyMetaBudget.toFixed(2)} | ${projectedMetaBudget.toFixed(2)} | ${smartMetaBudget.toFixed(2)} | - | ${cacMeta.toFixed(2)} | ${trueCac.toFixed(2)} | ${penaltyRate.toFixed(2)} | 15% | 6.66 | ${googleCostPerTrial.toFixed(2)} | ${gastoGoogleNovasAquisicoes.toFixed(2)} | ${trueCac.toFixed(2)} | ${newPaidActive} | ${newOrganicActive} | ${newPaidActive + newOrganicActive} | ${gastoMetaEfetivo.toFixed(2)} | ${maintenanceGoogle.toFixed(2)} | ${(gastoMetaEfetivo + maintenanceGoogle).toFixed(2)} | ${monthKnownChurn} | ${expectedChurn.toFixed(2)} | ${rolloverCash.toFixed(2)} | ${currentBase.toFixed(2)} | ${mrrFinal.toFixed(2)} |`);
}
