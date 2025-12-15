// config.js (Frontend)
const CONFIG = {
    // Se estiver no seu computador, usa localhost. Se estiver na nuvem, usa o Render.
    API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3001'
        : 'https://yelo.onrender.com'
};
console.log('API conectada em:', CONFIG.API_URL);