
// --- FUNÇÃO DE INICIALIZAÇÃO DO MENU (Global) ---
function initMobileMenu() {
    const menuBtn = document.querySelector('.menu-hamburguer');
    const navContainer = document.querySelector('.container-navegacao');

    // Remove event listeners antigos para evitar duplicação (cloneNode limpa eventos)
    if (menuBtn) {
        const newMenuBtn = menuBtn.cloneNode(true);
        menuBtn.parentNode.replaceChild(newMenuBtn, menuBtn);
        
        newMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navContainer.classList.toggle('ativo');
        });
    }

    // Lógica do Header Rolagem
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('header-rolagem');
            } else {
                header.classList.remove('header-rolagem');
            }
        });
    }
}

// Expondo a função para outros scripts (como resultados.js)
window.initMobileMenu = initMobileMenu;

// --- FUNÇÃO PARA CAPTURAR UTMs E LIMPAR URL ---
function captureUTMs() {
    if (!window.location.search) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    let hasUTMs = false;
    
    const globalUtms = {};
    
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(param => {
        if (urlParams.has(param)) {
            const val = urlParams.get(param);
            localStorage.setItem('yelo_' + param, val); // Legacy format
            
            // First click attribution legacy
            if (!localStorage.getItem('yelo_first_' + param)) {
                localStorage.setItem('yelo_first_' + param, val);
            }
            
            globalUtms[param] = val;
            urlParams.delete(param);
            hasUTMs = true;
        }
    });
    
    if (hasUTMs) {
        // Save new global format
        localStorage.setItem('yelo_global_utms', JSON.stringify(globalUtms));
        if (!localStorage.getItem('yelo_global_first_utms')) {
            localStorage.setItem('yelo_global_first_utms', JSON.stringify(globalUtms));
        }

        // Se encontrou alguma UTM, reescreve a URL na barra de endereços para ficar limpa
        const newSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
        const newUrl = window.location.pathname + newSearch + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
    }
}
window.captureUTMs = captureUTMs;

// Inicia automaticamente em páginas normais
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    checkLoginState();
    captureUTMs();
    
    // Lógica do Acordeão (FAQ)
    const acordeoes = document.querySelectorAll('.acordeao-titulo');
    if (acordeoes.length > 0) {
        acordeoes.forEach(acc => {
            acc.addEventListener('click', function() {
                // Fecha os outros painéis para manter apenas um aberto por vez
                acordeoes.forEach(other => {
                    if (other !== this) {
                        other.classList.remove('ativo');
                        if (other.nextElementSibling) {
                            other.nextElementSibling.style.maxHeight = null;
                        }
                    }
                });

                this.classList.toggle('ativo');
                const painel = this.nextElementSibling;
                if (painel.style.maxHeight) {
                    painel.style.maxHeight = null;
                } else {
                    painel.style.maxHeight = painel.scrollHeight + "px";
                }
            });
        });
    }

    // --- LÓGICA DE ANIMAÇÃO DE SCROLL (REVELAR SEÇÕES) ---
    // Esta é a forma moderna e performática de animar elementos ao rolar a página.
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Quando o elemento entra na tela (isIntersecting se torna true)
            if (entry.isIntersecting) {
                entry.target.classList.add('visivel');
                // Opcional: para de observar o elemento uma vez que ele já está visível, para economizar recursos.
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 /// a animação começa quando 10% do elemento está visível
    });

    // Pede ao observador para "vigiar" todos os elementos com a classe .hidden
    document.querySelectorAll('.hidden').forEach(el => observer.observe(el));

    // --- LÓGICA DE SESSÃO ANÔNIMA (NOVO) ---
    try {
        const ANONYMOUS_SESSION_ID_KEY = 'yelo_anon_session_id';
        const SESSION_START_TIME_KEY = 'yelo_session_start_time';
        const API_BASE_URL = window.API_BASE_URL || '';

        // Só executa para usuários não logados
        if (!localStorage.getItem('Yelo_token')) {
            let sessionId = sessionStorage.getItem(ANONYMOUS_SESSION_ID_KEY);

            // Inicia a sessão se não existir
            if (!sessionId) {
                sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                sessionStorage.setItem(ANONYMOUS_SESSION_ID_KEY, sessionId);
                sessionStorage.setItem(SESSION_START_TIME_KEY, Date.now().toString());
            }

            // Envia dados quando o usuário sai da página
            const handleUnload = () => {
                try {
                    const startTime = parseInt(sessionStorage.getItem(SESSION_START_TIME_KEY), 10);
                    if (startTime) {
                        const durationInSeconds = Math.round((Date.now() - startTime) / 1000);
                        if (durationInSeconds < 5) return; // Ignora sessões muito curtas

                        const payload = { sessionId: sessionStorage.getItem(ANONYMOUS_SESSION_ID_KEY), duration: durationInSeconds };
                        if (navigator.sendBeacon) {
                            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
                            navigator.sendBeacon(`${API_BASE_URL}/api/analytics/session-end`, blob);
                        }
                    }
                } catch(e) {}
            };
            window.addEventListener('pagehide', handleUnload);
        }
    } catch (e) { }

    // --- FIX GLOBAL PARA O BUG DO TECLADO MOBILE (iOS/Safari) ---
    // Corrige o problema onde a tela fica "empurrada para cima" e os headers somem
    // após o usuário digitar algo e fechar o teclado.
    document.addEventListener('focusout', function(e) {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            setTimeout(() => {
                // Dá um pequeno "empurrãozinho" para forçar o navegador a recalcular a viewport
                window.scrollTo(window.scrollX, window.scrollY);
            }, 100);
        }
    });

    // --- PROTEÇÃO CONTRA CÓPIA ---

    // 1. Desabilita o botão direito do mouse
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });

    // 2. Desabilita atalhos de teclado comuns para cópia e inspeção
    document.addEventListener('keydown', function(e) {
        // Bloqueia F12 (DevTools)
        if (e.key === 'F12') {
            e.preventDefault();
            return false;
        }

        // Bloqueia combinações com Ctrl (Ctrl+C, Ctrl+U, Ctrl+Shift+I)
        if (e.ctrlKey) {
            const key = e.key.toLowerCase();
            if (['c', 'x', 'u', 'i', 'j'].includes(key)) {
                e.preventDefault();
                return false;
            }
        }
    });

    // --- CORREÇÃO GLOBAL: REDIRECIONAMENTO DA SEÇÃO DE CRISE ---
    // Garante que os links da seção "Se você está em crise..." apontem corretamente para /ajuda
    document.querySelectorAll('.aviso-crise a, .aviso-texto a').forEach(link => {
        link.setAttribute('href', '/ajuda');
    });

    // --- CORREÇÃO GLOBAL: LINKS LEGAIS DO RODAPÉ ---
    // Remove a extensão .html dos links de termos e privacidade visualmente
    document.querySelectorAll('a[href$=".html"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && (href.includes('termos') || href.includes('privacidade'))) {
            link.setAttribute('href', href.replace('.html', ''));
        }
    });
});

