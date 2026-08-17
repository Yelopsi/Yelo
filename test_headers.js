const request = require('supertest');
const app = require('./backend/server');
request(app).get('/favicon.ico').set('X-Forwarded-Proto', 'https').end((err, res) => {
    console.log(res.headers);
    process.exit(0);
});
