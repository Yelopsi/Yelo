// backend/services/promoCouponService.js
const db = require('../models');
const { Op } = require('sequelize');

const PROMO_COUPONS = {
    BLACK2X1: {
        code: 'BLACK2X1',
        aliases: ['BLACK99', 'YELO2X1', 'VOLTEI2X1'],
        title: 'Black Friday Yelo: 2 meses por R$ 99,00',
        subtitle: 'Pague 1 mês (R$ 99,00) e ganhe +1 mês bônus (60 dias no total). Renovação automática por R$ 99/mês após 60 dias.',
        type: 'EXTRA_MONTHS',
        totalMonths: 2,
        minDays: 60,
        allowedPlans: ['ESSENTIAL'],
        expiresAt: process.env.BLACK_FRIDAY_EXPIRES_AT || '2026-12-01T02:59:59.000Z', // 30/11/2026 23:59:59 BRT
        onlyExpired: true
    }
};

function normalizeCouponCode(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return '';
    const cleaned = rawCode.trim().toUpperCase();
    for (const key of Object.keys(PROMO_COUPONS)) {
        const cfg = PROMO_COUPONS[key];
        if (cfg.code === cleaned || (Array.isArray(cfg.aliases) && cfg.aliases.includes(cleaned))) {
            return cfg.code;
        }
    }
    return cleaned;
}

function addMonthsWithMinDays(baseDate, months = 1, minDays = 30) {
    const start = new Date(baseDate.getTime());
    const target = new Date(start.getTime());
    const startDay = target.getDate();
    target.setMonth(target.getMonth() + months);
    // Evita overflow de fim de mês (ex: 31/12 + 2 meses -> 28/02)
    if (target.getDate() < startDay) {
        target.setDate(0);
    }
    const minTarget = new Date(start.getTime() + minDays * 24 * 60 * 60 * 1000);
    return target < minTarget ? minTarget : target;
}

function isPsychologistExpiredOrInactive(psychologist, now = new Date()) {
    if (!psychologist) return false;
    if (psychologist.is_exempt) return false;
    const status = String(psychologist.status || '').toLowerCase();
    if (status === 'inactive' || status === 'vencido' || status === 'canceled') return true;
    if (!psychologist.planExpiresAt) return false;
    return new Date(psychologist.planExpiresAt) <= now;
}

async function hasConsumedPromo(psychologistId, canonicalCode) {
    if (!psychologistId || !canonicalCode || !db.SystemLog) return false;
    const consumed = await db.SystemLog.findOne({
        where: {
            message: { [Op.like]: `[PROMO_CONSUMED] ${canonicalCode} | psi:${psychologistId}%` }
        }
    }).catch(() => null);
    return Boolean(consumed);
}

async function validateCouponForPsychologist(rawCode, psychologist, normalizedPlan = 'ESSENTIAL', options = {}) {
    const now = new Date();
    const vipCoupon = process.env.VIP_COUPON;
    const rawTrimmed = String(rawCode || '').trim();

    if (!rawTrimmed) {
        return { valid: false, reason: 'Informe um código de cupom.' };
    }

    if (vipCoupon && rawTrimmed.toUpperCase() === vipCoupon.toUpperCase()) {
        return {
            valid: true,
            isVip: true,
            code: vipCoupon.toUpperCase(),
            title: 'Cupom VIP Aplicado',
            subtitle: 'Acesso completo liberado.'
        };
    }

    const canonicalCode = normalizeCouponCode(rawTrimmed);
    const config = PROMO_COUPONS[canonicalCode];

    if (!config) {
        return { valid: false, reason: 'Cupom inválido ou não encontrado.' };
    }

    if (config.expiresAt && new Date(config.expiresAt) < now) {
        return { valid: false, reason: 'Esta campanha promocional foi encerrada.' };
    }

    if (options.isIosFee) {
        return { valid: false, reason: 'Este cupom promocional não se aplica à taxa de aplicativo iOS.' };
    }

    const planKey = String(normalizedPlan || 'ESSENTIAL').toUpperCase();
    if (!config.allowedPlans.includes(planKey)) {
        return { valid: false, reason: 'Este cupom é válido exclusivamente para o Plano Essencial.' };
    }

    if (!psychologist) {
        return { valid: false, reason: 'Psicólogo não identificado.' };
    }

    if (psychologist.is_exempt) {
        return { valid: false, reason: 'Perfis VIP isentos não precisam aplicar cupom.' };
    }

    if (config.onlyExpired && !isPsychologistExpiredOrInactive(psychologist, now)) {
        return {
            valid: false,
            reason: 'Este cupom é exclusivo para reativação de perfis expirados ou inativos.'
        };
    }

    const alreadyUsed = await hasConsumedPromo(psychologist.id, config.code);
    if (alreadyUsed) {
        return { valid: false, reason: 'Este cupom já foi utilizado anteriormente nesta conta.' };
    }

    return {
        valid: true,
        isVip: false,
        code: config.code,
        type: config.type,
        totalMonths: config.totalMonths,
        minDays: config.minDays,
        title: config.title,
        subtitle: config.subtitle,
        expiresAt: config.expiresAt,
        chargeToday: 99.00,
        renewalValue: 99.00
    };
}

module.exports = {
    PROMO_COUPONS,
    normalizeCouponCode,
    addMonthsWithMinDays,
    isPsychologistExpiredOrInactive,
    hasConsumedPromo,
    validateCouponForPsychologist
};
