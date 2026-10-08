const express = require('express');
const router = express.Router();
const metaAdsService = require('../services/metaAdsService');
const googleAdsService = require('../services/googleAdsService');
const { sequelize } = require('../models');
const moment = require('moment');
const db = require('../models');
const matchService = require('../services/matchService');
const { protect, admin } = require('../middlewares/authMiddleware');

// Rota de dashboard principal do CMO
router.get('/dashboard', protect, admin, async (req, res) => {
    try {
        // Data default para o mes atual
        const dateStart = req.query.dateStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const dateEnd = req.query.dateEnd || new Date().toISOString().split('T')[0];
        const endDateObj = new Date(dateEnd);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const nextDayStr = endDateObj.toISOString().split('T')[0];

        // 1. Definição de Períodos (Atual e Anterior)
        const start = new Date(dateStart + 'T00:00:00');
        const end = new Date(dateEnd + 'T00:00:00');
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - diffDays + 1);

        const prevDateStart = prevStart.toISOString().split('T')[0];
        const prevDateEnd = prevEnd.toISOString().split('T')[0];
        const prevEndDateObj = new Date(prevDateEnd);
        prevEndDateObj.setDate(prevEndDateObj.getDate() + 1);
        const prevNextDayStr = prevEndDateObj.toISOString().split('T')[0];

        // 2. Fetch de Ads Services (Atual, Anterior e Histórico via Campanhas Alvo)
        const getTargetSpend = (campaigns, targetNameOrId, isGoogle) => {
            if (isGoogle) {
                if (!campaigns || !campaigns.available || !campaigns.data) return 'MISSING_INPUT';
                const target = campaigns.data.find(c => c.campaign_name === targetNameOrId);
                return target ? (target.spend || 0) : 0;
            } else {
                if (!campaigns || campaigns.length === 0 || campaigns[0].id === 'ERRO_API' || campaigns[0].id === 'ERRO' || campaigns[0].id === 'ERRO_CONFIG') return 0;
                const target = campaigns.find(c => (c.campaign_id || c.id) === targetNameOrId);
                return target ? (target.spend || 0) : 0;
            }
        };

        const fetchGoogleAds = async (dStart, dEnd) => {
            try {
                const data = await googleAdsService.getCampaignInsights(dStart, dEnd);
                return { available: true, data };
            } catch (err) {
                return { available: false, errorCode: err.message, data: null };
            }
        };

        const [metaCampaigns, googleCampaigns, prevMetaCampaigns, prevGoogleCampaigns, histMetaCampaigns, histGoogleCampaigns, metaBudgets] = await Promise.all([
            metaAdsService.getCampaignInsights(dateStart, dateEnd),
            fetchGoogleAds(dateStart, dateEnd),
            metaAdsService.getCampaignInsights(prevDateStart, prevDateEnd),
            fetchGoogleAds(prevDateStart, prevDateEnd),
            metaAdsService.getCampaignInsights('2026-05-01', dateEnd),
            fetchGoogleAds('2026-05-01', dateEnd),
            metaAdsService.getCampaignBudgets()
        ]);

        const metaSpend = { spend: getTargetSpend(metaCampaigns, '120251213168140531', false) };
        const prevMetaSpend = { spend: getTargetSpend(prevMetaCampaigns, '120251213168140531', false) };
        const metaSpendHistorical = { spend: getTargetSpend(histMetaCampaigns, '120251213168140531', false) };
        
        const metaTargetBudgetObj = metaBudgets.find(c => c.campaign_id === '120251213168140531');
        metaSpend.configuredDailyBudget = metaTargetBudgetObj ? metaTargetBudgetObj.daily_budget : 0;

        const googleSpendAmount = getTargetSpend(googleCampaigns, 'Yelo MVP - Busca SP', true);
        const actualGoogleSpend = googleSpendAmount;
        const googleSpend = { spend: actualGoogleSpend };
        
        const googleTargetCamp = (googleCampaigns.available && googleCampaigns.data) ? googleCampaigns.data.find(c => c.campaign_name === 'Yelo MVP - Busca SP') : null;
        googleSpend.configuredDailyBudget = googleTargetCamp ? (googleTargetCamp.daily_budget || 0) : 0;
        
        const prevGoogleSpendAmount = getTargetSpend(prevGoogleCampaigns, 'Yelo MVP - Busca SP', true);
        const actualPrevGoogleSpend = prevGoogleSpendAmount;

        let actualGoogleSpendHistorical = getTargetSpend(histGoogleCampaigns, 'Yelo MVP - Busca SP', true);
        

        const totalSpend = metaSpend.spend + actualGoogleSpend;
        const totalPrevSpend = prevMetaSpend.spend + actualPrevGoogleSpend;

        // 3. Atribuição B2B (Meta Ads -> Psicólogos)
        // Funil B2B completo:
        //   trials    = status 'pending' (aguardando aprovação - lead cru do anúncio)
        //             + status 'active' sem subscription (aprovado, em trial)
        //   pagantes  = status 'active' com subscriptionId OU firstPaidAt (converteu para pago)
        //   churned   = status 'inactive'
        const b2bQuery = `
            SELECT 
                COUNT(*) FILTER (
                    WHERE "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND ("is_exempt" IS NULL OR "is_exempt" = false)
                    AND "firstPaidAt" >= :dateStart AND "firstPaidAt" < :nextDayStr
                ) as pagantes,
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL AND "fotoUrl" NOT LIKE '%placehold.co%')
                    AND ("bio" IS NOT NULL AND LENGTH("bio") >= 10)
                    AND "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
                ) as trials,
                COUNT(*) FILTER (
                    WHERE "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND ("planExpiresAt" <= NOW() OR "status" = 'inactive')
                    AND "updatedAt" >= :dateStart AND "updatedAt" < :nextDayStr
                ) as churned,
                COUNT(*) FILTER (
                    WHERE ("firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
                    AND "planExpiresAt" <= NOW()
                    AND "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
                ) as failed_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND (
                utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
                OR first_utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
            )
        `;

        const [metaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart, nextDayStr }, type: sequelize.QueryTypes.SELECT
        });
        const [prevMetaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart: prevDateStart, nextDayStr: prevNextDayStr }, type: sequelize.QueryTypes.SELECT
        });

        const metaPagantes = parseInt(metaMetricsRes.pagantes || 0);
        const prevMetaPagantes = parseInt(prevMetaMetricsRes.pagantes || 0);
        const prevMetaTrials = parseInt(prevMetaMetricsRes.trials || 0);
        const metaTrials = parseInt(metaMetricsRes.trials || 0);
        const metaChurned = parseInt(metaMetricsRes.churned || 0);

        const globalB2BQuery = `
            SELECT 
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "firstPaidAt" >= :dateStart AND "firstPaidAt" < :nextDayStr
                ) as total_new_pagantes,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'active')
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))
                    AND "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
                ) as total_new_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
        `;
        const [globalB2BRes] = await sequelize.query(globalB2BQuery, {
            replacements: { dateStart, nextDayStr }, type: sequelize.QueryTypes.SELECT
        });
        const totalNewPagantes = parseInt(globalB2BRes.total_new_pagantes || 0);
        const totalNewTrials = parseInt(globalB2BRes.total_new_trials || 0);
        const organicPagantes = Math.max(0, totalNewPagantes - metaPagantes);
        const organicTrials = Math.max(0, totalNewTrials - metaTrials);

        const globalChurnQuery = `
            SELECT COUNT(*) as churned
            FROM "Psychologists"
            WHERE status = 'inactive'
            AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
            AND "updatedAt" >= :dateStart AND "updatedAt" < :nextDayStr
            AND "deletedAt" IS NULL
        `;
        const [globalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart, nextDayStr }, type: sequelize.QueryTypes.SELECT
        });
        const globalChurned = parseInt(globalChurnRes.churned || 0);
        
        const [prevGlobalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart: prevDateStart, nextDayStr: prevNextDayStr }, type: sequelize.QueryTypes.SELECT
        });
        const prevGlobalChurned = parseInt(prevGlobalChurnRes.churned || 0);

        // Correlação: cliques recebidos por psis ativos vs churned nos últimos 90 dias (janela fixa)
        // Período fixo de 90d garante amostra estatisticamente robusta, independente do filtro do painel.
        // Responde: "quantos cliques/mês um psi precisa receber para não cancelar?"
        const churnCorrelation90dStart = new Date();
        churnCorrelation90dStart.setDate(churnCorrelation90dStart.getDate() - 90);
        const churnCorrelation90dStartStr = churnCorrelation90dStart.toISOString().split('T')[0];
        const churnCorrelation90dEndStr = new Date().toISOString().split('T')[0];

        const clicksVsChurnQuery = `
            SELECT
                p.status,
                COUNT(p.id) as psi_count,
                ROUND(AVG(click_count)::numeric, 2) as avg_clicks,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY click_count) as median_clicks
            FROM (
                SELECT
                    p.id,
                    p.status,
                    COUNT(w.id) as click_count
                FROM "Psychologists" p
                LEFT JOIN "WhatsAppClickLogs" w
                    ON (w."psychologistId" = p.id OR w."PsychologistId" = p.id)
                    AND w."createdAt" >= :corr90dStart AND w."createdAt" <= :corr90dEnd
                WHERE p."plano" IS NOT NULL AND (p."subscriptionId" IS NOT NULL OR p."subscription_payments_count" > 0)
                AND (p.is_exempt IS NULL OR p.is_exempt = false)
                AND p."deletedAt" IS NULL
                AND p.status IN ('active', 'inactive')
                GROUP BY p.id, p.status
            ) p
            GROUP BY p.status
        `;
        let clicksChurnActive = null;
        let clicksChurnInactive = null;
        try {
            const clicksVsChurnRes = await sequelize.query(clicksVsChurnQuery, {
                replacements: { corr90dStart: churnCorrelation90dStartStr, corr90dEnd: churnCorrelation90dEndStr + ' 23:59:59' },
                type: sequelize.QueryTypes.SELECT
            });
            clicksChurnActive = clicksVsChurnRes.find(r => r.status === 'active') || null;
            clicksChurnInactive = clicksVsChurnRes.find(r => r.status === 'inactive') || null;
        } catch (e) {
            console.error('[CMO] Erro na query clicks vs churn (90d):', e.message);
        }

        const matchService = require('../services/matchService');
        
        const globalPaidQuery = `
            SELECT * FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND status = 'active'
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND "planExpiresAt" > NOW()
            AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
        `;
        const globalPaidRes = await sequelize.query(globalPaidQuery, { type: sequelize.QueryTypes.SELECT });
        
        const paidAccessBase = globalPaidRes.length;
        const totalActive = paidAccessBase;
        
        // Derive forward operational and semantic bases natively from reconciled globalPaidRes
        const operationalForwardArray = globalPaidRes.filter(p => p.cancelAtPeriodEnd !== true);
        const operationalForwardBase = operationalForwardArray.length;
        
        const mechanicallyRenewableBase = operationalForwardArray.filter(p => p.subscriptionId !== null).length;
        const manualLegacyBase = operationalForwardArray.filter(p => p.subscriptionId === null).length;
        
        const forwardDemandEligibleBase = operationalForwardArray.filter(p => matchService.isEligibleForMatch(p)).length;
        const demandEligiblePaidBase = globalPaidRes.filter(p => matchService.isEligibleForMatch(p)).length;
        
        const futureDemandEligibilityRate = operationalForwardBase > 0 ? (forwardDemandEligibleBase / operationalForwardBase) : 0;


        const globalTrialsQuery = `
            SELECT COUNT(*) as total_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
            AND "planExpiresAt" > NOW()
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
        `;
        const [globalTrialsRes] = await sequelize.query(globalTrialsQuery, { type: sequelize.QueryTypes.SELECT });
        const totalTrials = parseInt(globalTrialsRes.total_trials || 0);
        const globalChurnRate = (totalActive + globalChurned) > 0 ? (globalChurned / (totalActive + globalChurned)) : 0;

        console.log('[CMO B2B Debug]', { dateStart, dateEnd, metaPagantes, metaTrials, metaChurned, globalChurned, globalChurnRate, raw: metaMetricsRes });


        const metaCac = metaPagantes > 0 ? (metaSpend.spend / metaPagantes) : 0;
        const prevMetaCac = prevMetaPagantes > 0 ? (prevMetaSpend.spend / prevMetaPagantes) : 0;

        const deltaMetaSpend = metaSpend.spend - prevMetaSpend.spend;
        const deltaMetaPagantes = metaPagantes - prevMetaPagantes;
        const metaMarginalCac = deltaMetaPagantes > 0 ? (deltaMetaSpend / deltaMetaPagantes) : 0;

        // Cálculo Dinâmico Real: Renewable Subscriber Base, MRR e Cash-In
        let renewableSubscriberBase = mechanicallyRenewableBase; // Mantido por backward compatibility
        let renewableDemandEligibleBase = forwardDemandEligibleBase; // Mantido por backward compatibility
        let renewableMRR = 0;
        let cashIn = 0;
        let arpu = 99;
        let pnlEngine = {};
        // Meta agregada de capacidade de demanda usada para dimensionar o orçamento de Google por psicólogo elegível.
        // NÃO significa: cada psicólogo receberá 3 contatos.
        // NÃO significa: média histórica observada = 3.
        // NÃO significa: promessa comercial de 3 contatos.
        // Unidade: 3 RAW WhatsApp clicks / eligible paid psychologist / month
        const AggregateDemandBudgetTarget = 3;

        // 4. Atribuição B2C (Google Ads -> Pacientes)
        const b2cQuery = `
            SELECT 
                COUNT(*) as wpp_clicks,
                SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks,
                SUM(CASE WHEN "dealClosed" IN ('yes', 'started') THEN 1 ELSE 0 END) as total_deals,
                SUM(CASE WHEN "dealClosed" IN ('no', 'no_reply', 'not_interested', 'did_not_reply') THEN 1 ELSE 0 END) as total_lost,
                SUM(CASE WHEN "dealClosed" IS NULL OR "dealClosed" = 'pending' THEN 1 ELSE 0 END) as total_pending
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
        `;

        const [googleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart, nextDayStr }, type: sequelize.QueryTypes.SELECT
        });
        const [prevGoogleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart: prevDateStart, nextDayStr: prevNextDayStr }, type: sequelize.QueryTypes.SELECT
        });

        const wppClicks = parseInt(googleMetricsRes.wpp_clicks || 0);
        const googleWppClicks = parseInt(googleMetricsRes.google_wpp_clicks || 0);
        const prevGoogleWppClicks = parseInt(prevGoogleMetricsRes.google_wpp_clicks || 0);
        const googleDeals = parseInt(googleMetricsRes.total_deals || 0);
        const prevGoogleDeals = parseInt(prevGoogleMetricsRes.total_deals || 0);
        const lostDeals = parseInt(googleMetricsRes.total_lost || 0);
        const pendingDeals = parseInt(googleMetricsRes.total_pending || 0);
        
        let googleCpl = null;
        let googleCplType = 'OBSERVED';
        if (actualGoogleSpend === 'MISSING_INPUT') {
            googleCpl = 'MISSING_INPUT';
            googleCplType = 'MISSING_INPUT';
        } else if (actualGoogleSpend > 0 && googleWppClicks > 0) {
            googleCpl = actualGoogleSpend / googleWppClicks;
        } else if (actualGoogleSpend > 0 && googleWppClicks === 0) {
            googleCpl = 'INVALID_INPUT';
            googleCplType = 'SPEND_WITH_ZERO_CLICKS';
        } else if (actualGoogleSpend === 0 && googleWppClicks > 0) {
            googleCpl = 'INVALID_INPUT';
            googleCplType = 'CLICKS_WITH_ZERO_SPEND';
        } else if (actualGoogleSpend === 0 && googleWppClicks === 0) {
            googleCpl = null;
            googleCplType = 'INSUFFICIENT_DATA';
        }

        let prevGoogleCpl = null;
        if (actualPrevGoogleSpend === 'MISSING_INPUT') {
            prevGoogleCpl = 'MISSING_INPUT';
        } else if (actualPrevGoogleSpend > 0 && prevGoogleWppClicks > 0) {
            prevGoogleCpl = actualPrevGoogleSpend / prevGoogleWppClicks;
        } else if (actualPrevGoogleSpend > 0 && prevGoogleWppClicks === 0) {
            prevGoogleCpl = 'INVALID_INPUT';
        } else if (actualPrevGoogleSpend === 0 && prevGoogleWppClicks > 0) {
            prevGoogleCpl = 'INVALID_INPUT';
        } else if (actualPrevGoogleSpend === 0 && prevGoogleWppClicks === 0) {
            prevGoogleCpl = null;
        }

        const b2cOrganic30dQuery = `
            SELECT 
                SUM(CASE WHEN "utmSource" IN ('organico', 'Direto/Orgânico', 'whatsapp_bio', 'instagram_bio') THEN 1 ELSE 0 END) as organic_wpp_clicks,
                SUM(CASE WHEN "utmSource" IS NULL OR "utmSource" = '' THEN 1 ELSE 0 END) as unattributed_wpp_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        `;
        const [organic30dRes] = await sequelize.query(b2cOrganic30dQuery, { type: sequelize.QueryTypes.SELECT });
        const organicWppClicks30d = parseInt(organic30dRes.organic_wpp_clicks || 0);
        const unattributedWppClicks30d = parseInt(organic30dRes.unattributed_wpp_clicks || 0);

        try {
            const settings = await db.SystemSetting.findOne() || {};
            const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
            const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
            const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;

            // Calcular o MRR sobre a população Operational Forward
            for (const r of operationalForwardArray) {
                if (r.subscriptionId !== null) {
                    if (r.plano === 'ESSENTIAL' || r.plano === 'Essencial') renewableMRR += Number(priceEssencial);
                    else if (r.plano === 'CLINICAL' || r.plano === 'Clínico') renewableMRR += Number(priceClinico);
                    else if (r.plano === 'REFERENCE' || r.plano === 'Sol' || r.plano === 'SOL') renewableMRR += Number(priceReference);
                    else renewableMRR += Number(priceEssencial);
                }
            }

            if (mechanicallyRenewableBase > 0) arpu = renewableMRR / mechanicallyRenewableBase;

            
            // --- LEDGER FINANCIAL METRICS ---
            const ledgerStats = await sequelize.query(`
                SELECT 
                    SUM(CASE WHEN "eventType" = 'PAYMENT_CONFIRMED' THEN "grossAmount" ELSE 0 END) as "ConfirmedGrossRevenue",
                    SUM(CASE WHEN "eventType" = 'PAYMENT_CREDITED' THEN "cashDeltaAmount" ELSE 0 END) as "RealizedPaymentCash",
                    SUM(CASE WHEN "eventType" = 'GATEWAY_CASH_MOVEMENT' THEN "cashDeltaAmount" ELSE 0 END) as "GatewayCashAdjustments",
                    SUM(CASE WHEN "eventType" = 'PAYMENT_CREDITED' THEN "feeAmount" ELSE 0 END) as "RealizedGatewayFees"
                FROM "PaymentFinancialEvents"
                WHERE "eventDate" >= :dateStart AND "eventDate" < :nextDayStr
            `, { replacements: { dateStart, nextDayStr }, type: sequelize.QueryTypes.SELECT });

            const lStats = ledgerStats[0];
            const ConfirmedGrossRevenue = lStats.ConfirmedGrossRevenue ? parseFloat(lStats.ConfirmedGrossRevenue) : 0;
            const RealizedPaymentCash = lStats.RealizedPaymentCash ? parseFloat(lStats.RealizedPaymentCash) : 0;
            const GatewayCashAdjustments = lStats.GatewayCashAdjustments ? parseFloat(lStats.GatewayCashAdjustments) : 0;
            const RealizedGatewayFees = lStats.RealizedGatewayFees ? parseFloat(lStats.RealizedGatewayFees) : 0;
            const GatewayNetCash = RealizedPaymentCash + GatewayCashAdjustments;
            
            // Não usar cashIn = ConfirmedGrossRevenue. A UI legada pode usar o GatewayNetCash para caixa ou ConfirmedGrossRevenue para faturamento
            // Como o nome é "cashIn", deve refletir CAIXA.
            cashIn = GatewayNetCash; 
            
            // --- DYNAMIC PROJECTED GATEWAY RATE (ALL TIME) ---
            const pairedCreditedStats = await sequelize.query(`
                SELECT 
                    SUM("grossAmount") as "totalGross",
                    SUM("feeAmount") as "totalFee",
                    COUNT(*) as "sampleCount"
                FROM "PaymentFinancialEvents"
                WHERE "eventType" = 'PAYMENT_CREDITED'
                  AND "grossAmount" > 0
                  AND "feeAmount" >= 0
                  AND "netCashAmount" IS NOT NULL
                  AND ABS("grossAmount" - "netCashAmount" - "feeAmount") < 0.05
            `, { type: sequelize.QueryTypes.SELECT });

            const pStats = pairedCreditedStats[0];
            const sampleCount = pStats.sampleCount ? parseInt(pStats.sampleCount) : 0;
            const pairedGross = pStats.totalGross ? parseFloat(pStats.totalGross) : 0;
            const pairedFee = pStats.totalFee ? parseFloat(pStats.totalFee) : 0;
            
            let projectedGatewayRateValue = 'MISSING_INPUT';
            if (sampleCount > 0 && pairedGross > 0) {
                projectedGatewayRateValue = pairedFee / pairedGross; // FRACTION (e.g. 0.027140...)
            }

            const projectedGatewayRate = {
                value: projectedGatewayRateValue,
                type: "DERIVED_FROM_OBSERVED",
                source: "PAIRED_CREDITED_EFFECTIVE_RATE",
                prospectiveClassification: "CURRENT_OBSERVED_PAYMENT_MIX_CARRY_FORWARD_ASSUMPTION",
                sampleCount: sampleCount,
                grossAmount: pairedGross,
                feeAmount: pairedFee,
                unit: "FRACTION",
                window: "ALL_TIME"
            };
            
            // --- YELO MONTHLY FINANCE SNAPSHOT ---
            const monthStr = dateStart.substring(0, 7);
            const monthlyFinance = await db.YeloMonthlyFinance.findOne({ where: { monthYear: monthStr } });
            let setting = await db.SystemSetting.findOne();
            if (!setting) {
                setting = await db.SystemSetting.create({});
            }
            
            let tax_variable_rate = monthlyFinance && monthlyFinance.appliedTaxVariableRate !== null ? parseFloat(monthlyFinance.appliedTaxVariableRate) : (setting.tax_variable_rate !== null ? parseFloat(setting.tax_variable_rate) : null);
            let tax_fixed_monthly = monthlyFinance && monthlyFinance.appliedTaxFixedMonthly !== null ? parseFloat(monthlyFinance.appliedTaxFixedMonthly) : (setting.tax_fixed_monthly !== null ? parseFloat(setting.tax_fixed_monthly) : null);
            let required_cash_reserve = monthlyFinance && monthlyFinance.appliedRequiredCashReserve !== null ? parseFloat(monthlyFinance.appliedRequiredCashReserve) : (setting.required_cash_reserve !== null ? parseFloat(setting.required_cash_reserve) : null);
            
            let currentCashBalance = monthlyFinance && monthlyFinance.closingCashBalance !== null ? parseFloat(monthlyFinance.closingCashBalance) : 'MISSING_INPUT';
            let OPEX_COMPLETENESS = monthlyFinance && monthlyFinance.opexIsComplete ? true : 'MISSING_INPUT';
            
            let OwnerExtraCash = parseFloat(setting.cmo_sim_extra_cash || 0);
            let reinvestRate = parseFloat(setting.cmo_sim_reinvest_rate || 100);

            let hasFiscalConfig = (tax_variable_rate !== null && tax_fixed_monthly !== null);

            // --- YELO EXPENSES (OPEX) ---
            const expensesList = await db.YeloExpense.findAll({
                where: { monthYear: monthStr }
            });
            
            let FixedOPEX = 0;
            let OtherVariableOperatingCosts = 0;
            let unclassifiedCount = 0;
            let cashOpexPaid = 0;

            for (const exp of expensesList) {
                if (exp.nature === 'UNCLASSIFIED' || exp.purpose === 'UNCLASSIFIED' || !exp.nature || !exp.purpose) {
                    unclassifiedCount++;
                }

                if (exp.nature === 'FIXED' && exp.purpose === 'OPERATION') {
                    FixedOPEX += parseFloat(exp.amount || 0);
                }
                
                if (exp.nature === 'VARIABLE' && exp.purpose === 'OPERATION') {
                    OtherVariableOperatingCosts += parseFloat(exp.amount || 0);
                }
                
                if (exp.purpose === 'OPERATION') {
                    cashOpexPaid += parseFloat(exp.amount || 0);
                }
            }

            const isProfitCertified = hasFiscalConfig && (OPEX_COMPLETENESS === true) && unclassifiedCount === 0 && currentCashBalance !== 'MISSING_INPUT';

            const RevenueTaxes = hasFiscalConfig ? (tax_fixed_monthly + (ConfirmedGrossRevenue * tax_variable_rate)) : 'MISSING_INPUT';
            const NetRevenue = RevenueTaxes !== 'MISSING_INPUT' ? (ConfirmedGrossRevenue - RevenueTaxes - RealizedGatewayFees) : 'MISSING_INPUT';
            
            // Lógica Google Maintenance vs Growth Restaurada
            const RequiredWhatsAppChats = renewableDemandEligibleBase * AggregateDemandBudgetTarget;
            const PaidWhatsAppChatsRequired = Math.max(0, RequiredWhatsAppChats - 0);
            
            const observedGoogleCostPerWhatsAppChat = (googleWppClicks > 0) ? (actualGoogleSpend / googleWppClicks) : ((actualGoogleSpend > 0) ? 'MISSING_INPUT' : 0); 
            const RequiredGoogleMaintenanceBudget = observedGoogleCostPerWhatsAppChat !== 'MISSING_INPUT' ? (PaidWhatsAppChatsRequired * observedGoogleCostPerWhatsAppChat) : 'MISSING_INPUT';
            
            const AllocatedGoogleMaintenanceSpend = RequiredGoogleMaintenanceBudget !== 'MISSING_INPUT' ? Math.min(actualGoogleSpend, RequiredGoogleMaintenanceBudget) : 'MISSING_INPUT';
            const AllocatedGoogleGrowthSpend = AllocatedGoogleMaintenanceSpend !== 'MISSING_INPUT' ? Math.max(0, actualGoogleSpend - AllocatedGoogleMaintenanceSpend) : 'MISSING_INPUT';

            const MetaGrowthSpend = metaSpend.spend;

            const OperatingCashBeforeReserve = (NetRevenue !== 'MISSING_INPUT' && AllocatedGoogleMaintenanceSpend !== 'MISSING_INPUT') ? (NetRevenue - FixedOPEX - OtherVariableOperatingCosts - AllocatedGoogleMaintenanceSpend) : 'MISSING_INPUT';
            const ReserveGap = (currentCashBalance !== 'MISSING_INPUT' && required_cash_reserve !== null) ? Math.max(0, required_cash_reserve - currentCashBalance) : 'MISSING_INPUT';
            const OperatingCashAvailable = (OperatingCashBeforeReserve !== 'MISSING_INPUT' && ReserveGap !== 'MISSING_INPUT') ? Math.max(0, OperatingCashBeforeReserve - ReserveGap) : 'MISSING_INPUT';
            
            const GrowthBudgetFromOperations = OperatingCashAvailable !== 'MISSING_INPUT' ? (OperatingCashAvailable * (reinvestRate / 100)) : 'MISSING_INPUT';
            const TotalGrowthBudget = GrowthBudgetFromOperations !== 'MISSING_INPUT' ? (GrowthBudgetFromOperations + OwnerExtraCash) : 'MISSING_INPUT';

            const TotalGoogleCashPaid = AllocatedGoogleMaintenanceSpend !== 'MISSING_INPUT' ? (AllocatedGoogleMaintenanceSpend + AllocatedGoogleGrowthSpend) : 'MISSING_INPUT';
            const cashMarketingPaid = TotalGoogleCashPaid !== 'MISSING_INPUT' ? (MetaGrowthSpend + TotalGoogleCashPaid) : 'MISSING_INPUT';
            const NetCashChange = (OwnerExtraCash !== 'MISSING_INPUT' && cashMarketingPaid !== 'MISSING_INPUT') ? (GatewayNetCash - cashOpexPaid - cashMarketingPaid + OwnerExtraCash) : 'MISSING_INPUT';

            pnlEngine = {
                LUCRO_GERENCIAL_CERTIFICADO: isProfitCertified,
                PROFIT_CERTIFICATION_BLOCKED: unclassifiedCount > 0 || !hasFiscalConfig || OPEX_COMPLETENESS === 'MISSING_INPUT' || currentCashBalance === 'MISSING_INPUT',
                MISSING_INPUTS: [],
                managerial: {
                    ConfirmedGrossRevenue,
                    RevenueTaxes,
                    RealizedGatewayFees,
                    NetRevenue,
                    FixedOPEX,
                    OtherVariableOperatingCosts,
                    tax_variable_rate,
                    AllocatedGoogleMaintenanceSpend,
                    OperatingCashBeforeReserve,
                    RequiredCashReserve: required_cash_reserve,
                    currentCashBalance,
                    ReserveGap,
                    OperatingCashAvailable,
                    ReinvestRate: reinvestRate,
                    GrowthBudgetFromOperations,
                    OwnerExtraCash,
                    TotalGrowthBudget,
                    MetaGrowthSpend,
                    AllocatedGoogleGrowthSpend,
                    projectedGatewayRate
                },
                cashflow: {
                    GatewayNetCash,
                    cashOpexPaid,
                    cashMarketingPaid,
                    OwnerExtraCash,
                    NetCashChange,
                    currentCashBalance
                },
                ledger: {
                    ConfirmedGrossRevenue,
                    RealizedPaymentCash,
                    GatewayCashAdjustments,
                    GatewayNetCash
                }
            };
            
            if (!hasFiscalConfig) pnlEngine.MISSING_INPUTS.push('configuração fiscal');
            if (currentCashBalance === 'MISSING_INPUT') pnlEngine.MISSING_INPUTS.push('saldo atual de caixa');
            if (required_cash_reserve === null) pnlEngine.MISSING_INPUTS.push('required_cash_reserve');
            if (OPEX_COMPLETENESS === 'MISSING_INPUT') pnlEngine.MISSING_INPUTS.push('OPEX_COMPLETENESS (despesas no mes)');
            if (OwnerExtraCash === 'MISSING_INPUT') pnlEngine.MISSING_INPUTS.push('OwnerExtraCash');


        } catch (e) {
            pnlEngine = { error: e.message, stack: e.stack }; console.error('[CMO] Erro ao calcular MRR e CashIn:', e);
        }

        const prevMetaChurned = parseInt(prevMetaMetricsRes.churned || 0);
        const metaChurnRate = metaPagantes > 0 ? (metaChurned / (metaPagantes + metaChurned)) : 0.05;
        const prevMetaChurnRate = prevMetaPagantes > 0 ? (prevMetaChurned / (prevMetaPagantes + prevMetaChurned)) : 0.05;
        const prevGlobalChurnRate = (totalActive + prevGlobalChurned) > 0 ? (prevGlobalChurned / (totalActive + prevGlobalChurned)) : 0;
        const metaLtv = arpu / (metaChurnRate > 0 ? metaChurnRate : 0.05);
        const metaLtvCacRatio = metaCac > 0 ? (metaLtv / metaCac) : 0;



        // HISTORICAL QUERIES
        const b2bHistQuery = `
            SELECT 
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                ) as pagantes,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'active')
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                ) as trials,
                COUNT(*) FILTER (WHERE status = 'inactive' AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)) as churned,
                COUNT(*) FILTER (
                    WHERE status IN ('inactive', 'pending', 'active') 
                    AND ("firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
                    AND "planExpiresAt" <= NOW()
                ) as failed_trials
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            AND "createdAt" < NOW() - INTERVAL '15 days'
            AND (
                utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
                OR first_utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
            )
        `;
        const [metaMetricsHistRes] = await sequelize.query(b2bHistQuery, { type: sequelize.QueryTypes.SELECT });
        const histMetaPagantes = parseInt(metaMetricsHistRes.pagantes || 0);
        const histMetaTrials = parseInt(metaMetricsHistRes.trials || 0);
        const histMetaChurned = parseInt(metaMetricsHistRes.churned || 0);

        const globalChurnHistQuery = `
            SELECT COUNT(*) as churned
            FROM "Psychologists"
            WHERE status = 'inactive'
            AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
            AND "deletedAt" IS NULL
        `;
        const [globalChurnHistRes] = await sequelize.query(globalChurnHistQuery, { type: sequelize.QueryTypes.SELECT });
        const histGlobalChurned = parseInt(globalChurnHistRes.churned || 0);
        
        // Calcular Taxa de Conversão Verdadeira (Historical True Conversion Rate)
        // Convertidos = pagantes (ativos) + churned (já pagaram)
        // Oportunidades = Convertidos + trials ativos + failed trials
        const histFailedTrials = parseInt(metaMetricsHistRes.failed_trials || 0);
        const totalConvertidos = histMetaPagantes + histMetaChurned;
        const totalOportunidades = totalConvertidos + histMetaTrials + histFailedTrials;
        const trueConversionRate = totalOportunidades > 0 ? (totalConvertidos / totalOportunidades) : 0.1102;

        const histMetaSpendVal = metaSpendHistorical.spend;
        const startOfTime = new Date('2026-05-01T00:00:00Z');
        const endOfPeriod = new Date(dateEnd + 'T23:59:59Z');
        const histDays = Math.max(1, Math.ceil(Math.abs(endOfPeriod - startOfTime) / (1000 * 60 * 60 * 24)));
        const histMonths = histDays / 30;
        
        const isMetaApiErrorHist = histMetaCampaigns && histMetaCampaigns.length > 0 && (histMetaCampaigns[0].id === 'ERRO' || histMetaCampaigns[0].id === 'ERRO_API');
        let histMetaMonthlySpendAvg;
        if (isMetaApiErrorHist) {
            histMetaMonthlySpendAvg = null;
        } else {
            histMetaMonthlySpendAvg = histMonths > 0 ? (histMetaSpendVal / histMonths) : 0;
        }
        
        let trueCac;
        if (isMetaApiErrorHist) {
            trueCac = null;
        } else {
            trueCac = totalConvertidos > 0 ? (histMetaSpendVal / totalConvertidos) : 150;
        }

        const histConversionRate = trueConversionRate;
        const histMetaCac = trueCac;
        const histMetaPaybackMonths = (histMetaCac !== null && histMetaCac > 0) ? (histMetaCac / arpu) : 0;
        const histGlobalChurnRate = (totalActive + histGlobalChurned) > 0 ? (histGlobalChurned / (totalActive + histGlobalChurned)) : 0;

        const b2cHistQuery = `
            SELECT 
                COUNT(*) as wpp_clicks,
                SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks,
                SUM(CASE WHEN "dealClosed" IN ('yes', 'started') THEN 1 ELSE 0 END) as total_deals
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '90 days'
        `;
        const [googleMetricsHistRes] = await sequelize.query(b2cHistQuery, { type: sequelize.QueryTypes.SELECT });
        const histWppClicks = parseInt(googleMetricsHistRes.wpp_clicks || 0);
        const histGoogleWppClicks = parseInt(googleMetricsHistRes.google_wpp_clicks || 0);
        const histGoogleDeals = parseInt(googleMetricsHistRes.total_deals || 0);
        const histGoogleCpl = histGoogleWppClicks > 0 ? (actualGoogleSpendHistorical / histGoogleWppClicks) : 0;

        const deltaGoogleSpend = actualGoogleSpend - actualPrevGoogleSpend;
        const deltaGoogleClicks = wppClicks - parseInt(prevGoogleMetricsRes.wpp_clicks || 0);
        const googleMarginalCpl = deltaGoogleClicks > 0 ? (deltaGoogleSpend / deltaGoogleClicks) : 0;

        // 5. Motor de Decisão (Meta/B2B)
        const metaPaybackMonths = metaCac > 0 ? (metaCac / arpu) : 0;
        const prevMetaPaybackMonths = prevMetaCac > 0 ? (prevMetaCac / arpu) : 0;
        
        let decisionEngineMeta = {
            action: 'RECOLHENDO DADOS ⏳', confidence: 0, target: arpu * 1.5,
            scaleCapacity: 'BAIXA', trend: metaCac - prevMetaCac, warning: null, recommendation: 'Aguarde mais conversões.',
            paybackMonths: metaPaybackMonths
        };

        if (metaPagantes < 15) {
            decisionEngineMeta.warning = `Amostra pequena (${metaPagantes} pagantes). O LTV é estatisticamente volátil e qualquer cancelamento mudará a métrica.`;
        }

        if (metaSpend.spend > 0) {
            const isScaleHealthy = metaLtvCacRatio >= 3;
            const isMarginalDangerous = metaMarginalCac > (decisionEngineMeta.target * 1.2);

            if (isScaleHealthy && !isMarginalDangerous && metaPagantes >= 5) {
                decisionEngineMeta.action = 'SINAL VERDE: AUMENTAR 🚀';
                decisionEngineMeta.confidence = metaPagantes < 15 ? 60 : 85;
                decisionEngineMeta.scaleCapacity = 'ALTA';
                decisionEngineMeta.recommendation = `O CAC está lucrativo (Ratio ${metaLtvCacRatio.toFixed(1)}x). Aumente o orçamento para Psicólogos com segurança.`;
            } else if (isScaleHealthy && isMarginalDangerous) {
                decisionEngineMeta.action = 'TETO DE EFICIÊNCIA ⚖️';
                decisionEngineMeta.confidence = 75;
                decisionEngineMeta.scaleCapacity = 'LIMITADA';
                decisionEngineMeta.warning = decisionEngineMeta.warning || 'Atenção: O aumento recente gerou psicólogos muito mais caros (CAC Marginal alto).';
                decisionEngineMeta.recommendation = 'Mantenha o orçamento atual para proteger suas margens.';
            } else if (metaPagantes === 0 && metaSpend.spend > 300) {
                decisionEngineMeta.action = 'PAUSAR / INVESTIGAR 🚨';
                decisionEngineMeta.confidence = 90;
                decisionEngineMeta.scaleCapacity = 'ZERO';
                decisionEngineMeta.recommendation = 'Gasto elevado sem novas assinaturas. Revise sua campanha B2B no Facebook/Insta.';
            } else if (!isScaleHealthy && metaSpend.spend > 0) {
                decisionEngineMeta.action = 'OTIMIZAR / REDUZIR 📉';
                decisionEngineMeta.confidence = 80;
                decisionEngineMeta.scaleCapacity = 'BAIXA';
                decisionEngineMeta.warning = decisionEngineMeta.warning || `O CAC está alto demais em relação ao LTV (Ratio ${metaLtvCacRatio.toFixed(1)}x).`;
                decisionEngineMeta.recommendation = 'Congele aumentos e foque em otimizar criativos e público. Escalar agora queimará caixa.';
            } else {
                decisionEngineMeta.action = 'MANTER ORÇAMENTO ⚖️';
                decisionEngineMeta.confidence = 70;
                decisionEngineMeta.scaleCapacity = 'MÉDIA';
                decisionEngineMeta.recommendation = 'O fluxo de aquisição está aceitável, mas sem espaço óbvio para escala agressiva.';
            }
        }

        // 6. Motor de Decisão (Google/B2C)
        let decisionEngineGoogle = {
            action: 'RECOLHENDO DADOS ⏳', confidence: 0, target: 8, // Target CPL B2C (Custo por Lead/Clique WPP)
            scaleCapacity: 'BAIXA', trend: (typeof googleCpl === 'number' && typeof prevGoogleCpl === 'number') ? googleCpl - prevGoogleCpl : null, warning: null, recommendation: 'Aguarde mais volume de cliques.'
        };
        if (wppClicks < 10) {
            decisionEngineGoogle.warning = `Amostra pequena (${wppClicks} cliques WPP). O custo por lead pode variar muito.`;
        }

        if (actualGoogleSpend === 'MISSING_INPUT') {
            decisionEngineGoogle.warning = 'Gastos do Google Ads não puderam ser lidos.';
        } else if (actualGoogleSpend > 0 && googleWppClicks === 0) {
            decisionEngineGoogle.action = 'PAUSAR / INVESTIGAR 🚨';
            decisionEngineGoogle.confidence = 90;
            decisionEngineGoogle.scaleCapacity = 'ZERO';
            decisionEngineGoogle.recommendation = 'Gasto no Google sem gerar nenhum contato WPP. Reveja as palavras-chave ou a landing page.';
        } else if (typeof googleCpl === 'number') {
            const isCplHealthy = googleCpl <= decisionEngineGoogle.target;
            const isMarginalDangerous = googleMarginalCpl > (decisionEngineGoogle.target * 1.5);

            if (isCplHealthy && !isMarginalDangerous && wppClicks >= 10) {
                decisionEngineGoogle.action = 'SINAL VERDE: AUMENTAR 🚀';
                decisionEngineGoogle.confidence = wppClicks < 30 ? 65 : 90;
                decisionEngineGoogle.scaleCapacity = 'ALTA';
                decisionEngineGoogle.recommendation = `O Custo por Lead (CPL R$ ${googleCpl.toFixed(2)}) está excelente. Aumente o Google Ads para entregar mais contatos aos psicólogos.`;
            } else if (isCplHealthy && isMarginalDangerous) {
                decisionEngineGoogle.action = 'TETO DE EFICIÊNCIA ⚖️';
                decisionEngineGoogle.confidence = 80;
                decisionEngineGoogle.scaleCapacity = 'LIMITADA';
                decisionEngineGoogle.warning = decisionEngineGoogle.warning || 'O custo marginal do lead (R$ ' + (typeof googleMarginalCpl === 'number' ? googleMarginalCpl.toFixed(2) : '?') + ') está subindo rápido.';
                decisionEngineGoogle.recommendation = 'Mantenha o orçamento do Google. O aumento recente trouxe contatos mais caros.';
            } else if (!isCplHealthy) {
                decisionEngineGoogle.action = 'OTIMIZAR / REDUZIR 📉';
                decisionEngineGoogle.confidence = 85;
                decisionEngineGoogle.scaleCapacity = 'BAIXA';
                decisionEngineGoogle.warning = decisionEngineGoogle.warning || `O custo por lead (R$ ${googleCpl.toFixed(2)}) ultrapassou o teto de R$ ${decisionEngineGoogle.target.toFixed(2)}.`;
                decisionEngineGoogle.recommendation = 'Congele aumentos e otimize anúncios/termos de pesquisa. O lead está muito caro.';
            } else {
                decisionEngineGoogle.action = 'MANTER ORÇAMENTO ⚖️';
                decisionEngineGoogle.confidence = 75;
                decisionEngineGoogle.scaleCapacity = 'MÉDIA';
                decisionEngineGoogle.recommendation = `CPL atual é R$ ${googleCpl.toFixed(2)}. Mantenha e monitore o volume de contatos.`;
            }
        }

        // 7. Visão Global 360 (B2B + B2C)
        let globalInsight = "💡 **Plano de Ação Executivo (Imediato)**\n";
        
        // Ação Meta
        if (decisionEngineMeta.action.includes('AUMENTAR')) {
            globalInsight += `✅ **Meta Ads (B2B):** Aumente o orçamento diário em **20%** para escalar a aquisição de assinantes.\n`;
        } else if (decisionEngineMeta.action.includes('PAUSAR')) {
            globalInsight += `🚨 **Meta Ads (B2B):** **PAUSE** a campanha. Alto gasto sem conversões claras.\n`;
        } else if (decisionEngineMeta.action.includes('TETO')) {
            globalInsight += `⚠️ **Meta Ads (B2B):** Reduza o orçamento em **15%**. O custo marginal estourou (teto de eficiência atingido).\n`;
        } else {
            globalInsight += `⚖️ **Meta Ads (B2B):** **MANTENHA** o orçamento atual. Números dentro do padrão de tração.\n`;
        }

        // Ação Google
        if (pendingDeals > (wppClicks * 0.3) && wppClicks > 0) {
            globalInsight += `⚠️ **Google Ads (B2C):** **CONGELE** aumentos. O gargalo não é tráfego, é conversão na ponta. Há ${pendingDeals} leads travados no funil (aguardando a janela de 48h de resposta do psicólogo ou prontos para cobrança no CRM).\n`;
        } else if (decisionEngineGoogle.action.includes('AUMENTAR')) {
            globalInsight += `✅ **Google Ads (B2C):** Aumente o orçamento diário em **20%** para entregar mais pacientes aos psicólogos.\n`;
        } else if (decisionEngineGoogle.action.includes('PAUSAR')) {
            globalInsight += `🚨 **Google Ads (B2C):** **PAUSE** as campanhas. Queima de caixa sem pacientes fechados.\n`;
        } else if (decisionEngineGoogle.action.includes('TETO')) {
            globalInsight += `⚠️ **Google Ads (B2C):** Reduza o orçamento em **15%**. O aumento recente trouxe pacientes caros demais.\n`;
        } else {
            globalInsight += `⚖️ **Google Ads (B2C):** **MANTENHA** o orçamento atual. Aguarde mais volume para tomar decisões.\n`;
        }

        globalInsight += `\n⏳ **Regra de Ouro:** Após aplicar qualquer mudança, aguarde **7 dias corridos** sem mexer nas campanhas para permitir o aprendizado do algoritmo da IA (Meta/Google).`;

        // --- MÉTRICAS DE EFICIÊNCIA COMERCIAL (NOVO) ---
        const { Op } = require('sequelize');
        const { WhatsAppClickLog, Psychologist } = db;
        
        let globalEffort = 'N/A', adsEffort = 'N/A', orgEffort = 'N/A', topTicket = 'N/A';
        let ttfcData = { median: 'N/A', mean: 'N/A', sample: 0 };
        let ttvData = { median: 'N/A', mean: 'N/A', sample: 0 };
        
        let prevEfficiency = null;

        try {
            const dateEnd90 = new Date();
            const dateStart90 = new Date();
            dateStart90.setDate(dateStart90.getDate() - 90);
            
            const dateStart180 = new Date(dateStart90);
            dateStart180.setDate(dateStart180.getDate() - 90);

            const getEfficiencyMetrics = async (startDate, endDate) => {
                const edObj = new Date(endDate);
                edObj.setDate(edObj.getDate() + 1);
                const nextDayStrEff = edObj.toISOString().split('T')[0];
                const dateCondition = { createdAt: { [Op.gte]: startDate, [Op.lte]: endDate } };
                const closedCondition = { dealClosed: { [Op.in]: ['yes', 'started'] } };

                const totalClicks = await WhatsAppClickLog.count({ where: dateCondition });
                const totalClosed = await WhatsAppClickLog.count({ where: { ...closedCondition, ...dateCondition } });
                const gEffort = totalClosed > 0 ? (totalClicks / totalClosed).toFixed(1) : 'N/A';

                const adsSources = ['google', 'meta', 'facebook', 'instagram', 'ig', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc'];
                const isAdsCondition = {
                    [Op.or]: [
                        { utmSource: { [Op.iLike]: { [Op.any]: adsSources.map(s => `%${s}%`) } } },
                        { source: { [Op.iLike]: { [Op.any]: adsSources.map(s => `%${s}%`) } } }
                    ]
                };
                const adsClicks = await WhatsAppClickLog.count({ where: { ...isAdsCondition, ...dateCondition } });
                const adsClosed = await WhatsAppClickLog.count({ where: { ...isAdsCondition, ...closedCondition, ...dateCondition } });
                const aEffort = adsClosed > 0 ? (adsClicks / adsClosed).toFixed(1) : 'N/A';
                
                const orgClicks = totalClicks - adsClicks;
                const orgClosed = totalClosed - adsClosed;
                const oEffort = orgClosed > 0 ? (orgClicks / orgClosed).toFixed(1) : 'N/A';

                let tTicket = 'N/A';
                const topPerformersQuery = await sequelize.query(`
                    SELECT "psychologistId", COUNT(id) as "closedCount"
                    FROM "WhatsAppClickLogs"
                    WHERE "dealClosed" IN ('yes', 'started') AND "psychologistId" IS NOT NULL
                    AND "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
                    GROUP BY "psychologistId"
                    ORDER BY "closedCount" DESC
                `, { replacements: { dateStart: startDate, nextDayStr: nextDayStrEff }, type: sequelize.QueryTypes.SELECT });

                if (topPerformersQuery.length > 0) {
                    const top20PercentCount = Math.max(1, Math.ceil(topPerformersQuery.length * 0.20));
                    const topPerformersIds = topPerformersQuery.slice(0, top20PercentCount).map(p => p.psychologistId);
                    const topPsychologists = await sequelize.query(`
                        SELECT AVG(valor_sessao_numero) as "avgTicket"
                        FROM "Psychologists"
                        WHERE id IN (:ids) AND valor_sessao_numero > 0 AND valor_sessao_numero IS NOT NULL
                    `, { replacements: { ids: topPerformersIds }, type: sequelize.QueryTypes.SELECT });
                    tTicket = topPsychologists[0]?.avgTicket ? parseFloat(topPsychologists[0].avgTicket).toFixed(2) : 'N/A';
                }

                let ttfc = { median: 'N/A', mean: 'N/A', sample: 0 };
                const ttfcQuery = await sequelize.query(`
                    SELECT 
                        EXTRACT(EPOCH FROM (MIN(w."createdAt") - p."createdAt")) / 86400 as days_to_first_contact
                    FROM "Psychologists" p
                    JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                    WHERE w."createdAt" >= :dateStart AND w."createdAt" < :nextDayStr
                    GROUP BY p.id, p."createdAt"
                `, { replacements: { dateStart: startDate, nextDayStr: nextDayStrEff }, type: sequelize.QueryTypes.SELECT });
                if (ttfcQuery.length > 0) {
                    const validTtfcs = ttfcQuery.filter(q => q.days_to_first_contact >= 0).map(q => parseFloat(q.days_to_first_contact)).sort((a,b) => a-b);
                    if (validTtfcs.length > 0) {
                        const mean = (validTtfcs.reduce((sum, val) => sum + val, 0) / validTtfcs.length).toFixed(1);
                        const mid = Math.floor(validTtfcs.length / 2);
                        const median = validTtfcs.length % 2 !== 0 ? validTtfcs[mid].toFixed(1) : ((validTtfcs[mid - 1] + validTtfcs[mid]) / 2).toFixed(1);
                        ttfc = { median, mean, sample: validTtfcs.length };
                    }
                }
                
                let ttv = { median: 'N/A', mean: 'N/A', sample: 0 };
                const ttvQuery = await sequelize.query(`
                    SELECT 
                        EXTRACT(EPOCH FROM (MIN(COALESCE(w."updatedAt", w."createdAt")) - p."createdAt")) / 86400 as days_to_value
                    FROM "Psychologists" p
                    JOIN "WhatsAppClickLogs" w ON p.id = w."psychologistId"
                    WHERE w."dealClosed" IN ('yes', 'started')
                    AND w."createdAt" >= :dateStart AND w."createdAt" < :nextDayStr
                    GROUP BY p.id, p."createdAt"
                `, { replacements: { dateStart: startDate, nextDayStr: nextDayStrEff }, type: sequelize.QueryTypes.SELECT });
                if (ttvQuery.length > 0) {
                    const validTtvs = ttvQuery.filter(q => q.days_to_value >= 0).map(q => parseFloat(q.days_to_value)).sort((a,b) => a-b);
                    if (validTtvs.length > 0) {
                        const mean = (validTtvs.reduce((sum, val) => sum + val, 0) / validTtvs.length).toFixed(1);
                        const mid = Math.floor(validTtvs.length / 2);
                        const median = validTtvs.length % 2 !== 0 ? validTtvs[mid].toFixed(1) : ((validTtvs[mid - 1] + validTtvs[mid]) / 2).toFixed(1);
                        ttv = { median, mean, sample: validTtvs.length };
                    }
                }

                return { globalEffort: gEffort, adsEffort: aEffort, orgEffort: oEffort, topTicket: tTicket, ttfcData: ttfc, ttvData: ttv };
            };

            const currEff = await getEfficiencyMetrics(dateStart90, dateEnd90);
            globalEffort = currEff.globalEffort;
            adsEffort = currEff.adsEffort;
            orgEffort = currEff.orgEffort;
            topTicket = currEff.topTicket;
            ttfcData = currEff.ttfcData;
            ttvData = currEff.ttvData;

            prevEfficiency = await getEfficiencyMetrics(dateStart180, dateStart90);
        } catch (effError) {
            console.error('[CMO Metrics] Erro calculando Eficiência Comercial:', effError);
        }

        // --- SIMULADOR MOTOR DE CRESCIMENTO ---
        let simMetaCac = null;
        let simMetaCacType = 'OBSERVED';
        
        // Google Baseline Config
        const baselineGoogleWindowDays = 30;
        let simGoogleCpl = null;
        let simTrialConv = null;
        let simChurn = null;
        let simChurnType = 'ASSUMED';
        let simTrialConvType = 'OBSERVED';
        let simTrialConvSource = null;
        let simChurnSource = null;
        let knownScheduledChurn = 0;
        let simGoogleCplType = 'OBSERVED';
        let simGoogleCplSource = 'GOOGLE_ADS_API_B2C_SPEND_INTERNAL_RAW_WPP_CLICKS';
        let simOrganicActive = 0;

        try {
            const dateEnd90 = new Date();
            const liveNextDayStr = new Date(dateEnd90.getTime() + 86400000).toISOString().split('T')[0];
            const liveDateEndStr = dateEnd90.toISOString().split('T')[0];

            const dateStart90 = new Date(dateEnd90);
            dateStart90.setDate(dateStart90.getDate() - 90);
            const dateStart90Str = dateStart90.toISOString().split('T')[0];

            const dateStartBaseline = new Date(dateEnd90);
            dateStartBaseline.setDate(dateStartBaseline.getDate() - baselineGoogleWindowDays);
            const dateStartBaselineStr = dateStartBaseline.toISOString().split('T')[0];

            const [metaCampaigns90, googleCampaignsBaseline] = await Promise.all([
                metaAdsService.getCampaignInsights(dateStart90Str, liveDateEndStr),
                fetchGoogleAds(dateStartBaselineStr, liveDateEndStr)
            ]);

            const isMetaApiError90 = metaCampaigns90 && metaCampaigns90.length > 0 && (metaCampaigns90[0].id === 'ERRO' || metaCampaigns90[0].id === 'ERRO_API');
            const metaSpend90 = getTargetSpend(metaCampaigns90, '120251213168140531', false);
            
            // Correção: Gasto Google REAL de 30 dias lido via API
            const googleSpendBaseline = getTargetSpend(googleCampaignsBaseline, 'Yelo MVP - Busca SP', true);


            const [metaMetrics90Res] = await sequelize.query(b2bQuery, {
                replacements: { dateStart: dateStart90Str, nextDayStr: liveNextDayStr }, type: sequelize.QueryTypes.SELECT
            });

            const metaPagantes90 = parseInt(metaMetrics90Res.pagantes || 0);
            const metaTrials90 = parseInt(metaMetrics90Res.trials || 0);
            const metaFailedTrials90 = parseInt(metaMetrics90Res.failed_trials || 0);

            const [globalB2B90dRes] = await sequelize.query(globalB2BQuery, {
                replacements: { dateStart: dateStart90Str, nextDayStr: liveNextDayStr }, type: sequelize.QueryTypes.SELECT
            });
            const totalNewPagantes90d = parseInt(globalB2B90dRes.total_new_pagantes || 0);
            const organicPagantes90d = Math.max(0, totalNewPagantes90d - metaPagantes90);
            simOrganicActive = Math.round(organicPagantes90d / 3);

            if (isMetaApiError90) {
                simMetaCac = null;
                simMetaCacType = 'MISSING_INPUT';
            } else {
                if (metaPagantes90 > 0 && metaSpend90 > 0) {
                    simMetaCac = metaSpend90 / metaPagantes90;
                } else if (metaTrials90 > 0 && metaSpend90 > 0) {
                    simMetaCac = metaSpend90 / metaTrials90 * (1 / 0.1102);
                    simMetaCacType = 'PROXY'; // Because there are no pagantes, only trials
                } else {
                    simMetaCac = histMetaCac; // Fallback to all-time historical CAC
                    simMetaCacType = 'PROXY';
                }
            }

            // The 7d trial cohort is not mature yet. 
            // Fallback to strict conversion from mature 14d cohorts (11.02%)
            simTrialConv = 0.1102;
            simTrialConvType = 'PROXY';
            simTrialConvSource = 'STRICT_14D_MATURE_COHORT_PROXY';

            const globalChurn90dQuery = `
                SELECT COUNT(*) as churned
                FROM "Psychologists"
                WHERE status = 'inactive'
                AND "plano" IS NOT NULL AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                AND "updatedAt" >= :dateStart AND "updatedAt" < :nextDayStr
                AND "deletedAt" IS NULL
            `;
            const [globalChurn90dRes] = await sequelize.query(globalChurn90dQuery, {
                replacements: { dateStart: dateStart90Str, nextDayStr: liveNextDayStr }, type: sequelize.QueryTypes.SELECT
            });
            const churned90d = parseInt(globalChurn90dRes.churned || 0);
            
            const churnRate90d = (totalActive + churned90d) > 0 ? (churned90d / (totalActive + churned90d)) : 0;
            
            const activePaidQuery = `
              SELECT 
                SUM(CASE WHEN (p."cancelAtPeriodEnd" = true) THEN 1 ELSE 0 END) as scheduled_churn
              FROM "Psychologists" p
              WHERE p."deletedAt" IS NULL
              AND p.status = 'active'
              AND (p."is_exempt" IS NULL OR p."is_exempt" = false)
              AND p."planExpiresAt" > NOW()
              AND p."plano" IS NOT NULL AND (p."subscriptionId" IS NOT NULL OR p."subscription_payments_count" > 0)
            `;
            const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
            knownScheduledChurn = parseInt(activePaidRes.scheduled_churn || 0);

            // Churn recorrente observado ainda é praticamente 0% por imaturidade da base.
            // A fórmula antiga (inativos / (ativos + inativos)) não representa bem a exposição real.
            // Assumimos 8,15% como hipótese conservadora temporária para o simulador.
            simChurn = 0.0815;
            simChurnType = 'ASSUMED';
            simChurnSource = 'CONSERVATIVE_EARLY_STAGE_CHURN_ASSUMPTION';


            const b2cQueryBaseline = `
                SELECT 
                    COUNT(*) as wpp_clicks,
                    SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
            `;
            const [googleMetricsBaselineRes] = await sequelize.query(b2cQueryBaseline, {
                replacements: { dateStart: dateStartBaselineStr, nextDayStr: liveNextDayStr }, type: sequelize.QueryTypes.SELECT
            });
            const googleWppClicksBaseline = parseInt(googleMetricsBaselineRes.google_wpp_clicks || 0);
            
            if (googleSpendBaseline === 'MISSING_INPUT') {
                simGoogleCpl = null;
                simGoogleCplType = 'MISSING_INPUT';
                simGoogleCplSource = 'GOOGLE_ADS_API';
            } else if (googleSpendBaseline > 0 && googleWppClicksBaseline > 0) {
                simGoogleCpl = googleSpendBaseline / googleWppClicksBaseline;
            } else if (googleSpendBaseline > 0 && googleWppClicksBaseline === 0) {
                simGoogleCpl = null;
                simGoogleCplType = 'SPEND_WITH_ZERO_CLICKS';
            } else if (googleSpendBaseline === 0 && googleWppClicksBaseline > 0) {
                simGoogleCpl = null;
                simGoogleCplType = 'CLICKS_WITH_ZERO_SPEND';
            } else if (googleSpendBaseline === 0 && googleWppClicksBaseline === 0) {
                simGoogleCpl = null;
                simGoogleCplType = 'INSUFFICIENT_DATA';
            }
        } catch (simError) {
            console.error('[CMO Metrics] Erro calculando Simulador 90d:', simError);
        }

        const demandEligibilityRate = renewableSubscriberBase > 0 ? (renewableDemandEligibleBase / renewableSubscriberBase) : 'MISSING_INPUT';

        const pastBaseQuery = `
            SELECT 
                to_char(d, 'YYYY-MM') as month_label,
                COUNT("Psychologists".id) as active_count
            FROM generate_series(
                date_trunc('month', CURRENT_DATE - interval '3 months'),
                date_trunc('month', CURRENT_DATE - interval '1 month'),
                '1 month'::interval
            ) d
            LEFT JOIN "Psychologists" ON 
                "Psychologists"."createdAt" <= (d + interval '1 month' - interval '1 day') AND
                "Psychologists"."deletedAt" IS NULL AND
                "Psychologists"."plano" IS NOT NULL AND 
                ("Psychologists"."subscriptionId" IS NOT NULL OR "Psychologists"."subscription_payments_count" > 0) AND
                ("Psychologists"."planExpiresAt" > (d + interval '1 month' - interval '1 day'))
            GROUP BY d
            ORDER BY d ASC
        `;
        const pastBaseRes = await sequelize.query(pastBaseQuery, { type: sequelize.QueryTypes.SELECT }).catch(() => []);
        const pastBaseHistory = pastBaseRes.map(r => parseInt(r.active_count || 0));

        res.json({
            success: true,
            efficiency: {
                globalEffort,
                adsEffort,
                orgEffort,
                topTicket,
                ttfcData,
                ttvData
            },
            prevEfficiency,
            
            simulator: {
                cac: { value: simMetaCac, type: simMetaCacType },
                cpl: { value: simGoogleCpl, type: simGoogleCplType, source: simGoogleCplSource, windowDays: baselineGoogleWindowDays },
                trialConv: { value: simTrialConv, type: simTrialConvType, source: simTrialConvSource },
                churn: { value: simChurn, type: simChurnType, source: simChurnSource },
                knownScheduledChurn,
                
                // M1 Snapshot & Forward Bases
                currentPaidAccessBase: totalActive,
                operationalForwardBase,
                
                mechanicallyRenewableBase: { value: mechanicallyRenewableBase, type: 'OBSERVED', source: 'RECONCILED_MECHANICALLY_RENEWABLE_BASE' },
                manualLegacyBase: { value: manualLegacyBase, type: 'OBSERVED', source: 'UNCONFIRMED_LEGACY_RENEWAL_RUNOFF' },
                
                // Demand Bases
                demandEligiblePaidBase,
                futureDemandEligibilityRate: { value: futureDemandEligibilityRate, type: 'OBSERVED', source: 'FORWARD_DEMAND_ELIGIBILITY_RATE' },
                
                // Policies
                revenueM1Policy: { type: 'CONFIG', source: 'CONSERVATIVE_FORWARD_REVENUE_POLICY' },
                demandM1Policy: { type: 'CONFIG', source: 'CASH_CONSERVATIVE_POLICY' },

                // Backward compatibility aliases
                renewableSubscriberBase,
                renewableDemandEligibleBase,
                demandEligibilityRate: futureDemandEligibilityRate,
                
                contactsPerPaidPsiMonth: { value: AggregateDemandBudgetTarget, type: 'CONFIG', source: 'AGGREGATE_DEMAND_BUDGET_TARGET' },
                organicContacts: { value: organicWppClicks30d, type: 'OBSERVED', source: 'ORGANIC_CONFIRMED_WPP_CLICKS_30D' },
                organicActive: { value: simOrganicActive, type: 'OBSERVED', source: 'ORGANIC_ACTIVE_ROLLING_90D_AVG' }
            },

            period: { dateStart, dateEnd, prevDateStart, prevDateEnd },
            globalInsight: globalInsight,
            ads: {
                meta: { ...metaSpend, spend: metaSpend.spend, cac: metaCac, marginalCac: metaMarginalCac },
                google: { ...googleSpend, spend: actualGoogleSpend, cpl: { value: googleCpl, type: googleCplType }, marginalCpl: googleMarginalCpl }
            },
            googleAdsStatus: {
                available: googleCampaigns.available,
                errorCode: googleCampaigns.errorCode || null
            },
            campaigns: { meta: metaCampaigns, google: googleCampaigns.data || [] },
            prevCampaigns: { meta: prevMetaCampaigns, google: prevGoogleCampaigns.data || [] },
            prevPlatform: {
                b2b: { active: prevMetaPagantes, trials: prevMetaTrials, meta_churn_rate: prevMetaChurnRate, global_churn_rate: prevGlobalChurnRate },
                b2c: { wpp_clicks: prevGoogleWppClicks, total_deals: prevGoogleDeals }
            },
            prevAds: {
                meta: { spend: prevMetaSpend.spend, cac: prevMetaCac },
                google: { spend: actualPrevGoogleSpend, cpl: prevGoogleCpl }
            },
            
            historical: {
                meta: { spend: metaSpendHistorical.spend, monthly_spend_avg: { value: histMetaMonthlySpendAvg, type: isMetaApiErrorHist ? 'MISSING_INPUT' : 'OBSERVED' }, cac: histMetaCac, paybackMonths: histMetaPaybackMonths, churn_rate: histGlobalChurnRate, trial_conversion_rate: histConversionRate, state: null, stateDate: null },

                google: { spend: actualGoogleSpendHistorical, cpl: histGoogleCpl },
                platform: {
                    b2b: { active: histMetaPagantes, trials: histMetaTrials, global_churn_rate: histGlobalChurnRate, past_base_history: pastBaseHistory },
                    b2c: { wpp_clicks: histWppClicks, total_deals: histGoogleDeals }
                }
            },
            platform: {
                pnl: pnlEngine,
                b2b: { arpu: arpu, active: metaPagantes, trials: metaTrials, churned: metaChurned, global_churn: globalChurned, meta_churn_rate: metaChurnRate, global_churn_rate: globalChurnRate, total_active: totalActive, total_trials: totalTrials, organic_active: organicPagantes, organic_trials: organicTrials, total_new_active: totalNewPagantes, total_new_trials: totalNewTrials, clicks_vs_churn: { active: clicksChurnActive, inactive: clicksChurnInactive }, cashIn, renewableMRR },
                b2c: { wpp_clicks: wppClicks, total_deals: googleDeals, pending_deals: pendingDeals, lost_deals: lostDeals, organic_wpp_clicks_30d: organicWppClicks30d, unattributed_wpp_clicks_30d: unattributedWppClicks30d }
            },
            decisionEngineMeta,
            prevDecisionEngineMeta: { paybackMonths: prevMetaPaybackMonths },
            decisionEngineGoogle
        });
    } catch (error) {
        console.error('[CMO Metrics] Erro Global na Rota:', error);
        res.status(500).json({
            success: false,
            error: 'Erro ao gerar dashboard do CMO',
            details: error.message,
            stack: error.stack
        });
    }
});

