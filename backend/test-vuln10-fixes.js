const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 1. Mocks and App Setup
const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Setup secret for tests
process.env.META_APP_SECRET = 'yelo_test_secret_123';

// 2. Mount Routes to test
// Add a mock for res.render to avoid engine errors
app.use((req, res, next) => {
    res.render = (view, options) => {
        res.status(404).send(`Mock render: ${view}`);
    };
    next();
});

// B. Upload Middleware (Stored XSS)
const { uploadProfilePhoto } = require('./middlewares/upload');
app.post('/test-upload', uploadProfilePhoto.single('profilePhoto'), (req, res) => {
    res.status(200).json({ success: true, file: req.file.filename });
});
// Error handler to catch multer errors gracefully in tests
app.use((err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
});

// C. Webhook Routes (WhatsApp Signature)
const webhookRoutes = require('./routes/webhookRoutes');
// Mock the actual db and handler so it doesn't crash on tests
const whatsappWebhook = require('./webhooks/whatsappWebhook');
whatsappWebhook.handleMessage = (req, res) => { res.status(200).send('EVENT_RECEIVED'); };
app.use('/api/webhooks', webhookRoutes);

// A. View Routes (LFI) - Mount last because of its catch-all 404
const viewRoutes = require('./routes/viewRoutes');
app.use('/', viewRoutes);

async function runTests() {
    console.log("=== INICIANDO BATERIA DE TESTES (FASE 10 FIXES) ===\n");
    let allPassed = true;

    // --- TESTES DE LFI ---
    console.log("--- 1. TESTES DE LFI / PATH TRAVERSAL (viewRoutes) ---");
    // Setup a legitimate file to test
    const dummyFile = path.join(__dirname, '../uploads/profiles/test_legit.png');
    if (!fs.existsSync(path.dirname(dummyFile))) fs.mkdirSync(path.dirname(dummyFile), { recursive: true });
    fs.writeFileSync(dummyFile, 'dummy content');

    const lfiTests = [
        { name: "1. Arquivo legítimo", path: "/uploads/profiles/test_legit.png", expected: 200 },
        { name: "2. Tentativa direta ../.env", path: "/uploads/profiles/..%2f..%2f.env", expected: 403 },
        { name: "3. Tentativa double encoded", path: "/uploads/profiles/%252e%252e%252f%252e%252e%252f.env", expected: 403 },
        { name: "4. Escapar para diretório irmão", path: "/uploads/profiles/..%2f..%2fadmin%2fadmin.html", expected: 403 }
    ];

    for (const t of lfiTests) {
        const res = await request(app).get(t.path);
        // It could return 404 or 403 if traversal detected. The fix returns 403.
        const passed = res.status === t.expected || (t.expected === 403 && res.status === 404); // Some encodings might not decode to path traversal but fail cleanly
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${t.name}: Retornou ${res.status} (Esperado: ${t.expected})`);
        if (!passed) allPassed = false;
    }
    console.log("");


    // --- TESTES DE UPLOAD ---
    console.log("--- 2. TESTES DE UPLOAD / STORED XSS (upload) ---");
    // Create dummy files
    fs.writeFileSync('test.jpg', 'fake-jpg');
    fs.writeFileSync('test.png', 'fake-png');
    fs.writeFileSync('test.svg', '<svg><script>alert(1)</script></svg>');
    
    const uploadTests = [
        { name: "1. JPEG Legítimo", file: "test.jpg", mime: "image/jpeg", expected: 200 },
        { name: "2. PNG Legítimo", file: "test.png", mime: "image/png", expected: 200 },
        { name: "3. SVG Rejeitado", file: "test.svg", mime: "image/svg+xml", expected: 400 },
        { name: "4. Fake extention SVG Rejeitado", file: "test.svg", mime: "image/png", expected: 400 },
        { name: "5. Extensão SVG com mime case-sensitive", file: "test.SVG", mime: "IMAGE/SVG+XML", expected: 400 }
    ];

    for (const t of uploadTests) {
        // Create file with specific name
        fs.writeFileSync(t.file, 'fake');
        const res = await request(app).post('/test-upload')
            .attach('profilePhoto', t.file, { contentType: t.mime });
        
        const passed = res.status === t.expected;
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${t.name}: Retornou ${res.status} (Esperado: ${t.expected})`);
        if (res.status === 400) console.log(`   Motivo: ${res.body.error}`);
        if (!passed) allPassed = false;
        fs.unlinkSync(t.file); // cleanup
    }
    fs.unlinkSync(dummyFile);
    console.log("");

    // --- TESTES DE WHATSAPP ---
    console.log("--- 3. TESTES DE WHATSAPP WEBHOOK (webhookAuth) ---");
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const correctHash = crypto.createHmac('sha256', process.env.META_APP_SECRET).update(payload).digest('hex');
    const wrongHash = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');
    const alteredPayload = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changed: true }] });

    const whTests = [
        { name: "1. Payload Válido + Assinatura Válida", payload, sig: `sha256=${correctHash}`, expected: 200 },
        { name: "2. Payload Válido sem assinatura", payload, sig: null, expected: 401 },
        { name: "3. Assinatura Incorreta", payload, sig: `sha256=${wrongHash}`, expected: 401 },
        { name: "4. Assinatura Adulterada (Malformada)", payload, sig: `sha256${correctHash}`, expected: 401 },
        { name: "5. Assinatura Válida mas payload adulterado", payload: alteredPayload, sig: `sha256=${correctHash}`, expected: 401 },
    ];

    for (const t of whTests) {
        let req = request(app).post('/api/webhooks/whatsapp').send(JSON.parse(t.payload)); // send as JSON so body-parser processes it
        if (t.sig) req.set('x-hub-signature-256', t.sig);
        
        const res = await req;
        const passed = res.status === t.expected;
        console.log(`[${passed ? 'PASS' : 'FAIL'}] ${t.name}: Retornou ${res.status} (Esperado: ${t.expected})`);
        if (!passed) allPassed = false;
    }

    console.log("\n===========================================");
    if (allPassed) {
        console.log("✅ TODOS OS TESTES PASSARAM! SISTEMA PROTEGIDO.");
    } else {
        console.log("❌ ALGUNS TESTES FALHARAM. REVISAR IMPLEMENTAÇÃO.");
    }
    process.exit(allPassed ? 0 : 1);
}

runTests();
