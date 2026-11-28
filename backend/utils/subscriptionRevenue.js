const { Op } = require('sequelize');

const VALID_PAYMENT_STATUSES = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_MONTH = 30.4375;

function round2(value) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

function resolvePlanKey(plano) {
    if (!plano) return null;
    const raw = String(plano).trim().toLowerCase();
    if (['essencial', 'essential'].includes(raw)) return 'essential';
    if (['clínico', 'clinico', 'clinical'].includes(raw)) return 'clinical';
    if (['sol', 'reference'].includes(raw)) return 'reference';
    return null;
}

function buildPlanPrices(sysSettings = {}) {
    const pEss = sysSettings?.price_Essencial > 0 ? Number(sysSettings.price_Essencial) : 99.00;
    const pCli = sysSettings?.price_Clínico > 0 ? Number(sysSettings.price_Clínico) : 159.00;
    const pRef = sysSettings?.price_sol > 0 ? Number(sysSettings.price_sol) : 259.00;
    return {
        essential: pEss,
        clinical: pCli,
        reference: pRef,
        essencial: pEss,
        clínico: pCli,
        clinico: pCli,
        sol: pRef
    };
}

function parseSubscriptionPlanMeta(planValue) {
    if (!planValue) return null;
    const raw = String(planValue).trim();
    if (!raw) return null;

    if (raw.startsWith('{')) {
        try {
            const parsed = JSON.parse(raw);
            const cycle = String(parsed.cycle || 'MONTHLY').toUpperCase();
            const installmentCount = Number(parsed.installmentCount || (cycle === 'SEMIANNUAL' ? 6 : cycle === 'QUARTERLY' ? 3 : 1));
            return {
                planType: parsed.planType || 'ESSENTIAL',
                cycle,
                installmentCount,
                totalValue: Number(parsed.totalValue || 0)
            };
        } catch (_e) {
            return null;
        }
    }

    const upper = raw.toUpperCase();
    const planType = upper.split('_')[0] || 'ESSENTIAL';
    if (upper.endsWith('_SEMIANNUAL')) {
        return { planType, cycle: 'SEMIANNUAL', installmentCount: 6, totalValue: 594 };
    }
    if (upper.endsWith('_QUARTERLY')) {
        return { planType, cycle: 'QUARTERLY', installmentCount: 3, totalValue: 387 };
    }
    return { planType, cycle: 'MONTHLY', installmentCount: 1, totalValue: 0 };
}

function parseValidDate(value) {
    if (!value) return null;
    const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
    return d;
}

function getPaymentEffectiveDate(payment) {
    if (!payment) return null;
    return parseValidDate(payment.paymentDate || payment.dueDate || payment.createdAt || payment.dateCreated);
}

function computeMonthsFromDates(startVal, endVal) {
    const start = parseValidDate(startVal);
    const end = parseValidDate(endVal);
    if (!start || !end || end <= start) return 1;
    const diffDays = (end.getTime() - start.getTime()) / MS_PER_DAY;
    if (diffDays < 55) return 1;
    return Math.max(2, Math.round(diffDays / AVG_DAYS_PER_MONTH));
}

function formatMoneyCompact(val) {
    const rounded = round2(val);
    const isInt = Math.abs(rounded - Math.round(rounded)) < 0.005;
    return rounded.toLocaleString('pt-BR', {
        minimumFractionDigits: isInt ? 0 : 2,
        maximumFractionDigits: 2
    });
}

/**
 * Calcula a receita mensal efetiva (MRR real), o valor nominal de tabela pós-promo,
 * os meses cobertos pelo pagamento vigente e metadados para exibição.
 */
