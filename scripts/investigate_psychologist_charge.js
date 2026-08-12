require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection (same connection string used elsewhere)
const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db',
  ssl: { rejectUnauthorized: false },
});

// Asaas configuration – environment variables set in Render
const ASAAS_API_URL = (process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3').replace(/\/+$/,'');
const ASAAS_API_KEY = process.env.ASAAS_API_KEY?.trim();
if (!ASAAS_API_KEY) {
  console.error('⚠️  ASAAS_API_KEY not set in environment. Exiting.');
  process.exit(1);
}

// Helper to call Asaas API
async function asaasRequest(endpoint) {
  const url = `${ASAAS_API_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Asaas request failed ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Main function
(async () => {
  try {
    await client.connect();
    const name = 'Geovan De Sousa Negreiros';
    const { rows } = await client.query(
      `SELECT "id", "nome", "plano", "status", "subscriptionId", "stripeSubscriptionId", "planExpiresAt", "subscription_payments_count", "createdAt", "updatedAt" FROM "Psychologists" WHERE "nome" ILIKE $1`,
      [`%Geovan%`]
    );
    if (rows.length === 0) {
      console.log('⚠️  Psicólogo não encontrado no banco.');
      return;
    }
    const ps = rows[0];
    console.log('📋 Registro do psicólogo:');
    console.table({
      id: ps.id,
      nome: ps.nome,
      plano: ps.plano,
      status: ps.status,
      subscriptionId: ps.subscriptionId,
      stripeSubscriptionId: ps.stripeSubscriptionId,
      planExpiresAt: ps.planExpiresAt,
      subscription_payments_count: ps.subscription_payments_count,
      createdAt: ps.createdAt,
    });

    if (!ps.subscriptionId) {
      console.log('❌  Sem subscriptionId (Asaas) associado.');
      return;
    }

    // Fetch subscription details from Asaas
    console.log('\n🔎 Consultando Asaas para subscriptionId:', ps.subscriptionId);
    const sub = await asaasRequest(`/subscriptions/${ps.subscriptionId}`);
    console.log('🗂️  Dados da assinatura Asaas:');
    console.table({
      id: sub.id,
      status: sub.status,
      customer: sub.customer,
      billingType: sub.billingType,
      value: sub.value,
      nextDueDate: sub.nextDueDate,
      endDate: sub.endDate,
    });

    // List recent payments (last 5)
    const payments = await asaasRequest(`/subscriptions/${ps.subscriptionId}/payments?offset=0&limit=5`);
    console.log('\n💰 Últimos pagamentos (até 5):');
    if (Array.isArray(payments.data) && payments.data.length) {
      console.table(payments.data.map(p => ({
        id: p.id,
        status: p.status,
        value: p.value,
        dueDate: p.dueDate,
        paymentDate: p.paymentDate,
        invoiceUrl: p.invoiceUrl,
      })));
    } else {
      console.log('Nenhum pagamento encontrado.');
    }

    // Compare DB expiration vs Asaas next due date
    const dbExpires = ps.planExpiresAt ? new Date(ps.planExpiresAt) : null;
    const asaasNext = sub.nextDueDate ? new Date(sub.nextDueDate) : null;
    console.log('\n⚖️  Comparação de datas de expiração:');
    console.log('DB planExpiresAt:', dbExpires ? dbExpires.toISOString() : 'null');
    console.log('Asaas nextDueDate:', asaasNext ? asaasNext.toISOString() : 'null');

    // Optionally, read recent lines from server.log for debugging
    const logPath = path.resolve(__dirname, '..', 'server.log');
    if (fs.existsSync(logPath)) {
      const logData = fs.readFileSync(logPath, 'utf8');
      const lines = logData.trim().split('\n');
      const relevant = lines.filter(l => l.includes(String(ps.id)) || l.includes(ps.subscriptionId));
      const tail = relevant.slice(-20); // last 20 relevant lines
      console.log('\n📝 Últimas linhas relevantes de server.log:');
      tail.forEach(l => console.log(l));
    } else {
      console.log('⚠️  server.log não encontrado.');
    }

  } catch (err) {
    console.error('❗ Erro durante a investigação:', err);
  } finally {
    await client.end();
  }
})();
