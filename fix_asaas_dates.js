require('dotenv').config();
const db = require('./backend/models');
const fetch = require('node-fetch');

async function run() {
    console.log('🔄 Iniciando sincronização Yelo <-> Asaas (Correção de Vencimentos)...');
    
    // Busca todos os psicólogos que têm assinatura e estão ativos
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
            // Busca todos os pagamentos da assinatura (até 100)
            const asaasRes = await fetch(`${ASAAS_API_URL}/payments?subscription=${psi.subscriptionId}&limit=100`, {
                headers: { 'access_token': process.env.ASAAS_API_KEY, 'Content-Type': 'application/json' }
            });
            
            if (!asaasRes.ok) {
                console.log(`⚠️ Falha ao consultar pagamentos da assinatura ${psi.subscriptionId} do psi ${psi.id}`);
                continue;
            }
            
            const paymentsData = await asaasRes.json();
            const payments = paymentsData.data || [];
            
            // Filtra apenas os pagamentos que foram confirmados/recebidos
            const paidPayments = payments.filter(p => ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH'].includes(p.status));
            
            if (paidPayments.length > 0) {
                // Ordena do mais recente para o mais antigo baseado na data de vencimento da fatura
                paidPayments.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
                const latestPayment = paidPayments[0];
                
                if (latestPayment.dueDate) {
                    const parts = latestPayment.dueDate.split('-');
                    let novaValidade = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T23:59:59.999-03:00`);
                    
                    // Adiciona 1 mês de forma segura (tratando pulo de mês curto)
                    const targetMonth = novaValidade.getMonth() + 1;
                    novaValidade.setMonth(targetMonth);
                    if (novaValidade.getMonth() !== targetMonth % 12) {
                        novaValidade.setDate(0); 
                    }
                    
                    const oldDateStr = psi.planExpiresAt ? new Date(psi.planExpiresAt).toISOString().split('T')[0] : null;
                    const newDateStr = novaValidade.toISOString().split('T')[0];
                    
                    // Só atualiza se o DIA for diferente, ignorando pequenas variações de milissegundos/fuso horário
                    if (oldDateStr !== newDateStr) {
                        await db.Psychologist.update(
                            { planExpiresAt: novaValidade },
                            { where: { id: psi.id } }
                        );
                        console.log(`✅ [ID ${psi.id}] ${psi.nome} - Atualizado de ${oldDateStr} para ${newDateStr}`);
                        updated++;
                    }
                }
            } else {
                 console.log(`ℹ️ [ID ${psi.id}] Nenhuma fatura paga encontrada para a assinatura ${psi.subscriptionId}`);
            }
        } catch(e) {
            console.error(`❌ Erro no psi ${psi.id}:`, e.message);
        }
    }
    console.log(`🎉 Correção concluída! ${updated} perfis corrigidos.`);
    process.exit(0);
}
run();
