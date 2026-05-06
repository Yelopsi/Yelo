const jwt = require('jsonwebtoken');

const verifyTokenLocal = (req, res, next) => {
    let token = req.headers.authorization?.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined' || token === 'cookie_auth_active') {
        token = req.cookies?.token;
    }
    if (!token) return res.status(401).json({ error: 'Não autorizado' });
    try {
        req.userDecoded = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
};

module.exports = { verifyTokenLocal };