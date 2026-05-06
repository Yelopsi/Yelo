const crypto = require('crypto');
const db = require('../models');

const staticFileRegex = /\.(css|js|json|ico|png|jpg|jpeg|webp|svg|woff|woff2|ttf|eot)$/i;

const sessionMiddleware = async (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return next();
    }

    let sessionId = req.cookies?.yelo_session;
    if (!sessionId) {
        sessionId = crypto.randomBytes(16).toString('hex');
        res.cookie('yelo_session', sessionId, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' });
    }

    db.sequelize.query(
        `INSERT INTO "ActiveSessions" ("sessionId", "lastSeen") VALUES (:sessionId, NOW()) ON CONFLICT ("sessionId") DO UPDATE SET "lastSeen" = NOW();`,
        { replacements: { sessionId }, type: db.sequelize.QueryTypes.INSERT }
    ).catch(() => {}); 
    next();
};

const visitMiddleware = async (req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !staticFileRegex.test(req.path)) {
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const url = req.originalUrl || req.path;
        const referrer = req.headers['referer'] || null;
        
        db.sequelize.query(
            `INSERT INTO "SiteVisits" ("url", "userAgent", "referrer", "createdAt", "updatedAt") VALUES (:url, :ua, :ref, NOW(), NOW())`,
            { replacements: { url, ua: userAgent, ref: referrer } }
        ).catch(() => {
            db.sequelize.query(`INSERT INTO "SiteVisits" ("createdAt", "updatedAt") VALUES (NOW(), NOW())`).catch(() => {});
        });
    }
    next();
};

module.exports = { sessionMiddleware, visitMiddleware };