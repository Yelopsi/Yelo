WITH RecentContacts AS (
    SELECT "psychologistId", COUNT(*) as total_contacts
    FROM "WhatsAppClickLogs"
    WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY "psychologistId"
),
PsiStats AS (
    SELECT 
        p.id, p.nome, p.status, p.plano, p."planExpiresAt", p."createdAt",
        COALESCE(c.total_contacts, 0) as contacts_last_30_days,
        CASE
            WHEN COALESCE(c.total_contacts, 0) = 0 THEN '0 contatos'
            WHEN COALESCE(c.total_contacts, 0) BETWEEN 1 AND 2 THEN '1-2 contatos'
            WHEN COALESCE(c.total_contacts, 0) BETWEEN 3 AND 5 THEN '3-5 contatos'
            ELSE '6+ contatos'
        END as contact_group
    FROM "Psychologists" p
    LEFT JOIN RecentContacts c ON p.id = c."psychologistId"
    WHERE p."deletedAt" IS NULL AND (p.status = 'active' OR p.status = 'inactive')
)
SELECT 
    contact_group,
    COUNT(*) as total_psis,
    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_psis,
    SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as churned_psis,
    ROUND(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as churn_rate
FROM PsiStats
GROUP BY contact_group
ORDER BY contact_group;
