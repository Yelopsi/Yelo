const MetricsService = require('./backend/services/metricsService');
const db = require('./backend/models');

async function debugEquation() {
    const start = new Date('2026-01-01T00:00:00-03:00');
    const end = new Date('2026-08-17T14:18:46-03:00');
    
    const allPsychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });
    
    let baseInicial = 0;
    let ativosNoFinal = 0;
    
    allPsychologists.forEach(psy => {
        if (MetricsService.isCurrentlyPaying(psy)) ativosNoFinal++;
        if (MetricsService.wasPayingAt(psy, start)) baseInicial++;
    });

    console.log(`Base Inicial verdadeira em Jan 1: ${baseInicial}`);
    console.log(`Ativos verdadeiros no Final: ${ativosNoFinal}`);
    
    // Let's see who is in firstPaidAt between start and end but NOT in ativosNoFinal and NOT in Paid Churn
    const missing = allPsychologists.filter(psy => {
        const firstPaid = psy.firstPaidAt ? new Date(psy.firstPaidAt) : null;
        const isNovo = firstPaid && firstPaid >= start && firstPaid <= end;
        
        const isPaidChurn = psy.canceledAt && new Date(psy.canceledAt) <= new Date() && psy.status !== 'active' && !psy.reactivatedAt && psy.lifetimeRevenue > 0;
        const isTrialChurn = psy.canceledAt && new Date(psy.canceledAt) <= new Date() && psy.status !== 'active' && !psy.reactivatedAt && (psy.lifetimeRevenue === 0 || !psy.lifetimeRevenue);
        
        const isAtivo = MetricsService.isCurrentlyPaying(psy);
        const wasBaseInicial = MetricsService.wasPayingAt(psy, start);
        
        // Se a pessoa entrou na equação (wasBaseInicial ou isNovo)
        // e não está em ativos no final
        // e não está em Paid Churn
        // Onde ela está?
        if ((wasBaseInicial || isNovo) && !isAtivo && !isPaidChurn) {
            console.log(`FALHA NA EQUAÇÃO: ID ${psy.id} | Nome: ${psy.nome}`);
            console.log(`wasBaseInicial: ${wasBaseInicial}, isNovo: ${isNovo}, firstPaid: ${firstPaid}, canceledAt: ${psy.canceledAt}, status: ${psy.status}, lifetimeRevenue: ${psy.lifetimeRevenue}`);
        }
        
        // E o inverso? Alguém que é ativo no final mas não estava na base inicial e não é novo
        if (isAtivo && !wasBaseInicial && !isNovo) {
            console.log(`SOBRA NA EQUAÇÃO: ID ${psy.id} | Nome: ${psy.nome} (Unknown?)`);
            console.log(`wasBaseInicial: ${wasBaseInicial}, isNovo: ${isNovo}, firstPaid: ${firstPaid}, canceledAt: ${psy.canceledAt}, status: ${psy.status}, lifetimeRevenue: ${psy.lifetimeRevenue}`);
        }
        
        return false;
    });

    process.exit(0);
}

debugEquation();
