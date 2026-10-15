const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const fs = require('fs');

async function processScheduledRefund() {
    const apiUrl = 'https://api.asaas.com/v3';
    const apiKey = (process.env.ASAAS_API_KEY || '').trim();
    const payId = 'pay_6nbq6ksje0dq4x9u';
    const refundAmount = 99.00;

    console.log(`[${new Date().toISOString()}] Verificando saldo do Asaas para estorno de Vanessa Toyama (${payId})...`);

    // 1. Verificar status atual do pagamento no Asaas
    const payRes = await fetch(`${apiUrl}/payments/${payId}`, {
        headers: { 'access_token': apiKey }
    });
    const payData = await payRes.json();

    if (payData.status === 'REFUNDED' || payData.status === 'REFUND_IN_PROGRESS') {
        console.log(`✅ O pagamento ${payId} já está com status ${payData.status} no Asaas! Nada a fazer.`);
        return { success: true, alreadyRefunded: true, payData };
    }

    // 2. Verificar saldo disponível
    const balRes = await fetch(`${apiUrl}/finance/balance`, {
        headers: { 'access_token': apiKey }
    });
    const balData = await balRes.json();
    const currentBalance = parseFloat(balData.balance || 0);

    console.log(`Saldo disponível no Asaas: R$ ${currentBalance.toFixed(2)} | Necessário: R$ ${refundAmount.toFixed(2)}`);

    if (currentBalance < refundAmount) {
        console.log(`⚠️ Saldo insuficiente no momento (R$ ${currentBalance.toFixed(2)}). O estorno será executado assim que o saldo entrar.`);
        return { success: false, reason: 'insufficient_balance', currentBalance };
    }

    // 3. Executar o estorno
    console.log(`🚀 Saldo suficiente! Executando estorno de R$ ${refundAmount.toFixed(2)} para ${payId}...`);
    const refundRes = await fetch(`${apiUrl}/payments/${payId}/refund`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'access_token': apiKey
        },
        body: JSON.stringify({
            value: refundAmount,
            description: 'Estorno de renovação indevida após cancelamento da assinatura'
        })
    });

    const refundData = await refundRes.json();
    console.log(`HTTP Status do Estorno: ${refundRes.status}`);
    console.log('Resposta do Asaas:', JSON.stringify(refundData, null, 2));

    const resultPath = path.resolve(__dirname, '../scratch/refund_result.json');
    fs.writeFileSync(resultPath, JSON.stringify({
        executedAt: new Date().toISOString(),
        httpStatus: refundRes.status,
        response: refundData
    }, null, 2));

    if (refundRes.ok) {
        console.log(`🎉 Estorno de Vanessa Toyama executado com sucesso no Asaas!`);
        return { success: true, refundData };
    } else {
        console.error(`❌ Falha ao estornar:`, refundData);
        return { success: false, refundData };
    }
}

if (require.main === module) {
    processScheduledRefund().catch(console.error);
}

module.exports = { processScheduledRefund };
