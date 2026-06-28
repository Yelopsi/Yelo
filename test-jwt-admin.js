require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('./backend/models');

async function test() {
  try {
    const adminId = 1;
    const token = jwt.sign({ id: adminId, type: 'admin' }, process.env.JWT_SECRET);
    
    console.log("Testing /me/stats as admin...");
    const statsRes = await fetch('http://127.0.0.1:3001/api/psychologists/me/stats?period=last7days', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Stats status:", statsRes.status);
    const statsData = await statsRes.text();
    console.log("Stats body:", statsData.substring(0, 200));

    console.log("Testing /appointments as admin...");
    const apptRes = await fetch('http://127.0.0.1:3001/api/appointments', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("Appts status:", apptRes.status);
    const apptData = await apptRes.text();
    console.log("Appts body:", apptData.substring(0, 200));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
test();
