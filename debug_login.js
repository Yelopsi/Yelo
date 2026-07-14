const { db } = require('./backend/models');
const auth = require('./backend/controllers/psiAuthController');

async function test() {
  const req = { body: { email: 'test@test.com', password: 'test' } };
  const res = {
    status: (code) => { console.log('Status:', code); return res; },
    json: (data) => { console.log('JSON:', data); return res; },
    cookie: () => {}
  };
  
  await auth.loginPsychologist(req, res);
}
test();
