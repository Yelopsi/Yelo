function runSimulation(baseInicial, arpu, cacMeta, cplGoogle, trialConv, histMetaMonthlySpend, reinvestRate, extraCash, assumedChurn) {
    const PENALTY_RATE = 0.20;
    let currentBase = baseInicial;
    let rolloverCash = 0;
    
    // Derived static parameters
    const maxHealthyMetaBudget = histMetaMonthlySpend * 3.5;
    const googleCostPerTrial = cplGoogle;
    const trialsPerPaidUser = trialConv > 0 ? (1 / trialConv) : 0;
    const baseGoogleBudget = 0; // Maintenance (0 in current logic if not set)

    const table = [];
    let cumulativeRevenue = 0;

    for (let month = 1; month <= 12; month++) {
        const monthlyRevenue = currentBase * arpu;
        cumulativeRevenue += monthlyRevenue;

        let availableForAcquisition = (monthlyRevenue * (reinvestRate / 100)) + extraCash + rolloverCash;
        
        // Scale penalty
        let cacPenalizado = cacMeta;
        if (availableForAcquisition > histMetaMonthlySpend && histMetaMonthlySpend > 0) {
            const extraRatio = Math.max(0, (availableForAcquisition - histMetaMonthlySpend) / histMetaMonthlySpend);
            const penaltyPercent = Math.min(extraRatio * PENALTY_RATE, 2.0); 
            cacPenalizado = cacMeta * (1 + penaltyPercent);
        }

        const baseTrueCac = cacPenalizado + (trialsPerPaidUser * googleCostPerTrial);
        let projectedMetaBudget = availableForAcquisition * (cacPenalizado / baseTrueCac);
        
        let smartMetaBudget = Math.min(projectedMetaBudget, maxHealthyMetaBudget);
        let smartGoogleTrialsBudget = smartMetaBudget * ((trialsPerPaidUser * googleCostPerTrial) / cacPenalizado);
        
        let smartAcquisitionBudget = smartMetaBudget + smartGoogleTrialsBudget;
        let actualAcquisitionSpend = Math.min(availableForAcquisition, smartAcquisitionBudget);

        let newPaidActive = Math.floor(actualAcquisitionSpend / baseTrueCac);
        let actualSpend = newPaidActive * baseTrueCac;

        rolloverCash = availableForAcquisition - actualSpend;

        let churnLoss = Math.floor(currentBase * assumedChurn);
        
        table.push({
            Mes: month,
            BaseInicial: currentBase,
            MRRInicial: currentBase * arpu,
            ChurnAssumido: (assumedChurn * 100).toFixed(1) + '%',
            PerdasPorChurn: churnLoss,
            Receita: monthlyRevenue,
            Reinvestido: reinvestRate + '%',
            AporteExtra: extraCash,
            RolloverInicial: rolloverCash,
            GoogleManutencao: baseGoogleBudget,
            CaixaDispAq: availableForAcquisition,
            MetaBudget: smartMetaBudget,
            CacMetaPenalizado: cacPenalizado,
            CustoGoogleAq: smartGoogleTrialsBudget,
            TrueCac: baseTrueCac,
            NovosPagantes: newPaidActive,
            GastoEfetivo: actualSpend,
            RolloverFinal: rolloverCash,
            BaseFinal: currentBase + newPaidActive - churnLoss,
            MRRFinal: (currentBase + newPaidActive - churnLoss) * arpu
        });

        currentBase = currentBase + newPaidActive - churnLoss;
    }
    return table;
}

// REAL VALUES FROM DB
const baseInicial = 2; // Real active
const arpu = 163;
const cacMeta = 150;
const cplGoogle = 4592.53;
const trialConv = 0.15;
const histMetaMonthlySpend = 0; // Token expired!
const reinvestRate = 100;
const extraCash = 2;

console.log("=== CENARIO: CHURN BAIXO (2%) ===");
console.table(runSimulation(baseInicial, arpu, cacMeta, cplGoogle, trialConv, histMetaMonthlySpend, reinvestRate, extraCash, 0.02));

console.log("\n=== CENARIO: CHURN BASE (5%) ===");
console.table(runSimulation(baseInicial, arpu, cacMeta, cplGoogle, trialConv, histMetaMonthlySpend, reinvestRate, extraCash, 0.05));

console.log("\n=== CENARIO: CHURN ALTO (10%) ===");
console.table(runSimulation(baseInicial, arpu, cacMeta, cplGoogle, trialConv, histMetaMonthlySpend, reinvestRate, extraCash, 0.10));
