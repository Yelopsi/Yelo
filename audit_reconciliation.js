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

    console.log('--- RECONCILIAÇÃO INICIAL YELO vs ASAAS ---');
    console.log('Obtendo usuários ativos com assinatura na Yelo...');
    
    // Pegando apenas psicólogos com subscriptionId populado ou com plano não expirado
    const yeloRes = await client.query(`
      SELECT id, email, status, plano, "subscriptionId", "planExpiresAt"
      FROM "Psychologists"
      WHERE ("subscriptionId" IS NOT NULL OR "status" = 'active') 
      AND "deletedAt" IS NULL
    `);

    const users = yeloRes.rows;
    console.log(`Encontrados ${users.length} usuários para avaliar.`);

    let orphansInAsaas = 0;
    let localStatusMismatches = 0;
    let perfectMatches = 0;

    for (const u of users) {
        if (!u.subscriptionId) {
            console.log(`[ALERTA] Psicólogo ${u.email} está ${u.status} na Yelo mas não tem subscriptionId.`);
            localStatusMismatches++;
            continue;
        }

        // Consultando o Asaas
        const subRes = await fetch(`${ASAAS_API_URL}/subscriptions/${u.subscriptionId}`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        
        if (!subRes.ok) {
            if (subRes.status === 404) {
                console.log(`[DIVERGÊNCIA CRÍTICA] Psicólogo ${u.email} tem subscriptionId ${u.subscriptionId}, mas ela NÃO EXISTE no Asaas!`);
                orphansInAsaas++;
            } else {
                console.log(`[ERRO ASAAS] Falha ao checar ${u.subscriptionId}: ${subRes.status}`);
            }
            continue;
        }

        const asaasSub = await subRes.json();
        
        // Verifica se a assinatura está ativa lá
        if (u.status === 'active' && asaasSub.status !== 'ACTIVE') {
            console.log(`[DIVERGÊNCIA] Psicólogo ${u.email} está ATIVO na Yelo, mas a assinatura ${u.subscriptionId} está ${asaasSub.status} no Asaas!`);
            localStatusMismatches++;
        } else if (u.status !== 'active' && asaasSub.status === 'ACTIVE') {
            console.log(`[DIVERGÊNCIA] Psicólogo ${u.email} está INATIVO na Yelo (${u.status}), mas a assinatura ${u.subscriptionId} está ATIVA no Asaas! (Pagamento pode estar cobrando)`);
            orphansInAsaas++;
        } else {
            perfectMatches++;
        }
    }

    console.log('\n--- RESUMO DA RECONCILIAÇÃO ---');
    console.log(`Total Analisado: ${users.length}`);
    console.log(`Match Perfeito: ${perfectMatches}`);
    console.log(`Status Divergente (Acesso indevido ou falta de acesso): ${localStatusMismatches}`);
    console.log(`Assinaturas Órfãs (Possível cobrança indevida): ${orphansInAsaas}`);

  } catch (e) {
    console.error('Erro na reconciliação:', e.message);
  } finally {
    await client.end();
  }
}

run();
