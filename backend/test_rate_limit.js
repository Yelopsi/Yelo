const express = require('express');
const request = require('supertest');
const { authLimiter, adminLimiter, emailSpamLimiter, registerLimiter } = require('./middlewares/rateLimiters');

const app = express();
app.set('trust proxy', 1);

app.post('/auth', authLimiter, (req, res) => res.send('ok'));
app.post('/admin', adminLimiter, (req, res) => res.send('ok'));
app.post('/email', emailSpamLimiter, (req, res) => res.send('ok'));
app.post('/register', registerLimiter, (req, res) => res.send('ok'));

async function runTest() {
    console.log("Testing authLimiter (15 max)");
    for(let i=1; i<=16; i++) {
        const res = await request(app).post('/auth').set('X-Forwarded-For', '1.1.1.1');
        if (i===15 && res.status !== 200) console.log(`ERROR: Request 15 should pass. Got ${res.status}`);
        if (i===16 && res.status === 429) console.log(`SUCCESS: Request 16 blocked (429) with: ${JSON.stringify(res.body)}`);
    }

    console.log("\nTesting adminLimiter (5 max)");
    for(let i=1; i<=6; i++) {
        const res = await request(app).post('/admin').set('X-Forwarded-For', '2.2.2.2');
        if (i===5 && res.status !== 200) console.log(`ERROR: Request 5 should pass. Got ${res.status}`);
        if (i===6 && res.status === 429) console.log(`SUCCESS: Request 6 blocked (429) with: ${JSON.stringify(res.body)}`);
    }

    console.log("\nTesting emailSpamLimiter (5 max)");
    for(let i=1; i<=6; i++) {
        const res = await request(app).post('/email').set('X-Forwarded-For', '3.3.3.3');
        if (i===5 && res.status !== 200) console.log(`ERROR: Request 5 should pass. Got ${res.status}`);
        if (i===6 && res.status === 429) console.log(`SUCCESS: Request 6 blocked (429) with: ${JSON.stringify(res.body)}`);
    }

    console.log("\nTesting registerLimiter (5 max)");
    for(let i=1; i<=6; i++) {
        const res = await request(app).post('/register').set('X-Forwarded-For', '4.4.4.4');
        if (i===5 && res.status !== 200) console.log(`ERROR: Request 5 should pass. Got ${res.status}`);
        if (i===6 && res.status === 429) console.log(`SUCCESS: Request 6 blocked (429) with: ${JSON.stringify(res.body)}`);
    }

    console.log("\nTesting IP Separation on authLimiter");
    const resDifferentIp = await request(app).post('/auth').set('X-Forwarded-For', '9.9.9.9');
    if (resDifferentIp.status === 200) console.log(`SUCCESS: Different IP got 200!`);
    else console.log(`ERROR: Different IP got ${resDifferentIp.status}`);
}

runTest().then(() => process.exit(0));
