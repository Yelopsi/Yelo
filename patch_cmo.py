import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

# 1. Google Spend 90d fix
# Original: const googleSpend90 = getTargetSpend(googleCampaigns90, 'Yelo MVP - Busca SP', true);
google_90d_patch = """
            // Correção: Gasto Google REAL de 90 dias lido do banco (ManualAdMetrics)
            const googleManual90 = await db.ManualAdMetric.findAll({
                where: { platform: 'google', dateEnd: { [Op.gte]: dateStart90Str } }
            });
            const googleSpend90 = googleManual90.reduce((acc, curr) => acc + parseFloat(curr.spend), 0);
"""
code = re.sub(r'const googleSpend90 = getTargetSpend\(googleCampaigns90, \'Yelo MVP - Busca SP\', true\);', google_90d_patch, code)

# 2. Meta Ads Fallback (STALE / UNAVAILABLE)
# Find histMetaMonthlySpendAvg
meta_fallback_patch = """
        let histMetaMonthlySpend = getTargetSpend(histMetaCampaigns, '120251213168140531', false);
        let histMetaMonths = Math.max(1, (new Date(dateEnd) - new Date('2026-05-01')) / (1000 * 60 * 60 * 24 * 30));
        let histMetaMonthlySpendAvg = histMetaMonthlySpend / histMetaMonths;

        let metaState = 'VALID';
        let metaStateDate = null;
        if (!histMetaCampaigns || histMetaCampaigns.length === 0 || histMetaMonthlySpend === 0) {
            const fallbackMeta = await db.ManualAdMetric.findOne({
                where: { platform: 'meta' },
                order: [['createdAt', 'DESC']]
            });
            if (fallbackMeta) {
                metaState = 'STALE';
                metaStateDate = fallbackMeta.updatedAt;
                histMetaMonthlySpendAvg = parseFloat(fallbackMeta.spend) || 0;
            } else {
                metaState = 'UNAVAILABLE';
                // Premissa explícita conservadora caso não haja histórico nem API
                histMetaMonthlySpendAvg = 3000; 
            }
        }
"""
code = re.sub(r'let histMetaMonthlySpend = getTargetSpend\(histMetaCampaigns.*?let histMetaMonthlySpendAvg = histMetaMonthlySpend / histMetaMonths;', meta_fallback_patch, code, flags=re.DOTALL)

# 3. Known Scheduled Churn & Active Bases
bases_patch = """
            const activePaidQuery = `
              SELECT 
                SUM(CASE WHEN ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW() AND "cancelAtPeriodEnd" = false) THEN 1 ELSE 0 END) as renewable_base,
                COUNT(*) as paid_access_base
              FROM "Psychologists"
              WHERE "deletedAt" IS NULL
              AND (
                ("subscriptionId" IS NOT NULL AND "planExpiresAt" > NOW()) OR
                ("subscriptionId" IS NULL AND "planExpiresAt" > NOW() AND "subscription_payments_count" > 0)
              )
            `;
            const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
            const renewableSubscriberBase = parseInt(activePaidRes.renewable_base || 0);
            const activePaidAccessBase = parseInt(activePaidRes.paid_access_base || 0);
            const knownScheduledChurn = activePaidAccessBase - renewableSubscriberBase;

            // Churn assumido fixo por enquanto (0.05)
            simChurn = 0.05;
            const simChurnType = 'ASSUMED';
"""
code = re.sub(r'// Converter churn de 90 dias para mensal.*?simChurn = .*?;', bases_patch, code, flags=re.DOTALL)

# 4. Modify payload
payload_patch = """
            simulator: {
                cac: simMetaCac,
                cpl: simGoogleCpl,
                trialConv: simTrialConv,
                churn: simChurn,
                churnType: simChurnType,
                knownScheduledChurn,
                renewableSubscriberBase,
                activePaidAccessBase
            },
"""
code = re.sub(r'simulator: \{.*?churn: simChurn\n\s*\},', payload_patch, code, flags=re.DOTALL)

# 5. Modify Meta Payload for State
historical_patch = """
            historical: {
                meta: { spend: metaSpendHistorical.spend, monthly_spend_avg: histMetaMonthlySpendAvg, cac: histMetaCac, paybackMonths: histMetaPaybackMonths, churn_rate: histGlobalChurnRate, trial_conversion_rate: histConversionRate, state: metaState, stateDate: metaStateDate },
"""
code = re.sub(r'historical: \{\n\s*meta: \{ spend: metaSpendHistorical.spend, monthly_spend_avg: histMetaMonthlySpendAvg, cac: histMetaCac, paybackMonths: histMetaPaybackMonths, churn_rate: histGlobalChurnRate, trial_conversion_rate: histConversionRate \},', historical_patch, code)

with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

print("CMO Routes patched successfully!")
