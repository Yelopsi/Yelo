require('dotenv').config();
const jwt = require('jsonwebtoken');

async function testEndpoints() {
    try {
        const token = jwt.sign({ id: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const headers = { 'Authorization': `Bearer ${token}` };

        console.log("Fetching production /api/admin/pending-actions...");
        const resPending = await fetch('https://www.yelopsi.com.br/api/admin/pending-actions', { headers });
        const pendingData = await resPending.json();
        
        const karimPending = pendingData.pendingList ? pendingData.pendingList.find(p => p.id === 245) : null;
        if (karimPending) {
            console.log("Karim in Follow-ups:", karimPending.metrics);
        } else {
            console.log("Karim NOT found in Follow-ups!");
        }

        console.log("\nFetching production /api/admin/psychologists/245/full-details...");
        const resDetails = await fetch('https://www.yelopsi.com.br/api/admin/psychologists/245/full-details', { headers });
        const detailsData = await resDetails.json();
        
        console.log("Karim Details stats:", detailsData.stats || detailsData);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testEndpoints();
