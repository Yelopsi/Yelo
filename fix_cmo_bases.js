const fs = require('fs');
const path = '/Users/andehrson/SITES/Yelo/backend/routes/cmoRoutes.js';
let content = fs.readFileSync(path, 'utf8');

// The old global active query block:
const oldQuery = `        const globalActiveQuery = \`
            SELECT 
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                ) as paid_access_base,
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL AND "fotoUrl" NOT LIKE '%placehold.co%')
                    AND ("bio" IS NOT NULL AND LENGTH("bio") >= 10)
                ) as demand_eligible_paid_base,
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                ) as total_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
        \`;
        const [globalActiveRes] = await sequelize.query(globalActiveQuery, { type: sequelize.QueryTypes.SELECT });
        
        const paidAccessBase = parseInt(globalActiveRes.paid_access_base || 0);
        const demandEligiblePaidBase = parseInt(globalActiveRes.demand_eligible_paid_base || 0);
        const totalActive = paidAccessBase;
        const totalTrials = parseInt(globalActiveRes.total_trials || 0);`;

const newQuery = `        const matchService = require('../services/matchService');
        
        const globalPaidQuery = \`
            SELECT * FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND "planExpiresAt" > NOW()
            AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
        \`;
        const globalPaidRes = await sequelize.query(globalPaidQuery, { type: sequelize.QueryTypes.SELECT });
        
        const paidAccessBase = globalPaidRes.length;
        const demandEligiblePaidBase = globalPaidRes.filter(p => matchService.isEligibleForMatch(p)).length;
        const totalActive = paidAccessBase;

        const globalTrialsQuery = \`
            SELECT COUNT(*) as total_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
            AND "planExpiresAt" > NOW()
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
        \`;
        const [globalTrialsRes] = await sequelize.query(globalTrialsQuery, { type: sequelize.QueryTypes.SELECT });
        const totalTrials = parseInt(globalTrialsRes.total_trials || 0);`;

content = content.replace(oldQuery, newQuery);

fs.writeFileSync(path, content);
