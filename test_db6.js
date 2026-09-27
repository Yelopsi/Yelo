const { sequelize } = require('./backend/models');
const { getTargetSpend } = require('./backend/services/metaAdsService');
// Mocking the required logic to just fetch the B2B queries used in CMO Routes
async function fetchRealValues() {
    const today = new Date();
    const dateEnd = today.toISOString().split('T')[0];
    const dateStart = new Date(today);
    dateStart.setDate(dateStart.getDate() - 30); // usually 30 days filter
    const dateStartStr = dateStart.toISOString().split('T')[0];
    
    // 1. Base Inicial
    const globalActiveQuery = `
        SELECT 
            COUNT(*) FILTER (
                WHERE status = 'active'
                AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                AND "planExpiresAt" > NOW()
                AND ("cancelAtPeriodEnd" IS NULL OR "cancelAtPeriodEnd" = false)
            ) as total_active
        FROM "Psychologists"
        WHERE status IN ('pending', 'active')
    `;
    const [globalActiveRes] = await sequelize.query(globalActiveQuery, { type: sequelize.QueryTypes.SELECT });
    const baseInicial = parseInt(globalActiveRes.total_active || 0);

    // 2. ARPU
    const arpuQuery = `
        SELECT AVG(valor_sessao_numero) as arpu
        FROM "Psychologists"
        WHERE status = 'active' AND valor_sessao_numero > 0
    `;
    const [arpuRes] = await sequelize.query(arpuQuery, { type: sequelize.QueryTypes.SELECT });
    const arpu = parseFloat(arpuRes.arpu || 100);

    // 3. Historical Meta Monthly Spend Avg
    const metaSpendHistQuery = `
        SELECT 
            SUM(amount) as spend
        FROM "AdSpends"
        WHERE platform = 'meta'
        AND "campaignId" = '120251213168140531'
    `;
    const [metaSpendHistRes] = await sequelize.query(metaSpendHistQuery, { type: sequelize.QueryTypes.SELECT });
    const histMetaSpendVal = parseFloat(metaSpendHistRes.spend || 0);
    const startOfTime = new Date('2026-05-01T00:00:00Z');
    const endOfPeriod = new Date(dateEnd + 'T23:59:59Z');
    const histDays = Math.max(1, Math.ceil(Math.abs(endOfPeriod - startOfTime) / (1000 * 60 * 60 * 24)));
    const histMonths = histDays / 30;
    const histMetaMonthlySpendAvg = histMonths > 0 ? (histMetaSpendVal / histMonths) : 0;
    
    // 4. Trial Conversion (90d)
    const dateEnd90 = new Date();
    const dateStart90 = new Date(dateEnd90);
    dateStart90.setDate(dateStart90.getDate() - 90);
    const dateStart90Str = dateStart90.toISOString().split('T')[0];
    
    const b2bQuery90 = `
        SELECT 
            COUNT(*) FILTER (WHERE status = 'active' AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)) as pagantes,
            COUNT(*) FILTER (WHERE status IN ('pending', 'active') AND "subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))) as trials,
            COUNT(*) FILTER (WHERE status = 'inactive' AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL) AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))) as failed_trials
        FROM "Psychologists"
        WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        AND "deletedAt" IS NULL
        AND (
            utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
            OR first_utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
        )
    `;
    const [metaMetrics90Res] = await sequelize.query(b2bQuery90, {
        replacements: { dateStart: dateStart90Str, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
    });
    const metaPagantes90 = parseInt(metaMetrics90Res.pagantes || 0);
    const metaTrials90 = parseInt(metaMetrics90Res.trials || 0);
    const metaFailedTrials90 = parseInt(metaMetrics90Res.failed_trials || 0);
    const totalOportunidades90 = metaPagantes90 + metaTrials90 + metaFailedTrials90;
    const trialConversion = totalOportunidades90 > 0 ? (metaPagantes90 / totalOportunidades90) : 0.15;
    
    // 5. CPL (90d)
    const b2cQuery90 = `
        SELECT 
            SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks
        FROM "WhatsAppClickLogs"
        WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
    `;
    const [googleMetrics90Res] = await sequelize.query(b2cQuery90, {
        replacements: { dateStart: dateStart90Str, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
    });
    const googleWppClicks90 = parseInt(googleMetrics90Res.google_wpp_clicks || 0);
    // Google spend 90d mock
    const googleSpend90Query = `
        SELECT SUM(amount) as spend FROM "AdSpends"
        WHERE platform = 'google' AND "date" >= :dateStart AND "date" <= :dateEnd
    `;
    const [googleSpend90Res] = await sequelize.query(googleSpend90Query, {
        replacements: { dateStart: dateStart90Str, dateEnd: dateEnd }, type: sequelize.QueryTypes.SELECT
    });
    const googleSpend90 = parseFloat(googleSpend90Res.spend || 0);
    const cplGoogle = googleWppClicks90 > 0 ? (googleSpend90 / googleWppClicks90) : 40;
    
    // Meta CAC (90d)
    const metaSpend90Query = `
        SELECT SUM(amount) as spend FROM "AdSpends"
        WHERE platform = 'meta' AND "campaignId" = '120251213168140531' AND "date" >= :dateStart AND "date" <= :dateEnd
    `;
    const [metaSpend90Res] = await sequelize.query(metaSpend90Query, {
        replacements: { dateStart: dateStart90Str, dateEnd: dateEnd }, type: sequelize.QueryTypes.SELECT
    });
    const metaSpend90 = parseFloat(metaSpend90Res.spend || 0);
    const cacMeta = metaPagantes90 > 0 ? (metaSpend90 / metaPagantes90) : (metaTrials90 > 0 ? (metaSpend90 / metaTrials90 * (1/0.15)) : 150);
    
    // Other Settings
    const settings = await sequelize.query(`SELECT * FROM "SystemSettings" LIMIT 1`, { type: sequelize.QueryTypes.SELECT });
    const s = settings[0] || {};
    
    console.log("=== REAIS NO BANCO ===");
    console.log("Base Inicial:", baseInicial);
    console.log("ARPU:", arpu);
    console.log("CAC Meta (90d):", cacMeta);
    console.log("CPL Google (90d):", cplGoogle);
    console.log("Trial Conversion:", trialConversion);
    console.log("Média Mensal Meta Histórica:", histMetaMonthlySpendAvg);
    console.log("Smart Cap (3.5x):", histMetaMonthlySpendAvg * 3.5);
    console.log("Reinvestimento (%):", s.cmo_sim_reinvest_rate || 100);
    console.log("Aporte Extra:", s.cmo_sim_extra_cash || 0);
    process.exit();
}
fetchRealValues();
