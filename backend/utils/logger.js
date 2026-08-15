/**
 * SECURITY HARDENING: LOG SANITIZATION
 * Monkey-patching global console.log e console.error para interceptar e mascarar 
 * dados sensíveis (PII e Segredos) antes de serem emitidos para o stdout/stderr.
 */

const sensitiveKeys = ['password', 'senha', 'token', 'jwt', 'secret', 'apikey', 'cpf', 'hash'];

function sanitizeObject(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
                sanitized[key] = '[REDACTED_BY_SECURITY_LOGGER]';
            } else {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
    }
    return sanitized;
}

function sanitizeArgs(args) {
    return args.map(arg => {
        try {
            if (typeof arg === 'string') {
                // Tentativa de limpar strings JSONizadas que contenham dados vazados
                // (Primitiva via RegEx para performance se for string muito longa)
                if (arg.length > 500) {
                    return arg.replace(/"(password|senha|token|jwt)":"[^"]*"/gi, '"$1":"[REDACTED]"');
                }
                return arg;
            }
            if (typeof arg === 'object') {
                return sanitizeObject(arg);
            }
        } catch (e) {
            return arg;
        }
        return arg;
    });
}

function initLogSanitizer() {
    const originalLog = console.log;
    const originalError = console.error;

    console.log = function (...args) {
        if (process.env.NODE_ENV === 'test' && args[0] && typeof args[0] === 'string' && args[0].includes('[HARDENING]')) {
            // Bypass para não quebrar a formatação dos scripts de teste
            originalLog.apply(console, args);
            return;
        }
        originalLog.apply(console, sanitizeArgs(args));
    };

    console.error = function (...args) {
        if (process.env.NODE_ENV === 'production') {
            // Em produção, stacktraces longos devem ser silenciados
            const sanitizedArgs = sanitizeArgs(args).map(arg => {
                if (arg instanceof Error) {
                    return `[Error: ${arg.message}] - StackTrace omitido por segurança`;
                }
                return arg;
            });
            originalError.apply(console, sanitizedArgs);
        } else {
            originalError.apply(console, sanitizeArgs(args));
        }
    };
}

module.exports = { initLogSanitizer, sanitizeObject };
