const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');

async function runAudit() {
    console.log("=== INICIANDO AUDITORIA FINAL INDEPENDENTE ===");
    
    // Período de auditoria: desde o início do ano até hoje
    const now = new Date('2026-08-17T14:15:56-03:00'); // data atual informada
    const startOfPeriod = new Date('2026-01-01T00:00:00-03:00');
    
    // Pegando métricas consolidadas
    const metrics = await MetricsService.getMetrics(startOfPeriod, now);

    console.log("\n1. MRR");
    console.log("MRR Atual:", metrics.mrrTotal);
    console.log("Pagantes Ativos:", metrics.payingActiveCount);
    
    console.log("\n2. Novos Pagantes");
    console.log("Novos Pagantes no período:", metrics.novosCount);
    
    console.log("\n3. Churn");
    console.log("Churns no período:", metrics.churnCount);
    
    console.log("\n4. Base Inicial, Churn, Reativação por Mês (Coortes)");
    for (const [month, data] of Object.entries(metrics.sampleData.historyLog || {})) {
        console.log(`- Mês ${month}: Base Inicial: ${data.startBase}, Novos: ${data.newUsers}, Churns: ${data.churns}, Reativações: ${data.reactivations}, Base Final: ${data.endBase}`);
    }

    console.log("\n7. LTV Projetado");
    console.log("ARPU:", metrics.arpu);
    console.log("Taxa de Churn Mensal (%):", metrics.churnRateMedioMensal);
    console.log("Lifetime Projetado (meses):", metrics.projectedLifetimeMonths);
    console.log("LTV Projetado:", metrics.ltvProjetado);
    
    console.log("\n8. LTV Observado");
    console.log("LTV Observado (Receita Recebida):", metrics.ltvObservado);
    
    console.log("\n9. Amostra");
    console.log("Tamanho da amostra (clientes analisados):", metrics.sampleData.totalCustomersAnalyzed);
    console.log("Total de Churns Históricos (Geral):", metrics.sampleData.totalHistoricalChurned);
    console.log("Meses analisados:", metrics.sampleData.mesesAnalisados);

    console.log("\n10. Clientes com histórico incompleto");
    console.log("Unknowns:", metrics.sampleData.unknowns);

    console.log("\n11. Caso Thais Silva Souza (id 327)");
    const thais = await db.Psychologist.findByPk(327, { paranoid: false });
    if(thais) {
        console.log("Thais canceledAt:", thais.canceledAt);
        console.log("Considerada churn?", metrics.sampleData.churnedUsers?.includes(327) ? "SIM" : "NÃO");
    } else {
        console.log("Thais não encontrada");
    }

    process.exit(0);
}

runAudit();
