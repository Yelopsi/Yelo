require('dotenv').config();
const db = require('../backend/models');
const fetch = require('node-fetch'); // Em Node 18+ o fetch é global, mas se precisar a gente exige

async function testPaymentCycle() {
    console.log("=== INICIANDO TESTE DO CICLO DE PAGAMENTO ===");
    
    // 1. Criar um psicólogo no banco local
    const mockEmail = `psi_teste_${Date.now()}@yelopsi.com.br`;
    console.log("1. Criando Psicólogo de teste:", mockEmail);
    function randomCpf() {
        const rnd = (n) => Math.round(Math.random() * n);
        const mod = (dividendo, divisor) => Math.round(dividendo - (Math.floor(dividendo / divisor) * divisor));
        const n = Array(9).fill(0).map(() => rnd(9));
        let d1 = n.reduce((total, number, index) => total + (number * (10 - index)), 0);
        d1 = 11 - mod(d1, 11);
        if (d1 >= 10) d1 = 0;
        let d2 = n.reduce((total, number, index) => total + (number * (11 - index)), 0) + d1 * 2;
        d2 = 11 - mod(d2, 11);
        if (d2 >= 10) d2 = 0;
        return n.join('') + d1 + d2;
    }
    const fakeCpf = randomCpf();

    const psi = await db.Psychologist.create({
        nome: "Psicólogo de Teste",
        email: mockEmail,
        senha: "hash-fake",
        telefone: "11988881234",
        crp: `06/${Date.now().toString().slice(-5)}`,
        cpf: fakeCpf,
        cep: "01001-000",
        rua: "Praça da Sé",
        numero: "1",
        bairro: "Sé",
        status: "inactive"
    });
    console.log("   ✅ Criado com ID local:", psi.id);

    // 2. Mock do req e res para simular o controller
    const req = {
        psychologist: { id: psi.id },
        body: {
            planType: "ESSENTIAL",
            billingType: "PIX",
            cupom: "",
            creditCard: null
        },
        headers: {
            'x-idempotency-key': `idem_${Date.now()}`
        }
    };

    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            console.log(`\n=== RESPOSTA DO CONTROLLER (Status ${this.statusCode || 200}) ===`);
            console.log(JSON.stringify(data, null, 2));
            if (this.statusCode && this.statusCode >= 400) {
                console.error("❌ Falha na assinatura");
            } else {
                console.log("✅ Assinatura criada com sucesso no Asaas!");
            }
        }
    };

    const { createPreference } = require('../backend/controllers/paymentController');

    // Mocar o IP (alguns middlewares usam)
    req.ip = '127.0.0.1';

    console.log("\n2. Invocando o controller de pagamento (paymentController.createPreference)...");
    
    try {
        await createPreference(req, res);
    } catch (e) {
        console.error("Erro fatal ao invocar createPreference:", e);
    }

    console.log("\n3. Verificando o registro do psicólogo após a chamada...");
    const psiUpdated = await db.Psychologist.findByPk(psi.id);
    console.log("   Customer ID no Asaas:", psiUpdated.asaasCustomerId || 'Não setado');
    console.log("   Subscription ID no Asaas:", psiUpdated.subscriptionId || 'Não setado');
    
    console.log("\n=== FIM DO TESTE ===");
    process.exit(0);
}

testPaymentCycle();
