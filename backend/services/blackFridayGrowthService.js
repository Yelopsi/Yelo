// backend/services/blackFridayGrowthService.js
const defaultDb = require('../models');
const { Op } = require('sequelize');
const googleAdsService = require('./googleAdsService');
const metaAdsService = require('./metaAdsService');
const promoCouponService = require('./promoCouponService');
const emailService = require('./emailService');

const DEFAULT_CONFIG = {
    minGoogleBudgetReais: 90,
    maxGoogleBudgetReais: 200,
    targetMonthlyClicksPerPayer: 2.75,
    catchupDays: 14,
    minBudgetLostImpressionShare: 0.20,
    maxCostPerPaidWhatsappReais: 34.0,
    maxCplJumpRatio: 1.25,
    maxDailyStepUpPct: 0.20,
    maxDailyStepDownPct: 0.15,
    minChangeThresholdReais: 5,
    pauseHungryRatio: 0.55,
    cautionHungryRatio: 0.35,
    minHealthyMonthlyDeliveryPerPayer: 1.8,
    healthyMonthlyDeliveryPerPayer: 2.8,
    standardBatchSize: 20,
    cautionBatchSize: 10,
    boostedBatchSize: 25
};

/**
 * Classifica UTM de clique no WhatsApp seguindo a mesma regra do Match V6.1 (matchService.js).
 */
function isPaidUtmSource(utmSource) {
    const utm = String(utmSource || '').trim().toLowerCase();
    if (!utm) return false;
    return (
        utm.includes('google') ||
        utm.includes('adwords') ||
        utm.includes('cpc') ||
        utm === 'gads' ||
        utm.includes('meta') ||
        utm.includes('facebook') ||
        utm.includes('fb_ads')
    );
}

/**
 * Função pura de decisão: avalia demanda dos pagantes, cliques orgânicos vs pagos,
 * eficiência do leilão Google Ads (teto R$ 200/dia apenas se justificável) e tamanho seguro do lote de e-mails.
 */
