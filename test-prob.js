require('dotenv').config();
const seoService = require('./backend/services/seoService');
async function test() {
    try {
        const res = await seoService.generateTrialProbabilities([{id:1, fotoUrl:'foo.jpg', sobre:'test', abordagem:'test', crp:'123', preco:'100', clickCount: 2}]);
        console.log("RES:", res);
    } catch(e) { console.error("ERR:", e); }
}
test();
