const express = require('express');
const router = express.Router();
const metaAdsService = require('../services/metaAdsService');
const googleAdsService = require('../services/googleAdsService');
const { sequelize } = require('../models');
const moment = require('moment');
const db = require('../models');
const matchService = require('../services/matchService');

// Rota de dashboard principal do CMO
router.get('/dashboard', async (req, res) => {
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
            if (!campaigns || campaigns.length === 0 || campaigns[0].id === 'ERRO_API' || campaigns[0].id === 'ERRO') return 0;
            const target = isGoogle 
                ? campaigns.find(c => c.campaign_name === targetNameOrId)
                : campaigns.find(c => (c.campaign_id || c.id) === targetNameOrId);
            return target ? (target.spend || 0) : 0;
        };

        const [metaCampaigns, googleCampaigns, prevMetaCampaigns, prevGoogleCampaigns, histMetaCampaigns, histGoogleCampaigns, metaBudgets] = await Promise.all([
            metaAdsService.getCampaignInsights(dateStart, dateEnd),
            googleAdsService.getCampaignInsights(dateStart, dateEnd),
            metaAdsService.getCampaignInsights(prevDateStart, prevDateEnd),
            googleAdsService.getCampaignInsights(prevDateStart, prevDateEnd),
            metaAdsService.getCampaignInsights('2026-05-01', dateEnd),
            googleAdsService.getCampaignInsights('2026-05-01', dateEnd),
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
        
        const googleTargetCamp = googleCampaigns.find(c => c.campaign_name === 'Yelo MVP - Busca SP');
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
                    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND ("is_exempt" IS NULL OR "is_exempt" = false)
                ) as pagantes,
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL AND "fotoUrl" NOT LIKE '%placehold.co%')
                    AND ("bio" IS NOT NULL AND LENGTH("bio") >= 10)
                ) as trials,
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND ("planExpiresAt" <= NOW() OR "status" = 'inactive')
                ) as churned,
                COUNT(*) FILTER (
                    WHERE ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
                    AND "planExpiresAt" <= NOW()
                ) as failed_trials
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
            AND "deletedAt" IS NULL
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
                    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                ) as total_new_pagantes,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'active')
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))
                ) as total_new_trials
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
            AND "deletedAt" IS NULL
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
            AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
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
                WHERE (p."subscriptionId" IS NOT NULL OR p."firstPaidAt" IS NOT NULL OR p."subscription_payments_count" > 0)
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
            AND ("is_exempt" IS NULL OR "is_exempt" = false)
            AND "planExpiresAt" > NOW()
            AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
        `;
        const globalPaidRes = await sequelize.query(globalPaidQuery, { type: sequelize.QueryTypes.SELECT });
        
        const paidAccessBase = globalPaidRes.length;
        const demandEligiblePaidBase = globalPaidRes.filter(p => matchService.isEligibleForMatch(p)).length;
        const totalActive = paidAccessBase;

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
        let renewableSubscriberBase = 0;
        let renewableDemandEligibleBase = 0;
        let renewableMRR = 0;
        let cashIn = 0;
        let arpu = 99;
        let pnlEngine = {};
        const AssumedTargetWhatsAppChatsPerPsi = 10;

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

        const googleCpl = googleWppClicks > 0 ? (actualGoogleSpend / googleWppClicks) : 0;
        const prevGoogleCpl = prevGoogleWppClicks > 0 ? (actualPrevGoogleSpend / prevGoogleWppClicks) : 0;

        const b2cOrganic90dQuery = `
            SELECT COUNT(*) as organic_wpp_clicks
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= NOW() - INTERVAL '90 days'
            AND ("utmSource" IS NULL OR "utmSource" NOT IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads', 'google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc'))
        `;
        const [organic90dRes] = await sequelize.query(b2cOrganic90dQuery, { type: sequelize.QueryTypes.SELECT });
        const organicWppClicks90d = parseInt(organic90dRes.organic_wpp_clicks || 0);

        try {
            const settings = await db.SystemSetting.findOne() || {};
            const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
            const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
            const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;

            const resRenewables = await sequelize.query(`
                SELECT p.*, s.status as sub_status, s.plan, p."cancelAtPeriodEnd" as p_cancel
                FROM "Psychologists" p
                LEFT JOIN "Subscriptions" s ON p."subscriptionId" = s.id
                WHERE p."deletedAt" IS NULL
                AND p."planExpiresAt" > NOW()
                AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
                AND (p.is_exempt IS NULL OR p.is_exempt = false)
            `, { type: sequelize.QueryTypes.SELECT });

            for (const r of resRenewables) {
                if (r.sub_status === 'ACTIVE' && r.p_cancel !== true) {
                    renewableSubscriberBase++;
                    if (r.plan === 'ESSENTIAL' || r.plan === 'Essencial') renewableMRR += Number(priceEssencial);
                    else if (r.plan === 'CLINICAL' || r.plan === 'Clínico') renewableMRR += Number(priceClinico);
                    else if (r.plan === 'REFERENCE' || r.plan === 'Sol' || r.plan === 'SOL') renewableMRR += Number(priceReference);
                    else renewableMRR += Number(priceEssencial);

                    // Check if this renewable user is demand eligible
                    if (matchService.isEligibleForMatch(r)) {
                        renewableDemandEligibleBase++;
                    }
                }
            }

            if (renewableSubscriberBase > 0) arpu = renewableMRR / renewableSubscriberBase;

            
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
            
            // --- YELO EXPENSES (OPEX) ---
            const expensesList = await db.YeloExpense.findAll({
                where: { 
                    monthYear: dateStart.substring(0, 7) // Assumindo formato YYYY-MM
                }
            });
            
            let FixedOPEX = 0;
            let OtherVariableOperatingCosts = 0;
            let unclassifiedCount = 0;
            let cashOpexPaid = 0;
            let hasFiscalConfig = false; // missing
            
            // OPEX_COMPLETENESS não pode ser provado por expensesList.length > 0
            let OPEX_COMPLETENESS = 'MISSING_INPUT'; // Até que admin declare

            let OwnerExtraCash = 'MISSING_INPUT'; 

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
                
                // cashOpexPaid DEVE ser apenas OPERATION, nunca GROWTH
                if (exp.purpose === 'OPERATION') {
                    cashOpexPaid += parseFloat(exp.amount || 0);
                }
            }

            const isProfitCertified = hasFiscalConfig && (OPEX_COMPLETENESS !== 'MISSING_INPUT') && unclassifiedCount === 0;

            const RevenueTaxes = 'MISSING_INPUT'; // não há config fiscal
            const NetRevenue = RevenueTaxes !== 'MISSING_INPUT' ? (ConfirmedGrossRevenue - RevenueTaxes - RealizedGatewayFees) : 'MISSING_INPUT';
            
            // Lógica Google Maintenance vs Growth Restaurada
            const RequiredWhatsAppChats = renewableDemandEligibleBase * AssumedTargetWhatsAppChatsPerPsi;
            // Considerando organic igual à query anterior (simplificado aqui caso não tenha o número ainda)
            const PaidWhatsAppChatsRequired = Math.max(0, RequiredWhatsAppChats - 0 /* OrganicWhatsAppChatsAllocatedToRenewableBase */);
            
            // Precisamos do CPC real ou usamos fallback
            const observedGoogleCostPerWhatsAppChat = (googleWppClicks > 0) ? (actualGoogleSpend / googleWppClicks) : 0; 
            const RequiredGoogleMaintenanceBudget = PaidWhatsAppChatsRequired * observedGoogleCostPerWhatsAppChat;
            
            const AllocatedGoogleMaintenanceSpend = Math.min(actualGoogleSpend, RequiredGoogleMaintenanceBudget);
            const AllocatedGoogleGrowthSpend = Math.max(0, actualGoogleSpend - AllocatedGoogleMaintenanceSpend);

            const MetaGrowthSpend = metaSpend.spend;

            const ContributionMargin = NetRevenue !== 'MISSING_INPUT' ? (NetRevenue - AllocatedGoogleMaintenanceSpend - OtherVariableOperatingCosts) : 'MISSING_INPUT';
            const OperatingProfitBeforeGrowth = ContributionMargin !== 'MISSING_INPUT' ? (ContributionMargin - FixedOPEX) : 'MISSING_INPUT';
            const OperatingProfitAfterGrowth = OperatingProfitBeforeGrowth !== 'MISSING_INPUT' ? (OperatingProfitBeforeGrowth - MetaGrowthSpend - AllocatedGoogleGrowthSpend) : 'MISSING_INPUT';

            const cashMarketingPaid = MetaGrowthSpend + AllocatedGoogleGrowthSpend;
            const currentCashBalance = 'MISSING_INPUT';
            
            const NetCashChange = (OwnerExtraCash !== 'MISSING_INPUT') ? (GatewayNetCash - cashOpexPaid - cashMarketingPaid + OwnerExtraCash) : 'MISSING_INPUT';

            pnlEngine = {
                LUCRO_GERENCIAL_CERTIFICADO: isProfitCertified,
                PROFIT_CERTIFICATION_BLOCKED: unclassifiedCount > 0 || !hasFiscalConfig || OPEX_COMPLETENESS === 'MISSING_INPUT',
                MISSING_INPUTS: [],
                managerial: {
                    ConfirmedGrossRevenue,
                    RevenueTaxes,
                    RealizedGatewayFees,
                    NetRevenue,
                    AllocatedGoogleMaintenanceSpend,
                    OtherVariableOperatingCosts,
                    ContributionMargin,
                    FixedOPEX,
                    OperatingProfitBeforeGrowth,
                    MetaGrowthSpend,
                    AllocatedGoogleGrowthSpend,
                    OperatingProfitAfterGrowth
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
                    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND (is_exempt IS NULL OR is_exempt = false)
                ) as pagantes,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'active')
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND (is_exempt IS NULL OR is_exempt = false)
                    AND "planExpiresAt" > NOW()
                ) as trials,
                COUNT(*) FILTER (WHERE status = 'inactive' AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)) as churned,
                COUNT(*) FILTER (
                    WHERE status IN ('inactive', 'pending', 'active') 
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
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
            AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
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
        const trueConversionRate = totalOportunidades > 0 ? (totalConvertidos / totalOportunidades) : 0.15;

        const histMetaSpendVal = metaSpendHistorical.spend;
        const startOfTime = new Date('2026-05-01T00:00:00Z');
        const endOfPeriod = new Date(dateEnd + 'T23:59:59Z');
        const histDays = Math.max(1, Math.ceil(Math.abs(endOfPeriod - startOfTime) / (1000 * 60 * 60 * 24)));
        const histMonths = histDays / 30;
        const histMetaMonthlySpendAvg = histMonths > 0 ? (histMetaSpendVal / histMonths) : 0;
        
        const trueCac = totalConvertidos > 0 ? (histMetaSpendVal / totalConvertidos) : 150;

        const histConversionRate = trueConversionRate;
        const histMetaCac = trueCac;
        const histMetaPaybackMonths = histMetaCac > 0 ? (histMetaCac / arpu) : 0;
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
            scaleCapacity: 'BAIXA', trend: googleCpl - prevGoogleCpl, warning: null, recommendation: 'Aguarde mais volume de cliques.'
        };
        if (wppClicks < 10) {
            decisionEngineGoogle.warning = `Amostra pequena (${wppClicks} cliques WPP). O custo por lead pode variar muito.`;
        }

        if (actualGoogleSpend > 0) {
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
                decisionEngineGoogle.warning = decisionEngineGoogle.warning || 'O custo marginal do lead (R$ ' + googleMarginalCpl.toFixed(2) + ') está subindo rápido.';
                decisionEngineGoogle.recommendation = 'Mantenha o orçamento do Google. O aumento recente trouxe contatos mais caros.';
            } else if (wppClicks === 0 && actualGoogleSpend > 50) {
                decisionEngineGoogle.action = 'PAUSAR / INVESTIGAR 🚨';
                decisionEngineGoogle.confidence = 90;
                decisionEngineGoogle.scaleCapacity = 'ZERO';
                decisionEngineGoogle.recommendation = 'Gasto no Google sem gerar nenhum contato WPP. Reveja as palavras-chave ou a landing page.';
            } else if (!isCplHealthy && actualGoogleSpend > 0) {
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

        // --- SIMULADOR MOTOR DE CRESCIMENTO (90 DIAS) ---
        let simMetaCac = null;
        let simGoogleCpl = 40;
        let simTrialConv = null;
        let simChurn = null;
        let simChurnType = 'ASSUMED';
        let knownScheduledChurn = 0;

        try {
            const dateEnd90 = new Date(dateEnd + 'T23:59:59.999Z');
            const dateStart90 = new Date(dateEnd90);
            dateStart90.setDate(dateStart90.getDate() - 90);
            const dateStart90Str = dateStart90.toISOString().split('T')[0];

            const [metaCampaigns90, googleCampaigns90] = await Promise.all([
                metaAdsService.getCampaignInsights(dateStart90Str, dateEnd),
                googleAdsService.getCampaignInsights(dateStart90Str, dateEnd)
            ]);

            const metaSpend90 = getTargetSpend(metaCampaigns90, '120251213168140531', false);
            
            // Correção: Gasto Google REAL de 90 dias lido do banco (ManualAdMetrics)
            const googleManual90 = await db.ManualAdMetric.findAll({
                where: { platform: 'google', dateEnd: { [Op.gte]: dateStart90Str } }
            });
            const googleSpend90 = googleManual90.reduce((acc, curr) => acc + parseFloat(curr.spend), 0);


            const [metaMetrics90Res] = await sequelize.query(b2bQuery, {
                replacements: { dateStart: dateStart90Str, nextDayStr }, type: sequelize.QueryTypes.SELECT
            });

            const metaPagantes90 = parseInt(metaMetrics90Res.pagantes || 0);
            const metaTrials90 = parseInt(metaMetrics90Res.trials || 0);
            const metaFailedTrials90 = parseInt(metaMetrics90Res.failed_trials || 0);

            if (metaPagantes90 > 0) {
                simMetaCac = metaSpend90 / metaPagantes90;
            } else if (metaTrials90 > 0) {
                simMetaCac = metaSpend90 / metaTrials90 * (1 / 0.15);
            }

            const totalOportunidades90 = metaPagantes90 + metaTrials90 + metaFailedTrials90;
            if (totalOportunidades90 > 0) {
                simTrialConv = metaPagantes90 / totalOportunidades90;
            }

            const globalChurn90dQuery = `
                SELECT COUNT(*) as churned
                FROM "Psychologists"
                WHERE status = 'inactive'
                AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                AND "updatedAt" >= :dateStart AND "updatedAt" < :nextDayStr
                AND "deletedAt" IS NULL
            `;
            const [globalChurn90dRes] = await sequelize.query(globalChurn90dQuery, {
                replacements: { dateStart: dateStart90Str, nextDayStr }, type: sequelize.QueryTypes.SELECT
            });
            const churned90d = parseInt(globalChurn90dRes.churned || 0);
            
            const churnRate90d = (totalActive + churned90d) > 0 ? (churned90d / (totalActive + churned90d)) : 0;
            
            const activePaidQuery = `
              SELECT 
                SUM(CASE WHEN ("cancelAtPeriodEnd" = true) THEN 1 ELSE 0 END) as scheduled_churn
              FROM "Psychologists" p
              LEFT JOIN "Subscriptions" s ON p."subscriptionId" = s.id
              WHERE p."deletedAt" IS NULL
              AND p."planExpiresAt" > NOW()
              AND ("subscriptionId" IS NOT NULL OR "subscription_payments_count" > 0)
            `;
            const [activePaidRes] = await sequelize.query(activePaidQuery, { type: sequelize.QueryTypes.SELECT });
            knownScheduledChurn = parseInt(activePaidRes.scheduled_churn || 0);

            if ((totalActive + churned90d) > 0) {
                // churnRate90d represents a cumulative 90-day churn.
                // The engine expects monthlyChurn, so we convert it:
                const monthlyChurnEq = 1 - Math.pow(1 - churnRate90d, 1 / 3);
                simChurn = monthlyChurnEq;
                simChurnType = 'PROXY'; // Preserved as PROXY because it relies on heuristic status updates rather than contractual logs
            } else {
                simChurn = null;
                simChurnType = 'PROXY'; // Preserved original proxy fallback classification if no data
            }


            const b2cQuery90 = `
                SELECT 
                    COUNT(*) as wpp_clicks,
                    SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= :dateStart AND "createdAt" < :nextDayStr
            `;
            const [googleMetrics90Res] = await sequelize.query(b2cQuery90, {
                replacements: { dateStart: dateStart90Str, nextDayStr }, type: sequelize.QueryTypes.SELECT
            });
            const googleWppClicks90 = parseInt(googleMetrics90Res.google_wpp_clicks || 0);
            
            if (googleWppClicks90 > 0) {
                simGoogleCpl = googleSpend90 / googleWppClicks90;
            } else if (googleSpend90 > 0) {
                simGoogleCpl = googleSpend90 / 1;
            }
        } catch (simError) {
            console.error('[CMO Metrics] Erro calculando Simulador 90d:', simError);
        }

        const demandEligibilityRate = renewableSubscriberBase > 0 ? (renewableDemandEligibleBase / renewableSubscriberBase) : 'MISSING_INPUT';

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
                cac: { value: simMetaCac, type: simMetaCac ? 'OBSERVED' : 'PROXY' },
                cpl: { value: simGoogleCpl, type: 'OBSERVED' },
                trialConv: { value: simTrialConv, type: simTrialConv ? 'OBSERVED' : 'MISSING_INPUT' },
                churn: { value: simChurn, type: simChurnType },
                knownScheduledChurn,
                renewableSubscriberBase,
                renewableDemandEligibleBase,
                demandEligiblePaidBase,
                demandEligibilityRate,
                contactsPerPaidPsiMonth: { value: AssumedTargetWhatsAppChatsPerPsi, type: 'ASSUMED' }
            },

            period: { dateStart, dateEnd, prevDateStart, prevDateEnd },
            globalInsight: globalInsight,
            ads: {
                meta: { ...metaSpend, spend: metaSpend.spend, cac: metaCac, marginalCac: metaMarginalCac },
                google: { ...googleSpend, spend: actualGoogleSpend, cpl: googleCpl, marginalCpl: googleMarginalCpl }
            },
            campaigns: { meta: metaCampaigns, google: googleCampaigns },
            prevCampaigns: { meta: prevMetaCampaigns, google: prevGoogleCampaigns },
            prevPlatform: {
                b2b: { active: prevMetaPagantes, trials: prevMetaTrials, meta_churn_rate: prevMetaChurnRate, global_churn_rate: prevGlobalChurnRate },
                b2c: { wpp_clicks: prevGoogleWppClicks, total_deals: prevGoogleDeals }
            },
            prevAds: {
                meta: { spend: prevMetaSpend.spend, cac: prevMetaCac },
                google: { spend: actualPrevGoogleSpend, cpl: prevGoogleCpl }
            },
            
            historical: {
                meta: { spend: metaSpendHistorical.spend, monthly_spend_avg: histMetaMonthlySpendAvg, cac: histMetaCac, paybackMonths: histMetaPaybackMonths, churn_rate: histGlobalChurnRate, trial_conversion_rate: histConversionRate, state: null, stateDate: null },

                google: { spend: actualGoogleSpendHistorical, cpl: histGoogleCpl },
                platform: {
                    b2b: { active: histMetaPagantes, trials: histMetaTrials, global_churn_rate: histGlobalChurnRate },
                    b2c: { wpp_clicks: histWppClicks, total_deals: histGoogleDeals }
                }
            },
            platform: {
                pnl: pnlEngine,
                b2b: { arpu: arpu, active: metaPagantes, trials: metaTrials, churned: metaChurned, global_churn: globalChurned, meta_churn_rate: metaChurnRate, global_churn_rate: globalChurnRate, total_active: totalActive, total_trials: totalTrials, organic_active: organicPagantes, organic_trials: organicTrials, total_new_active: totalNewPagantes, total_new_trials: totalNewTrials, clicks_vs_churn: { active: clicksChurnActive, inactive: clicksChurnInactive }, cashIn, renewableMRR },
                b2c: { wpp_clicks: wppClicks, total_deals: googleDeals, pending_deals: pendingDeals, lost_deals: lostDeals, organic_wpp_clicks_90d: organicWppClicks90d }
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
router.post('/manual-ads', async (req, res) => {
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
router.get('/manual-ads', async (req, res) => {
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
router.delete('/manual-ads', async (req, res) => {
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
router.get('/traffic', async (req, res) => {
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
router.get('/simulator-settings', async (req, res) => {
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
        } catch (e) {
            console.error('Raw ALTER TABLE skip in GET:', e.message);
        }

        let settings = null;
        try {
            settings = await db.SystemSetting.findOne({
                attributes: ['id', 'cmo_sim_target_subs', 'cmo_sim_target_months', 'cmo_sim_mode', 'cmo_sim_max_budget', 'cmo_sim_start_date', 'cmo_sim_start_subs', 'cmo_sim_reinvest_rate', 'cmo_sim_extra_cash', 'cmo_sim_curiosity_goal']
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
            curiosityGoal: settings?.cmo_sim_curiosity_goal ?? null
        });
    } catch (error) {
        console.error('[CMO] Erro ao carregar simulator settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/cmo/simulator-settings — Salva a meta do simulador no banco
router.post('/simulator-settings', async (req, res) => {
    try {
        const db = require('../models');
        const { targetSubs, targetMonths, simMode, maxBudget, startSubs, reinvestRate, extraCash, curiosityGoal } = req.body;
        
        try {
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_mode VARCHAR(255) DEFAULT 'acelerador';`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_max_budget DECIMAL(10,2) DEFAULT 2000.00;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_date TIMESTAMP;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_start_subs INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_reinvest_rate INTEGER DEFAULT 100;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_extra_cash DECIMAL(10,2) DEFAULT 0;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_sim_curiosity_goal INTEGER;`);
            await db.sequelize.query(`ALTER TABLE "SystemSettings" ADD COLUMN IF NOT EXISTS cmo_ai_action_plan TEXT;`);
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
                cmo_sim_curiosity_goal: curiosityGoal ? parseInt(curiosityGoal) : null
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
            
            await settings.save();
        }
        
        res.json({ success: true, message: 'Configurações salvas', settings });
    } catch (error) {
        console.error('[CMO] Erro ao salvar simulator settings:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/cmo/action-plan - Recupera o último plano gerado
router.get('/action-plan', async (req, res) => {
    try {
        const db = require('../models');
        const setting = await db.SystemSetting.findOne();
        res.json({ success: true, html: setting ? setting.cmo_ai_action_plan : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao buscar plano' });
    }
});

// POST /api/cmo/generate-action-plan — Analisa a lucratividade e projeções do Simulador com IA
router.post('/generate-action-plan', async (req, res) => {
    try {
        const { 
            mrrAtual, mrr12M, reinvestRate, extraCash, cacAtual, cacPenalizado, unspentCash, 
            targetMetaDaily, currentMetaDailyBudget, availableForAcquisition1, 
            targetGoogleDaily, currentDailyGoogle, baseDaily, trialsDaily,
            safeMarginStatus, safeDistributableMargin, safeDistributableAmount,
            target30PercentStatus, gapTo30Percent
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

        const metaAction = calcAction(currentMetaDailyBudget, targetMetaDaily);
        const googleAction = calcAction(currentDailyGoogle, targetGoogleDaily);

        const prompt = `Você é o Diretor de Crescimento (CMO) e Diretor Financeiro (CFO) da Yelo.
Analise os dados e produza um Plano de Ação curto e natural, sem jargões corporativos robóticos.

DADOS DO MOTOR:
- MRR Atual: ${mrrAtual}
- CAC B2B Atual: ${cacAtual} | CAC Projetado (Teto): ${cacPenalizado}
- Orçamento Diário Meta Atual: ${currentMetaDailyBudget} | Orçamento Ideal (Meta): ${targetMetaDaily}
- Orçamento Diário Google Atual: ${currentDailyGoogle} | Orçamento Ideal (Google): ${targetGoogleDaily}
- Margem Distribuível Segura: Status: ${safeMarginStatus} | Estimativa Atual: ${safeDistributableMargin}% (${safeDistributableAmount})
- Meta 30% de Retirada: ${target30PercentStatus} | Gap de Custo para chegar lá: ${gapTo30Percent}
- Ação Determinística Meta: ${metaAction}
- Ação Determinística Google: ${googleAction}

REGRAS RÍGIDAS DE ANÁLISE:
1. FAIXA DE TOLERÂNCIA E AÇÃO DETERMINÍSTICA: Você NÃO deve decidir o que fazer com os orçamentos do Meta e do Google. A decisão JÁ FOI TOMADA matematicamente e está no campo "Ação Determinística" (MANTER, AUMENTAR ou REDUZIR). Sua única função é transformar essa ação em um texto analítico e natural. Se a ação for MANTER, diga que a variação está dentro da margem de segurança de 10%.
2. NÃO ZERAR O CAIXA: Nunca instrua a "esgotar o fundo" ou diga que "sobra de caixa pequena = capital perfeitamente alocado". Valorize a margem de segurança e a reserva de caixa para imprevistos e volatilidade.
3. LUCRATIVIDADE: Se o Status da Margem Distribuível for MISSING_INPUT, você DEVE dizer EXATAMENTE: "Ainda não há dados financeiros suficientes para calcular uma retirada segura." e não deve inventar, supor ou estimar nenhum percentual. Caso o Status seja OK, responda "Quanto posso retirar hoje?" e "Posso retirar 30%?". Se não puder, explique o que falta. Exemplo: "Com os custos conhecidos, a operação ainda não sustenta uma retirada de 30% com segurança. A margem hoje é de X% (R$ Y). Para chegar aos 30%, reduza custos ou aumente o MRR."
4. NATURALIDADE: Limite o texto a 3 blocos. Cada bloco deve ter no máximo 3-4 frases curtas (Situação atual, Ação e Por quê). Evite repetir números que já estão no painel visual do usuário.

INSTRUÇÕES DE FORMATAÇÃO:
Retorne APENAS o HTML das 3 tags <li> exatamente com os títulos abaixo (sem tags extras).
<li><strong>Meta Ads (Aquisição):</strong> <br>🔍 <strong>Situação:</strong> [Texto] <br><br>💡 <strong>Ação:</strong> [Texto]</li>
<br>
<li><strong>Google Ads (Google vs Meta Trials):</strong> <br>🔍 <strong>Situação:</strong> [Texto] <br><br>💡 <strong>Ação:</strong> [Texto]</li>
<br>
<li><strong>Lucro e Caixa (ROI Geral):</strong> <br>🔍 <strong>Diagnóstico de Retirada:</strong> [Texto sobre a Margem Segura] <br><br>💡 <strong>Ação:</strong> [Texto]</li>`;

        const result = await model.generateContent(prompt);
        let analysis = result.response.text().trim();
        
        if (analysis.startsWith('```html')) {
            analysis = analysis.replace(/^```html/, '').replace(/```$/, '').trim();
        } else if (analysis.startsWith('```')) {
            analysis = analysis.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const db = require('../models');
        let setting = await db.SystemSetting.findOne();
        if (setting) {
            await setting.update({ cmo_ai_action_plan: analysis });
        } else {
            await db.SystemSetting.create({ cmo_ai_action_plan: analysis });
        }

        res.json({ success: true, html: analysis });
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

module.exports = router;