function evaluateTrafficAndCapacity(snapshot = {}, userConfig = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...userConfig };

    const activePayers = Math.max(0, Number(snapshot.activePayers || 0));
    const activePayersZeroClicks14d = Math.max(0, Number(snapshot.activePayersZeroClicks14d || 0));
    const organicClicks7d = Math.max(0, Number(snapshot.organicClicks7d || 0));
    const paidClicks7d = Math.max(0, Number(snapshot.paidClicks7d || 0));
    const totalClicks7d = organicClicks7d + paidClicks7d;

    const currentBudgetReais = Number(snapshot.googleAds?.currentBudgetReais ?? cfg.minGoogleBudgetReais);
    const spend7d = Math.max(0, Number(snapshot.googleAds?.spend7d || 0));
    const prevSpend7d = Math.max(0, Number(snapshot.googleAds?.prevSpend7d || 0));
    const prevPaidClicks7d = Math.max(0, Number(snapshot.prevPaidClicks7d || 0));
    const conversions7d = Math.max(0, Number(snapshot.googleAds?.conversions7d || 0));
    const lostBudgetIS = Number(snapshot.googleAds?.searchBudgetLostImpressionShare ?? 0);

    const invitesSentTotal = Math.max(0, Number(snapshot.bfFunnel?.invitesSentTotal || 0));
    const convertedTotal = Math.max(0, Number(snapshot.bfFunnel?.convertedTotal || 0));
    const readyEligibleCount = Math.max(0, Number(snapshot.bfFunnel?.readyEligibleCount || 0));

    // 1. Taxa real de entrega atual (considerando orgânico + pago juntos)
    const organicClicksPerDay = organicClicks7d / 7;
    const paidClicksPerDay = paidClicks7d / 7;
    const totalClicksPerDay = totalClicks7d / 7;
    const monthlyDeliveryPerPayer = activePayers > 0
        ? (totalClicksPerDay * 30) / activePayers
        : 0;
    const hungryRatio = activePayers > 0
        ? activePayersZeroClicks14d / activePayers
        : 0;

    // 2. Taxa de adesão observada da campanha (ou prior conservador de 8% antes de 20 envios)
    const hasReliableAdhesionSample = invitesSentTotal >= 20;
    const observedAdhesionRate = hasReliableAdhesionSample
        ? (convertedTotal / invitesSentTotal)
        : 0.08;

    // 3. Tamanho adaptativo do lote de e-mails baseado em capacidade + adesão
    let recommendedBatchSize = cfg.standardBatchSize;
    let emailAction = 'SEND_STANDARD';
    const emailReasons = [];

    const googleAtOrNearCap = currentBudgetReais >= (cfg.maxGoogleBudgetReais - 5);

    if (readyEligibleCount === 0) {
        recommendedBatchSize = 0;
        emailAction = 'PAUSE_EMPTY_QUEUE';
        emailReasons.push('Não há mais perfis elegíveis aguardando envio.');
    } else if (
        (hungryRatio > cfg.pauseHungryRatio && googleAtOrNearCap) ||
        (monthlyDeliveryPerPayer < cfg.minHealthyMonthlyDeliveryPerPayer && invitesSentTotal > 0)
    ) {
        recommendedBatchSize = 0;
        emailAction = 'PAUSE_CAPACITY';
        emailReasons.push(
            `Capacidade de entrega apertada (${monthlyDeliveryPerPayer.toFixed(2)} cliques/pagante/mês, ${(hungryRatio * 100).toFixed(0)}% sem cliques em 14d). Pausando envios até a entrega estabilizar.`
        );
    } else if (hungryRatio >= cfg.cautionHungryRatio || (hasReliableAdhesionSample && observedAdhesionRate >= 0.14)) {
        recommendedBatchSize = cfg.cautionBatchSize;
        emailAction = 'THROTTLE_CAUTIOUS';
        if (hungryRatio >= cfg.cautionHungryRatio) {
            emailReasons.push(`${(hungryRatio * 100).toFixed(0)}% dos pagantes ativos estão sem clique nos últimos 14 dias — lote reduzido para ${cfg.cautionBatchSize}.`);
        }
        if (hasReliableAdhesionSample && observedAdhesionRate >= 0.14) {
            emailReasons.push(`Adesão alta (${(observedAdhesionRate * 100).toFixed(1)}%) — dosando novos retornos em ${cfg.cautionBatchSize} convites.`);
        }
    } else if (
        monthlyDeliveryPerPayer >= cfg.healthyMonthlyDeliveryPerPayer &&
        hasReliableAdhesionSample &&
        observedAdhesionRate <= 0.05
    ) {
        recommendedBatchSize = cfg.boostedBatchSize;
        emailAction = 'SEND_BOOSTED';
        emailReasons.push(
            `Entrega saudável (${monthlyDeliveryPerPayer.toFixed(2)} cliques/pagante/mês) e adesão moderada (${(observedAdhesionRate * 100).toFixed(1)}%) — lote ampliado para ${cfg.boostedBatchSize}.`
        );
    } else {
        emailReasons.push(
            `Ritmo padrão (${cfg.standardBatchSize} envios) com entrega atual de ${monthlyDeliveryPerPayer.toFixed(2)} cliques/pagante/mês.`
        );
    }

    recommendedBatchSize = Math.min(recommendedBatchSize, readyEligibleCount);

    // 4. Demanda total de cliques/dia considerando novos pagantes esperados deste lote
    const projectedNewPayers = Math.round(recommendedBatchSize * observedAdhesionRate);
    const projectedActivePayers = activePayers + projectedNewPayers;
    const baseDailyClicksNeeded = projectedActivePayers * (cfg.targetMonthlyClicksPerPayer / 30);
    const catchupDailyClicksNeeded = activePayersZeroClicks14d / cfg.catchupDays;
    const totalDailyClicksNeeded = baseDailyClicksNeeded + catchupDailyClicksNeeded;

    // SUBTRAI cliques orgânicos reais para NÃO inflar Google Ads quando orgânico dá conta!
    const neededPaidClicksPerDay = Math.max(0, totalDailyClicksNeeded - organicClicksPerDay);

    // 5. Custo real por clique qualificado (WhatsApp pago) e validação anti-inflação
    let observedCostPerPaidClick = 22.0;
    if (spend7d > 0 && paidClicks7d > 0) {
        observedCostPerPaidClick = spend7d / paidClicks7d;
    } else if (spend7d > 0 && conversions7d > 0) {
        observedCostPerPaidClick = spend7d / conversions7d;
    }

    const prevCostPerPaidClick = (prevSpend7d > 0 && prevPaidClicks7d > 0)
        ? (prevSpend7d / prevPaidClicks7d)
        : 0;
    const cplJumpRatio = prevCostPerPaidClick > 0
        ? (observedCostPerPaidClick / prevCostPerPaidClick)
        : 1.0;

    const rawDesiredGoogleBudget = neededPaidClicksPerDay * observedCostPerPaidClick;
    const boundedDesiredBudget = Math.min(
        cfg.maxGoogleBudgetReais,
        Math.max(cfg.minGoogleBudgetReais, rawDesiredGoogleBudget)
    );

    let recommendedGoogleBudget = currentBudgetReais;
    let googleAdsAction = 'HOLD';
    const googleAdsReasons = [];

    const wantsScaleUp = boundedDesiredBudget > (currentBudgetReais + cfg.minChangeThresholdReais);
    const wantsScaleDown = boundedDesiredBudget < (currentBudgetReais - cfg.minChangeThresholdReais);

    if (wantsScaleUp) {
        const auctionHasBudgetHeadroom = lostBudgetIS >= cfg.minBudgetLostImpressionShare;
        const cplHealthy = observedCostPerPaidClick <= cfg.maxCostPerPaidWhatsappReais;
        const cplStable = cplJumpRatio <= cfg.maxCplJumpRatio;

        if (!auctionHasBudgetHeadroom) {
            googleAdsAction = 'HOLD_LOW_BUDGET_LOST_IS';
            googleAdsReasons.push(
                `Aumento travado: lostBudgetIS em ${(lostBudgetIS * 100).toFixed(1)}% (< ${(cfg.minBudgetLostImpressionShare * 100).toFixed(0)}%). Aumentar verba agora só encareceria o CPC sem comprar impressões reais.`
            );
        } else if (!cplHealthy) {
            googleAdsAction = 'HOLD_CPL_TOO_HIGH';
            googleAdsReasons.push(
                `Aumento travado: custo por clique pago no WhatsApp está em R$ ${observedCostPerPaidClick.toFixed(2)} (acima do teto justificável de R$ ${cfg.maxCostPerPaidWhatsappReais.toFixed(2)}).`
            );
        } else if (!cplStable) {
            googleAdsAction = 'HOLD_CPL_SPIKE';
            googleAdsReasons.push(
                `Aumento travado: CPL subiu ${((cplJumpRatio - 1) * 100).toFixed(1)}% vs semana anterior — respeitando trava anti-leilão inflacionado.`
            );
        } else {
            const maxAllowedStepUp = currentBudgetReais * (1 + cfg.maxDailyStepUpPct);
            recommendedGoogleBudget = Number(Math.min(cfg.maxGoogleBudgetReais, Math.min(boundedDesiredBudget, maxAllowedStepUp)).toFixed(2));
            googleAdsAction = 'SCALE_UP';
            googleAdsReasons.push(
                `Escala justificada: demanda necessária = ${totalDailyClicksNeeded.toFixed(2)} cliques/dia (${organicClicksPerDay.toFixed(2)} orgânicos + ${neededPaidClicksPerDay.toFixed(2)} pagos), lostBudgetIS = ${(lostBudgetIS * 100).toFixed(1)}% e custo/WhatsApp pago saudável em R$ ${observedCostPerPaidClick.toFixed(2)}.`
            );
        }
    } else if (wantsScaleDown && currentBudgetReais > cfg.minGoogleBudgetReais) {
        const maxAllowedStepDown = currentBudgetReais * (1 - cfg.maxDailyStepDownPct);
        recommendedGoogleBudget = Number(Math.max(cfg.minGoogleBudgetReais, Math.max(boundedDesiredBudget, maxAllowedStepDown)).toFixed(2));
        googleAdsAction = 'SCALE_DOWN';
        googleAdsReasons.push(
            `Redução inteligente: cliques orgânicos (${organicClicksPerDay.toFixed(2)}/dia) + base atual já cobrem a necessidade com orçamento menor (${boundedDesiredBudget.toFixed(2)}/dia).`
        );
    } else {
        recommendedGoogleBudget = Number(Math.min(cfg.maxGoogleBudgetReais, Math.max(cfg.minGoogleBudgetReais, currentBudgetReais)).toFixed(2));
        googleAdsAction = 'HOLD';
        googleAdsReasons.push(
            `Orçamento atual (R$ ${currentBudgetReais.toFixed(2)}/dia) adequado à demanda paga residual (${neededPaidClicksPerDay.toFixed(2)} cliques pagos/dia após ${organicClicksPerDay.toFixed(2)} orgânicos/dia).`
        );
    }

    // Se o Google Ads NÃO pôde escalar por leilão caro/saturado e a fila já está apertada, freia o lote de e-mails para proteger pagantes
    if (
        (googleAdsAction === 'HOLD_CPL_TOO_HIGH' || googleAdsAction === 'HOLD_CPL_SPIKE') &&
        hungryRatio >= cfg.cautionHungryRatio &&
        recommendedBatchSize > 0
    ) {
        recommendedBatchSize = 0;
        emailAction = 'PAUSE_ADS_INEFFICIENT';
        emailReasons.push('Google Ads segurou escala por custo elevado e já há pagantes sem clique — lote pausado para não sobrecarregar entrega.');
    }

    return {
        metrics: {
            activePayers,
            projectedActivePayers,
            activePayersZeroClicks14d,
            hungryRatio: Number(hungryRatio.toFixed(4)),
            organicClicks7d,
            paidClicks7d,
            organicClicksPerDay: Number(organicClicksPerDay.toFixed(2)),
            paidClicksPerDay: Number(paidClicksPerDay.toFixed(2)),
            monthlyDeliveryPerPayer: Number(monthlyDeliveryPerPayer.toFixed(2)),
            totalDailyClicksNeeded: Number(totalDailyClicksNeeded.toFixed(2)),
            neededPaidClicksPerDay: Number(neededPaidClicksPerDay.toFixed(2)),
            observedCostPerPaidClick: Number(observedCostPerPaidClick.toFixed(2)),
            lostBudgetIS: Number(lostBudgetIS.toFixed(4)),
            observedAdhesionRate: Number(observedAdhesionRate.toFixed(4)),
            hasReliableAdhesionSample
        },
        googleAdsDecision: {
            action: googleAdsAction,
            currentBudgetReais: Number(currentBudgetReais.toFixed(2)),
            rawDesiredBudgetReais: Number(rawDesiredGoogleBudget.toFixed(2)),
            recommendedBudgetReais: recommendedGoogleBudget,
            minBudgetReais: cfg.minGoogleBudgetReais,
            maxBudgetReais: cfg.maxGoogleBudgetReais,
            reasons: googleAdsReasons
        },
        emailDecision: {
            action: emailAction,
            recommendedBatchSize,
            readyEligibleCount,
            reasons: emailReasons
        }
    };
}

