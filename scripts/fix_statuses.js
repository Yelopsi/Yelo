require('dotenv').config({ path: '/Users/andehrson/SITES/Yelo/.env' });
const db = require('../backend/models');

async function fixStatuses() {
    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    try {
        console.log("🔍 Buscando assinaturas no Asaas...");
        const res = await fetch(`${ASAAS_API_URL}/subscriptions?status=ACTIVE&limit=100`, {
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });
        const asaasData = await res.json();
        const asaasSubs = asaasData.data || [];

        const psis = await db.Psychologist.findAll({
            where: { deletedAt: null }
        });

        let truePayingIds = new Set();
        let updatePromises = [];

        console.log(`🔎 Verificando pagamentos para ${asaasSubs.length} assinaturas...`);
        for (const sub of asaasSubs) {
            let localPsi = null;
            if (sub.externalReference) {
                localPsi = psis.find(p => String(p.id) === String(sub.externalReference));
            }
            if (!localPsi) {
                localPsi = psis.find(p => p.subscriptionId === sub.id);
            }
            if (!localPsi && sub.customer) {
                const cRes = await fetch(`${ASAAS_API_URL}/customers/${sub.customer}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
                const cData = await cRes.json();
                if (cData && cData.email) {
                    localPsi = psis.find(p => p.email.toLowerCase() === cData.email.toLowerCase());
                }
            }

            if (!localPsi) continue;

            const pRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${sub.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
            const pData = await pRes.json();
            const payments = pData.data || [];
            
            const hasOverdue = payments.some(p => p.status === 'OVERDUE');

            if (!hasOverdue) {
                truePayingIds.add(localPsi.id);
                const nextDueDate = new Date(sub.nextDueDate);
                
                // Dar uma margem de segurança de +3 dias no Yelo (Grace Period)
                nextDueDate.setDate(nextDueDate.getDate() + 3);

                console.log(`✅ Pagante Ativo: ${localPsi.nome} | ID: ${localPsi.id}`);
                updatePromises.push(localPsi.update({
                    status: 'active',
                    subscriptionId: sub.id,
                    planExpiresAt: nextDueDate
                }));
            }
        }

        console.log(`\n🧹 Limpando inativos e falsos pagantes...`);
        const now = new Date();

        for (const psi of psis) {
            if (psi.is_exempt || psi.isAdmin) continue; // Pula os VIPs/Admins

            if (!truePayingIds.has(psi.id)) {
                // Não é um pagante verdadeiro no Asaas.
                let updateData = { subscriptionId: null };
                
                const expDate = psi.planExpiresAt ? new Date(psi.planExpiresAt) : null;
                const limitDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days grace period
                
                if (!expDate || expDate < limitDate) {
                    // Trial Vencido ou Assinatura Expirada (com 3 dias de tolerância)
                    updateData.status = 'inactive';
                    console.log(`❌ Vencido (ou Inativo): ${psi.nome} | ID: ${psi.id} (Status -> inactive)`);
                } else {
                    // Trial Vigente ou no período de tolerância
                    console.log(`⏳ Em Trial/Tolerância: ${psi.nome} | ID: ${psi.id} (Vence: ${expDate.toLocaleDateString()})`);
                }

                updatePromises.push(psi.update(updateData));
            }
        }

        await Promise.all(updatePromises);
        console.log("\n🚀 Sincronização e Auditoria Concluída com Sucesso!");

    } catch (error) {
        console.error("Erro Crítico:", error);
    }
}

fixStatuses().then(() => process.exit(0));
