const request = require('supertest');
const app = require('./backend/server');
(async () => {
    for (let i = 0; i < 12; i++) {
        const res = await request(app).post('/api/auth/login').send({ email: 'test@test.com', password: '123' });
        console.log(i, res.status, res.body);
    }
    process.exit(0);
})();
