const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: process.env.DB_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    
    // The 30 users:
    const q30 = `
        SELECT p.id, p."planExpiresAt", p."subscriptionId", s.status, s.plan, p."cancelAtPeriodEnd", p."firstPaidAt", p."subscription_payments_count"
        FROM "Psychologists" p
        LEFT JOIN "Subscriptions" s ON p."subscriptionId" = s.id
        WHERE p."deletedAt" IS NULL
        AND (p."is_exempt" IS NULL OR p."is_exempt" = false)
        AND p."planExpiresAt" > NOW()
        AND (p."subscriptionId" IS NOT NULL OR p."firstPaidAt" IS NOT NULL OR p."subscription_payments_count" > 0)
    `;
    const res30 = await client.query(q30);
    const all30 = res30.rows;
    
    let renewable = 0;
    let scheduledChurn = 0;
    let nonRecurring = 0;
    let inactiveSub = 0;

    all30.forEach(row => {
        const isRenewable = row.status === 'ACTIVE' && row.cancelAtPeriodEnd !== true;
        if (isRenewable) renewable++;
        else {
            if (row.cancelAtPeriodEnd === true) scheduledChurn++;
            else if (row.status && row.status !== 'ACTIVE') inactiveSub++;
            else if (!row.status) nonRecurring++;
        }
    });

    console.log(`Renewable: ${renewable}`);
    console.log(`Scheduled Churn: ${scheduledChurn}`);
    console.log(`Inactive Sub but still valid plan: ${inactiveSub}`);
    console.log(`Non-recurring (firstPaidAt/payments_count but no Sub): ${nonRecurring}`);
    
    await client.end();
}

check().catch(console.error);
