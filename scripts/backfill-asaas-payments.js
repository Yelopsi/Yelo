const db = require('../backend/models');
const fs = require('fs');

async function getAsaasPayments() {
    const AS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
    const AS_API_KEY = process.env.ASAAS_API_KEY;

    if (!AS_API_KEY) {
        console.error("ASAAS_API_KEY não encontrada nas variáveis de ambiente!");
        process.exit(1);
    }

    let allPayments = [];
    let hasMore = true;
    let offset = 0;
    const limit = 100;

    while (hasMore) {
        const response = await fetch(`${AS_API_URL}/payments?limit=${limit}&offset=${offset}&dateCreated[ge]=2026-01-01`, {
            headers: { 'access_token': AS_API_KEY }
        });
        
        if (!response.ok) {
            console.error("Erro na API do Asaas:", await response.text());
            process.exit(1);
        }

        const data = await response.json();
        allPayments = allPayments.concat(data.data);
        hasMore = data.hasMore;
        offset += limit;
    }

    return allPayments;
}

async function runBackfill() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');

    const asaasPayments = await getAsaasPayments();
    
    const psychologists = await db.Psychologist.findAll({ paranoid: false });
    const localPayments = await db.Payment.findAll();
    const localSubscriptions = await db.Subscription.findAll({ attributes: ['id'] });

    const psyBySubscriptionId = {};
    const psyById = {};
    const psyByCustomer = {}; 

    const validSubscriptionIds = new Set(localSubscriptions.map(s => s.id));

    psychologists.forEach(p => {
        if (p.subscriptionId) psyBySubscriptionId[p.subscriptionId] = p;
        psyById[p.id] = p;
    });

    const localPaymentIds = new Set(localPayments.map(p => p.id));
    
    let stats = {
        payments: {
            totalAsaas: asaasPayments.length,
            existentes: 0,
            novos: 0,
            orfaos: 0,
            suspeitos: 0
        },
        psychologists: {
            firstPaidAtAlterados: 0,
            firstPaidAtAnulados: 0,
            lifetimeGrossAlterados: 0,
            lifetimeNetAlterados: 0,
            semAlteracao: 0
        },
        financeiro: {
            brutoRecebido: 0,
            liquidoRecebido: 0,
            reembolsado: 0,
            pendente: 0,
            vencido: 0
        }
    };

    const asaasMatches = {}; 
    const validPaymentsByPsy = {}; 

    for (const p of asaasPayments) {
        let psyId = null;

        if (p.externalReference && psyById[p.externalReference]) {
            psyId = Number(p.externalReference);
        } else if (p.subscription && psyBySubscriptionId[p.subscription]) {
            psyId = psyBySubscriptionId[p.subscription].id;
        }

        // FASE 3: STATUS FINANCEIRO
        if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)) {
            stats.financeiro.brutoRecebido += p.value;
            stats.financeiro.liquidoRecebido += (p.netValue || p.value);
        } else if (p.status === 'REFUNDED') {
            stats.financeiro.reembolsado += p.value;
        } else if (p.status === 'PENDING') {
            stats.financeiro.pendente += p.value;
        } else if (p.status === 'OVERDUE') {
            stats.financeiro.vencido += p.value;
        }

        // FASE 4: CASOS SUSPEITOS
        const isSuspect = (psyId === 74 || psyId === 72) && p.paymentDate && p.paymentDate.startsWith('2026-03-10');

        if (isSuspect) {
            stats.payments.suspeitos++;
            continue; 
        }

        if (psyId) {
            asaasMatches[p.id] = psyId;
            const validStatus = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
            if (validStatus.includes(p.status)) {
                if (!validPaymentsByPsy[psyId]) validPaymentsByPsy[psyId] = [];
                validPaymentsByPsy[psyId].push(p);
            }
        } else {
            stats.payments.orfaos++;
        }

        if (localPaymentIds.has(p.id)) {
            stats.payments.existentes++;
        } else if (psyId) {
            stats.payments.novos++;
        }
    }

    const backupData = [];
    const updateTasks = [];

    const formatBRL = (v) => `R$ ${v.toFixed(2)}`;
    
    let reportLogs = [];

    for (const psy of psychologists) {
        const validPayments = validPaymentsByPsy[psy.id] || [];
        validPayments.sort((a,b) => {
            const d1 = new Date(a.paymentDate || a.clientPaymentDate || a.confirmedDate || a.dateCreated);
            const d2 = new Date(b.paymentDate || b.clientPaymentDate || b.confirmedDate || b.dateCreated);
            return d1 - d2;
        });

        // FASE 6: FIRSTPAIDAT (DERIVADO)
        const calculatedFirstPaidAt = validPayments.length > 0 ? new Date(validPayments[0].paymentDate || validPayments[0].clientPaymentDate || validPayments[0].confirmedDate || validPayments[0].dateCreated) : null;
        
        // FASE 7: LIFETIMEREVENUE (Bruto)
        const calculatedGrossRevenue = validPayments.reduce((acc, p) => acc + p.value, 0);
        const calculatedNetRevenue = validPayments.reduce((acc, p) => acc + (p.netValue || p.value), 0);

        let needsFpUpdate = false;
        let needsGrossUpdate = false;
        let needsNetUpdate = false; // Simulated, since DB column doesn't exist yet

        const currentFpStr = psy.firstPaidAt ? new Date(psy.firstPaidAt).toISOString().split('T')[0] : null;
        const calcFpStr = calculatedFirstPaidAt ? calculatedFirstPaidAt.toISOString().split('T')[0] : null;

        if (currentFpStr !== calcFpStr) needsFpUpdate = true;
        
        // lifetimeRevenue is being redefined as Gross Historic Revenue
        if (Number(psy.lifetimeRevenue || 0) !== calculatedGrossRevenue) needsGrossUpdate = true;
        // Mock check for Net Revenue
        if (Number(psy.lifetimeRevenue || 0) !== calculatedNetRevenue) needsNetUpdate = true;

        if (needsFpUpdate || needsGrossUpdate || needsNetUpdate) {
            
            if (needsFpUpdate) {
                if (calcFpStr === null) stats.psychologists.firstPaidAtAnulados++;
                else stats.psychologists.firstPaidAtAlterados++;
            }
            if (needsGrossUpdate) stats.psychologists.lifetimeGrossAlterados++;
            if (needsNetUpdate) stats.psychologists.lifetimeNetAlterados++;

            reportLogs.push(`- ID ${psy.id} (${psy.nome}): FP [${currentFpStr} -> ${calcFpStr}], Gross [${formatBRL(Number(psy.lifetimeRevenue || 0))} -> ${formatBRL(calculatedGrossRevenue)}], Net [? -> ${formatBRL(calculatedNetRevenue)}]`);
            
            backupData.push({
                psychologistId: psy.id,
                firstPaidAt: psy.firstPaidAt,
                lifetimeRevenue: psy.lifetimeRevenue, // Atuando como Gross legado
                timestamp: new Date().toISOString()
            });

            updateTasks.push({
                psy,
                newFp: calculatedFirstPaidAt,
                newLr: calculatedGrossRevenue // Semantic change: lifetimeRevenue = gross
            });
        } else {
            stats.psychologists.semAlteracao++;
        }
    }

    console.log("=== DRY-RUN FINAL ===\n");
    
    console.log("Payments:");
    console.log(`- Encontrados Asaas: ${stats.payments.totalAsaas}`);
    console.log(`- Já existentes: ${stats.payments.existentes}`);
    console.log(`- Novos: ${stats.payments.novos}`);
    console.log(`- Órfãos: ${stats.payments.orfaos}`);
    console.log(`- Suspeitos: ${stats.payments.suspeitos}\n`);
    
    console.log("Psicólogos:");
    console.log(`- firstPaidAt alterados: ${stats.psychologists.firstPaidAtAlterados}`);
    console.log(`- firstPaidAt anulados: ${stats.psychologists.firstPaidAtAnulados}`);
    console.log(`- lifetimeGrossRevenue alterados: ${stats.psychologists.lifetimeGrossAlterados}`);
    console.log(`- lifetimeNetRevenue a criar/alterar: ${stats.psychologists.lifetimeNetAlterados}`);
    console.log(`- Sem alteração: ${stats.psychologists.semAlteracao}\n`);

    console.log("Financeiro (Histórico Global Asaas):");
    console.log(`- Total Bruto Recebido: ${formatBRL(stats.financeiro.brutoRecebido)}`);
    console.log(`- Total Líquido Recebido: ${formatBRL(stats.financeiro.liquidoRecebido)}`);
    console.log(`- Total Reembolsado (REFUNDED): ${formatBRL(stats.financeiro.reembolsado)}`);
    console.log(`- Total Pendente: ${formatBRL(stats.financeiro.pendente)}`);
    console.log(`- Total Vencido: ${formatBRL(stats.financeiro.vencido)}\n`);

    console.log("Detalhes de Alteração nos Psicólogos:");
    reportLogs.forEach(l => console.log(l));

    if (!isDryRun) {
        console.log("\nExecutando BACKFILL...");
        fs.writeFileSync('backup_first_paid_at.json', JSON.stringify(backupData, null, 2));
        console.log("Backup gravado em backup_first_paid_at.json");

        // Insert payments (Idempotent)
        for (const p of asaasPayments) {
            const psyId = asaasMatches[p.id];
            const isSuspect = (psyId === 74 || psyId === 72) && p.paymentDate && p.paymentDate.startsWith('2026-03-10');
            
            if (psyId && !isSuspect && !localPaymentIds.has(p.id)) {
                await db.Payment.create({
                    id: p.id,
                    subscriptionId: validSubscriptionIds.has(p.subscription) ? p.subscription : null,
                    psychologistId: psyId,
                    status: p.status,
                    value: p.value,
                    billingType: p.billingType,
                    dueDate: p.dueDate,
                    paymentDate: p.paymentDate
                });
            }
        }

        // Update Psychologists
        for (const task of updateTasks) {
            await task.psy.update({
                firstPaidAt: task.newFp,
                lifetimeRevenue: task.newLr
            });
        }
        console.log("Backfill finalizado com sucesso!");
    } else {
        console.log("\nBACKFILL PRONTO PARA EXECUÇÃO");
        console.log("*(Aguardando aprovação explícita para remover a flag --dry-run)*");
    }

    process.exit(0);
}

require('dotenv').config();
runBackfill().catch(console.error);
