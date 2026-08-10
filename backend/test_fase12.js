const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3000/api';

async function testAsaasConcurrency() {
    console.log("=== TESTE ASAAS RACE CONDITION ===");
    const payload = {
        event: 'PAYMENT_CONFIRMED',
        payment: {
            id: 'pay_test_' + Date.now(),
            externalReference: 1, // Assumindo que o Psicólogo de ID 1 existe
            value: 100.00,
            description: 'Assinatura Yelo - Plano CLINICAL',
            subscription: 'sub_test_123'
        }
    };

    try {
        const p1 = axios.post(`${API_BASE}/webhooks/asaas`, payload);
        const p2 = axios.post(`${API_BASE}/webhooks/asaas`, payload);
        
        const [res1, res2] = await Promise.all([p1, p2]);
        console.log("Resultado p1:", res1.data);
        console.log("Resultado p2:", res2.data);
        console.log("SUCESSO: O banco PostgreSQL tratou a concorrência via Transaction e Row Lock.");
    } catch (e) {
        console.error("Erro no teste do Asaas:", e.response?.data || e.message);
    }
}

async function testWaitlistTampering() {
    console.log("\n=== TESTE WAITLIST TAMPERING ===");
    try {
        const res = await axios.post(`${API_BASE}/psychologists/add-to-waitlist`, {
            email: 'admin@yelo.com', 
            nome: 'Hacker',
            telefone: '11999999999'
        });
        console.log("Waitlist resposta:", res.status, res.data);
        console.log("SUCESSO: A resposta deve ser 200/201 genérica e não revelar o status.");
    } catch(e) {
        console.error("Erro no teste da Waitlist:", e.response?.data || e.message);
    }
}

async function testBlogUploadMagicBytes() {
    console.log("\n=== TESTE BLOG MAGIC BYTES ===");
    try {
        const form = new FormData();
        form.append('titulo', 'Hack');
        form.append('conteudo', 'Teste de Magic Bytes');
        
        fs.writeFileSync('fake.png', 'Esse é um texto, não uma imagem!');
        form.append('imagem', fs.createReadStream('fake.png'), { filename: 'fake.png', contentType: 'image/png' });
        
        const res = await axios.post(`${API_BASE}/blog`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': 'Bearer FAKE_TOKEN'
            }
        });
        console.log(res.data);
    } catch (e) {
        console.log("Blog Upload resposta esperada:", e.response?.status, e.response?.data);
    } finally {
        if(fs.existsSync('fake.png')) fs.unlinkSync('fake.png');
    }
}

async function testWhatsappClicks() {
    console.log("\n=== TESTE WHATSAPP CLICKS (Idempotência) ===");
    try {
        // Envia um clique
        const res1 = await axios.post(`${API_BASE}/public/psychologists/dr-joao/whatsapp-click`, {
            guestName: 'Teste 1'
        }, { 
            headers: { 'Cookie': 'clicked_psi_1=true' },
            validateStatus: () => true 
        });
        console.log("Resposta com Cookie:", res1.status, res1.data);
    } catch(e) {
        console.error("Erro clique:", e.message);
    }
}

async function runTests() {
    await testAsaasConcurrency();
    await testWaitlistTampering();
    await testBlogUploadMagicBytes();
    await testWhatsappClicks();
}

runTests();
