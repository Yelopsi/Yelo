const db = require('./backend/models');
const controller = require('./backend/controllers/onboardingController.js');

async function test() {
    try {
        const psi = await db.Psychologist.findOne({ where: { status: 'active' }});
        if (!psi) return console.log('No psi');
        
        const req = { user: { id: psi.id } };
        const res = {
            status: (s) => { console.log('Status:', s); return res; },
            json: (data) => console.log('JSON returned:', data)
        };
        
        await controller.getSettings(req, res);
    } catch (e) {
        console.error('Test crashed:', e);
    }
    process.exit(0);
}
test();
