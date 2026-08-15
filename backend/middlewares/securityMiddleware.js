const cors = require('cors');

const corsConfig = cors({
    origin: (origin, callback) => {
        const allowedOrigins = [process.env.FRONTEND_URL];
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(new Error('Origem não permitida pelo CORS'));
        }
    },
    credentials: true
});

const crypto = require('crypto');

const cspMiddleware = (req, res, next) => {
    const nonce = crypto.randomBytes(16).toString('base64');
    res.locals.nonce = nonce;

    const scriptSrc = `script-src 'self' 'unsafe-inline' https://*.googletagmanager.com https://www.googletagmanager.com https://*.google-analytics.com https://www.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://*.google.com https://tagmanager.google.com https://connect.facebook.net https://unpkg.com https://cdn.jsdelivr.net https://accounts.google.com https://cdnjs.cloudflare.com https://cdn.quilljs.com https://npmcdn.com https://*.clarity.ms https://clarity.ms https://vlibras.gov.br`;

    const csp = [
        "default-src 'self'",
        scriptSrc,
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline' https://tagmanager.google.com https://fonts.googleapis.com https://accounts.google.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.quilljs.com",
        "img-src 'self' data: blob: https: https://*.google-analytics.com https://*.googletagmanager.com https://*.g.doubleclick.net https://googleads.g.doubleclick.net https://www.google.com https://*.google.com.br https://www.facebook.com https://ade.googlesyndication.com https://ssl.gstatic.com https://www.gstatic.com https://*.clarity.ms",
        "font-src 'self' https://fonts.gstatic.com data:",
        "connect-src 'self' ws: wss: https://*.google-analytics.com https://www.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://*.g.doubleclick.net https://ad.doubleclick.net https://www.googleadservices.com https://*.google.com https://*.google.com.br https://*.facebook.com https://www.facebook.com https://connect.facebook.net https://cdn.jsdelivr.net https://unpkg.com https://cdn.quilljs.com https://*.clarity.ms https://clarity.ms https://viacep.com.br " + (process.env.FRONTEND_URL || 'http://localhost:3001'),
        "frame-src 'self' https://accounts.google.com https://bid.g.doubleclick.net",
        "object-src 'self'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'"
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
};

module.exports = { corsConfig, cspMiddleware };