function classifyExpiredCandidate(psi) {
    const wasPayer = Boolean(
        Number(psi.subscription_payments_count || 0) > 0 ||
        psi.subscriptionId ||
        psi.firstPaidAt ||
        Number(psi.lifetimeRevenue || 0) > 0
    );
    const hasPhoto = Boolean(psi.fotoUrl && String(psi.fotoUrl).trim() !== '' && !String(psi.fotoUrl).includes('placehold.co'));
    const hasBio = Boolean(psi.bio && String(psi.bio).trim().length >= 10);
    const hasCpf = Boolean(psi.cpf && String(psi.cpf).trim() !== '');
    const matchReady = hasPhoto && hasBio && hasCpf;
    const clicks = parseInt(psi.whatsapp_clicks || 0, 10);

    if (wasPayer) {
        return { wave: 1, waveKey: 'wave1_ex_payer', variant: 'ex_payer', priority: 1, matchReady, clicks };
    }
    if (matchReady && clicks >= 2) {
        return { wave: 1, waveKey: 'wave1_trial_hot_2plus', variant: 'trial_with_clicks', priority: 2, matchReady, clicks };
    }
    if (matchReady && clicks === 1) {
        return { wave: 2, waveKey: 'wave2_trial_warm_1click', variant: 'trial_with_clicks', priority: 3, matchReady, clicks };
    }
    if (matchReady && clicks === 0) {
        return { wave: 3, waveKey: 'wave3_trial_cold_ready', variant: 'trial_no_clicks', priority: 4, matchReady, clicks };
    }
    return { wave: 0, waveKey: null, variant: null, priority: 99, matchReady, clicks };
}

