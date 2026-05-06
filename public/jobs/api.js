// public/js/api.js

// --- GLOBAL FETCH INTERCEPTOR (Migração para Cookies e PLG) ---
const originalApiFetch = window.fetch;
window.fetch = async function(resource, init) {
    const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    
    if (url.includes('/api/')) {
        init = Object.assign({}, init, { credentials: 'include' });
    }
    
    const response = await originalApiFetch(resource, init);
    
    // AUTO-INTERCEPTAÇÃO PLG (Confetes e Gamificação)
    try {
        if (url.includes('/api/psychologists/me') && !url.includes('/posts') && !url.includes('/analytics')) {
            const clonedRes = response.clone();
            clonedRes.json().then(data => {
                if (data && data.id && typeof window.verificarConquistasPLG === 'function') {
                    window.verificarConquistasPLG(data);
                }
            }).catch(() => {});
        }
    } catch (e) {}

    return response;
};

// --- API FETCH DEDICADO (Com Injeção de Token JWT Automática) ---
window.apiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('Yelo_token');
    if (!token) { window.location.href = '/login'; throw new Error("Sessão expirada."); }
    const headers = { 'Authorization': `Bearer ${token}`, ...options.headers };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const finalUrl = endpoint.startsWith('http') ? endpoint : `${window.API_BASE_URL || ''}${endpoint}`;
    const response = await fetch(finalUrl, { ...options, headers });
    if (response.status === 401) { localStorage.removeItem('Yelo_token'); window.location.href = '/'; throw new Error("Sessão expirada."); }
    return response;
};