// Rota para salvar inputs manuais (ex: Google Ads)
router.post('/manual-ads', protect, admin, async (req, res) => {
    try {
        const { dateStart, dateEnd, platform, campaignName, spend, impressions, clicks, conversions } = req.body;
        if (!dateStart || !dateEnd || !platform) {
            return res.status(400).json({ success: false, error: 'dateStart, dateEnd e platform são obrigatórios' });
        }

        const { ManualAdMetric } = require('../models');

        // Busca o registro existente
        let record = await ManualAdMetric.findOne({
            where: { dateStart, dateEnd, platform }
        });

        let created = false;
        if (record) {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
            
            // Se foi atualizado entre 7 dias atrás e 15 minutos atrás (janela de bloqueio)
            if (record.updatedAt > sevenDaysAgo && record.updatedAt < fifteenMinsAgo) {
                return res.status(403).json({ 
                    success: false, 
                    error: 'Fase de aprendizado: Aguarde 7 dias da última alteração para inserir novos dados, ou exclua o registro atual.' 
                });
            }
            record = await record.update({ campaignName, spend, impressions, clicks, conversions });
        } else {
            record = await ManualAdMetric.create({ dateStart, dateEnd, platform, campaignName, spend, impressions, clicks, conversions });
            created = true;
        }

        res.json({ success: true, record, created });
    } catch (error) {
        console.error('[CMO] Erro ao salvar dados manuais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para carregar inputs manuais
router.get('/manual-ads', protect, admin, async (req, res) => {
    try {
        const { dateStart, dateEnd, platform } = req.query;
        if (!dateStart || !dateEnd || !platform) {
            return res.status(400).json({ success: false, error: 'Parâmetros insuficientes' });
        }

        const { ManualAdMetric } = require('../models');

        const record = await ManualAdMetric.findOne({
            where: { dateStart, dateEnd, platform }
        });

        res.json({ success: true, record });
    } catch (error) {
        console.error('[CMO] Erro ao buscar dados manuais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para excluir inputs manuais
router.delete('/manual-ads', protect, admin, async (req, res) => {
    try {
        const { dateStart, dateEnd, platform } = req.body;
        if (!dateStart || !dateEnd || !platform) {
            return res.status(400).json({ success: false, error: 'Parâmetros insuficientes' });
        }

        const { ManualAdMetric } = require('../models');

        await ManualAdMetric.destroy({
            where: { dateStart, dateEnd, platform }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[CMO] Erro ao excluir dados manuais:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/cmo/traffic
router.get('/traffic', protect, admin, async (req, res) => {
    try {
        const dateStart = req.query.dateStart || moment().startOf('month').format('YYYY-MM-DD');
        const dateEnd = req.query.dateEnd || moment().endOf('month').format('YYYY-MM-DD');
        
        // Define minimum start date like dashboard
        const START_OF_TIME = '2026-05-01';
        let safeDateStart = moment(dateStart).isBefore(START_OF_TIME) ? START_OF_TIME : dateStart;

        const duration = moment(dateEnd).diff(moment(safeDateStart), 'days') + 1;
        const prevDateStart = moment(safeDateStart).subtract(duration, 'days').format('YYYY-MM-DD');
        const prevDateEnd = moment(dateEnd).subtract(duration, 'days').format('YYYY-MM-DD');
        let safePrevDateStart = moment(prevDateStart).isBefore(START_OF_TIME) ? START_OF_TIME : prevDateStart;

        const ga4Service = require('../services/googleAnalyticsService');
        const gscService = require('../services/googleSearchConsoleService');

        const [ga4Data, gscData, prevGa4Data, prevGscData] = await Promise.all([
            ga4Service.getMetrics(safeDateStart, dateEnd),
            gscService.getMetrics(safeDateStart, dateEnd),
            ga4Service.getMetrics(safePrevDateStart, prevDateEnd),
            gscService.getMetrics(safePrevDateStart, prevDateEnd)
        ]);

        res.json({
            success: true,
            data: {
                ga4: ga4Data,
                gsc: gscData,
                prevGa4: prevGa4Data,
                prevGsc: prevGscData
            }
        });
    } catch (error) {
        console.error('[CMO] Erro Global na Rota /traffic:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/cmo/simulator-settings — Carrega a meta do simulador do banco
router.get('/simulator-settings', protect, admin, async (req, res) => {
    try {
        const db = require('../models');
        
        try {
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_mode VARCHAR(255) DEFAULT 'acelerador';`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_max_budget DECIMAL(10,2) DEFAULT 2000.00;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_date TIMESTAMP;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_subs INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_reinvest_rate INTEGER DEFAULT 100;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_extra_cash DECIMAL(10,2) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_curiosity_goal INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_ai_action_plan TEXT;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_fixed_opex DECIMAL(10,2) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_tax_rate DECIMAL(5,4) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_other_var_rate DECIMAL(5,4) DEFAULT 0;`);
        } catch (e) {
            console.error('Raw ALTER TABLE skip in GET:', e.message);
        }

        let settings = null;
        try {
            settings = await db.SystemSetting.findOne({
                attributes: ['id', 'cmo_sim_target_subs', 'cmo_sim_target_months', 'cmo_sim_mode', 'cmo_sim_max_budget', 'cmo_sim_start_date', 'cmo_sim_start_subs', 'cmo_sim_reinvest_rate', 'cmo_sim_extra_cash', 'cmo_sim_curiosity_goal', 'cmo_sim_fixed_opex', 'cmo_sim_tax_rate', 'cmo_sim_other_var_rate']
            });
        } catch (e) {
            console.error('findOne failed in GET, returning defaults:', e.message);
        }

        res.json({
            success: true,
            targetSubs: settings?.cmo_sim_target_subs ?? 70,
            targetMonths: settings?.cmo_sim_target_months ?? 3,
            simMode: settings?.cmo_sim_mode ?? 'acelerador',
            maxBudget: settings?.cmo_sim_max_budget ?? 2000.00,
            startDate: settings?.cmo_sim_start_date ?? null,
            startSubs: settings?.cmo_sim_start_subs ?? null,
            reinvestRate: settings?.cmo_sim_reinvest_rate ?? 100,
            extraCash: settings?.cmo_sim_extra_cash ?? 0,
            curiosityGoal: settings?.cmo_sim_curiosity_goal ?? null,
            fixedOpex: settings?.cmo_sim_fixed_opex ?? 0,
            taxRate: settings?.cmo_sim_tax_rate ?? 0,
            otherVarRate: settings?.cmo_sim_other_var_rate ?? 0
        });
    } catch (error) {
        console.error('[CMO] Erro ao carregar simulator settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/cmo/simulator-settings — Salva a meta do simulador no banco
router.post('/simulator-settings', protect, admin, async (req, res) => {
    try {
        const db = require('../models');
        const { targetSubs, targetMonths, simMode, maxBudget, startSubs, reinvestRate, extraCash, curiosityGoal, fixedOpex, taxRate, otherVarRate } = req.body;
        
        try {
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_mode VARCHAR(255) DEFAULT 'acelerador';`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_max_budget DECIMAL(10,2) DEFAULT 2000.00;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_date TIMESTAMP;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_subs INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_reinvest_rate INTEGER DEFAULT 100;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_extra_cash DECIMAL(10,2) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_curiosity_goal INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_ai_action_plan TEXT;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_fixed_opex DECIMAL(10,2) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_tax_rate DECIMAL(5,4) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_other_var_rate DECIMAL(5,4) DEFAULT 0;`);
        } catch (e) {
            console.error('Raw ALTER TABLE skip in POST:', e.message);
        }
        
        let settings = null;
        try {
            settings = await db.SystemSetting.findOne();
        } catch (e) {
            console.error('findOne failed in POST:', e.message);
        }
        
        if (!settings) {
            settings = await db.SystemSetting.create({
                id: 1, // Garantindo que a primeira linha tenha o ID 1
                cmo_sim_target_subs: targetSubs !== undefined ? parseInt(targetSubs) : 70,
                cmo_sim_target_months: targetMonths !== undefined ? parseInt(targetMonths) : 3,
                cmo_sim_mode: simMode || 'acelerador',
                cmo_sim_max_budget: maxBudget !== undefined ? parseFloat(maxBudget) : 2000.00,
                cmo_sim_start_date: new Date(),
                cmo_sim_start_subs: startSubs !== undefined ? parseInt(startSubs) : null,
                cmo_sim_reinvest_rate: reinvestRate !== undefined ? parseInt(reinvestRate) : 100,
                cmo_sim_extra_cash: extraCash !== undefined ? parseFloat(extraCash) : 0,
                cmo_sim_curiosity_goal: curiosityGoal ? parseInt(curiosityGoal) : null,
                cmo_sim_fixed_opex: fixedOpex !== undefined ? parseFloat(fixedOpex) : 0,
                cmo_sim_tax_rate: taxRate !== undefined ? parseFloat(taxRate) : 0,
                cmo_sim_other_var_rate: otherVarRate !== undefined ? parseFloat(otherVarRate) : 0
            });
        } else {
            if (targetSubs !== undefined) settings.cmo_sim_target_subs = parseInt(targetSubs);
            if (targetMonths !== undefined) settings.cmo_sim_target_months = parseInt(targetMonths);
            if (simMode) settings.cmo_sim_mode = simMode;
            if (maxBudget !== undefined) settings.cmo_sim_max_budget = parseFloat(maxBudget);
            
            // Só atualiza a start date se o usuário estiver reiniciando a máquina
            if (startSubs !== undefined && req.body.resetTracking) {
                settings.cmo_sim_start_date = new Date();
                settings.cmo_sim_start_subs = parseInt(startSubs);
            }
            
            if (reinvestRate !== undefined) settings.cmo_sim_reinvest_rate = parseInt(reinvestRate);
            if (extraCash !== undefined) settings.cmo_sim_extra_cash = parseFloat(extraCash);
            settings.cmo_sim_curiosity_goal = (curiosityGoal !== undefined && curiosityGoal !== null && curiosityGoal !== '') ? parseInt(curiosityGoal) : null;
            if (fixedOpex !== undefined) settings.cmo_sim_fixed_opex = parseFloat(fixedOpex);
            if (taxRate !== undefined) settings.cmo_sim_tax_rate = parseFloat(taxRate);
            if (otherVarRate !== undefined) settings.cmo_sim_other_var_rate = parseFloat(otherVarRate);
            
            await settings.save();
        }
        
        res.json({ success: true, message: 'Configurações salvas', settings });
    } catch (error) {
        console.error('[CMO] Erro ao salvar simulator settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/cmo/action-plan - Recupera o último plano gerado
router.get('/action-plan', protect, admin, async (req, res) => {
    try {
        const db = require('../models');
        const setting = await db.SystemSetting.findOne();
        
        let html = setting ? setting.cmo_ai_action_plan : null;
        let canGenerateNew = true;
        let generatedAt = null;

        if (html) {
            const dateMatch = html.match(/<!-- DATE: (.*?) -->/);
            if (dateMatch) {
                generatedAt = new Date(dateMatch[1]);
                
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                const day = d.getDay();
                const diff = (day === 6) ? 0 : (day + 1); 
                d.setDate(d.getDate() - diff);
                const lastSaturday = d;
                
                if (generatedAt >= lastSaturday) {
                    canGenerateNew = false;
                }
            } else {
                // If there's an HTML but no date, allow generating a new one to start tracking
                canGenerateNew = true; 
            }
            // Optional: clean up the comment from the HTML sent to client
            html = html.replace(/<!-- DATE: .*? -->/, '');
        }

        res.json({ success: true, html, canGenerateNew });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao buscar plano' });
    }
});

// POST /api/cmo/generate-action-plan — Analisa a lucratividade e projeções do Simulador com IA
router.post('/generate-action-plan', protect, admin, async (req, res) => {
    try {
        const { 
            mrrAtual, mrr12M, reinvestRate, extraCash, cacAtual, cacPenalizado, unspentCash, 
            targetMetaDaily, currentMetaDailyBudget, availableForAcquisition1, 
            targetGoogleDaily, currentDailyGoogle, baseDaily, trialsDaily,
            safeMarginStatus, safeDistributableMargin, safeDistributableAmount,
            target30PercentStatus, gapTo30Percent,
            metaDataSource, histMetaSpendEffective,
            trialConvType, trialConvSource, trialConvValue,
            churnType, churnSource, churnValue,
            contactsType, contactsValue,
            organicType, organicSource, organicValue
        } = req.body;
        
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

        function calcAction(atual, ideal) {
            const a = parseFloat(atual.replace(/[^\d.,-]/g, '').replace(',', '.'));
            const i = parseFloat(ideal.replace(/[^\d.,-]/g, '').replace(',', '.'));
            if (!i || i === 0) return 'MANTER';
            const diff = Math.abs(a - i) / i;
            if (diff <= 0.10) return 'MANTER';
            return a < i ? 'AUMENTAR' : 'REDUZIR';
        }

        function formatActionText(atualStr, idealStr, action) {
            const a = parseFloat(atualStr.replace(/[^\d.,-]/g, '').replace(',', '.'));
            const i = parseFloat(idealStr.replace(/[^\d.,-]/g, '').replace(',', '.'));
            
            const formatVal = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
            const atualBRL = formatVal(a || 0);
            const idealBRL = formatVal(i || 0);
            const diffBRL = formatVal(Math.abs((i || 0) - (a || 0)));

            if (action === 'MANTER') {
                return `Mantenha ${atualBRL} por dia. O valor já está dentro da faixa de tolerância em relação ao alvo modelado de ${idealBRL}.`;
            } else if (action === 'AUMENTAR') {
                return `Aumente o orçamento diário de ${atualBRL} para ${idealBRL}. Isso representa um acréscimo de ${diffBRL} por dia.`;
            } else if (action === 'REDUZIR') {
                return `Reduza o orçamento diário de ${atualBRL} para ${idealBRL}.`;
            }
            return `Ajuste para ${idealBRL}`;
        }

        const metaAction = calcAction(currentMetaDailyBudget, targetMetaDaily);
        const googleAction = calcAction(currentDailyGoogle, targetGoogleDaily);
        
        const metaActionText = formatActionText(currentMetaDailyBudget, targetMetaDaily, metaAction);
        const googleActionText = formatActionText(currentDailyGoogle, targetGoogleDaily, googleAction);

        let metaScenarioContext = '';
        if (metaDataSource === 'MANUAL_SCENARIO') {
            metaScenarioContext = `
ATENÇÃO: Os dados do Meta Ads enviados (CAC = ${cacAtual} e Gasto Histórico = ${histMetaSpendEffective}) são HIPÓTESES DE CENÁRIO configuradas manualmente pelo usuário para testar projeções, e NÃO devem ser tratados como métricas atuais ou desempenho observado da operação da Yelo. Identifique explicitamente no seu diagnóstico que são dados de cenário hipotético ou hipóteses escolhidas pelo usuário.`;
        }
        
        let trialContext = '';
        if (trialConvType === 'PROXY') {
            trialContext = `ATENÇÃO: O cenário usa ${(trialConvValue * 100).toFixed(2)}% como proxy baseado nas coortes maduras de trial de 14 dias; ainda não há dados maduros suficientes do trial atual de 7 dias.`;
        }
        
        let churnContext = '';
        if (churnType === 'ASSUMED') {
            churnContext = `ATENÇÃO: O cenário usa churn mensal de ${(churnValue * 100).toFixed(2)}% como hipótese conservadora temporária porque a base recorrente da Yelo ainda não possui maturidade suficiente para estimar churn observado confiável. NÃO diga: "Seu churn atual é ${(churnValue * 100).toFixed(2)}%."`;
        }

        let contactsContext = '';
        if (contactsType === 'CONFIG') {
            contactsContext = `ATENÇÃO: O Motor usa uma meta agregada configurada de ${contactsValue} cliques WhatsApp por psicólogo elegível/mês para dimensionar a necessidade total de Google. Isso não garante distribuição individual uniforme. NÃO diga: "Cada psicólogo precisa receber exatamente ${contactsValue} pacientes."`;
        }

        let organicContext = '';
        if (organicType === 'OBSERVED' && organicSource === 'ORGANIC_CONFIRMED_WPP_CLICKS_30D') {
            organicContext = `Foram observados ${organicValue} cliques orgânicos confirmados nos últimos 30 dias.`;
        }

        const prompt = `Você é o Diretor de Crescimento (CMO) e Diretor Financeiro (CFO) da Yelo.
Analise os dados e produza um contexto curto e natural, sem jargões corporativos robóticos, APENAS para explicar a situação atual das métricas abaixo.
NÃO GERE AS AÇÕES (eu mesmo farei isso no sistema).
Gere apenas o trecho de "Diagnóstico" ou "Situação".
${metaScenarioContext}
${trialContext}
${churnContext}
${contactsContext}
${organicContext}

DADOS DO MOTOR:
- Margem Distribuível Segura: Status: ${safeMarginStatus} | Estimativa Atual: ${safeDistributableMargin}% (${safeDistributableAmount})

REGRAS:
1. Meta Ads e Google Ads: Você pode adicionar 1 ou 2 frases curtas de contexto explicando se os orçamentos estão abaixo ou acima.
2. NÃO ZERAR O CAIXA: Nunca instrua a "esgotar o fundo" ou diga que "sobra de caixa pequena = capital perfeitamente alocado".
3. LUCRATIVIDADE: Se o Status for MISSING_INPUT, o Diagnóstico DEVE ser: "Ainda não há dados financeiros suficientes para calcular uma retirada segura."

Retorne os resultados EXATAMENTE como um objeto JSON estruturado:
{
  "metaContext": "texto da situação do Meta",
  "googleContext": "texto da situação do Google",
  "lucroContext": "texto do diagnóstico de lucro"
}
Não retorne Markdown (sem \`\`\`json). Apenas o JSON puro.`;

        const result = await model.generateContent(prompt);
        let analysisRaw = result.response.text().trim();
        if (analysisRaw.startsWith('```json')) analysisRaw = analysisRaw.replace(/^```json/, '').replace(/```$/, '').trim();
        else if (analysisRaw.startsWith('```')) analysisRaw = analysisRaw.replace(/^```/, '').replace(/```$/, '').trim();
        
        let aiData = { metaContext: "Situação sob análise.", googleContext: "Situação sob análise.", lucroContext: "Ainda não há dados financeiros suficientes para calcular uma retirada segura." };
        try {
            aiData = JSON.parse(analysisRaw);
        } catch (e) {
            console.error("[CMO] Erro ao parsear JSON do Gemini:", analysisRaw);
        }
        
        const lucroActionText = safeMarginStatus === 'MISSING_INPUT'
            ? "Complete os dados financeiros pendentes antes de definir um percentual de lucro."
            : "Avalie a margem para retirar.";
        
        const analysis = `<!-- DATE: ${new Date().toISOString()} -->
<li><strong>Meta Ads (Aquisição):</strong> <br>🔍 <strong>Situação:</strong> ${aiData.metaContext} <br><br>💡 <strong>Ação:</strong> ${metaActionText}</li>
<br>
<li><strong>Google Ads (Google vs Meta Trials):</strong> <br>🔍 <strong>Situação:</strong> ${aiData.googleContext} <br><br>💡 <strong>Ação:</strong> ${googleActionText}</li>
<br>
<li><strong>Lucro e Caixa (ROI Geral):</strong> <br>🔍 <strong>Diagnóstico:</strong> ${aiData.lucroContext} <br><br>💡 <strong>Ação:</strong> ${lucroActionText}</li>`;

        const db = require('../models');
        let setting = await db.SystemSetting.findOne();
        if (setting) {
            await setting.update({ cmo_ai_action_plan: analysis });
        } else {
            await db.SystemSetting.create({ cmo_ai_action_plan: analysis });
        }

        // Return without the DATE comment to the frontend
        res.json({ success: true, html: analysis.replace(/<!-- DATE: .*? -->/, '') });
    } catch (error) {
        console.error('[CMO] Erro ao analisar ROI com IA:', error);
        
        const fallbackHTML = `
<li><strong>Meta Ads (Aquisição):</strong> <br>🔍 <strong>Fato Calculado:</strong> Sistema de IA temporariamente indisponível (Erro 503 no provedor). <br><br>💡 <strong>Sugestão Estratégica:</strong> Analise as métricas no topo desta página. Se o CAC estiver abaixo do teto saudável, considere aumentar gradativamente.</li>
<br>
<li><strong>Google Ads (Google vs Meta Trials):</strong> <br>🔍 <strong>Fato Calculado:</strong> Sistema de IA temporariamente indisponível. <br><br>💡 <strong>Sugestão Estratégica:</strong> Verifique o volume de Leads (B2C) travados na coluna de pendentes do funil antes de escalar o tráfego.</li>
`;
        res.json({ success: true, html: fallbackHTML });
    }
});


// ----------------------------------------------------
// ROTAS DE SNAPSHOT FINANCEIRO MENSAL
// ----------------------------------------------------
router.get('/monthly-finance', protect, admin, async (req, res) => {
    try {
        const { monthYear } = req.query; // format YYYY-MM
        if (!monthYear) return res.status(400).json({ error: 'monthYear required' });

        const snapshot = await db.YeloMonthlyFinance.findOne({ where: { monthYear } });
        const settings = await db.SystemSetting.findOne() || {};

        res.json({
            snapshot: snapshot || null,
            defaults: {
                tax_variable_rate: settings.tax_variable_rate,
                tax_fixed_monthly: settings.tax_fixed_monthly,
                required_cash_reserve: settings.required_cash_reserve
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/monthly-finance', protect, admin, async (req, res) => {
    try {
        const { monthYear, closingCashBalance, opexIsComplete, appliedTaxVariableRate, appliedTaxFixedMonthly, appliedRequiredCashReserve, action } = req.body;
        if (!monthYear) return res.status(400).json({ error: 'monthYear required' });

        let snapshot = await db.YeloMonthlyFinance.findOne({ where: { monthYear } });
        if (snapshot && snapshot.isClosed) {
            return res.status(403).json({ error: 'Mês já fechado. Não pode ser alterado.' });
        }


        if (!monthYear || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear)) {
            return res.status(400).json({ error: 'monthYear inválido. Deve ser YYYY-MM.' });
        }

        const parseFinance = (val, min, max) => {
            if (val === '' || val === null || val === undefined) return null;
            const num = parseFloat(val);
            if (isNaN(num)) throw new Error('Valor financeiro inválido: ' + val);
            if (min !== undefined && num < min) throw new Error('Valor abaixo do permitido: ' + val);
            if (max !== undefined && num > max) throw new Error('Valor acima do permitido: ' + val);
            return num;
        };

        let parsedClosingCash, parsedTaxVar, parsedTaxFix, parsedReserve;
        try {
            parsedClosingCash = parseFinance(closingCashBalance); // Pode ser negativo
            parsedTaxVar = parseFinance(appliedTaxVariableRate, 0, 1);
            parsedTaxFix = parseFinance(appliedTaxFixedMonthly, 0);
            parsedReserve = parseFinance(appliedRequiredCashReserve, 0);
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }

        const data = {
            closingCashBalance: parsedClosingCash,
            opexIsComplete: !!opexIsComplete,
            appliedTaxVariableRate: parsedTaxVar,
            appliedTaxFixedMonthly: parsedTaxFix,
            appliedRequiredCashReserve: parsedReserve
        };

        if (action === 'close') {
            if (data.closingCashBalance === null || data.appliedTaxVariableRate === null || data.appliedTaxFixedMonthly === null || data.appliedRequiredCashReserve === null || data.opexIsComplete !== true) {
                return res.status(422).json({ error: 'Mês não pode ser fechado porque possui campos financeiros incompletos.' });
            }

            data.isClosed = true;
            data.closedAt = new Date();
        }

        if (snapshot) {
            await snapshot.update(data);
        } else {
            snapshot = await db.YeloMonthlyFinance.create({ monthYear, ...data });
        }

        res.json({ success: true, snapshot });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Rota para analisar impacto do Motor V6
router.get('/v6-impact', protect, admin, async (req, res) => {
    try {
        const v6DeployDate = new Date('2026-10-06T21:40:00.000Z');
        const now = new Date();
        const daysSinceDeploy = Math.max(1, Math.floor((now - v6DeployDate) / (1000 * 60 * 60 * 24)));
        
        const beforeStartDate = new Date(v6DeployDate);
        beforeStartDate.setDate(beforeStartDate.getDate() - daysSinceDeploy);

        const psys = await db.Psychologist.findAll({
            where: {
                status: ['active', 'trial'],
                deletedAt: null
            },
            attributes: ['id', 'nome', 'status']
        });

        const stats = {
            before: { totalLeads: 0, starvingCount: 0, leadsPerPsy: [] },
            after: { totalLeads: 0, starvingCount: 0, leadsPerPsy: [] }
        };

        const getLeadsInPeriod = async (startDate, endDate) => {
            const logs = await db.sequelize.query(`
                SELECT 
                    "psychologistId", 
                    COUNT(*) as total_clicks,
                    SUM(CASE WHEN "contactReceived" = false OR "dealClosed" IN ('no_contact', 'ghosted', 'wpp_issue') THEN 1 ELSE 0 END) as invalid_clicks
                FROM "WhatsAppClickLogs" 
                WHERE "createdAt" >= :startDate AND "createdAt" < :endDate
                GROUP BY "psychologistId"
            `, { replacements: { startDate, endDate }, type: db.sequelize.QueryTypes.SELECT });

            const map = {};
            logs.forEach(l => {
                map[l.psychologistId] = parseInt(l.total_clicks) - parseInt(l.invalid_clicks || 0);
            });
            return map;
        };

        const leadsBefore = await getLeadsInPeriod(beforeStartDate, v6DeployDate);
        const leadsAfter = await getLeadsInPeriod(v6DeployDate, now);

        let tableData = [];

        psys.forEach(p => {
            const lb = leadsBefore[p.id] || 0;
            const la = leadsAfter[p.id] || 0;

            stats.before.totalLeads += lb;
            stats.after.totalLeads += la;

            if (lb === 0) stats.before.starvingCount++;
            if (la === 0) stats.after.starvingCount++;

            stats.before.leadsPerPsy.push({ name: p.nome, leads: lb });
            stats.after.leadsPerPsy.push({ name: p.nome, leads: la });

            if (lb > 0 || la > 0) {
                tableData.push({
                    id: p.id,
                    nome: p.nome.substring(0, 20),
                    leadsBefore: lb,
                    leadsAfter: la,
                    variation: la - lb
                });
            }
        });

        tableData.sort((a, b) => b.leadsAfter - a.leadsAfter);

        const top5Before = stats.before.leadsPerPsy.sort((a, b) => b.leads - a.leads).slice(0, 5).reduce((acc, curr) => acc + curr.leads, 0);
        const top5After = stats.after.leadsPerPsy.sort((a, b) => b.leads - a.leads).slice(0, 5).reduce((acc, curr) => acc + curr.leads, 0);

        const beforeConcentration = stats.before.totalLeads > 0 ? ((top5Before / stats.before.totalLeads) * 100).toFixed(1) : 0;
        const afterConcentration = stats.after.totalLeads > 0 ? ((top5After / stats.after.totalLeads) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            days: daysSinceDeploy,
            beforeStartDate: beforeStartDate.toISOString().split('T')[0],
            v6DeployDate: v6DeployDate.toISOString().split('T')[0],
            now: now.toISOString().split('T')[0],
            stats: {
                totalLeadsBefore: stats.before.totalLeads,
                totalLeadsAfter: stats.after.totalLeads,
                starvingBefore: stats.before.starvingCount,
                starvingAfter: stats.after.starvingCount,
                concentrationBefore: parseFloat(beforeConcentration),
                concentrationAfter: parseFloat(afterConcentration)
            },
            tableData
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