/**
 * Seleciona e ordena os perfis elegíveis prontos para receber convite Black Friday em micro-lotes (Wave 1 -> Wave 2 -> Wave 3),
 * respeitando opt-out de newsletter e prontidão de perfil para Match.
 */
async function getOrderedEligibleRecipients(db = defaultDb, options = {}) {
    const now = new Date();
    const waveFilter = options.waveFilter ? Number(options.waveFilter) : null;

    const expiredCandidates = await db.Psychologist.findAll({
        where: {
            deletedAt: null,
            isAdmin: { [Op.or]: [false, null] },
            is_exempt: { [Op.or]: [false, null] },
            email: { [Op.ne]: null },
            status: { [Op.ne]: 'content_creator' },
            [Op.or]: [
                { status: { [Op.in]: ['inactive', 'vencido', 'canceled'] } },
                {
                    status: { [Op.in]: ['active', 'trial'] },
                    planExpiresAt: { [Op.lte]: now }
                }
            ]
        },
        attributes: [
            'id', 'nome', 'email', 'crp', 'bio', 'fotoUrl', 'cpf',
            'status', 'plano', 'subscriptionId', 'subscription_payments_count',
            'firstPaidAt', 'lifetimeRevenue', 'planExpiresAt', 'whatsapp_clicks',
            'profile_appearances', 'valor_sessao_numero', 'createdAt'
        ]
    });

    const unsubRows = db.NewsletterSubscription
        ? await db.NewsletterSubscription.findAll({ where: { status: 'unsubscribed' }, attributes: ['email'] }).catch(() => [])
        : [];
    const unsubSet = new Set(unsubRows.map((u) => String(u.email || '').trim().toLowerCase()));

    const sentLogs = db.SystemLog
        ? await db.SystemLog.findAll({
            where: {
                [Op.or]: [
                    { message: { [Op.like]: '[BF2026_SENT]%' } },
                    { message: { [Op.like]: '[BF2026_OFFER_GRANTED]%' } }
                ]
            },
            attributes: ['message', 'meta']
        }).catch(() => [])
        : [];

    const alreadyInvitedIds = new Set();
    const sentLastCallIds = new Set();
    for (const log of sentLogs) {
        const msg = String(log.message || '');
        const match = msg.match(/psi:(\d+)/);
        const pid = log.meta?.psychologistId ? Number(log.meta.psychologistId) : (match ? Number(match[1]) : null);
        if (!pid) continue;
        if (msg.includes('wave:4')) sentLastCallIds.add(pid);
        else alreadyInvitedIds.add(pid);
    }

    const queue = [];
    for (const psi of expiredCandidates) {
        const emailClean = String(psi.email || '').trim().toLowerCase();
        if (!emailClean || !emailClean.includes('@') || unsubSet.has(emailClean)) continue;

        const cls = classifyExpiredCandidate(psi);
        if (cls.wave === 0) continue;

        if (waveFilter === 4) {
            if (sentLastCallIds.has(psi.id)) continue;
            queue.push({ psi, wave: 4, waveKey: 'wave4_last_call', variant: 'bf_last_call', priority: cls.priority, clicks: cls.clicks, matchReady: cls.matchReady });
        } else {
            if (alreadyInvitedIds.has(psi.id)) continue;
            if (waveFilter && cls.wave !== waveFilter) continue;
            queue.push({ psi, ...cls });
        }
    }

    queue.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const priceA = Number(a.psi.valor_sessao_numero || 999);
        const priceB = Number(b.psi.valor_sessao_numero || 999);
        const affordableA = priceA <= 120 ? 0 : 1;
        const affordableB = priceB <= 120 ? 0 : 1;
        if (affordableA !== affordableB) return affordableA - affordableB;
        return b.clicks - a.clicks;
    });

    return {
        queue,
        alreadyInvitedCount: alreadyInvitedIds.size
    };
}

