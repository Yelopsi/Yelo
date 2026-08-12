require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');

async function getPayingUsers() {
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    try {
        const res = await fetch(`${ASAAS_API_URL}/subscriptions?status=ACTIVE&limit=100`, {
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });
        const asaasData = await res.json();
        
        if (!asaasData || !asaasData.data) {
            console.error("Falha ao consultar Asaas", asaasData);
            return;
        }

        const asaasSubs = asaasData.data;

        const psis = await db.Psychologist.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'nome', 'email', 'subscriptionId']
        });

        let results = [];

        for (const sub of asaasSubs) {
            let localPsi = null;
            if (sub.externalReference) {
                localPsi = psis.find(p => String(p.id) === String(sub.externalReference));
            }
            if (!localPsi) {
                localPsi = psis.find(p => p.subscriptionId === sub.id);
            }

            // Fallback: buscar o email do customer no Asaas
            if (!localPsi && sub.customer) {
                const cRes = await fetch(`${ASAAS_API_URL}/customers/${sub.customer}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
                const cData = await cRes.json();
                if (cData && cData.email) {
                    localPsi = psis.find(p => p.email.toLowerCase() === cData.email.toLowerCase());
                }
            }

            // Validar no Asaas se a assinatura tem pagamentos quitados
            const pRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${sub.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
            const pData = await pRes.json();
            const payments = pData.data || [];
            
            const hasPaid = payments.some(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
            const hasOverdue = payments.some(p => p.status === 'OVERDUE');

            // Só é pagante se tiver pago ao menos uma e não estiver inadimplente
            if (hasPaid && !hasOverdue) {
                results.push({
                    Nome: localPsi ? localPsi.nome : 'Desconhecido',
                    Email: localPsi ? localPsi.email : 'Sem registro',
                    Valor: `R$ ${sub.value.toFixed(2)}`,
                    'Próximo Pagamento': new Date(sub.nextDueDate).toLocaleDateString('pt-BR'),
                    Ciclo: sub.cycle === 'MONTHLY' ? 'Mensal' : sub.cycle
                });
            }
        }

        // Ordenar pela data de pagamento mais próxima
        results.sort((a, b) => {
            const dateA = a['Próximo Pagamento'].split('/').reverse().join('');
            const dateB = b['Próximo Pagamento'].split('/').reverse().join('');
            return dateA.localeCompare(dateB);
        });

        console.table(results);
        console.log(`Total de pagantes ativos: ${results.length}`);
        
        // Output de Markdown para salvar no artefato
        console.log("===MARKDOWN===");
        console.log("| Nome | Email | Valor | Ciclo | Próximo Pagamento |");
        console.log("|---|---|---|---|---|");
        results.forEach(r => {
            console.log(`| ${r.Nome} | ${r.Email} | ${r.Valor} | ${r.Ciclo} | ${r['Próximo Pagamento']} |`);
        });

    } catch (error) {
        console.error(error);
    }
}

getPayingUsers().then(() => process.exit(0));
