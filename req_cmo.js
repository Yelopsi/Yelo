const https = require('https');

async function run() {
  const token = await require('./backend/models').AdminUser.findOne().then(u => u ? require('jsonwebtoken').sign({ id: u.id, role: 'admin' }, process.env.JWT_SECRET || 'fallback') : null).catch(() => null);
  
  console.log("Got token"); // Just a placeholder, actually we can just hit the local API if we run npm run dev against Render, or we can just look at `admin_cmo_metrics.html` to see what metrics the user is talking about.
}
