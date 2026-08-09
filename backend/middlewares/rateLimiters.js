const rateLimit = require('express-rate-limit');

// Limiter para Login de Psicólogos e Pacientes (Tolerância média para Clínicas/NAT)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
});

// Limiter para Login Administrativo (Tolerância zero)
const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
});

// Limiter para Endpoints que Envolvem Disparo de E-mail ou Custos (Forgot Password, Contato, Waitlist)
const emailSpamLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas. Tente novamente mais tarde.' }
});

// Limiter para Criação de Contas (Evitar poluição do DB e Spam de Boas-Vindas)
const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas. Tente novamente mais tarde." }
});

const matchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitas tentativas de busca. Tente novamente mais tarde." }
});

const clickLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 15, // 15 cliques de WhatsApp por IP por hora (generoso mas impede bot abuse)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Muitos cliques registrados. Tente novamente mais tarde." }
});

module.exports = {
    authLimiter,
    adminLimiter,
    emailSpamLimiter,
    registerLimiter,
    matchLimiter,
    clickLimiter
};