/**
 * Coleta snapshot em modo SOMENTE LEITURA do banco e APIs de tráfego pago.
 */
async function collectLiveSnapshot(options = {}) {
    const db = options.db || defaultDb;
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activePayers = await db.Psychologist.findAll({
        where: {
            status: 'active',
            is_exempt: { [Op.not]: true },
            subscriptionId: { [Op.ne]: null },
            [Op.or]: [
                { planExpiresAt: null },
                { planExpiresAt: { [Op.gt]: now } }
            ]
        },
        attributes: ['id']
    });
    const activePayerIds = activePayers.map(p => p.id);

    let activePayersZeroClicks14d = 0;
    if (activePayerIds.length > 0 && db.WhatsAppClickLog) {
        const recentPayersWithClicks = await db.WhatsAppClickLog.findAll({
            where: {
                psychologistId: { [Op.in]: activePayerIds },
                createdAt: { [Op.gte]: d14 }
            },
            attributes: ['psychologistId'],
            group: ['psychologistId']
        }).catch(() => []);
        const fedIds = new Set(recentPayersWithClicks.map(r => r.psychologistId));
        activePayersZeroClicks14d = activePayerIds.filter(id => !fedIds.has(id)).length;
    }

    let organicClicks7d = 0;
    let paidClicks7d = 0;
    if (db.WhatsAppClickLog) {
        const clicksLast7 = await db.WhatsAppClickLog.findAll({
            where: { createdAt: { [Op.gte]: d7 } },
            attributes: ['utmSource']
        }).catch(() => []);
        for (const row of clicksLast7) {
            if (isPaidUtmSource(row.utmSource)) paidClicks7d++;
            else organicClicks7d++;
        }
    }

    // Google Ads (somente leitura)
    let googleAdsData = {
        currentBudgetReais: 90,
        spend7d: 0,
        prevSpend7d: 0,
        clicks7d: 0,
        conversions7d: 0,
        searchBudgetLostImpressionShare: 0,
        budgetResourceName: null
    };

    if (options.googleAdsMock) {
        googleAdsData = { ...googleAdsData, ...options.googleAdsMock };
    } else if (googleAdsService.isConfigured()) {
        try {
            const endStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const start7Str = d7.toISOString().split('T')[0];
            const prevEndStr = new Date(d7.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const prevStartStr = d14.toISOString().split('T')[0];

            const [curDetails, prevDetails] = await Promise.all([
                googleAdsService.getActiveCampaignDetails(start7Str, endStr),
                googleAdsService.getActiveCampaignDetails(prevStartStr, prevEndStr).catch(() => [])
            ]);

            if (curDetails.length > 0) {
                const primary = curDetails[0];
                googleAdsData.currentBudgetReais = primary.dailyBudgetReais || 90;
                googleAdsData.spend7d = curDetails.reduce((s, c) => s + (c.spend || 0), 0);
                googleAdsData.clicks7d = curDetails.reduce((s, c) => s + (c.clicks || 0), 0);
                googleAdsData.conversions7d = curDetails.reduce((s, c) => s + (c.conversions || 0), 0);
                googleAdsData.searchBudgetLostImpressionShare = primary.searchBudgetLostImpressionShare || 0;
                googleAdsData.budgetResourceName = primary.budgetResourceName || null;
            }
            if (prevDetails.length > 0) {
                googleAdsData.prevSpend7d = prevDetails.reduce((s, c) => s + (c.spend || 0), 0);
            }
        } catch (adsErr) {
            console.warn('[BFGrowth] Falha ao ler Google Ads ao vivo:', adsErr.message);
        }
    }

    // Cliques pagos na semana anterior (para comparar spike de CPL)
    let prevPaidClicks7d = 0;
    if (db.WhatsAppClickLog) {
        const clicksPrev7 = await db.WhatsAppClickLog.findAll({
            where: {
                createdAt: { [Op.gte]: d14, [Op.lt]: d7 }
            },
            attributes: ['utmSource']
        }).catch(() => []);
        for (const row of clicksPrev7) {
            if (isPaidUtmSource(row.utmSource)) prevPaidClicks7d++;
        }
    }

    // Estatísticas do funil Black Friday
    const { queue } = await getOrderedEligibleRecipients(db);
    let invitesSentTotal = 0;
    let convertedTotal = 0;
    if (db.SystemLog) {
        invitesSentTotal = await db.SystemLog.count({
            where: { message: { [Op.like]: '[BF2026_OFFER_GRANTED]%' } }
        }).catch(() => 0);
        convertedTotal = await db.SystemLog.count({
            where: { message: { [Op.like]: '[PROMO_CONSUMED] BF2026_EMAIL%' } }
        }).catch(() => 0);
    }

    return {
        activePayers: activePayerIds.length,
        activePayersZeroClicks14d,
        organicClicks7d,
        paidClicks7d,
        prevPaidClicks7d,
        googleAds: googleAdsData,
        bfFunnel: {
            readyEligibleCount: queue.length,
            invitesSentTotal,
            convertedTotal
        },
        queue
    };
}

/**
 * Executa um ciclo completo de balanceamento (ou simulação dryRun=true):
 * 1) Avalia demanda orgânica + paga e recomenda/aplica ajuste no Google Ads (R$ 90..R$ 200);
 * 2) Libera oferta exclusiva por e-mail + envia micro-lote adaptado para fila elegível.
 */
async function runAdaptiveStep(options = {}) {
    const db = options.db || defaultDb;
    const dryRun = options.dryRun !== false; // Seguro por padrão: somente executa se dryRun === false!
    const applyGoogleBudget = Boolean(options.applyGoogleBudget);
    const sendEmails = Boolean(options.sendEmails);
    const pauseMetaAds = Boolean(options.pauseMetaAds);
    const batchOverride = options.limit ? Number(options.limit) : null;

    const snapshot = await collectLiveSnapshot({
        db,
        googleAdsMock: options.googleAdsMock
    });
    const decision = evaluateTrafficAndCapacity(snapshot, options.config || {});

    const targetBatchSize = batchOverride !== null
        ? Math.min(batchOverride, snapshot.queue.length)
        : decision.emailDecision.recommendedBatchSize;

    const selectedBatch = snapshot.queue.slice(0, targetBatchSize);

    const actionsLog = {
        dryRun,
        metaAdsResult: null,
        googleAdsMutation: null,
        emailsDispatched: []
    };

    // 1. Pausa Meta Ads B2B (se solicitado)
    if (pauseMetaAds) {
        actionsLog.metaAdsResult = await metaAdsService.pauseCampaign(null, { dryRun });
    }

    // 2. Ajusta orçamento Google Ads apenas quando justificável (e sempre validateOnly=true em dryRun!)
    if (
        applyGoogleBudget &&
        (decision.googleAdsDecision.action === 'SCALE_UP' || decision.googleAdsDecision.action === 'SCALE_DOWN')
    ) {
        actionsLog.googleAdsMutation = await googleAdsService.updateCampaignDailyBudget(
            decision.googleAdsDecision.recommendedBudgetReais,
            {
                validateOnly: dryRun,
                budgetResourceName: snapshot.googleAds.budgetResourceName,
                minBudgetReais: decision.googleAdsDecision.minBudgetReais,
                maxBudgetReais: decision.googleAdsDecision.maxBudgetReais
            }
        );
    }

    // 3. Disparo adaptativo vinculando oferta estritamente ao (psychologist.id, email)
    if (sendEmails && selectedBatch.length > 0) {
        for (const item of selectedBatch) {
            if (dryRun) {
                actionsLog.emailsDispatched.push({
                    id: item.psi.id,
                    email: item.psi.email,
                    wave: item.waveKey,
                    variant: item.variant,
                    status: 'DRY_RUN'
                });
                continue;
            }

            await promoCouponService.grantBlackFridayOffer(item.psi, {
                db,
                wave: item.waveKey
            });
            await emailService.sendBlackFridayEmail(item.psi, item.variant);
            if (db.SystemLog) {
                await db.SystemLog.create({
                    level: 'info',
                    message: `[BF2026_SENT] ${item.waveKey} | psi:${item.psi.id} | email:${promoCouponService.normalizeEmail(item.psi.email)}`,
                    meta: {
                        psychologistId: item.psi.id,
                        email: promoCouponService.normalizeEmail(item.psi.email),
                        wave: item.waveKey,
                        variant: item.variant
                    }
                }).catch(() => {});
            }
            actionsLog.emailsDispatched.push({
                id: item.psi.id,
                email: item.psi.email,
                wave: item.waveKey,
                variant: item.variant,
                status: 'SENT'
            });
        }
    }

    return {
        snapshot: {
            activePayers: snapshot.activePayers,
            activePayersZeroClicks14d: snapshot.activePayersZeroClicks14d,
            organicClicks7d: snapshot.organicClicks7d,
            paidClicks7d: snapshot.paidClicks7d,
            googleAds: snapshot.googleAds,
            bfFunnel: snapshot.bfFunnel
        },
        decision,
        plannedBatchPreview: selectedBatch.map(s => ({
            id: s.psi.id,
            nome: s.psi.nome,
            email: s.psi.email,
            wave: s.waveKey,
            clicks: s.clicks
        })),
        actionsLog
    };
}

module.exports = {
    DEFAULT_CONFIG,
    isPaidUtmSource,
    evaluateTrafficAndCapacity,
    getOrderedEligibleRecipients,
    collectLiveSnapshot,
    runAdaptiveStep
};
