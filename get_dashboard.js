const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/cmo/dashboard?dateStart=2026-09-01&dateEnd=2026-09-30',
  method: 'GET'
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json.simulator, null, 2));
      console.log(JSON.stringify({
          paidAccessBase: json.platform.b2b.total_active,
          renewableSubscriberBase: json.simulator.renewableSubscriberBase,
          demandEligiblePaidBase: json.simulator.demandEligiblePaidBase,
          cashIn: json.platform.b2b.cashIn,
          renewableMRR: json.platform.b2b.arpu * json.simulator.renewableSubscriberBase
      }, null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
