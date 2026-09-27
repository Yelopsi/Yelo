const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

// The simulator block declares:
// let renewableSubscriberBase = 0;
// let activePaidAccessBase = 0;
// We can just use the outer ones, but they are declared with `const` and `let` outside. Let's look.
// `const paidAccessBase = globalPaidRes.length;`
// `let renewableSubscriberBase = 0;` (around line 252)

content = content.replace(/let renewableSubscriberBase = 0;\s*let activePaidAccessBase = 0;\s*let knownScheduledChurn = 0;/g, "let knownScheduledChurn = 0;");

// Fix the activePaidQuery
const badQuery = `            const activePaidQuery = \`
              SELECT 
                SUM(CASE WHEN ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false) THEN 1 ELSE 0 END) as renewable_base,
                COUNT(*) as paid_access_base
              FROM "Psychologists"
              WHERE "deletedAt" IS NULL
              AND (
                ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR
                ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0)
              )
            \`;
            const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
            renewableSubscriberBase = parseInt(activePaidRes.renewable_base || 0);
            activePaidAccessBase = parseInt(activePaidRes.paid_access_base || 0);
            knownScheduledChurn = activePaidAccessBase - renewableSubscriberBase;`;

const newQuery = `            const activePaidQuery = \`
              SELECT 
                SUM(CASE WHEN ("cancelAtPeriodEnd" = true) THEN 1 ELSE 0 END) as scheduled_churn
              FROM "Psychologists" p
              LEFT JOIN "Subscriptions" s ON p."subscriptionId" = s.id
              WHERE p."deletedAt" IS NULL
              AND p."planExpiresAt" > NOW()
              AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
            \`;
            const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
            knownScheduledChurn = parseInt(activePaidRes.scheduled_churn || 0);`;

content = content.replace(badQuery, newQuery);

fs.writeFileSync(path, content);
