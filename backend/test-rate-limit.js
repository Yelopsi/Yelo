const express = require('express');
const request = require('supertest');
const { emailSpamLimiter, adminLimiter, authLimiter } = require('./middlewares/rateLimiters');

// Mock db for testing
const db = require('./models');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());

// Routes to test
app.post('/api/login-admin-check', adminLimiter, (req, res) => res.json({ success: true }));
app.post('/api/auth/google', authLimiter, (req, res) => res.json({ success: true }));

// Identify-user (using same logic as route)
app.post('/api/auth/identify-user', emailSpamLimiter, (req, res) => res.json({ type: 'unified' }));

async function runTests() {
    console.log("--- TESTANDO /api/login-admin-check (Admin Limiter) ---");
    for (let i = 1; i <= 6; i++) {
        const res = await request(app)
            .post('/api/login-admin-check')
            .set('X-Forwarded-For', '10.0.0.1');
        console.log(`Req ${i}: Status ${res.status}`);
    }
    const resAdminDiff = await request(app)
        .post('/api/login-admin-check')
        .set('X-Forwarded-For', '10.0.0.2');
    console.log(`Req c/ IP diferente: Status ${resAdminDiff.status}`);

    console.log("\n--- TESTANDO /api/auth/google (Auth Limiter) ---");
    for (let i = 1; i <= 16; i++) {
        const res = await request(app)
            .post('/api/auth/google')
            .set('X-Forwarded-For', '20.0.0.1');
        if (i >= 14) console.log(`Req ${i}: Status ${res.status}`);
    }
    const resAuthDiff = await request(app)
        .post('/api/auth/google')
        .set('X-Forwarded-For', '20.0.0.2');
    console.log(`Req c/ IP diferente: Status ${resAuthDiff.status}`);

    console.log("\n--- TESTANDO /api/auth/identify-user (Enumeração + Limiter) ---");
    const resId1 = await request(app)
        .post('/api/auth/identify-user')
        .send({ email: 'inexistente@teste.com' })
        .set('X-Forwarded-For', '30.0.0.1');
    console.log(`Req Email Inexistente: Status ${resId1.status}, Body:`, resId1.body);
    
    for (let i = 2; i <= 6; i++) {
        const res = await request(app)
            .post('/api/auth/identify-user')
            .set('X-Forwarded-For', '30.0.0.1');
        if (i === 6) console.log(`Req ${i} (estourando limite): Status ${res.status}`);
    }
}

runTests().then(() => console.log("Testes concluídos.")).catch(console.error);
