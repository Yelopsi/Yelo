const jwt = require('jsonwebtoken');
const db = require('./backend/models');

async function test() {
    try {
        const psi = await db.Psychologist.findOne({ where: { status: 'active' }});
        if (!psi) {
            console.log('No psychologist found.');
            return;
        }
        const token = jwt.sign({ id: psi.id, tipo: 'psi' }, 'a8f5b1e3c9d7a2b4e6f8a0c1d3e5b7a9f0c2d4e6f8a0b1c3d5e7f9a2b4c6d8e0', { expiresIn: '1d' });
        const res = await fetch('http://127.0.0.1:8080/api/psi/me/onboarding', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    } catch (e) {
        console.error('Error:', e);
    }
    process.exit(0);
}
test();