// --- FUNÇÃO PARA GERENCIAR ESTADO DE LOGIN NO HEADER ---
async function checkLoginState() {
    // Evita duplicação se a função for executada múltiplas vezes
    if (document.querySelector('.user-logged-header')) return;

    let token, userName, userType, userPhoto;
    try {
        token = localStorage.getItem('Yelo_token');
        userName = localStorage.getItem('Yelo_user_name');
        userType = localStorage.getItem('Yelo_user_type');
        userPhoto = localStorage.getItem('Yelo_user_photo');
    } catch (e) { return; }

    // Se não estiver logado, não faz nada (botões padrão aparecem)
    if (!token) return;

    // Tenta encontrar os botões de "Entrar" e "Cadastrar" pelos links
    const loginBtn = document.querySelector('a[href*="login"]');
    const registerBtn = document.querySelector('a[href*="cadastro"], a[href*="registrar"], a[href*="registro"]');

    // Se não encontrar nenhum botão no header, encerra
    if (!loginBtn && !registerBtn) return;

    let container = null;
    let isList = false;

    // Função auxiliar para esconder o elemento (li ou a)
    const hideElement = (el) => {
        if (el.parentElement.tagName === 'LI') {
            el.parentElement.style.display = 'none';
            container = el.parentElement.parentElement; // O <ul>
            isList = true;
        } else {
            el.style.display = 'none';
            if (!container) container = el.parentElement;
        }
    };

    if (loginBtn) hideElement(loginBtn);
    if (registerBtn) hideElement(registerBtn);

    if (!container) return;

    // --- SELF-HEALING: Se faltar dados (Nome ou Tipo), busca na API ---
    if (!userName || !userType || userName === 'undefined') {
        try {
            const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
            
            // Tenta identificar o usuário batendo nos endpoints
            // 1. Tenta Paciente
            let res = await fetch(`${BASE_URL}/api/patients/me`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                userName = data.nome;
                userType = 'patient';
                    if (data.fotoUrl) localStorage.setItem('Yelo_user_photo', data.fotoUrl);
            } else {
                // 2. Tenta Psicólogo
                res = await fetch(`${BASE_URL}/api/psychologists/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    userName = data.nome;
                    userType = 'psychologist';
                        if (data.fotoUrl) localStorage.setItem('Yelo_user_photo', data.fotoUrl);
                } else {
                    // 3. Tenta Admin
                    res = await fetch(`${BASE_URL}/api/admin/me`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (res.ok) {
                        const data = await res.json();
                        userName = data.nome;
                        userType = 'admin';
                            if (data.fotoUrl) localStorage.setItem('Yelo_user_photo', data.fotoUrl);
                    }
                }
            }
            // Salva para a próxima vez
            if (userName) localStorage.setItem('Yelo_user_name', userName);
            if (userType) localStorage.setItem('Yelo_user_type', userType);
        } catch (e) { }
    }

    // Prepara os dados
    let firstName = userName ? userName.split(' ')[0] : 'Usuário';
    // Capitaliza (Primeira letra maiúscula)
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    
    let dashboardLink = '/'; // Rota padrão para a página inicial

    if (userType === 'patient') {
        dashboardLink = '/patient/patient_dashboard';
    } else if (userType === 'psychologist' || userType === 'psi') {
        dashboardLink = '/psi/psi_dashboard.html';
    } else if (userType === 'admin') {
        dashboardLink = '/admin'; // CORREÇÃO: Aponta para o dashboard de admin correto.
        firstName = 'Admin'; // CORREÇÃO: Garante que o nome de exibição seja sempre "Admin".
    }

    // Injeta CSS dinâmico para controlar a cor do texto na rolagem
    if (!document.getElementById('user-header-style')) {
        const style = document.createElement('style');
        style.id = 'user-header-style';
        style.innerHTML = `
            .user-logged-modern {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                padding: 5px 18px 5px 5px;
                border-radius: 50px;
                text-decoration: none;
                color: #ffffff !important;
                font-weight: 600;
                font-size: 0.95rem;
                transition: all 0.3s ease;
                backdrop-filter: blur(4px);
                position: relative;
                z-index: 100002;
            }

            .user-logged-modern:hover {
                background: rgba(255, 255, 255, 0.2);
                border-color: rgba(255, 255, 255, 0.4);
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }

            .user-logged-modern .avatar-circle {
                width: 32px;
                height: 32px;
                background-color: #ffffff;
                color: #1B4332;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 800;
                font-size: 0.9rem;
                flex-shrink: 0;
            }

            header.header-rolagem .user-logged-modern {
                background: rgba(27, 67, 50, 0.05);
                border-color: rgba(27, 67, 50, 0.15);
                color: #1B4332 !important;
            }

            header.header-rolagem .user-logged-modern:hover {
                background: rgba(27, 67, 50, 0.1);
                border-color: rgba(27, 67, 50, 0.25);
            }

            header.header-rolagem .user-logged-modern .avatar-circle {
                background-color: #1B4332;
                color: #ffffff;
            }
            
            .user-logged-modern span {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .user-logged-modern svg {
                width: 16px;
                height: 16px;
                opacity: 0.6;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            
            .user-logged-modern:hover svg {
                transform: translateX(3px);
                opacity: 1;
            }
        `;
        document.head.appendChild(style);
    }

    // Cria o elemento de saudação
    const userEl = document.createElement(isList ? 'li' : 'div');
    userEl.className = 'user-logged-header';
    if (!isList) {
        userEl.style.display = 'flex';
        userEl.style.alignItems = 'center';
    }

    // Decide se renderiza a foto de perfil ou a inicial do nome
    let avatarHtml = `<div class="avatar-circle" id="header-avatar-initial">${firstName.charAt(0)}</div>`;
    if (userPhoto && userPhoto !== 'null' && userPhoto !== 'undefined' && !userPhoto.includes('placehold.co')) {
        const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const photoUrl = userPhoto.startsWith('http') || userPhoto.startsWith('data:') ? userPhoto : `${BASE_URL}/${userPhoto.replace(/^backend\/public\//, '').replace(/^\//, '')}`;
        avatarHtml = `<img src="${photoUrl}" alt="Perfil" class="avatar-circle" id="header-avatar-initial" style="object-fit: cover; border: 2px solid #ffffff; padding: 0; box-sizing: border-box;">`;
    }

    userEl.innerHTML = `
        <a href="${dashboardLink}" class="user-logged-modern" id="btn-meu-painel">
            ${avatarHtml}
            <span><span class="user-greeting-text">Painel de ${firstName}</span> <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
        </a>
    `;

    container.appendChild(userEl);
}

// --- PULL TO REFRESH GLOBAL (Sensibilidade Ajustada) ---
window.setupPullToRefresh = function() {
    const scrollContainer = document.querySelector('.dashboard-main') || document.documentElement;
    let startY = 0;
    let currentY = 0;
    let isPulling = false;
    
    // Distância necessária para ativar o refresh (Ajustado para 150px)
    const PULL_THRESHOLD = 150; 

    scrollContainer.addEventListener('touchstart', (e) => {
        // Só permite o pull se a página estiver no topo absoluto
        if (scrollContainer.scrollTop <= 0) {
            startY = e.touches[0].clientY;
            currentY = startY; // Zera o valor fantasma do toque anterior
            isPulling = true;
        }
    }, { passive: true });

    scrollContainer.addEventListener('touchmove', (e) => {
        if (!isPulling) return;
        
        currentY = e.touches[0].clientY;
        // Se o usuário rolou o dedo para cima, cancela a puxada
        if (currentY - startY < 0) {
            isPulling = false;
        }
    }, { passive: true });

    scrollContainer.addEventListener('touchend', () => {
        if (!isPulling) return;
        
        const pullDistance = currentY - startY;
        // Verifica se superou o limite de segurança
        if (pullDistance > PULL_THRESHOLD && scrollContainer.scrollTop <= 0) {
            if (navigator.vibrate) navigator.vibrate(50);
            if (window.showToast) window.showToast('Recarregando...', 'info');
            
            setTimeout(() => {
                window.location.reload();
            }, 300);
        }
        
        // Reset
        isPulling = false;
        startY = 0;
        currentY = 0;
    });
};