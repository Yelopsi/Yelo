// config.js (Frontend - Versão Global)

// Detecta se o ambiente é de produção (Render) ou desenvolvimento (qualquer outra coisa)
const isLocalhost = window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1');

window.API_BASE_URL = isLocalhost
    ? 'http://localhost:3001'     // Em desenvolvimento, força a porta da API (3001)
    : window.location.origin;     // Em produção, usa a própria URL do site (ex: https://yelo.onrender.com)

console.log('🌍 GPS do Frontend definido para:', window.API_BASE_URL);