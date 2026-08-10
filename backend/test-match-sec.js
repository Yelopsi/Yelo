const express = require('express');
const request = require('supertest');
const { matchLimiter } = require('./middlewares/rateLimiters');
const matchController = require('./controllers/matchController');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Rota simulando o anônimo
app.post('/api/psychologists/match', matchLimiter, matchController.getAnonymousMatches);

// Mock db for testing
const db = require('./models');

// Mock matchService para NÃO chamar Gemini durante o teste e podermos contar quantas vezes foi chamado
const matchService = require('./services/matchService');
let serviceCallCount = 0;
const originalCalculateMatches = matchService.calculateMatches;
matchService.calculateMatches = async (prefs) => {
    serviceCallCount++;
    return {
        matchTier: 'ideal',
        results: [{ id: 1, nome: "Psi Teste", matchScore: 100 }],
        compromiseText: "mock"
    };
};

async function runTests() {
    console.log("--- INICIANDO TESTES DA VULN #7 (MATCH) ---");

    const payload1 = {
        faixa_valor: "R$ 51 - R$ 90",
        temas: ["Ansiedade"],
        pref_genero_prof: "Feminino",
        modalidade_atendimento: "Online"
    };

    console.log("\\n1. PRIMEIRA REQUISIÇÃO (Executa normalmente)");
    serviceCallCount = 0;
    const res1 = await request(app)
        .post('/api/psychologists/match')
        .send(payload1)
        .set('X-Forwarded-For', '10.0.0.1');
    console.log(`Status: ${res1.status}, calculateMatches chamado: ${serviceCallCount} vez(es)`);

    console.log("\\n2. SEGUNDA REQUISIÇÃO IDÊNTICA (Usa Cache)");
    serviceCallCount = 0;
    const res2 = await request(app)
        .post('/api/psychologists/match')
        .send(payload1)
        .set('X-Forwarded-For', '10.0.0.1');
    console.log(`Status: ${res2.status}, calculateMatches chamado: ${serviceCallCount} vez(es) (esperado 0)`);

    console.log("\\n3. CONSULTA DIFERENTE (Não compartilha cache)");
    serviceCallCount = 0;
    const payload2 = { ...payload1, faixa_valor: "Até R$ 50" };
    const res3 = await request(app)
        .post('/api/psychologists/match')
        .send(payload2)
        .set('X-Forwarded-For', '10.0.0.1');
    console.log(`Status: ${res3.status}, calculateMatches chamado: ${serviceCallCount} vez(es) (esperado 1)`);

    console.log("\\n4. ENTRADA INVÁLIDA (Payload Gigante)");
    const giantPayload = {
        faixa_valor: "R$ 51",
        temas: Array(100).fill("Ansiedade Gigante")
    };
    const res4 = await request(app)
        .post('/api/psychologists/match')
        .send(giantPayload)
        .set('X-Forwarded-For', '10.0.0.1');
    console.log(`Status: ${res4.status} (Esperado 400), Erro: ${res4.body.error}`);

    console.log("\\n5. RATE LIMIT (11ª Requisição)");
    for(let i = 0; i < 7; i++) {
        // Envia requisições com payloads dinâmicos para não cair no cache e forçar rate limit no Express (o limiter não liga pro cache, liga pro endpoint)
        await request(app).post('/api/psychologists/match').send({ ...payload1, random: Math.random() }).set('X-Forwarded-For', '10.0.0.1');
    }
    const resLimit = await request(app)
        .post('/api/psychologists/match')
        .send(payload1)
        .set('X-Forwarded-For', '10.0.0.1');
    console.log(`Status 11ª req: ${resLimit.status} (Esperado 429)`);

    console.log("\\n6. OUTRO IP (Bucket independente)");
    const resIp = await request(app)
        .post('/api/psychologists/match')
        .send(payload1)
        .set('X-Forwarded-For', '20.0.0.2');
    console.log(`Status outro IP: ${resIp.status} (Esperado 200)`);
    
    // Restaura mock
    matchService.calculateMatches = originalCalculateMatches;
}

runTests().then(() => {
    console.log("\\nTestes concluídos.");
    process.exit(0);
}).catch(console.error);
