console.log("Script carregado!");

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

// Inicia automaticamente em páginas normais
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    checkLoginState();
    
    // Lógica do Acordeão (FAQ)
    const acordeoes = document.querySelectorAll('.acordeao-titulo');
    if (acordeoes.length > 0) {
        acordeoes.forEach(acc => {
            acc.addEventListener('click', function() {
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
        threshold: 0.1 // A animação começa quando 10% do elemento está visível
    });

    // Pede ao observador para "vigiar" todos os elementos com a classe .hidden
    document.querySelectorAll('.hidden').forEach(el => observer.observe(el));

    // --- LÓGICA DE SESSÃO ANÔNIMA (NOVO) ---
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
        };
        window.addEventListener('pagehide', handleUnload);
    }

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
});

// --- FUNÇÃO PARA GERENCIAR ESTADO DE LOGIN NO HEADER ---
function checkLoginState() {
    // Evita duplicação se a função for executada múltiplas vezes
    if (document.querySelector('.user-logged-header')) return;

    const token = localStorage.getItem('Yelo_token');
    const userName = localStorage.getItem('Yelo_user_name');
    const userType = localStorage.getItem('Yelo_user_type');

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

    // Prepara os dados
    let firstName = userName ? userName.split(' ')[0] : 'Usuário';
    let dashboardLink = '/'; // Rota padrão para a página inicial

    if (userType === 'patient') {
        dashboardLink = '/patient/patient_dashboard';
    } else if (userType === 'psychologist' || userType === 'psi') {
        dashboardLink = '/psi/psi_dashboard.html';
    } else if (userType === 'admin') {
        dashboardLink = '/admin/admin.html'; // CORREÇÃO: Aponta para o dashboard de admin correto.
        firstName = 'Admin'; // CORREÇÃO: Garante que o nome de exibição seja sempre "Admin".
    }

    // Injeta CSS dinâmico para controlar a cor do texto na rolagem
    if (!document.getElementById('user-header-style')) {
        const style = document.createElement('style');
        style.id = 'user-header-style';
        style.innerHTML = `
            .user-greeting {
                color: #ffffff; /* Inicial: Branco (Fundo Verde) */
                font-weight: 500;
                margin-right: 10px;
                transition: color 0.3s ease;
            }
            
            /* Quando o header fica branco (rolagem) */
            header.header-rolagem .user-greeting {
                color: #1B4332 !important; /* Rolagem: Verde (Fundo Branco) */
            }

            /* Botão "Meu Painel" - Inicial (Fundo Verde -> Botão Branco) */
            .user-logged-header .btn-painel {
                background-color: #ffffff !important;
                color: #1B4332 !important;
                border: 2px solid #ffffff !important;
                text-decoration: none;
                font-weight: bold;
                padding: 8px 18px;
                border-radius: 25px;
                font-size: 15px;
                transition: all 0.3s ease;
                position: relative; /* Garante contexto de pilha */
                z-index: 100002;    /* Fica acima de tudo no header */
            }
            .user-logged-header .btn-painel:hover {
                background-color: #f0f0f0 !important;
                transform: translateY(-2px);
            }

            /* Botão "Meu Painel" - Rolagem (Fundo Branco -> Botão Verde) */
            header.header-rolagem .user-logged-header .btn-painel {
                background-color: #1B4332 !important;
                color: #ffffff !important;
                border: 2px solid #1B4332 !important;
            }
            
            header.header-rolagem .user-logged-header .btn-painel:hover {
                background-color: #2a624d !important;
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
        userEl.style.gap = '15px';
    }

    userEl.innerHTML = `
        <span class="user-greeting">Olá, ${firstName}</span>
        <a href="${dashboardLink}" class="btn-painel" id="btn-meu-painel">Meu Painel</a>
    `;

    container.appendChild(userEl);
}