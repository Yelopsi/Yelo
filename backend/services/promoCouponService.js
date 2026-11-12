// backend/services/promoCouponService.js
const defaultDb = require('../models');
const { Op } = require('sequelize');

const BF_OFFER_CODE = 'BF2026_EMAIL';

const EMAIL_OFFERS = {
    [BF_OFFER_CODE]: {
        code: BF_OFFER_CODE,
        title: 'Condição Exclusiva: 2 meses por R$ 99,00',
        subtitle: 'Pague apenas 1 mês (R$ 99,00) hoje e ganhe +1 mês bônus (60 dias no total). Benefício automático vinculado ao seu e-mail.',
        type: 'EXTRA_MONTHS',
        totalMonths: 2,
        minDays: 60,
        allowedPlans: ['ESSENTIAL'],
        expiresAt: process.env.BLACK_FRIDAY_EXPIRES_AT || '2026-12-01T02:59:59.000Z', // 30/11/2026 23:59:59 BRT
        onlyExpired: true,
        chargeToday: 99.00,
        renewalValue: 99.00
    }
};

// Mantido vazio para campanhas: Black Friday nao utiliza mais codigo de cupom digitavel.
const PROMO_COUPONS = {};

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizeCouponCode(rawCode) {
    if (!rawCode || typeof rawCode !== 'string') return '';
    return rawCode.trim().toUpperCase();
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

async function hasConsumedPromo(psychologistId, canonicalCode = BF_OFFER_CODE, options = {}) {
    const db = options.db || defaultDb;
    if (!psychologistId || !db.SystemLog) return false;

    const codes = canonicalCode === BF_OFFER_CODE ? [BF_OFFER_CODE, 'BLACK2X1'] : [canonicalCode];
    for (const code of codes) {
        const consumed = await db.SystemLog.findOne({
            where: {
                message: { [Op.like]: `[PROMO_CONSUMED] ${code} | psi:${psychologistId}%` }
            },
            transaction: options.transaction
        }).catch(() => null);
        if (consumed) return true;
    }
    return false;
}

async function findGrantForPsychologist(psychologist, options = {}) {
    const db = options.db || defaultDb;
    if (!psychologist || !psychologist.id || !psychologist.email || !db.SystemLog) {
        return null;
    }

    const emailLower = normalizeEmail(psychologist.email);
    const exactPrefix = `[BF2026_OFFER_GRANTED] psi:${psychologist.id} | email:${emailLower}`;

    const candidates = await db.SystemLog.findAll({
        where: {
            message: { [Op.like]: `[BF2026_OFFER_GRANTED] psi:${psychologist.id} |%` }
        },
        order: [['createdAt', 'DESC']],
        limit: 10,
        transaction: options.transaction
    }).catch(() => []);

    for (const row of candidates) {
        const meta = row.meta || {};
        const msg = String(row.message || '');
        const metaEmail = normalizeEmail(meta.email);
        const metaPsiId = Number(meta.psychologistId);

        if (
            metaPsiId === Number(psychologist.id) &&
            metaEmail === emailLower &&
            msg.startsWith(exactPrefix)
        ) {
            return row;
        }
    }

    return null;
}

async function grantBlackFridayOffer(psychologist, options = {}) {
    const db = options.db || defaultDb;
    if (!psychologist || !psychologist.id || !psychologist.email || !db.SystemLog) {
        throw new Error('Psicólogo inválido para liberação de oferta Black Friday.');
    }

    const emailLower = normalizeEmail(psychologist.email);
    const existing = await findGrantForPsychologist(psychologist, options);
    if (existing) {
        return { granted: true, alreadyExisted: true, email: emailLower, logId: existing.id };
    }

    const cfg = EMAIL_OFFERS[BF_OFFER_CODE];
    const expiresAt = options.expiresAt || cfg.expiresAt;
    const wave = options.wave || 'manual';

    const created = await db.SystemLog.create({
        level: 'info',
        message: `[BF2026_OFFER_GRANTED] psi:${psychologist.id} | email:${emailLower} | wave:${wave}`,
        meta: {
            offerCode: BF_OFFER_CODE,
            psychologistId: Number(psychologist.id),
            email: emailLower,
            wave,
            expiresAt,
            grantedAt: new Date().toISOString()
        }
    }, { transaction: options.transaction });

    return { granted: true, alreadyExisted: false, email: emailLower, logId: created.id, expiresAt };
}

async function getActiveOfferForPsychologist(psychologist, normalizedPlan = 'ESSENTIAL', options = {}) {
    const now = options.now ? new Date(options.now) : new Date();
    const config = EMAIL_OFFERS[BF_OFFER_CODE];

    if (!psychologist || !psychologist.id || !psychologist.email) {
        return { eligible: false, valid: false, reason: 'Profissional não identificado.' };
    }

    if (psychologist.is_exempt) {
        return { eligible: false, valid: false, reason: 'Perfis VIP isentos não necessitam desta condição.' };
    }

    if (config.expiresAt && new Date(config.expiresAt) < now) {
        return { eligible: false, valid: false, reason: 'Esta campanha promocional foi encerrada.' };
    }

    if (config.onlyExpired && !isPsychologistExpiredOrInactive(psychologist, now)) {
        return {
            eligible: false,
            valid: false,
            reason: 'Condição exclusiva para reativação de perfis expirados ou inativos.'
        };
    }

    const grant = await findGrantForPsychologist(psychologist, options);
    if (!grant) {
        return {
            eligible: false,
            valid: false,
            reason: 'Nenhuma condição promocional ativa para o e-mail cadastrado nesta conta.'
        };
    }

    const grantExpiresAt = grant.meta?.expiresAt || config.expiresAt;
    if (grantExpiresAt && new Date(grantExpiresAt) < now) {
        return {
            eligible: false,
            valid: false,
            reason: 'O prazo da condição especial liberada para este e-mail expirou.'
        };
    }

    const alreadyUsed = await hasConsumedPromo(psychologist.id, BF_OFFER_CODE, options);
    if (alreadyUsed) {
        return {
            eligible: false,
            valid: false,
            reason: 'A condição especial de Black Friday já foi utilizada anteriormente nesta conta.'
        };
    }

    const emailLower = normalizeEmail(psychologist.email);

    if (options.isIosFee) {
        return {
            eligible: false,
            valid: false,
            eligibleOtherPlatform: true,
            code: config.code,
            email: emailLower,
            reason: 'Seu e-mail possui 2 meses por R$ 99,00 liberados ao concluir a assinatura pelo site ou Android.'
        };
    }

    const planKey = String(normalizedPlan || 'ESSENTIAL').toUpperCase();
    if (!config.allowedPlans.includes(planKey)) {
        return {
            eligible: false,
            valid: false,
            reason: 'Esta condição especial é válida exclusivamente para o Plano Essencial.'
        };
    }

    return {
        eligible: true,
        valid: true,
        isVip: false,
        code: config.code,
        type: config.type,
        totalMonths: config.totalMonths,
        minDays: config.minDays,
        email: emailLower,
        psychologistId: Number(psychologist.id),
        title: config.title,
        subtitle: config.subtitle,
        expiresAt: grantExpiresAt,
        chargeToday: config.chargeToday,
        renewalValue: config.renewalValue
    };
}

async function validateCouponForPsychologist(rawCode, _psychologist, _normalizedPlan = 'ESSENTIAL', _options = {}) {
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

    return {
        valid: false,
        reason: 'Cupom inválido. As condições promocionais agora são liberadas automaticamente para os e-mails convidados.'
    };
}

module.exports = {
    BF_OFFER_CODE,
    EMAIL_OFFERS,
    PROMO_COUPONS,
    normalizeEmail,
    normalizeCouponCode,
    addMonthsWithMinDays,
    isPsychologistExpiredOrInactive,
    hasConsumedPromo,
    findGrantForPsychologist,
    grantBlackFridayOffer,
    getActiveOfferForPsychologist,
    validateCouponForPsychologist
};
