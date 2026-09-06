const db = require('./backend/models');

async function testWaitlistLocal() {
    const count = await db.WaitingList.count({ where: { status: 'pending' } });
    console.log("Local Pending Waiting List Count:", count);
    
    if (count > 0) {
        const rawWaitingList = await db.WaitingList.findAll({ where: { status: 'pending' }, raw: true });
        console.log("Local Pending Waiting List:", rawWaitingList);
    }
    
    process.exit(0);
}
testWaitlistLocal().catch(console.error);
