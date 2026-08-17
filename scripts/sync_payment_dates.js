// scripts/sync_payment_dates.js

/**
 * Script: sincroniza datas de pagamentos da API Asaas com a coluna `paymentDate`
 * da tabela Payments no banco PostgreSQL.
 *
 * Executar com: `node scripts/sync_payment_dates.js`
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fetch = require('node-fetch'); // node-fetch >=3 uses ESM, but the project already uses fetch in other files (global?)
const db = require('../backend/models'); // importa todos os modelos (inclui Payment)

const ASAAS_API_URL = process.env.ASAAS_API_URL?.trim().replace(/\/+$/, '') || 'https://sandbox.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY?.trim() || '';

if (!ASAAS_API_KEY) {
  console.error('❌ Chave ASAAS_API_KEY não configurada. Abortando.');
  process.exit(1);
}

// Função que busca todos os pagamentos da Asaas (paginado)
async function fetchAllAsaasPayments() {
  const limit = 100; // máximo suportado pela API
  let offset = 0;
  let all = [];
  while (true) {
    const url = `${ASAAS_API_URL}/payments?limit=${limit}&offset=${offset}`;
    const resp = await fetch(url, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!resp.ok) {
      console.error('⚠️ Erro ao buscar pagamentos da Asaas:', resp.status, resp.statusText);
      break;
    }
    const data = await resp.json();
    if (!data || !Array.isArray(data.data)) break;
    all = all.concat(data.data);
    if (data.data.length < limit) break; // última página
    offset += limit;
  }
  return all;
}

async function syncPayments() {
  console.log('🔄 Iniciando sincronização de datas de pagamentos...');
  const payments = await fetchAllAsaasPayments();
  console.log(`📦 ${payments.length} pagamentos recebidos da Asaas.`);

  const transaction = await db.sequelize.transaction();
  let inserted = 0,
    updated = 0,
    unchanged = 0;
  try {
    for (const p of payments) {
      // O ID da Asaas já é usado como PK em nosso modelo Payment
      const [record, created] = await db.Payment.findOrCreate({
        where: { id: p.id },
        defaults: {
          subscriptionId: p.subscriptionId || null,
          psychologistId: p.customer && !Number.isNaN(parseInt(p.customer)) ? parseInt(p.customer) : null,
          status: p.status,
          value: p.value,
          billingType: p.billingType,
          dueDate: p.dueDate,
          paymentDate: p.paymentDate || null,
        },
        transaction,
      });

      if (created) {
        inserted++;
        continue;
      }

      const newDate = p.paymentDate ? new Date(p.paymentDate) : null;
      const curDate = record.paymentDate ? new Date(record.paymentDate) : null;
      const datesDiffer = (newDate && !curDate) || (!newDate && curDate) || (newDate && curDate && newDate.getTime() !== curDate.getTime());
      if (datesDiffer) {
        await record.update({ paymentDate: newDate }, { transaction });
        updated++;
      } else {
        unchanged++;
      }
    }
    await transaction.commit();
    console.log('✅ Sincronização concluída.');
    console.log(`   Inseridos: ${inserted}\n   Atualizados: ${updated}\n   Inalterados: ${unchanged}`);
  } catch (err) {
    await transaction.rollback();
    console.error('❌ Erro durante a sincronização, transação revertida:', err);
    process.exit(1);
  }
}

syncPayments().then(() => process.exit(0)).catch(err => {
  console.error('❌ Falha inesperada:', err);
  process.exit(1);
});
