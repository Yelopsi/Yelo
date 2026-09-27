require('dotenv').config();
const express = require('express');
const cmoRoutes = require('./backend/routes/cmoRoutes');
const app = express();
app.use(express.json());
app.use('/api/cmo', cmoRoutes);

const request = require('supertest');
async function test() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const prev30 = new Date();
        prev30.setDate(prev30.getDate() - 30);
        const prev30Str = prev30.toISOString().split('T')[0];
        const res = await request(app).get(`/api/cmo/dashboard?dateStart=${prev30Str}&dateEnd=${today}`);
        const data = res.body;
        
        console.log("=== VALORES REAIS ===");
        console.log("Base Inicial (platform.b2b.total_active):", data.platform?.b2b?.total_active);
        console.log("ARPU (platform.b2b.arpu):", data.platform?.b2b?.arpu);
        console.log("CAC Meta 90d (simulator.cac):", data.simulator?.cac);
        console.log("CPL Google 90d (simulator.cpl):", data.simulator?.cpl);
        console.log("Trial Conversion 90d (simulator.trialConv):", data.simulator?.trialConv);
        console.log("Média Mensal Histórica Meta (historical.meta.monthly_spend_avg):", data.historical?.meta?.monthly_spend_avg);
        console.log("Smart Cap (3.5x da Média):", (data.historical?.meta?.monthly_spend_avg || 0) * 3.5);
        
        const simRes = await request(app).get('/api/cmo/simulator-settings');
        const sim = simRes.body;
        console.log("Reinvestimento (%):", sim.reinvestRate);
        console.log("Aporte Extra:", sim.extraCash);
        process.exit();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
test();
