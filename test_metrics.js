const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');

async function runTests() {
    console.log("Iniciando testes de métricas...");
    
    // We will just call the service for the current month and print out the results
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const metrics = await MetricsService.getMetrics(startOfMonth, endOfMonth);
    
    console.log("========================================");
    console.log("RESULTADOS DA AUDITORIA AUTOMATIZADA");
    console.log("========================================");
    console.log(`MRR Atual: R$ ${metrics.mrrTotal}`);
    console.log(`ARPU Atual: R$ ${metrics.arpu.toFixed(2)}`);
    console.log(`Pagantes Ativos Atuais: ${metrics.payingActiveCount}`);
    console.log(`Novos Pagantes no Período: ${metrics.novosCount}`);
    console.log(`Reativações no Período: ${metrics.reactivatedCount}`);
    console.log(`Churns Realizados no Período: ${metrics.churnCount}`);
    console.log(`Taxa de Churn Média Mensal: ${metrics.churnRateMedioMensal.toFixed(2)}%`);
    console.log(`Lifetime Projetado (Meses): ${metrics.projectedLifetimeMonths.toFixed(1)}`);
    console.log(`LTV Projetado: R$ ${metrics.ltvProjetado.toFixed(2)}`);
    console.log(`LTV Observado (Histórico): R$ ${metrics.ltvObservado.toFixed(2)}`);
    console.log(`CAC Payback Projetado: ${metrics.cacPaybackMonths.toFixed(1)} meses`);
    console.log("----------------------------------------");
    console.log("DADOS DA AMOSTRA:");
    console.log(`Total de Psicólogos: ${metrics.sampleData.totalCustomersAnalyzed}`);
    console.log(`Total de Churns Históricos: ${metrics.sampleData.totalHistoricalChurned}`);
    console.log(`Usuários com Data de Início Desconhecida: ${metrics.sampleData.unknowns}`);
    console.log(`Meses Válidos de Análise de Retenção: ${metrics.sampleData.mesesAnalisados}`);
    console.log("========================================");
    
    process.exit(0);
}

runTests();
