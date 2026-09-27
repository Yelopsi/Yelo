import re

with open('backend/controllers/adminGrowthController.js', 'r') as f:
    code = f.read()

old_cond = """        else if (group === "sem_demanda_cs") {
            condition = `
                p."subscriptionId" IS NOT NULL 
                AND (p.is_exempt IS NULL OR p.is_exempt = false)
                AND NOT (p."cancelAtPeriodEnd" = true AND p."planExpiresAt" < NOW())
                AND COALESCE(c.total_contacts, 0) = 0
            `;
        }"""

new_cond = """        else if (group === "sem_demanda_cs") {
            condition = `
                p."subscriptionId" IS NOT NULL 
                AND (p.is_exempt IS NULL OR p.is_exempt = false)
                AND NOT (p."cancelAtPeriodEnd" = true AND p."planExpiresAt" < NOW())
                AND COALESCE(c.total_contacts, 0) = 0
                AND p."createdAt" < NOW() - INTERVAL '14 days'
            `;
        }"""

code = code.replace(old_cond, new_cond)

with open('backend/controllers/adminGrowthController.js', 'w') as f:
    f.write(code)

