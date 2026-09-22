const express = require('express');
const router = express.Router();
const metaAdsService = require('../services/metaAdsService');
const googleAdsService = require('../services/googleAdsService');
const { sequelize } = require('../models');
const moment = require('moment');
const db = require('../models');

// Rota de dashboard principal do CMO
router.get('/dashboard', async (req, res) => {
    try {
        // Data default para o mes atual
        const dateStart = req.query.dateStart || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const dateEnd = req.query.dateEnd || new Date().toISOString().split('T')[0];

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
                    AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))
                ) as trials,
                COUNT(*) FILTER (WHERE status = 'inactive' AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)) as churned,
                COUNT(*) FILTER (
                    WHERE status IN ('inactive', 'pending', 'active') 
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL AND ("subscription_payments_count" IS NULL OR "subscription_payments_count" = 0))
                    AND "planExpiresAt" <= NOW()
                ) as failed_trials
            FROM "Psychologists"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
            AND "deletedAt" IS NULL
            AND (
                utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
                OR first_utm_source IN ('facebook', 'instagram', 'ig', 'meta', 'fb', 'meta_ads')
            )
        `;

        const [metaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const [prevMetaMetricsRes] = await sequelize.query(b2bQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });

        const metaPagantes = parseInt(metaMetricsRes.pagantes || 0);
        const prevMetaPagantes = parseInt(prevMetaMetricsRes.pagantes || 0);
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
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
            AND "deletedAt" IS NULL
        `;
        const [globalB2BRes] = await sequelize.query(globalB2BQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
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
            AND "updatedAt" >= :dateStart AND "updatedAt" <= :dateEnd
            AND "deletedAt" IS NULL
        `;
        const [globalChurnRes] = await sequelize.query(globalChurnQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const globalChurned = parseInt(globalChurnRes.churned || 0);

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

        const globalActiveQuery = `
            SELECT 
                COUNT(*) FILTER (
                    WHERE status = 'active'
                    AND ("subscriptionId" IS NOT NULL OR "firstPaidAt" IS NOT NULL OR "subscription_payments_count" > 0)
                    AND "planExpiresAt" > NOW()
                    AND ("cancelAtPeriodEnd" IS NULL OR "cancelAtPeriodEnd" = false)
                ) as total_active,
                COUNT(*) FILTER (
                    WHERE status IN ('pending', 'active')
                    AND ("subscriptionId" IS NULL AND "firstPaidAt" IS NULL)
                    AND "planExpiresAt" > NOW()
                    AND ("fotoUrl" IS NOT NULL OR ("bio" IS NOT NULL AND "bio" != ''))
                ) as total_trials
            FROM "Psychologists"
            WHERE status IN ('pending', 'active')
            AND (is_exempt IS NULL OR is_exempt = false)
            AND "deletedAt" IS NULL
        `;
        const [globalActiveRes] = await sequelize.query(globalActiveQuery, { type: sequelize.QueryTypes.SELECT });
        const totalActive = parseInt(globalActiveRes.total_active || 0);
        const totalTrials = parseInt(globalActiveRes.total_trials || 0);
        const globalChurnRate = (totalActive + globalChurned) > 0 ? (globalChurned / (totalActive + globalChurned)) : 0;

        console.log('[CMO B2B Debug]', { dateStart, dateEnd, metaPagantes, metaTrials, metaChurned, globalChurned, globalChurnRate, raw: metaMetricsRes });


        const metaCac = metaPagantes > 0 ? (metaSpend.spend / metaPagantes) : 0;
        const prevMetaCac = prevMetaPagantes > 0 ? (prevMetaSpend.spend / prevMetaPagantes) : 0;

        const deltaMetaSpend = metaSpend.spend - prevMetaSpend.spend;
        const deltaMetaPagantes = metaPagantes - prevMetaPagantes;
        const metaMarginalCac = deltaMetaPagantes > 0 ? (deltaMetaSpend / deltaMetaPagantes) : 0;

        // Cálculo dinâmico do ARPU (MRR / Pagantes Ativos Globais)
        let arpu = 99;
        try {
            const pagantesAtivos = await db.Psychologist.findAll({
                where: {
                    status: 'active',
                    planExpiresAt: { [db.Sequelize.Op.gt]: new Date() },
                    cancelAtPeriodEnd: { [db.Sequelize.Op.or]: [false, null] }
                },
                attributes: ['id', 'plano', 'planExpiresAt', 'cancelAtPeriodEnd']
            });
            let settings = await db.SystemSetting.findOne() || {};
            const priceEssencial = settings.price_Essencial > 0 ? settings.price_Essencial : 99.00;
            const priceClinico = settings.price_Clínico > 0 ? settings.price_Clínico : 159.00;
            const priceReference = settings.price_sol > 0 ? settings.price_sol : 259.00;
            
            let mrrTotal = 0;
            let validPagantes = 0;
            for (const p of pagantesAtivos) {
                validPagantes++;
                if (p.plano === 'ESSENTIAL' || p.plano === 'Essencial') mrrTotal += Number(priceEssencial);
                else if (p.plano === 'CLINICAL' || p.plano === 'Clínico') mrrTotal += Number(priceClinico);
                else if (p.plano === 'REFERENCE' || p.plano === 'Sol' || p.plano === 'SOL') mrrTotal += Number(priceReference);
                else mrrTotal += Number(priceEssencial); // Fallback
            }
            if (validPagantes > 0) arpu = mrrTotal / validPagantes;
        } catch (e) {
            console.error('Erro ao calcular ARPU dinâmico no CMO:', e);
        }

        const metaChurnRate = metaPagantes > 0 ? (metaChurned / (metaPagantes + metaChurned)) : 0.05;
        const metaLtv = arpu / (metaChurnRate > 0 ? metaChurnRate : 0.05);
        const metaLtvCacRatio = metaCac > 0 ? (metaLtv / metaCac) : 0;

        // 4. Atribuição B2C (Google Ads -> Pacientes)
        const b2cQuery = `
            SELECT 
                COUNT(*) as wpp_clicks,
                SUM(CASE WHEN "utmSource" IN ('google', 'google_ads', 'gads', 'googleads', 'g_ads', 'cpc') THEN 1 ELSE 0 END) as google_wpp_clicks,
                SUM(CASE WHEN "dealClosed" IN ('yes', 'started') THEN 1 ELSE 0 END) as total_deals,
                SUM(CASE WHEN "dealClosed" IN ('no', 'no_reply', 'not_interested', 'did_not_reply') THEN 1 ELSE 0 END) as total_lost,
                SUM(CASE WHEN "dealClosed" IS NULL OR "dealClosed" = 'pending' THEN 1 ELSE 0 END) as total_pending
            FROM "WhatsAppClickLogs"
            WHERE "createdAt" >= :dateStart AND "createdAt" <= :dateEnd
        `;

        const [googleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart, dateEnd: dateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
        });
        const [prevGoogleMetricsRes] = await sequelize.query(b2cQuery, {
            replacements: { dateStart: prevDateStart, dateEnd: prevDateEnd + ' 23:59:59' }, type: sequelize.QueryTypes.SELECT
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

        res.json({
            success: true,
            period: { dateStart, dateEnd, prevDateStart, prevDateEnd },
            globalInsight: globalInsight,
            ads: {
                meta: { ...metaSpend, spend: metaSpend.spend, cac: metaCac, marginalCac: metaMarginalCac },
                google: { ...googleSpend, spend: actualGoogleSpend, cpl: googleCpl, marginalCpl: googleMarginalCpl }
            },
            campaigns: { meta: metaCampaigns, google: googleCampaigns },
            historical: {
                meta: { spend: metaSpendHistorical.spend, cac: histMetaCac, paybackMonths: histMetaPaybackMonths, churn_rate: histGlobalChurnRate, trial_conversion_rate: histConversionRate },
                google: { spend: actualGoogleSpendHistorical, cpl: histGoogleCpl },
                platform: {
                    b2b: { active: histMetaPagantes, trials: histMetaTrials, global_churn_rate: histGlobalChurnRate },
                    b2c: { wpp_clicks: histWppClicks, total_deals: histGoogleDeals }
                }
            },
            platform: {
                b2b: { arpu: arpu, active: metaPagantes, trials: metaTrials, churned: metaChurned, global_churn: globalChurned, meta_churn_rate: metaChurnRate, global_churn_rate: globalChurnRate, total_active: totalActive, total_trials: totalTrials, organic_active: organicPagantes, organic_trials: organicTrials, total_new_active: totalNewPagantes, total_new_trials: totalNewTrials, clicks_vs_churn: { active: clicksChurnActive, inactive: clicksChurnInactive } },
                b2c: { wpp_clicks: wppClicks, total_deals: googleDeals, pending_deals: pendingDeals, lost_deals: lostDeals, organic_wpp_clicks_90d: organicWppClicks90d }
            },
            decisionEngineMeta,
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
            settings.cmo_sim_curiosity_goal = curiosityGoal ? parseInt(curiosityGoal) : null;
            
            await settings.save();
        }
        
        res.json({ success: true, message: 'Configurações salvas' });
    } catch (error) {
        console.error('[CMO] Erro ao salvar simulator settings:', error);
        res.status(500).json({ success: false, error: error.message, stack: error.stack });
    }
});

module.exports = router;
