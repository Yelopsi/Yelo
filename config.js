// config.js (Frontend - Versão Global)

// Define uma variável GLOBAL (window) que o registrar.js consegue ler
window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001' // Desenvolvimento (PC)
    : 'https://yelo.onrender.com'; // Produção (Render)

console.log('🌍 GPS do Frontend definido para:', window.API_BASE_URL);