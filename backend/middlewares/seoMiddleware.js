const seoRedirect = (req, res, next) => {
    const host = req.headers.host ? req.headers.host.split(':')[0] : req.hostname;
    const target = 'www.yelopsi.com.br';
    const isLocalIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);

    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('onrender.com') || host.includes('render.com') || isLocalIp) {
        return next();
    }
    if (host !== target) {
        return res.redirect(301, `https://${target}${req.originalUrl}`);
    }
    next();
};

module.exports = seoRedirect;