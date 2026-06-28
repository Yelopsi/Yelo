const axios = require('axios');
async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3001/api/psychologists/login', {
      email: 'admin@yelo.com', // guess an email, or maybe we don't know it. Let's try to query db for a psi email.
      password: 'password'
    });
  } catch (err) {
    console.error(err.message);
  }
}
test();
