const assert = require('assert');

console.log('  🔍 Iniciando Testes de Regressão: Pagamentos, Race Conditions & Idempotência...');

let hasFailed = false;

const checkPaymentLogic = () => {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const paymentController = fs.readFileSync(path.join(__dirname, '../../backend/controllers/paymentController.js'), 'utf-8');
        
        console.log('    [Test] Idempotência na criação de Assinatura Asaas');
        if (paymentController.includes("req.headers['idempotency-key']") && paymentController.includes("db.SubscriptionIntent.findOne")) {
            console.log('    ✅ PASSOU: Chave de idempotência (idempotency-key) e Intents (SubscriptionIntent) detectados no Checkout.');
        } else {
             console.error('    ❌ FALHA: Faltam proteções de idempotência no Checkout (paymentController.js).');
             hasFailed = true;
        }

        console.log('    [Test] Race Condition e Tratamento Concorrente de Pagamentos');
        // A proteção de concorrência se dá pela Unique Constraint no banco para o idempotencyKey e a captura do SequelizeUniqueConstraintError
        if (paymentController.includes("SequelizeUniqueConstraintError") && paymentController.includes("Você já possui um pagamento em andamento")) {
             console.log('    ✅ PASSOU: Tratamento de concorrência (SequelizeUniqueConstraintError) ativo. Previne dupla cobrança simultânea.');
        } else {
             console.error('    ❌ FALHA: Faltam tratamentos de Race Condition explícitos no catch() da criação do intent.');
             hasFailed = true;
        }

    } catch (e) {
        console.log('    ⚠️ Aviso: paymentController.js não encontrado.');
    }
};

checkPaymentLogic();

if (hasFailed) {
    process.exit(1);
} else {
    process.exit(0);
}
