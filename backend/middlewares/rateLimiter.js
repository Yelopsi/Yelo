const rateLimit = require('express-rate-limit');

// ============================================================================
// RATE LIMITING MULTICAMADAS (FASE 5.2)
// ============================================================================

// 1. PUBLIC: Limite brando para navegação genérica e assets
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 300, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições (PUBLIC). Tente novamente mais tarde.' }
});

// 2. AUTH: Limite estrito para Login, Cadastro, Reset de Senha (Brute-force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Max 10 tentativas a cada 15m
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de autenticação. Tente novamente em 15 minutos.' }
});

// 3. EXPENSIVE: IA/Gemini, Consultas pesadas, Geração de relatórios
// Usamos o UserId se autenticado, caso contrário, o IP.
const expensiveLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 5, // Apenas 5 calls pesadas por janela
    keyGenerator: (req) => req.user?.id ? `user_${req.user.id}` : req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Limite de processamento atingido. Aguarde alguns minutos.' }
});

// 4. FINANCIAL (Webhooks Asaas): Isentos do limitador por IP rigoroso para não barrar retries
// Mas impomos um teto para evitar flood puro. A idempotência resolve duplicações lógicas.
const webhookLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // Permite burts de até 100 notificações/minuto (Retries legítimos)
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Webhook flood detectado.' }
});

module.exports = {
    publicLimiter,
    authLimiter,
    expensiveLimiter,
    webhookLimiter
};