function computePsychologistRevenueSummary(psy, context = {}, options = {}) {
    const planPrices = context.planPrices || buildPlanPrices();
    const planKey = resolvePlanKey(psy?.plano);
    const nominalMonthly = round2((planKey && planPrices[planKey]) ? planPrices[planKey] : 0);

    if (!psy || psy.is_exempt) {
        return {
            effectiveMonthly: 0,
            nominalMonthly: 0,
            monthsCovered: 1,
            paidAmount: 0,
            isMultiMonthPromo: false,
            cycleLabel: 'VIP',
            planDisplayName: `${psy?.plano || 'VIP'} (VIP)`
        };
    }

    const hasSub = !!(psy.subscriptionId) || (Number(psy.subscription_payments_count || 0) > 0) || !!(psy.firstPaidAt);
    if (!hasSub) {
        return {
            effectiveMonthly: 0,
            nominalMonthly: 0,
            monthsCovered: 1,
            paidAmount: 0,
            isMultiMonthPromo: false,
            cycleLabel: 'Trial',
            planDisplayName: `${psy.plano || 'ESSENTIAL'} (Trial)`
        };
    }

    const atDate = parseValidDate(options.atDate);
    const subById = context.subscriptionsById;
    const subByPsi = context.subscriptionsByPsi;
    const paymentsByPsi = context.paymentsByPsi;

    const sub = (psy.subscriptionId && subById?.get(psy.subscriptionId)) || subByPsi?.get(psy.id) || null;
    const subMeta = sub ? parseSubscriptionPlanMeta(sub.plan) : null;

    const rawPayments = paymentsByPsi?.get(psy.id) || [];
    const validPayments = rawPayments
        .filter(p => VALID_PAYMENT_STATUSES.includes(p.status))
        .filter(p => {
            if (!atDate) return true;
            const pDate = getPaymentEffectiveDate(p);
            return pDate && pDate <= atDate;
        })
        .sort((a, b) => {
            const da = getPaymentEffectiveDate(a)?.getTime() || 0;
            const db = getPaymentEffectiveDate(b)?.getTime() || 0;
            return db - da;
        });

    const latestPayment = validPayments[0] || null;
    const latestPayVal = latestPayment ? round2(parseFloat(latestPayment.value || 0)) : 0;

    // 1. Planos novos com ciclo estruturado (Trimestral/Semestral 2027+)
    if (subMeta && (subMeta.cycle === 'QUARTERLY' || subMeta.cycle === 'SEMIANNUAL')) {
        const cycleMonths = subMeta.cycle === 'SEMIANNUAL' ? 6 : 3;
        const total = subMeta.totalValue > 0 ? subMeta.totalValue : (latestPayVal > 0 ? latestPayVal : nominalMonthly * cycleMonths);
        const eff = round2(total / cycleMonths);
        const cycleLabel = cycleMonths === 6 ? 'Semestral' : 'Trimestral';
        const basePlano = psy.plano || subMeta.planType || 'ESSENTIAL';
        return {
            effectiveMonthly: eff,
            nominalMonthly: nominalMonthly || eff,
            monthsCovered: cycleMonths,
            paidAmount: round2(total),
            isMultiMonthPromo: eff + 0.5 < nominalMonthly,
            cycleLabel,
            planDisplayName: `${basePlano} · ${cycleLabel} (R$ ${formatMoneyCompact(eff)}/mês)`
        };
    }

    // 2. Cobertura real por período da assinatura / pagamento (suporta promos pague X, leve Y)
    let monthsCovered = 1;
    const subStart = parseValidDate(sub?.currentPeriodStart);
    const subEnd = parseValidDate(sub?.currentPeriodEnd);

    if (subStart && subEnd) {
        const subCoversTarget = !atDate || (subStart <= atDate && subEnd >= atDate);
        if (subCoversTarget) {
            monthsCovered = computeMonthsFromDates(subStart, subEnd);
        }
    } else if (!atDate) {
        const payStart = getPaymentEffectiveDate(latestPayment) || parseValidDate(psy.subscribedAt);
        const psiEnd = parseValidDate(psy.planExpiresAt);
        if (payStart && psiEnd) {
            const rawDays = (psiEnd.getTime() - payStart.getTime()) / MS_PER_DAY;
            // Evita falso positivo em mensais com ~7-14d de trial/carência acumulados
            if (rawDays >= 55) {
                monthsCovered = computeMonthsFromDates(payStart, psiEnd);
            }
        }
    }

    let effectiveMonthly = nominalMonthly;
    if (latestPayVal > 0) {
        effectiveMonthly = monthsCovered > 1 ? round2(latestPayVal / monthsCovered) : latestPayVal;
    } else if (monthsCovered > 1 && nominalMonthly > 0) {
        // Sem pagamento local registrado, mantém valor de tabela
        effectiveMonthly = nominalMonthly;
    }

    const isPromoDiscount = effectiveMonthly > 0 && nominalMonthly > 0 && (effectiveMonthly + 0.5 < nominalMonthly);
    const isMultiMonth = monthsCovered > 1;
    const isMultiMonthPromo = isMultiMonth || isPromoDiscount;
    const basePlano = psy.plano || 'ESSENTIAL';

    let cycleLabel = 'Mensal';
    if (monthsCovered === 2) cycleLabel = 'Bimestral (2m)';
    else if (monthsCovered === 3) cycleLabel = 'Trimestral (3m)';
    else if (monthsCovered === 6) cycleLabel = 'Semestral (6m)';
    else if (monthsCovered > 1) cycleLabel = `${monthsCovered} meses`;

    let planDisplayName = basePlano;
    if (isMultiMonth && isPromoDiscount) {
        planDisplayName = `${basePlano} · Promo ${monthsCovered}m (R$ ${formatMoneyCompact(effectiveMonthly)}/mês)`;
    } else if (isMultiMonth) {
        planDisplayName = `${basePlano} · ${monthsCovered}m (R$ ${formatMoneyCompact(effectiveMonthly)}/mês)`;
    } else if (isPromoDiscount) {
        planDisplayName = `${basePlano} · Promo (R$ ${formatMoneyCompact(effectiveMonthly)}/mês)`;
    }

    return {
        effectiveMonthly,
        nominalMonthly,
        monthsCovered,
        paidAmount: latestPayVal || round2(effectiveMonthly * monthsCovered),
        isMultiMonthPromo,
        cycleLabel,
        planDisplayName
    };
}

