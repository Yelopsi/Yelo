const express = require('express');
const app = express();
const cmoRoutes = require('./backend/routes/cmoRoutes');

app.use((req, res, next) => {
    req.user = { role: 'admin' };
    next();
});

app.use('/api/cmo', cmoRoutes);

app.listen(3003, async () => {
    try {
        const fetch = require('node-fetch');
        const res = await fetch('http://localhost:3003/api/cmo/dashboard?dateStart=2026-09-01&dateEnd=2026-09-30');
        const text = await res.text();
        console.log("RESPONSE:", text);
    } catch (e) {
        console.error("ERROR:", e);
    }
    process.exit(0);
});
