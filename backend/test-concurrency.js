const express = require('express');
const request = require('supertest');
const { matchLimiter } = require('./middlewares/rateLimiters');
const matchController = require('./controllers/matchController');
const matchService = require('./services/matchService');

// Decorate matchService to count calls
let calculateMatchesCount = 0;
const originalCalculateMatches = matchService.calculateMatches;
matchService.calculateMatches = async (prefs) => {
    calculateMatchesCount++;
    // simulate a delay so other concurrent requests hit the controller before this resolves
    await new Promise(r => setTimeout(r, 200));
    return {
        matchTier: 'ideal',
        results: [{ id: 1, nome: "Psi Teste", matchScore: 100 }],
        compromiseText: "mock"
    };
};

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.post('/api/psychologists/match', matchLimiter, matchController.getAnonymousMatches);

async function runTests() {
    console.log("--- INICIANDO TESTE DE CONCORRÊNCIA ---");
    const payload = {
        faixa_valor: "R$ 100",
        temas: ["Teste Concorrente"],
        pref_genero_prof: "qualquer",
        modalidade_atendimento: "online"
    };

    // We send 5 requests at the exact same time
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(request(app).post('/api/psychologists/match').send(payload));
    }
    
    console.log(`Disparando ${promises.length} requisições simultâneas para o mesmo payload...`);
    const results = await Promise.all(promises);
    
    let successCount = 0;
    results.forEach(r => {
        if (r.status === 200) successCount++;
    });

    console.log(`Sucessos (200): ${successCount}`);
    console.log(`Chamadas reais ao matchService (Gemini): ${calculateMatchesCount}`);
    
    if (calculateMatchesCount > 1) {
        console.log("❌ CONCORRÊNCIA VAZADA! O Cache não possui Single-Flight (In-Flight deduplication).");
    } else {
        console.log("✅ Concorrência protegida.");
    }
    process.exit(0);
}
runTests();