/**
 * Carrega assinaturas, pagamentos válidos e configurações de preço uma única vez
 * para cálculos consistentes de MRR efetivo em dashboards e relatórios.
 */
async function loadRevenueContext(db, options = {}) {
    const psychologistIds = Array.isArray(options.psychologistIds) && options.psychologistIds.length > 0
        ? options.psychologistIds
        : null;

    const payWhere = { status: { [Op.in]: VALID_PAYMENT_STATUSES } };
    const subWhere = {};
    if (psychologistIds) {
        payWhere.psychologistId = { [Op.in]: psychologistIds };
        subWhere.psychologistId = { [Op.in]: psychologistIds };
    }

    const [subscriptions, payments, sysSettings] = await Promise.all([
        db.Subscription
            ? db.Subscription.findAll({
                where: subWhere,
                attributes: ['id', 'psychologistId', 'plan', 'status', 'currentPeriodStart', 'currentPeriodEnd', 'updatedAt'],
                raw: true
            }).catch(() => [])
            : Promise.resolve([]),
        db.Payment
            ? db.Payment.findAll({
                where: payWhere,
                attributes: ['id', 'psychologistId', 'subscriptionId', 'value', 'status', 'paymentDate', 'dueDate', 'createdAt'],
                raw: true
            }).catch(() => [])
            : Promise.resolve([]),
        options.sysSettings
            ? Promise.resolve(options.sysSettings)
            : (db.SystemSetting ? db.SystemSetting.findOne().catch(() => ({})) : Promise.resolve({}))
    ]);

    const subscriptionsById = new Map();
    const subscriptionsByPsi = new Map();
    for (const s of (subscriptions || [])) {
        if (s.id) subscriptionsById.set(s.id, s);
        if (s.psychologistId) {
            const existing = subscriptionsByPsi.get(s.psychologistId);
            if (!existing || new Date(s.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
                subscriptionsByPsi.set(s.psychologistId, s);
            }
        }
    }

    const paymentsByPsi = new Map();
    for (const p of (payments || [])) {
        if (!p.psychologistId) continue;
        if (!paymentsByPsi.has(p.psychologistId)) paymentsByPsi.set(p.psychologistId, []);
        paymentsByPsi.get(p.psychologistId).push(p);
    }

    const planPrices = options.planPrices || buildPlanPrices(sysSettings || {});
    return {
        subscriptionsById,
        subscriptionsByPsi,
        paymentsByPsi,
        planPrices
    };
}

module.exports = {
    VALID_PAYMENT_STATUSES,
    round2,
    resolvePlanKey,
    buildPlanPrices,
    parseSubscriptionPlanMeta,
    computeMonthsFromDates,
    formatMoneyCompact,
    computePsychologistRevenueSummary,
    loadRevenueContext
};
