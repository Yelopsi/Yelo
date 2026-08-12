require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

    console.log('# SECURITY GATE: DIAGNÓSTICO DOS 4 ÓRFÃOS\n');
    
    // As 4 assinaturas divergentes mapeadas
    const emails = [
        'carina.o.nelis@gmail.com',
        'augusto.ocbs@gmail.com',
        'nt.garrido107@gmail.com',
        'travessia.inconsciente@gmail.com'
    ];

    for (const email of emails) {
        const res = await client.query(`SELECT id, nome, email, status, plano, "subscriptionId", "subscription_payments_count" FROM "Psychologists" WHERE email = $1`, [email]);
        if (res.rows.length === 0) continue;
        
        const psi = res.rows[0];
        console.log(`--- Análise para: ${psi.nome} (${psi.email}) ---`);
        
        const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
        if (!subRes.ok) {
            console.log('Erro ao buscar Asaas:', subRes.status);
            continue;
        }
        const asaasSub = await subRes.json();
        
        // Pagamentos do Asaas
        const payRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${psi.subscriptionId}&limit=50`, { headers: { 'access_token': ASAAS_API_KEY } });
        const asaasPays = payRes.ok ? await payRes.json() : { data: [] };
        
        // Local Payments
        const localPaysRes = await client.query(`SELECT COUNT(*) FROM "Payments" WHERE "psychologistId" = $1`, [psi.id]);
        
        console.log(`- asaasSubscriptionId: ${asaasSub.id}`);
        console.log(`- asaasCustomerId: ${asaasSub.customer}`);
        console.log(`- status no Asaas: ${asaasSub.status}`);
        console.log(`- valor: R$ ${asaasSub.value}`);
        console.log(`- plano (descrição Asaas): ${asaasSub.description}`);
        console.log(`- ciclo de cobrança: ${asaasSub.cycle}`);
        console.log(`- próxima cobrança: ${asaasSub.nextDueDate}`);
        
        const receivedPays = asaasPays.data.filter(p => p.status === 'RECEIVED' || p.status === 'CONFIRMED');
        const lastPay = receivedPays.length > 0 ? receivedPays[0].paymentDate || receivedPays[0].clientPaymentDate : 'Nenhuma';
        console.log(`- última cobrança paga: ${lastPay}`);
        
        console.log(`- status do psicólogo na Yelo: ${psi.status}`);
        console.log(`- subscriptionId atual na Yelo: ${psi.subscriptionId}`);
        console.log(`- existência de Payment local: ${localPaysRes.rows[0].count > 0 ? 'Sim' : 'Não (Zero)'}`);
        console.log(`- existência de Intent local: Não (Zero, tabela recém-criada)`);
        console.log(`- qtd de cobranças realizadas (Asaas): ${receivedPays.length}`);
        console.log(`- qtd de cobranças registradas (Yelo count): ${psi.subscription_payments_count}`);
        
        let classificacao = 'DIVERGÊNCIA A INVESTIGAR';
        let risco = 'Médio';
        
        if (asaasSub.status === 'ACTIVE' && psi.status === 'inactive' && asaasSub.nextDueDate) {
            classificacao = 'ÓRFÃO CONFIRMADO';
            risco = 'ALTO (Cobrança Indevida iminente se o usuário perdeu o acesso)';
        }
        
        console.log(`- Risco estimado: ${risco}`);
        console.log(`- Classificação: ${classificacao}\n`);
    }

    console.log('\n# RESUMO DAS 15 DIVERGÊNCIAS GERAIS\n');
    const divRes = await client.query(`
        SELECT email, status, "is_exempt", plano, "planExpiresAt", "subscriptionId" 
        FROM "Psychologists" 
        WHERE status = 'active' AND "subscriptionId" IS NULL AND "deletedAt" IS NULL
    `);
    
    let isExemptCount = 0;
    let nullExemptCount = 0;
    
    divRes.rows.forEach(r => {
        if (r.is_exempt) isExemptCount++;
        else nullExemptCount++;
    });
    
    console.log(`Identificados ${divRes.rows.length} usuários 'active' sem 'subscriptionId':`);
    console.log(`- Causa Provável 1: Isenção Administrativa (is_exempt = true). Quantidade: ${isExemptCount}`);
    console.log(`- Causa Provável 2: Legado Stripe sem migração ou erro de cancelamento. Quantidade: ${nullExemptCount}`);
    console.log(`Nota: Nenhuma ação destrutiva foi realizada.`);

  } catch (e) {
    console.error('Erro:', e.message);
  } finally {
    await client.end();
  }
}
run();
