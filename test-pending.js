require('dotenv').config();
const db = require('./backend/models');
const controller = require('./backend/controllers/adminUsersController');

(async () => {
  try {
    const req = {};
    const res = {
      json: (data) => console.log(JSON.stringify(data, null, 2)),
      status: (code) => ({ json: (data) => console.log('STATUS', code, data) }),
      send: (data) => console.log('SEND', data)
    };
    await controller.getPendingActions(req, res);
  } catch(e) {
    console.error('ERROR:', e);
  } finally {
    process.exit(0);
  }
})();
