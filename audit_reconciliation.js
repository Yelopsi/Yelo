const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');
const { Op } = require('sequelize');

async function auditReconciliation() {
    console.log("=== AUDITORIA DE RECONCILIAÇÃO ===");
    const start = new Date('2026-01-01T00:00:00-03:00');
    const end = new Date('2026-08-17T14:25:02-03:00');

    const allPsychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });

    let firstPaidAt17 = [];
    
    // 1. All 17 users with firstPaidAt in the period
    allPsychologists.forEach(psy => {
        if (psy.firstPaidAt) {
            const firstPaid = new Date(psy.firstPaidAt);
            if (firstPaid >= start && firstPaid <= end) {
                firstPaidAt17.push(psy);
            }
        }
    });

    console.log(`\nEncontrados ${firstPaidAt17.length} clientes com firstPaidAt no período.\n`);
    
    // 2. Classify each of the 17
    let classifications = {
        ativo: 0,
        paidChurn: 0,
        trialChurn: 0,
        inadimplente: 0,
        outro: 0
    };

    console.log("=== LISTA DOS CLIENTES COM FIRSTPAIDAT NO PERÍODO ===");
    for (const psy of firstPaidAt17) {
        const isAtivo = MetricsService.isCurrentlyPaying(psy);
        const isPaidChurn = psy.canceledAt && new Date(psy.canceledAt) <= new Date() && psy.status !== 'active' && !psy.reactivatedAt && psy.lifetimeRevenue > 0;
        const isTrialChurn = psy.canceledAt && new Date(psy.canceledAt) <= new Date() && psy.status !== 'active' && !psy.reactivatedAt && (!psy.lifetimeRevenue || psy.lifetimeRevenue === 0);
        
        let classif = "OUTRO";
        if (isAtivo) { classif = "ATIVO"; classifications.ativo++; }
        else if (isPaidChurn) { classif = "PAID CHURN"; classifications.paidChurn++; }
        else if (isTrialChurn) { classif = "TRIAL CHURN"; classifications.trialChurn++; }
        else if (psy.status === 'inactive' && !psy.canceledAt) { classif = "INADIMPLENTE/INATIVO SEM CANCELAMENTO"; classifications.inadimplente++; }
        else classifications.outro++;

        console.log(`- ID: ${psy.id} | Nome: ${psy.nome}`);
        console.log(`  firstPaidAt: ${psy.firstPaidAt}`);
        console.log(`  status atual: ${psy.status}`);
        console.log(`  plano atual: ${psy.plano}`);
        console.log(`  lifetimeRevenue: ${psy.lifetimeRevenue}`);
        console.log(`  canceledAt: ${psy.canceledAt}`);
        console.log(`  reactivatedAt: ${psy.reactivatedAt}`);
        console.log(`  isCurrentlyPaying(): ${isAtivo}`);
        console.log(`  => CLASSIFICAÇÃO: ${classif}\n`);
    }

    console.log("=== RESUMO DAS CLASSIFICAÇÕES (DOS 17) ===");
    console.log(classifications);

    console.log("\n=== EXPOSIÇÃO MÊS A MÊS ===");
    let exposureAcumulada = 0;
    const months = MetricsService.getMonthlyCohortDates(start, end);
    let monthStats = [];

    for (const monthStart of months) {
        let baseInicial = 0;
        let novos = 0;
        let paidChurns = 0;
        let reactivations = 0;
        const monthExactStart = new Date(monthStart);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);

        if (monthExactStart > new Date()) continue;

        for (const psy of allPsychologists) {
            // Base inicial
            if (MetricsService.wasPayingAt(psy, monthExactStart)) {
                baseInicial++;
                if (psy.canceledAt) {
                    const canceled = new Date(psy.canceledAt);
                    if (canceled >= monthStart && canceled <= monthEnd && canceled <= new Date() && psy.lifetimeRevenue > 0) {
                        paidChurns++;
                    }
                }
            }
            // Novos
            if (psy.firstPaidAt) {
                const fp = new Date(psy.firstPaidAt);
                if (fp >= monthStart && fp <= monthEnd && psy.lifetimeRevenue > 0) {
                    novos++;
                }
            }
        }
        
        exposureAcumulada += baseInicial;
        console.log(`Mês: ${monthStart.toISOString().split('T')[0]} | Base inicial: ${baseInicial} | Novos (pagantes reais): ${novos} | Paid Churns: ${paidChurns} | Exposição (Cliente-Mês): ${baseInicial}`);
    }
    console.log(`TOTAL DE EXPOSIÇÃO ACUMULADA: ${exposureAcumulada} cliente-mês`);

    process.exit(0);
}

auditReconciliation();
