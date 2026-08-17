const db = require('../backend/models');

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

    console.log(`Buscando pagamentos do Asaas em ${AS_API_URL}...`);
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
        console.log(`Buscados ${allPayments.length} pagamentos...`);
    }

    return allPayments;
}

async function runAudit() {
    console.log("=== INICIANDO AUDITORIA READ-ONLY: ASAAS vs BANCO LOCAL ===\n");
    
    const asaasPayments = await getAsaasPayments();
    
    // Fetch local psychologists and payments
    const psychologists = await db.Psychologist.findAll({ paranoid: false, raw: true });
    const localPayments = await db.Payment.findAll({ raw: true });

    // Maps for quick lookup
    const psyByCpfCnpj = {};
    const psyBySubscriptionId = {};
    const psyById = {};
    psychologists.forEach(p => {
        if (p.cpf) psyByCpfCnpj[p.cpf.replace(/\D/g, '')] = p;
        if (p.cnpj) psyByCpfCnpj[p.cnpj.replace(/\D/g, '')] = p;
        if (p.subscriptionId) psyBySubscriptionId[p.subscriptionId] = p;
        psyById[p.id] = p;
    });

    const localPaymentIds = new Set(localPayments.map(p => p.id));
    
    // 1 & 2 & 3: Audit Payments and match
    console.log("\n=== 1. CONCILIAÇÃO DE PAGAMENTOS ===");
    
    let stats = {
        totalAsaas: asaasPayments.length,
        status: {},
        valorBrutoTotal: 0,
        valorLiquidoTotal: 0,
        associados: 0,
        orfaos: 0,
        existentesLocalmente: 0,
        novosParaInserir: 0
    };

    const asaasMatches = {}; // Asaas Payment ID -> Psychologist ID
    const asaasPaymentsByPsy = {};

    // First fetch customer info for payments (Asaas customer ID -> CPF/CNPJ)
    // To save time, we will try to match via externalReference or subscriptionId first
    
    for (const p of asaasPayments) {
        // Status counts
        stats.status[p.status] = (stats.status[p.status] || 0) + 1;
        
        // Sum values
        if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status)) {
            stats.valorBrutoTotal += p.value;
            stats.valorLiquidoTotal += p.netValue || p.value;
        }

        let psyId = null;
        let matchMethod = 'NONE';
        let matchConfidence = 'LOW';

        // 1. Match by externalReference
        if (p.externalReference && psyById[p.externalReference]) {
            psyId = p.externalReference;
            matchMethod = 'externalReference';
            matchConfidence = 'HIGH';
        }
        // 2. Match by subscriptionId
        else if (p.subscription && psyBySubscriptionId[p.subscription]) {
            psyId = psyBySubscriptionId[p.subscription].id;
            matchMethod = 'subscriptionId';
            matchConfidence = 'HIGH';
        }
        
        if (psyId) {
            stats.associados++;
            asaasMatches[p.id] = psyId;
            if (!asaasPaymentsByPsy[psyId]) asaasPaymentsByPsy[psyId] = [];
            asaasPaymentsByPsy[psyId].push(p);
        } else {
            stats.orfaos++;
        }

        if (localPaymentIds.has(p.id)) {
            stats.existentesLocalmente++;
        } else {
            stats.novosParaInserir++;
        }
    }

    console.log("Total Pagamentos no Asaas:", stats.totalAsaas);
    console.log("Por Status:", stats.status);
    console.log("Valor Bruto Total (Recebidos): R$", stats.valorBrutoTotal.toFixed(2));
    console.log("Valor Líquido Total (Recebidos): R$", stats.valorLiquidoTotal.toFixed(2));
    console.log("Pagamentos Associados a Psicólogos:", stats.associados);
    console.log("Pagamentos Órfãos (Sem vínculo óbvio):", stats.orfaos);
    console.log("Já existem na tabela local:", stats.existentesLocalmente);
    console.log("Faltam inserir (Backfill necessário):", stats.novosParaInserir);

    // 5. CASOS CONHECIDOS
    console.log("\n=== 5. INVESTIGAÇÃO DE CASOS CONHECIDOS ===");
    const targetIds = [195, 218, 74, 75, 72];
    for (const id of targetIds) {
        const psy = psyById[id];
        const asaasPsyPayments = asaasPaymentsByPsy[id] || [];
        const received = asaasPsyPayments.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status));
        console.log(`\nPsicólogo ID ${id} (${psy.nome}):`);
        console.log(`- firstPaidAt atual: ${psy.firstPaidAt}`);
        console.log(`- lifetimeRevenue atual: R$ ${psy.lifetimeRevenue || 0}`);
        console.log(`- Pagamentos totais no Asaas: ${asaasPsyPayments.length}`);
        console.log(`- Pagamentos RECEIVED no Asaas: ${received.length}`);
        if (received.length > 0) {
            console.log(`  -> Primeiro: ${received[0].paymentDate} | Valor: ${received[0].value}`);
        } else {
            console.log(`  -> NENHUM PAGAMENTO RECEBIDO NO ASAAS ENCONTRADO.`);
        }
    }

    // 6 & 7. FIRSTPAIDAT E LIFETIMEREVENUE (TODOS)
    console.log("\n=== 6 E 7. AUDITORIA GERAL DE firstPaidAt E lifetimeRevenue ===");
    let divFirstPaid = 0;
    let divLifetime = 0;
    let semHistorico = 0;

    for (const psy of psychologists) {
        const asaasPsyPayments = asaasPaymentsByPsy[psy.id] || [];
        const received = asaasPsyPayments.filter(p => ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(p.status))
                                         .sort((a,b) => new Date(a.paymentDate) - new Date(b.paymentDate));

        const asaasFirstPaid = received.length > 0 ? new Date(received[0].paymentDate) : null;
        const asaasLifetime = received.reduce((acc, p) => acc + p.value, 0);

        let divFP = false;
        if (asaasFirstPaid) {
            if (!psy.firstPaidAt) {
                divFP = true;
            } else {
                const diffTime = Math.abs(asaasFirstPaid - new Date(psy.firstPaidAt));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays > 2) divFP = true;
            }
        } else {
            if (psy.firstPaidAt) divFP = true; // Has date but no payment
        }
        
        let divLR = false;
        if (Math.abs(asaasLifetime - Number(psy.lifetimeRevenue || 0)) > 1) {
            divLR = true;
        }

        if (divFP) divFirstPaid++;
        if (divLR) divLifetime++;
        if (received.length === 0 && (psy.firstPaidAt || psy.lifetimeRevenue > 0)) {
            semHistorico++;
        }
    }

    console.log(`Divergências em firstPaidAt: ${divFirstPaid}`);
    console.log(`Divergências em lifetimeRevenue: ${divLifetime}`);
    console.log(`Casos com dados locais mas SEM histórico Asaas válido: ${semHistorico}`);
    
    console.log("\n=== PLANO DE BACKFILL (PREVIEW) ===");
    console.log(`- Passo 1: Executar upsert idempotente de ${stats.novosParaInserir} novos pagamentos no banco local baseados no id do Asaas.`);
    console.log(`- Passo 2: Para cada psicólogo com Pagamentos RECEIVED no Asaas, atualizar firstPaidAt para o primeiro paymentDate e lifetimeRevenue para a soma total.`);
    console.log(`- Passo 3: Para os psicólogos com firstPaidAt preenchido localmente mas SEM pagamentos RECEIVED no Asaas (incluindo Trial Churns), setar firstPaidAt = null e lifetimeRevenue = 0.`);
    console.log(`- Estratégia de rollback: O upsert pode ser revertido deletando pagamentos criados no dia do backfill. firstPaidAt antigo não está logado, portanto o script deve gerar um dump de backup (JSON) antes do update.`);

    process.exit(0);
}

require('dotenv').config();
runAudit().catch(console.error);
