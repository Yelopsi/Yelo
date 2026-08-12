require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');

async function findOrphans() {
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    console.log("Consultando assinaturas no Asaas...");
    const res = await fetch(`${ASAAS_API_URL}/subscriptions?status=ACTIVE&limit=100`, {
        headers: { 'access_token': process.env.ASAAS_API_KEY }
    });
    const asaasData = await res.json();
    
    if (!asaasData || !asaasData.data) {
        console.error("Falha ao consultar Asaas", asaasData);
        return;
    }

    const asaasSubs = asaasData.data;
    console.log(`Encontradas ${asaasSubs.length} assinaturas ATIVAS no Asaas.`);

    let orphans = [];
    let mismatches = [];

    const psis = await db.Psychologist.findAll({
        attributes: ['id', 'email', 'status', 'subscriptionId', 'plano']
    });

    // Mapear por customer (Yelo não armazena asaasCustomerId diretamente no Psychologist, apenas no Intent ou nós enviamos o id do psicologo no externalReference)
    // Então vamos comparar pelo externalReference retornado pelo Asaas, ou buscar o psychologistId se estiver no db.
    for (const sub of asaasSubs) {
        const extRef = sub.externalReference;
        
        let localPsi = null;
        if (extRef) {
            localPsi = psis.find(p => p.id == extRef);
        } else {
            // Tenta buscar localmente por subscriptionId
            localPsi = psis.find(p => p.subscriptionId === sub.id);
        }

        if (!localPsi) {
            orphans.push({
                asaasSubscriptionId: sub.id,
                asaasCustomerId: sub.customer,
                psychologistId: extRef || 'DESCONHECIDO',
                statusAsaas: sub.status,
                statusYelo: 'NÃO ENCONTRADO',
                plan: sub.description,
                value: sub.value,
                cycle: sub.cycle,
                nextDueDate: sub.nextDueDate,
                motivo: 'Psychologist não existe na base Yelo ou não referenciado'
            });
        } else {
            // Psi existe. Verificar se os status batem
            if (localPsi.status !== 'active' || localPsi.subscriptionId !== sub.id) {
                if (localPsi.subscriptionId !== sub.id && localPsi.status === 'active') {
                    // Ele tem outra ativa
                    orphans.push({
                        asaasSubscriptionId: sub.id,
                        asaasCustomerId: sub.customer,
                        psychologistId: localPsi.id,
                        statusAsaas: sub.status,
                        statusYelo: localPsi.status,
                        plan: sub.description,
                        value: sub.value,
                        cycle: sub.cycle,
                        nextDueDate: sub.nextDueDate,
                        motivo: `Psicólogo ativo com OUTRA assinatura (${localPsi.subscriptionId})`
                    });
                } else if (localPsi.status !== 'active') {
                    mismatches.push({
                        asaasSubscriptionId: sub.id,
                        asaasCustomerId: sub.customer,
                        psychologistId: localPsi.id,
                        statusAsaas: sub.status,
                        statusYelo: localPsi.status,
                        plan: sub.description,
                        value: sub.value,
                        cycle: sub.cycle,
                        nextDueDate: sub.nextDueDate,
                        motivo: 'Psicólogo está inativo/pendente no Yelo, mas assinatura está ativa no Asaas'
                    });
                }
            }
        }
    }

    console.log("\n=== ORPHANS (Asaas ativo, Yelo inexistente ou com outra assinatura) ===");
    console.table(orphans);

    console.log("\n=== MISMATCHES (Asaas ativo, Yelo inativo) ===");
    console.table(mismatches);
    
    // Agora o inverso: Yelo Ativo -> Asaas cancelado/inativo
    let yeloOrphans = [];
    for (const psi of psis) {
        if (psi.status === 'active' && psi.subscriptionId) {
            const asaasMatched = asaasSubs.find(s => s.id === psi.subscriptionId);
            if (!asaasMatched) {
                yeloOrphans.push({
                    psychologistId: psi.id,
                    email: psi.email,
                    subscriptionId: psi.subscriptionId,
                    statusYelo: psi.status,
                    statusAsaas: 'INATIVO/INEXISTENTE/NÃO RETORNADO NA LISTA DE ATIVOS'
                });
            }
        }
    }

    console.log("\n=== DIVERGÊNCIAS YELO (Yelo Ativo, Asaas ausente da lista de ATIVOS) ===");
    console.table(yeloOrphans);

}

findOrphans().then(() => process.exit(0)).catch(e => console.error(e));
