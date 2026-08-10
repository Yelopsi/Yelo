const express = require('express');
const request = require('supertest');
const { matchLimiter } = require('./middlewares/rateLimiters');
const matchController = require('./controllers/matchController');
const matchService = require('./services/matchService');

let calculateMatchesCount = 0;
let throwNextTime = false;
const originalCalculateMatches = matchService.calculateMatches;

matchService.calculateMatches = async (prefs) => {
    calculateMatchesCount++;
    await new Promise(r => setTimeout(r, 200)); // Simula latência de Gemini
    if (throwNextTime) {
        throwNextTime = false;
        throw new Error("Erro forçado do Gemini");
    }
    return {
        matchTier: 'ideal',
        results: [{ id: 1, nome: "Psi Teste", matchScore: 100 }],
        compromiseText: "mock"
    };
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
// Remove o Rate Limiter apenas para este teste permitir disparar 15 reqs do mesmo IP
app.post('/api/psychologists/match', matchController.getAnonymousMatches);

async function runTests() {
    console.log("--- INICIANDO TESTES DEFINITIVOS DE CONCORRÊNCIA E SINGLE-FLIGHT ---");

    // Limpa o cache para garantir
    matchController.__testResetCache = () => {};

    // 1. Teste de Thundering Herd (10 requisições idênticas simultâneas)
    console.log("\n1. Disparando 10 requisições simultâneas para o mesmo hash...");
    calculateMatchesCount = 0;
    const promises10 = [];
    const payloadA = { faixa_valor: "R$ 100", temas: ["Ansiedade"] };
    for (let i = 0; i < 10; i++) {
        promises10.push(request(app).post('/api/psychologists/match').send(payloadA));
    }
    const results10 = await Promise.all(promises10);
    const success10 = results10.filter(r => r.status === 200).length;
    console.log(`Sucessos (200): ${success10}/10`);
    console.log(`Chamadas reais ao matchService (Gemini): ${calculateMatchesCount}`);
    if (calculateMatchesCount === 1 && success10 === 10) console.log("✅ Single-Flight funcionou!");

    // 2. Teste A: Hashes diferentes executam independentemente
    console.log("\n2. Disparando 2 requisições simultâneas com hashes diferentes (A e B)...");
    calculateMatchesCount = 0;
    const payloadB1 = { faixa_valor: "R$ 100", temas: ["A1"] };
    const payloadB2 = { faixa_valor: "R$ 100", temas: ["A2"] };
    const pB1 = request(app).post('/api/psychologists/match').send(payloadB1);
    const pB2 = request(app).post('/api/psychologists/match').send(payloadB2);
    await Promise.all([pB1, pB2]);
    console.log(`Chamadas reais ao matchService (Gemini): ${calculateMatchesCount}`);
    if (calculateMatchesCount === 2) console.log("✅ Hashes diferentes não se bloqueiam!");

    // 3. Teste B e C: Erro limpa o InFlight e permite retentativa
    console.log("\n3. Disparando requisição que falha, e logo depois retentando...");
    calculateMatchesCount = 0;
    throwNextTime = true;
    const payloadC = { faixa_valor: "R$ 100", temas: ["Error"] };
    const resFail = await request(app).post('/api/psychologists/match').send(payloadC);
    console.log(`Status da primeira (falha): ${resFail.status}`);
    
    // Retentativa (se o inFlight travou, isso vai ficar pendente ou falhar sem bater no service)
    const resSuccess = await request(app).post('/api/psychologists/match').send(payloadC);
    console.log(`Status da segunda (sucesso): ${resSuccess.status}`);
    console.log(`Chamadas reais ao matchService (Gemini): ${calculateMatchesCount}`);
    
    if (resFail.status === 500 && resSuccess.status === 200 && calculateMatchesCount === 2) {
        console.log("✅ Erros libertam a Promise e permitem retentativa com sucesso!");
    }

    process.exit(0);
}
runTests();
