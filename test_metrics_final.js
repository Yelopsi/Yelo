const db = require('./backend/models');
const MetricsService = require('./backend/services/metricsService');

async function test() {
    const end = new Date();
    const start = new Date(new Date().setDate(end.getDate() - 30));

    console.log("Running MetricsService.getMetrics...");
    const metrics = await MetricsService.getMetrics(start, end);
    
    console.log("=== RESULTS ===");
    console.log("Base Final Pagante:", metrics.payingActiveCount);
    console.log("Inadimplentes:", metrics.inadimplentesCount);
    console.log("Novos Pagantes:", metrics.novosCount);
    console.log("Reativados:", metrics.reactivatedCount);
    console.log("Paid Churn (No Período):", metrics.paidChurnCount);
    console.log("Trial Churn (No Período):", metrics.trialChurnCount);
    console.log("LTV Bruto:", metrics.ltvObservadoBruto);
    console.log("LTV Líquido:", metrics.ltvObservadoLiquido);
    
    console.log("\nMatemática da Base Pagante:");
    console.log(`Base Inicial (${metrics.sampleData.baseInicialDoPeriodo}) + Novos (${metrics.novosCount}) + Reativados (${metrics.reactivatedCount}) - Paid Churn (${metrics.paidChurnCount}) - Inadimplentes (${metrics.inadimplentesCount}) = Base Final (${metrics.payingActiveCount})`);
    
    const mathFinal = metrics.sampleData.baseInicialDoPeriodo + metrics.novosCount + metrics.reactivatedCount - metrics.paidChurnCount - metrics.inadimplentesCount;
    if (mathFinal === metrics.payingActiveCount) {
        console.log("✅ Reconciliação Matemática EXATA!");
    } else {
        console.log(`❌ Divergência! Calculado: ${mathFinal} != Real: ${metrics.payingActiveCount}`);
    }

    process.exit(0);
}

test();
