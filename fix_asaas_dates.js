require('dotenv').config();
const db = require('./backend/models');
const fetch = require('node-fetch');

async function run() {
    console.log('🔄 Iniciando sincronização Yelo <-> Asaas...');
    const psis = await db.Psychologist.findAll({
        where: { subscriptionId: { [db.Sequelize.Op.ne]: null }, status: 'active' },
        attributes: ['id', 'nome', 'subscriptionId', 'planExpiresAt']
    });

    let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
        ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }

    let updated = 0;
    for (const psi of psis) {
        try {
            const asaasRes = await fetch(`${ASAAS_API_URL}/subscriptions/${psi.subscriptionId}`, {
                headers: { 'access_token': process.env.ASAAS_API_KEY, 'Content-Type': 'application/json' }
            });
            
            if (!asaasRes.ok) {
                console.log(`⚠️ Falha ao consultar assinatura ${psi.subscriptionId} do psi ${psi.id}`);
                continue;
            }
            
            const asaasSub = await asaasRes.json();
            if (asaasSub && asaasSub.nextDueDate) {
                const parts = asaasSub.nextDueDate.split('-');
                // Ajusta para o final do dia do vencimento no fuso do Brasil
                const novaValidade = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999-03:00`);
                
                // Só atualiza se a data for diferente
                if (!psi.planExpiresAt || new Date(psi.planExpiresAt).getTime() !== novaValidade.getTime()) {
                    await db.Psychologist.update(
                        { planExpiresAt: novaValidade },
                        { where: { id: psi.id } }
                    );
                    console.log(`✅ [ID ${psi.id}] ${psi.nome} - Atualizado de ${psi.planExpiresAt} para ${novaValidade}`);
                    updated++;
                }
            }
        } catch(e) {
            console.error(`❌ Erro no psi ${psi.id}:`, e.message);
        }
    }
    console.log(`🎉 Sincronização concluída! ${updated} perfis corrigidos.`);
    process.exit(0);
}
run();
