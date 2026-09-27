const { Client } = require('pg');

async function test() {
    const client = new Client({
        connectionString: process.env.DB_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        const q1 = `
            SELECT 
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                ) as paid_access_base,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND ("fotoUrl" IS NOT NULL AND "fotoUrl" NOT LIKE '%placehold.co%')
                    AND ("bio" IS NOT NULL AND LENGTH("bio") >= 10)
                ) as demand_eligible_paid_base
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
        `;
        const res1 = await client.query(q1);
        const paidAccessBase = parseInt(res1.rows[0].paid_access_base || 0);
        const demandEligiblePaidBase = parseInt(res1.rows[0].demand_eligible_paid_base || 0);
        
        console.log(`paidAccessBase: ${paidAccessBase}`);
        console.log(`demandEligiblePaidBase: ${demandEligiblePaidBase}`);
        console.log(`demandEligiblePaidBase <= paidAccessBase? ${demandEligiblePaidBase <= paidAccessBase}`);
        
        const q2 = `
            SELECT SUM(value) as cash_in FROM "Payments" 
            WHERE status IN ('CONFIRMED', 'RECEIVED') 
        `;
        const res2 = await client.query(q2);
        const cashIn = parseFloat(res2.rows[0].cash_in || 0);
        console.log(`cashIn: ${cashIn}`);

    } catch(e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

test();
