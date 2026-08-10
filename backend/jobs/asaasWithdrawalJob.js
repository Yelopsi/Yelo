const db = require('../models');

/**
 * Função responsável por consultar o saldo no Asaas e realizar transferência via PIX.
 */
async function executeAutoWithdrawal() {
    console.log('💸 [ASAAS SAQUE] Iniciando verificação de saldo para saque programado...');

    try {
        const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';
        // Variável de ambiente (Mais seguro). Caso não esteja definida, usará o CNPJ configurado.
        // O CNPJ fornecido foi inserido de forma limpa (apenas números).
        const PIX_KEY = process.env.ASAAS_PIX_KEY || '64518011000140'; 

        if (!ASAAS_API_KEY) {
            console.error('❌ [ASAAS SAQUE] Cancelado. ASAAS_API_KEY não está configurada no ambiente.');
            return;
        }

        // Usa a API de fetch nativa do Node.js
        const balanceResponse = await global.fetch(`${ASAAS_API_URL}/finance/balance`, {
            method: 'GET',
            headers: {
                'access_token': ASAAS_API_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (!balanceResponse.ok) {
            const errBody = await balanceResponse.text();
            throw new Error(`Falha ao consultar saldo: Status ${balanceResponse.status} - ${errBody}`);
        }

        const balanceData = await balanceResponse.json();
        const availableBalance = parseFloat(balanceData.balance || 0);

        console.log(`💰 [ASAAS SAQUE] Saldo atual disponível: R$ ${availableBalance.toFixed(2)}`);

        // Transfere se o saldo for maior que zero
        if (availableBalance > 0) {
            console.log(`🚀 [ASAAS SAQUE] Solicitando transferência PIX (CNPJ) no valor de R$ ${availableBalance.toFixed(2)}...`);
            
            const transferPayload = {
                value: availableBalance,
                operationType: 'PIX',
                pixAddressKey: PIX_KEY,
                pixAddressKeyType: 'CNPJ',
                description: 'Saque Automático Programado - Yelo'
            };

            const transferResponse = await global.fetch(`${ASAAS_API_URL}/transfers`, {
                method: 'POST',
                headers: {
                    'access_token': ASAAS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(transferPayload)
            });

            if (!transferResponse.ok) {
                const errBody = await transferResponse.text();
                throw new Error(`Falha ao solicitar transferência: Status ${transferResponse.status} - ${errBody}`);
            }

            const transferData = await transferResponse.json();
            console.log(`✅ [ASAAS SAQUE] Transferência de R$ ${availableBalance.toFixed(2)} solicitada com sucesso! Protocolo: ${transferData.id}`);
            
            // Registra no banco de dados para segurança
            try {
                await db.SystemLog.create({
                    level: 'info',
                    message: `Saque automático Asaas realizado com sucesso: R$ ${availableBalance.toFixed(2)}`,
                    meta: { transferId: transferData.id, balanceBefore: availableBalance, pixKey: PIX_KEY }
                });
            } catch (logErr) {}
            
        } else {
            console.log('⚠️ [ASAAS SAQUE] Saldo zerado. Nenhuma transferência será solicitada hoje.');
        }

    } catch (error) {
        console.error('🔥 [ASAAS SAQUE] Erro CRÍTICO durante rotina de saque automático:', error.message);
        try {
            await db.SystemLog.create({
                level: 'error',
                message: `Falha na rotina de saque automático do Asaas`,
                meta: { error: error.message }
            });
        } catch (logErr) {}
    }
}

module.exports = {
    executeAutoWithdrawal
};
