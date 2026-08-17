const db = require('./backend/models');
const { Op } = require('sequelize');

async function runAudit() {
    console.log("=== INICIANDO AUDITORIA DE FIRST PAID AT E PAGAMENTOS REAIS ===\n");
    
    // 1. Fetch all psychologists and payments
    const allPsychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });
    const allPayments = await db.Payment.findAll({
        where: {
            status: { [Op.in]: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] }
        },
        order: [['paymentDate', 'ASC']],
        raw: true
    });

    const paymentsByPsy = {};
    for (const p of allPayments) {
        if (!paymentsByPsy[p.psychologistId]) {
            paymentsByPsy[p.psychologistId] = [];
        }
        paymentsByPsy[p.psychologistId].push(p);
    }

    // Function equivalent to hasPaidCustomer
    const hasPaidCustomer = (psyId) => {
        return paymentsByPsy[psyId] && paymentsByPsy[psyId].length > 0;
    };

    const getFirstReceivedPaymentAt = (psyId) => {
        if (!hasPaidCustomer(psyId)) return null;
        // Since we ordered by paymentDate ASC, the first one is the earliest
        return new Date(paymentsByPsy[psyId][0].paymentDate);
    };

    // 2. AUDIT FIRST PAID AT
    console.log("=== 1. AUDITORIA DA COLUNA firstPaidAt ===\n");
    console.log("ID | Nome | firstPaidAt (Atual) | Primeiro RECEIVED | lifetimeRevenue | Status | Divergente?");
    
    const divergentes = [];
    const firstPaidAtCustomers = allPsychologists.filter(p => p.firstPaidAt);

    for (const psy of firstPaidAtCustomers) {
        const firstReceived = getFirstReceivedPaymentAt(psy.id);
        const hasPaid = hasPaidCustomer(psy.id);
        const firstPaidStr = new Date(psy.firstPaidAt).toISOString().split('T')[0];
        const firstRecStr = firstReceived ? firstReceived.toISOString().split('T')[0] : 'NUNCA PAGOU';
        
        let divergente = false;
        if (!hasPaid) {
            divergente = true;
        } else {
            // Difference in days
            const diffTime = Math.abs(firstReceived - new Date(psy.firstPaidAt));
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
            if (diffDays > 2) divergente = true; // allow small timezone difference
        }

        if (divergente) divergentes.push(psy.id);
        
        console.log(`${psy.id} | ${psy.nome.padEnd(20).substring(0, 20)} | ${firstPaidStr} | ${firstRecStr.padEnd(15)} | R$ ${psy.lifetimeRevenue || 0} | ${psy.status} | ${divergente ? '❌ SIM' : '✅ NÃO'}`);
    }

    console.log(`\n=> Encontrados ${divergentes.length} clientes com divergência semântica no firstPaidAt.\n`);

    // 3. RECALCULAR A EXPOSIÇÃO CORRETA E CHURN
    console.log("=== 2. EXPOSIÇÃO FINANCEIRA CORRIGIDA (APENAS PAGANTES REAIS) ===\n");
    const start = new Date('2026-01-01T00:00:00-03:00');
    const end = new Date('2026-08-17T14:27:00-03:00');

    // Helper: Was paying at (based on real payments and cancellation)
    const wasEffectivelyPayingAt = (psy, date) => {
        if (!hasPaidCustomer(psy.id)) return false;
        const firstPaid = getFirstReceivedPaymentAt(psy.id);
        if (firstPaid > date) return false;
        
        // Se cancelou ANTES dessa data e já expirou (vamos usar canceledAt para simplificar o risco, assumindo que canceledAt = fim da intenção)
        if (psy.canceledAt && new Date(psy.canceledAt) <= date) return false;
        
        return true;
    };

    let totalExposure = 0;
    let totalPaidChurns = 0;
    
    // We need getMonthlyCohortDates equivalent
    const getMonthlyDates = (d1, d2) => {
        const dates = [];
        let cur = new Date(d1.getFullYear(), d1.getMonth(), 1);
        while (cur <= d2) {
            dates.push(new Date(cur));
            cur.setMonth(cur.getMonth() + 1);
        }
        return dates;
    };
    
    const months = getMonthlyDates(start, end);

    console.log("Mês | Base inicial pagante | Novos pagantes | Paid Churn | Exposição (Cliente-Mês)");
    for (const monthStart of months) {
        let baseInicial = 0;
        let novos = 0;
        let churns = 0;
        
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59);
        if (monthStart > new Date()) continue;

        for (const psy of allPsychologists) {
            const hasPaid = hasPaidCustomer(psy.id);
            if (!hasPaid) continue;

            const fp = getFirstReceivedPaymentAt(psy.id);
            
            // Base inicial
            if (wasEffectivelyPayingAt(psy, monthStart)) {
                baseInicial++;
                
                // Sofreu churn neste mês?
                if (psy.canceledAt) {
                    const canceled = new Date(psy.canceledAt);
                    if (canceled >= monthStart && canceled <= monthEnd) {
                        churns++;
                    }
                }
            }

            // Novos pagantes no mês
            if (fp >= monthStart && fp <= monthEnd) {
                novos++;
            }
        }

        totalExposure += baseInicial;
        totalPaidChurns += churns;
        
        console.log(`${monthStart.toISOString().split('T')[0]} | ${String(baseInicial).padEnd(20)} | ${String(novos).padEnd(14)} | ${String(churns).padEnd(10)} | ${baseInicial}`);
    }

    console.log(`\n=> Total Exposição Corrigida: ${totalExposure} cliente-mês`);
    
    const paidChurnRate = totalExposure > 0 ? (totalPaidChurns / totalExposure) : 0;
    console.log(`=> Churn Rate Ponderado Corrigido: ${(paidChurnRate * 100).toFixed(2)}%`);
    
    const arpu = 99; // Mock for now
    const ltvProj = paidChurnRate > 0 ? arpu / paidChurnRate : 0;
    console.log(`=> LTV Projetado Corrigido: R$ ${ltvProj.toFixed(2)} (Aviso: Baixa confiabilidade, 1 Paid Churn)`);

    // 4. RECONCILIAÇÕES (Pagantes vs Trials)
    console.log("\n=== 3. RECONCILIAÇÃO DA BASE PAGANTE ===\n");
    let baseJan = 0;
    let novosPagantesTotal = 0;
    let reativacoes = 0;
    let paidChurnsTotal = 0;
    
    for (const psy of allPsychologists) {
        if (!hasPaidCustomer(psy.id)) continue;
        
        const fp = getFirstReceivedPaymentAt(psy.id);
        
        if (fp < start) {
            baseJan++;
        } else if (fp >= start && fp <= end) {
            novosPagantesTotal++;
        }
        
        if (psy.canceledAt) {
            const canceled = new Date(psy.canceledAt);
            if (canceled >= start && canceled <= end) {
                paidChurnsTotal++;
            }
        }
    }

    const baseFinal = baseJan + novosPagantesTotal + reativacoes - paidChurnsTotal;
    
    console.log(`Base Inicial (Jan): ${baseJan}`);
    console.log(`+ Novos Pagantes Reais: ${novosPagantesTotal}`);
    console.log(`+ Reativações: ${reativacoes}`);
    console.log(`- Paid Churn (Efetivos): ${paidChurnsTotal}`);
    console.log(`= Base Final Calculada: ${baseFinal}`);

    // Quantos tem hasPaidCustomer e ainda estão rodando?
    let baseFinalReal = 0;
    for (const psy of allPsychologists) {
        if (hasPaidCustomer(psy.id)) {
            // E não cancelou, ou se cancelou, reativou?
            const isAtivo = wasEffectivelyPayingAt(psy, end); 
            if (isAtivo) baseFinalReal++;
        }
    }
    console.log(`Base Ativa Pagante Atual (wasEffectivelyPayingAt(agora)): ${baseFinalReal}`);


    // 5. THAIS SILVA
    console.log("\n=== 4. INVESTIGAÇÃO THAIS SILVA (ID 218) ===\n");
    const thais = allPsychologists.find(p => p.id === 218);
    if (thais) {
        const thaisHasPaid = hasPaidCustomer(thais.id);
        const thaisPayments = thaisHasPaid ? paymentsByPsy[thais.id] : [];
        console.log(`firstPaidAt atual: ${thais.firstPaidAt}`);
        console.log(`Pagamentos RECEIVED: ${thaisPayments.length}`);
        if (thaisPayments.length > 0) {
            console.log(`- Primeiro Pagamento Real: ${thaisPayments[0].paymentDate}`);
        }
        console.log(`Status: ${thais.status}`);
        console.log(`canceledAt: ${thais.canceledAt}`);
        console.log(`planExpiresAt: ${thais.planExpiresAt}`);
        console.log(`lifetimeRevenue: ${thais.lifetimeRevenue}`);
        console.log(`Veredito: ${thaisHasPaid ? 'É PAGANTE HISTÓRICA' : 'NÃO É PAGANTE (Inadimplente que nunca pagou)'}`);
    }

    process.exit(0);
}

runAudit().catch(console.error);
