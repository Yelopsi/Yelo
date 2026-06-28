async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/psychologists/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@yelo.com', password: 'password' })
    });
    const loginData = await loginRes.json();
    console.log("Login token:", loginData.token ? "YES" : "NO");
    if (!loginData.token) return;

    console.log("Testing /me/stats...");
    const statsRes = await fetch('http://localhost:3001/api/psychologists/me/stats?period=last7days', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    console.log("Stats status:", statsRes.status);
    const statsData = await statsRes.text();
    console.log("Stats body:", statsData);

    console.log("Testing /appointments...");
    const apptRes = await fetch('http://localhost:3001/api/appointments', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    console.log("Appts status:", apptRes.status);
    const apptData = await apptRes.text();
    console.log("Appts body:", apptData);
  } catch (err) {
    console.error(err);
  }
}
test();
