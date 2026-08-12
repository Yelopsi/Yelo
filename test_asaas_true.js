require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const db = require('/Users/andehrson/Yelo/backend/models');

async function test() {
    let url = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (url.includes('sandbox.asaas.com') && !url.includes('/api')) {
        url = url.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }
    const res = await fetch(`${url}/subscriptions?status=ACTIVE&limit=100`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
    const data = await res.json();
    
    const psis = await db.Psychologist.findAll({ where: { deletedAt: null }, attributes: ['id', 'nome', 'email', 'subscriptionId'] });
    
    let truePaying = [];
    
    for (const sub of data.data) {
        const pRes = await fetch(`${url}/payments?subscription=${sub.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
        const pData = await pRes.json();
        const payments = pData.data || [];
        
        const hasPaid = payments.some(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
        const hasOverdue = payments.some(p => p.status === 'OVERDUE');
        
        if (hasPaid && !hasOverdue) {
            let localPsi = psis.find(p => p.id == sub.externalReference) || psis.find(p => p.subscriptionId === sub.id);
            truePaying.push({
                Nome: localPsi ? localPsi.nome : 'Desconhecido',
                Email: localPsi ? localPsi.email : 'Sem registro',
                Valor: `R$ ${sub.value.toFixed(2)}`,
                'Próximo Pagamento': new Date(sub.nextDueDate).toLocaleDateString('pt-BR'),
                Ciclo: sub.cycle === 'MONTHLY' ? 'Mensal' : sub.cycle
            });
        }
    }
    
    truePaying.sort((a, b) => a['Próximo Pagamento'].split('/').reverse().join('').localeCompare(b['Próximo Pagamento'].split('/').reverse().join('')));
    
    console.table(truePaying);
    console.log(`Total de verdadeiros pagantes: ${truePaying.length}`);
}
test().catch(console.error);
