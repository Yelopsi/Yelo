require('dotenv').config({ path: '/Users/andehrson/Yelo/.env' });
async function test() {
    let url = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
    if (url.includes('sandbox.asaas.com') && !url.includes('/api')) {
        url = url.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
    }
    const res = await fetch(`${url}/subscriptions?status=ACTIVE`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
    const data = await res.json();
    if (!data.data || data.data.length === 0) return console.log('No subs');
    
    // Pick the first sub
    const sub = data.data[0];
    console.log("Sub:", sub.id, "Customer:", sub.customer);
    
    // Fetch payments for this sub
    const pRes = await fetch(`${url}/payments?subscription=${sub.id}`, { headers: { 'access_token': process.env.ASAAS_API_KEY } });
    const pData = await pRes.json();
    console.log("Payments:", pData.data.map(p => ({ id: p.id, status: p.status, dueDate: p.dueDate })));
}
test().catch(console.error);
