require('dotenv').config();
const db = require('./backend/models');
const fetch = require('node-fetch');

async function analyze() {
    console.log('Iniciando análise aprofundada de divergência de assinaturas...');

    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    try {
        console.log('Buscando assinaturas ativas no Asaas...');
        const res = await fetch(`${ASAAS_API_URL}/subscriptions?status=ACTIVE&limit=100`, {
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });
        const asaasData = await res.json();
        
        if (!asaasData || !asaasData.data) {
            console.error("Falha ao consultar Asaas", asaasData);
            return;
        }

        const asaasSubs = asaasData.data;
        console.log(`Encontradas ${asaasSubs.length} assinaturas ativas no Asaas.`);

        console.log('Buscando psicólogos no banco de dados...');
        const psis = await db.Psychologist.findAll({
            where: { deletedAt: null },
            attributes: ['id', 'nome', 'email', 'subscriptionId', 'planExpiresAt', 'status']
        });

        let divergences = [];
        let ok = 0;
        let notFoundInDB = [];
        let analysisDetails = [];

        for (const sub of asaasSubs) {
            let localPsi = null;
            if (sub.externalReference) {
                localPsi = psis.find(p => String(p.id) === String(sub.externalReference));
            }
            if (!localPsi && sub.id) {
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

            if (!localPsi) {
                notFoundInDB.push(sub);
                continue;
            }

            // Validar se está realmente pagante
            const pRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${sub.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
            const pData = await pRes.json();
            const payments = pData.data || [];
            
            const hasPaid = payments.some(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
            const hasOverdue = payments.some(p => p.status === 'OVERDUE');
            
            let isPaying = hasPaid && !hasOverdue;

            let asaasNextDueDate = sub.nextDueDate;
            let parts = asaasNextDueDate.split('-');
            let asaasDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999-03:00`);
            
            let localDate = localPsi.planExpiresAt ? new Date(localPsi.planExpiresAt) : null;
            
            // Compara os milissegundos
            let isDivergent = false;
            if (!localDate || localDate.getTime() !== asaasDate.getTime()) {
                isDivergent = true;
            }

            analysisDetails.push({
                psiId: localPsi.id,
                nome: localPsi.nome,
                email: localPsi.email,
                isPaying: isPaying,
                asaasSubId: sub.id,
                asaasNextDueDate: asaasNextDueDate,
                calculatedAsaasDate: asaasDate.toISOString(),
                localExpiresAt: localDate ? localDate.toISOString() : 'NULL',
                isDivergent: isDivergent
            });

            if (isDivergent) {
                divergences.push(analysisDetails[analysisDetails.length - 1]);
            } else {
                ok++;
            }
        }

        console.log('\n================ RESUMO DA ANÁLISE APROFUNDADA ================');
        console.log(`Assinaturas ativas no Asaas analisadas: ${asaasSubs.length}`);
        console.log(`Psicólogos mapeados corretamente: ${ok}`);
        console.log(`Assinaturas não encontradas no DB: ${notFoundInDB.length}`);
        console.log(`Divergências encontradas de datas: ${divergences.length}`);

        if (notFoundInDB.length > 0) {
            console.log('\n--- ASSINATURAS DO ASAAS NÃO MAPEADAS NO DB ---');
            console.table(notFoundInDB.map(s => ({ SubId: s.id, Customer: s.customer, ExternalRef: s.externalReference })));
        }

        if (divergences.length > 0) {
            console.log('\n--- DIVERGÊNCIAS ENCONTRADAS (Data no Asaas vs Data no DB) ---');
            console.table(divergences.map(d => ({
                Nome: d.nome,
                Email: d.email,
                'DB Expires': d.localExpiresAt,
                'Asaas Expires (Calc)': d.calculatedAsaasDate,
                'Adimplente': d.isPaying ? 'SIM' : 'NÃO'
            })));
        }

        const fs = require('fs');
        fs.writeFileSync('divergences_report.json', JSON.stringify(analysisDetails, null, 2));
        console.log('\nRelatório detalhado salvo em divergences_report.json');

    } catch (error) {
        console.error(error);
    }
    
    process.exit(0);
}
analyze();
