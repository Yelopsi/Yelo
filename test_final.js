const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');

async function runTest() {
    console.log("=== RECONCILIAÇÃO E AUDITORIA FINAL ===");
    
    // Período de auditoria: desde o início do ano até hoje
    const now = new Date('2026-08-17T14:18:46-03:00'); // data atual informada
    const startOfPeriod = new Date('2026-01-01T00:00:00-03:00');
    
    const metrics = await MetricsService.getMetrics(startOfPeriod, now);

    console.log("\n[ RECONCILIAÇÃO DA BASE ]");
    console.log("Período:", startOfPeriod.toISOString().split('T')[0], "até", now.toISOString().split('T')[0]);
    console.log(`Base Inicial do Período: ${metrics.sampleData.baseInicialDoPeriodo}`);
    console.log(`+ Novos Clientes (com firstPaidAt): ${metrics.novosCount}`);
    console.log(`+ Clientes Legado/Unknown (Ativos sem firstPaidAt na base): ${metrics.sampleData.unknowns}`);
    console.log(`+ Reativações: ${metrics.reactivatedCount}`);
    console.log(`- Paid Churns: ${metrics.paidChurnCount}`);
    console.log(`- Trial Churns: ${metrics.trialChurnCount}`);
    
    // Equação completa:
    // Base Inicial + Novos (que passaram pelo funil) + Unknowns (que já existiam mas não tinham data) + Reativações - Paid Churn - Trial Churn
    const equacao = metrics.sampleData.baseInicialDoPeriodo + metrics.novosCount + metrics.sampleData.unknowns + metrics.reactivatedCount - metrics.paidChurnCount - metrics.trialChurnCount;
    
    console.log(`= Equação Final Matemática: ${equacao}`);
    console.log(`Base Ativa Real do Sistema: ${metrics.sampleData.baseFinal}`);
    console.log(equacao === metrics.sampleData.baseFinal ? "✅ A CONTA FECHA" : "❌ INCONSISTÊNCIA NA BASE");

    console.log("\n[ MÉTRICAS AGREGADAS ]");
    console.log("Total Paid Churn (Histórico Completo):", metrics.sampleData.totalHistoricalPaidChurned);
    console.log("Total Trial Churn (Histórico Completo):", metrics.sampleData.totalHistoricalTrialChurned);
    console.log(`Paid Churn Rate (Média Mensal Simples): ${metrics.churnRateMedioMensal.toFixed(2)}%`);
    console.log(`Paid Churn Rate (Ponderado pela Exposição): ${metrics.weightedChurnRate.toFixed(2)}%`);
    
    console.log("\n[ LTV ]");
    console.log(`LTV Projetado (Com Churn Ponderado): R$ ${metrics.ltvProjetado.toFixed(2)}`);
    console.log(`LTV Observado (Apenas Paid Churns): R$ ${metrics.ltvObservado.toFixed(2)}`);

    console.log("\n[ DADOS INCOMPLETOS ]");
    console.log(`Clientes ativos sem firstPaidAt conhecido: ${metrics.sampleData.unknowns}`);
    
    process.exit(0);
}

runTest();
