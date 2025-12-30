// config.js (Frontend - Versão Global)

// Detecta se o ambiente é de produção (Render) ou desenvolvimento (qualquer outra coisa)
const isProduction = window.location.hostname.includes('yelo.onrender.com');

window.API_BASE_URL = isProduction
    ? 'https://yelo.onrender.com' // URL da API de Produção
    : window.location.origin;     // Usa o endereço local para a API (ex: http://localhost:3001)

console.log('🌍 GPS do Frontend definido para:', window.API_BASE_URL);