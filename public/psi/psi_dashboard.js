// Arquivo: psi_dashboard.js (VERSÃO FINAL 2.1)

document.addEventListener('DOMContentLoaded', function() {
    // --- SHADOW TRACKING (TELEMETRIA DE USO) ---
    document.body.addEventListener('click', function(e) {
        // Captura cliques em elementos com classe track-feature ou em links de navegação do menu principal
        const trackEl = e.target.closest('.track-feature') || e.target.closest('.sidebar-nav a') || e.target.closest('.bottom-nav-item');
        
        if (trackEl) {
            let funcionalidade = trackEl.getAttribute('data-feature');
            
            // Fallback: se não tiver data-feature explícito, extrai do data-page (ex: 'psi_financeiro.html' vira 'financeiro')
            if (!funcionalidade) {
                const page = trackEl.getAttribute('data-page') || trackEl.getAttribute('data-target-page');
                if (page) {
                    funcionalidade = page.replace('psi_', '').replace('.html', '');
                }
            }
            
            if (!funcionalidade) return;
            
            const token = localStorage.getItem('Yelo_token');
            if (!token) return;

            const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

            fetch(`${API_BASE_URL}/api/tracking/uso-feature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ feature: funcionalidade })
            }).catch(err => {});
        }
    });

    // --- FIX BLINDADO: Eventos Globais Delegados (Benchmarking e Botões Dinâmicos) ---
    document.addEventListener('click', function(e) {
        // 1. Procura por um link com data-page dentro dos cards de KPI
        const link = e.target.closest('.kpi-card a[data-page]');
        if (link) {
            e.preventDefault();
            const pageToLoad = link.getAttribute('data-page');
            if (pageToLoad && typeof window.loadPage === 'function') {
                window.loadPage(pageToLoad);
            }
        }
        
        // 2. Fix para o botão "Melhorar meu perfil" que carrega dinamicamente
        const btnMelhorarPerfil = e.target.closest('.modern-hero-cta');
        if (btnMelhorarPerfil) {
            e.preventDefault();
            if (typeof window.loadPage === 'function') {
                window.loadPage('psi_meu_perfil.html');
            }
        }
    }, true); // Usa capture phase para garantir que o clique não seja bloqueado por outros elementos

    
    let psychologistData = null; 
    
    // --- EXPOSIÇÃO DE ESTADO PARA MÓDULOS ---
    window.getPsychologistData = () => psychologistData;
    window.setPsychologistData = (data) => { psychologistData = data; };
    window.atualizarInterfaceLateral = atualizarInterfaceLateral;

    const mainContent = document.getElementById('main-content');
    
    // Estado global para contar conversas não lidas
    window.psiUnreadConversations = new Set();

    // --- ESTILOS GLOBAIS (BADGE + BLOQUEIO) ---
    const globalStyles = document.createElement('style');
    globalStyles.innerHTML = `
        /* BADGE DA SIDEBAR */
        .sidebar-badge {
            background-color: #E63946; /* Vermelho Alerta (Mais visível) */
            color: white;
            border-radius: 50px;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            margin-left: auto; /* Empurra para o canto direito no flexbox sem sobrepor o texto */
            display: none;
            font-size: 11px;
            font-weight: 800;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        .sidebar-badge.visible { display: flex; }
        .sidebar-nav li a { position: relative; }

        /* MODO RESTRITO (SEM PLANO) - Substitui o antigo Lock Overlay */
        .dashboard-main.restricted-mode button, 
        .dashboard-main.restricted-mode input, 
        .dashboard-main.restricted-mode textarea, 
        .dashboard-main.restricted-mode select, 
        .dashboard-main.restricted-mode a {
            pointer-events: none !important;
            opacity: 0.5 !important;
            cursor: not-allowed !important;
            filter: grayscale(100%);
        }

        /* Banner Flutuante de Restrição */
        .restriction-floating-banner {
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #1B4332;
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 1rem;
            animation: fadeInUp 0.5s ease-out;
            width: max-content;
            max-width: 90%;
            border: 1px solid #FFEE8C;
        }
        
        .restriction-floating-banner button {
            background: #FFEE8C;
            color: #1B4332;
            border: none;
            padding: 8px 20px;
            border-radius: 20px;
            font-weight: 800;
            cursor: pointer;
            font-size: 0.9rem;
            transition: transform 0.2s;
            pointer-events: auto !important; /* Garante clique */
            opacity: 1 !important;
            filter: none !important;
        }
        
        .restriction-floating-banner button:hover {
            transform: scale(1.05);
        }

        @keyframes fadeInUpBanner {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* ANIMAÇÃO PULSE (BOTÃO DESTAQUE) */
        @keyframes pulse-green {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27, 67, 50, 0.7); }
            70% { transform: scale(1.03); box-shadow: 0 0 0 10px rgba(27, 67, 50, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(27, 67, 50, 0); }
        }
        .btn-pulse-effect {
            animation: pulse-green 2s infinite;
        }

        /* BOTÕES MOSTRAR MAIS COMO LINKS ESTILO TEXTO */
        #btn-load-more-articles,
        #btn-load-more-posts,
        #btn-load-more-comments {
            background: transparent !important;
            border: none !important;
            color: #1B4332 !important;
            text-decoration: underline !important;
            font-weight: 600 !important;
            box-shadow: none !important;
            padding: 10px !important;
            margin: 15px auto !important;
            display: block;
            width: fit-content;
        }
        #btn-load-more-articles:hover,
        #btn-load-more-posts:hover,
        #btn-load-more-comments:hover {
            color: #2D6A4F !important;
            transform: none !important;
            background: transparent !important;
        }
    `;
    document.head.appendChild(globalStyles);

    // Função para controlar a badge no menu
    function updateSidebarBadge(pageName, show) {
        let targetPage = pageName;
        // O motivo da bolinha amarela aparecer em Ajustes foi eliminado:
        // if (pageName === 'psi_caixa_de_entrada.html') {
        //     targetPage = 'psi_ajustes_hub.html';
        // }
        
        const updateBadgeOnElement = (element, isBottomNav = false) => {
            if (!element) return;
            let badge = element.querySelector('.sidebar-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                if (isBottomNav) {
                    badge.style.position = 'absolute';
                    badge.style.top = '0';
                    badge.style.right = '10px';
                    badge.style.transform = 'none';
                    badge.style.margin = '0';
                    element.style.position = 'relative';
                }
                element.appendChild(badge);
            }
            
            // Permite receber um número direto ou boolean
            let num = 0;
            if (typeof show === 'number') {
                num = show;
            } else if (show === true) {
                num = window.psiUnreadConversations ? window.psiUnreadConversations.size : 0;
            }

            if (num > 0) {
                badge.textContent = num > 99 ? '99+' : num;
                badge.classList.add('visible');
                badge.style.display = 'flex';
            } else {
                badge.classList.remove('visible');
                badge.textContent = '';
                badge.style.display = 'none';
            }
        };
        
        // Atualiza na sidebar desktop
        updateBadgeOnElement(document.querySelector(`.sidebar-nav a[data-page="${targetPage}"]`), false);
        // Atualiza na bottom nav mobile
        updateBadgeOnElement(document.querySelector(`.bottom-nav-item[data-target-page="${targetPage}"]`), true);
        
        // Atualiza no sino do header mobile (Avisos)
        if (targetPage === 'psi_avisos.html') {
            const mobileAvisosTrigger = document.getElementById('mobile-avisos-trigger');
            if (mobileAvisosTrigger) {
                let badge = mobileAvisosTrigger.querySelector('.sidebar-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'sidebar-badge';
                    badge.style.position = 'absolute';
                    badge.style.top = '-2px';
                    badge.style.right = '-2px';
                    badge.style.transform = 'none';
                    badge.style.margin = '0';
                    badge.style.padding = '0 5px';
                    badge.style.fontSize = '9px';
                    mobileAvisosTrigger.appendChild(badge);
                }
                
                let num = 0;
                if (typeof show === 'number') num = show;
                else if (show === true) num = window.psiUnreadConversations ? window.psiUnreadConversations.size : 0;

                if (num > 0) {
                    badge.textContent = num > 99 ? '99+' : num;
                    badge.classList.add('visible');
                    badge.style.display = 'flex';
                } else {
                    badge.classList.remove('visible');
                    badge.textContent = '';
                    badge.style.display = 'none';
                }
            }
        }
    }
    window.updateSidebarBadge = updateSidebarBadge;

    // --- MÓDULO DA SIDEBAR (MENU E UPLOAD) ---
    if (window.PsiSidebar) {
        window.PsiSidebar.initMenu();
        window.PsiSidebar.initUpload();
    }

    // --- LÓGICA DO BOTÃO SAIR (LOGOUT) ---
    const btnsLogout = document.querySelectorAll('.btn-logout-action, #btn-logout, #btn-logout-mobile');
    btnsLogout.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation(); // Impede interferência de cliques da sidebar
            const span = this.querySelector('span') || this;
            span.textContent = "Saindo...";
            localStorage.removeItem('Yelo_token');
            localStorage.removeItem('yelo_last_psi_page');
            window.location.href = '/';
        });
    });

    // --- HELPERS E FETCH (Agora importados via scripts globais em /js) ---
    const showToast = window.showToast;
    const formatImageUrl = window.formatImageUrl;
    const apiFetch = window.apiFetch;

    // --- FUNÇÃO AUXILIAR: TRADUZ MARKDOWN PARA HTML E MANTÉM QUEBRAS DE LINHA ---
    window.formatTextContent = function(text) {
        if (!text) return '';
        let formatted = text;
        
        // Formatações (Ordem importa para não haver conflito de caracteres)
        formatted = formatted.replace(/'''([\s\S]*?)'''/g, '<code style="background:#f4f4f4; padding:2px 6px; border-radius:4px; font-family:monospace; color:#333; font-size:0.9em;">$1</code>');
        formatted = formatted.replace(/__([\s\S]*?)__/g, '<u>$1</u>');
        formatted = formatted.replace(/\*([\s\S]*?)\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/_([\s\S]*?)_/g, '<em>$1</em>');
        formatted = formatted.replace(/~([\s\S]*?)~/g, '<del>$1</del>');
        
        // Quebras de linha por último
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    async function fetchPsychologistData() {
        const token = localStorage.getItem('Yelo_token');
        if (!token) { 
            // Salva intenção de post caso o usuário não esteja logado e tenha vindo do e-mail
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.has('postId')) {
                localStorage.setItem('yelo_intent_post', urlParams.get('postId'));
            }
            window.location.href = '/'; 
            return false; 
        }
        try {
            // Adicionado timestamp (?t=...) para evitar que o navegador use dados velhos do cache
            const response = await fetch(`${API_BASE_URL}/api/psychologists/me?t=${new Date().getTime()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                psychologistData = await response.json();

                // Sincroniza o nome e foto no LocalStorage para o Header Público
                if (psychologistData.nome) {
                    localStorage.setItem('Yelo_user_name', psychologistData.nome);
                }
                if (psychologistData.fotoUrl) {
                    localStorage.setItem('Yelo_user_photo', psychologistData.fotoUrl);
                }
                
                // --- SANITIZAÇÃO DE DADOS LEGADOS (GHOST TAGS) ---
                // Impede que tags antigas fiquem presas e invisíveis no painel de edição
                const sanitizeTags = (field) => {
                    if (!psychologistData[field]) return;
                    let arr = psychologistData[field];
                    
                    if (typeof arr === 'string') { 
                        if (arr.trim().startsWith('[')) {
                            try { arr = JSON.parse(arr); } catch(e) { arr = [arr]; } 
                        } else {
                            arr = [arr]; 
                        }
                    }
                    
                    if (Array.isArray(arr)) {
                        let clean = [];
                        arr.flat(Infinity).forEach(tag => {
                            if (!tag) return;
                            let t = typeof tag === 'string' ? tag.trim() : tag;
                            
                            // Divide strings legadas concatenadas por vírgula (Ignora vírgula dentro de parênteses como no TDAH)
                            let subTags = [t];
                            if (typeof t === 'string' && t.includes(',')) {
                                subTags = t.split(/,(?![^\(\)]*\))/).map(s => s.trim());
                            }

                            subTags.forEach(subT => {
                                if (!subT) return;
                                if (field === 'praticas_inclusivas') {
                                    if (subT === "Que faça parte da comunidade LGBTQIAPN+" || subT === "Comunidade LGBTQIAPN+") clean.push("Faz parte da comunidade LGBTQIAPN+ / Afirmativa");
                                    else if (subT === "LGBTQIAPN+ friendly" || subT === "LGBTQIAPN+ Friendly") clean.push("LGBTQIAPN+ Friendly 🏳️‍🌈");
                                    else if (subT.includes("não-branca") || subT.includes("Antirracista")) clean.push("Pessoa não-branca // Prática Antirracista");
                                    else if (subT.includes("Feminista")) clean.push("Perspectiva Feminista");
                                    else if (subT.includes("Neurodiversidade") || subT.includes("TDAH") || subT.includes("Autismo")) clean.push("Neurodiversidade (TDAH, Autismo)");
                                    else if (subT === "Faz parte da comunidade LGBTQIAPN+ / Afirmativa" || subT === "LGBTQIAPN+ Friendly 🏳️‍🌈") clean.push(subT);
                                    else if (subT !== "Indiferente" && subT !== "Nenhuma específica") clean.push(subT);
                                } else {
                                    if (subT !== "Indiferente" && subT !== "Nenhuma específica") clean.push(subT);
                                }
                            });
                        });
                        psychologistData[field] = [...new Set(clean)];
                    }
                };
                
                const multiSelectFields = ['temas_atuacao', 'publico_alvo', 'praticas_inclusivas', 'abordagens_tecnicas', 'modalidade', 'disponibilidade_periodo', 'estilo_terapia'];
                multiSelectFields.forEach(f => sanitizeTags(f));

                atualizarInterfaceLateral(); 
                return true;
            } else if (response.status === 401) {
                // Apenas 401 (Não autorizado) deve causar logout
                throw new Error("Token inválido");
            } else {
                // Erros 500, 502, 503 (Servidor/Banco) não devem deslogar o usuário
                return false; // Retorna false para tratar na inicialização
            }
        } catch (error) {
            if (error.message === "Token inválido") {
                localStorage.removeItem('Yelo_token');
                window.location.href = '/';
            } else {
                // Não desloga em erro de rede/fetch
            }
            return false;
        }
    }

    function atualizarInterfaceLateral() {
        if (!psychologistData) return;
        const nameEl = document.getElementById('psi-sidebar-name');
        const imgEl = document.getElementById('psi-sidebar-photo');
        if(nameEl) nameEl.textContent = psychologistData.nome;
        if(imgEl) {
            imgEl.src = formatImageUrl(psychologistData.fotoUrl);
            // Correção para imagem quebrada (404)
            imgEl.onerror = function() { this.src = 'https://placehold.co/70x70/1B4332/FFFFFF?text=Psi'; };
        }
        const btnLink = document.getElementById('btn-view-public-profile');
        if(btnLink && psychologistData.slug) btnLink.href = `/${psychologistData.slug}`;
        
        // --- NOVO: Atualiza a foto na tela de Ajustes de Perfil (Modo Mobile) ---
        const mobileImgEl = document.getElementById('mobile-profile-photo-preview');
        if (mobileImgEl) {
            mobileImgEl.src = formatImageUrl(psychologistData.fotoUrl);
            mobileImgEl.onerror = function() { this.src = 'https://placehold.co/120x120/1B4332/FFFFFF?text=Psi'; };
        }

        // --- NOVO: Atualiza o Nível Globalmente na Sidebar ---
        let level = psychologistData.authority_level || 'nivel_iniciante';
        // Força "Mentor" se a XP máxima já foi atingida
        if (psychologistData.xp && psychologistData.xp >= 15000) level = 'nivel_mentor';

        const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
        const levelDisplaySidebar = document.getElementById('psi-sidebar-level');
        if (levelDisplaySidebar) {
            levelDisplaySidebar.innerHTML = `🔥 Nível: <strong>${levelMap[level] || 'Iniciante'}</strong>`;
        }

        // --- NOVO: Renderiza as badges ---
        if (psychologistData) {
            if (window.renderSidebarBadges) window.renderSidebarBadges(psychologistData);
        }
    }

    // --- FUNÇÃO DE BLOQUEIO GERAL (NOVA) ---
    function verificarBloqueioGeral(url) {
        if (!psychologistData) return;

        // Páginas permitidas mesmo com o status inativo (para assinar, ajustar perfil, suporte ou exclusão)
        const paginasPermitidas = ['psi_assinatura.html', 'psi_ajustes_hub.html', 'psi_caixa_de_entrada.html', 'psi_excluir_conta.html']; 

        // O Paywall de fim de teste é acionado quando o status muda para inactive
        const estaInativo = psychologistData.status === 'inactive';
        
        const mainEl = document.querySelector('.dashboard-main');
        const paywallOverlay = document.getElementById('paywall-overlay');
        const bannerAnterior = document.querySelector('.restriction-floating-banner');
        const trialPremiumBanner = document.getElementById('trial-premium-banner');


        if (!mainEl) return;
        
        // 1. Limpa os bloqueios visuais da tela anterior
        mainEl.classList.remove('blocked-view');
        mainEl.classList.remove('restricted-mode');
        if (paywallOverlay) paywallOverlay.style.display = 'none';
        if (trialPremiumBanner) trialPremiumBanner.style.display = 'none'; // Esconde o banner de trial por padrão
        if (bannerAnterior) bannerAnterior.remove();

        // Usuários VIP/Isentos nunca são bloqueados
        if (psychologistData.is_exempt) return;

        // 2. Aplica o Paywall se estiver inativo e em página restrita
        if (estaInativo && !paginasPermitidas.includes(url)) {
            mainEl.classList.add('blocked-view');
            
            if (paywallOverlay) {
                paywallOverlay.style.display = 'flex';
            } else {
                // Fallback caso o paywall HTML fixo não exista na página
                mainEl.classList.add('restricted-mode');
                const banner = document.createElement('div');
                banner.className = 'restriction-floating-banner';
                banner.innerHTML = `<span>🔒 Seu período de teste expirou. Ative o Premium para continuar.</span><button onclick="window.loadPage('psi_assinatura.html')">Assinar Agora</button>`;
                document.body.appendChild(banner);
            }
         } else if (psychologistData.showTrialBanner && trialPremiumBanner) {
            // Exibe o banner de trial premium se a flag do backend for true
            trialPremiumBanner.style.display = 'flex';
            const titleEl = document.getElementById('trial-premium-title');
            const messageEl = document.getElementById('trial-premium-message');
            if (titleEl) titleEl.textContent = psychologistData.trialBannerMessage || "Complete seu CPF para liberar o Premium!";
            if (messageEl) messageEl.textContent = "Seu perfil está quase pronto! Adicione seu CPF para ativar seus 14 dias Premium grátis e começar a receber pacientes.";
        }
    }

    function inicializarAjustesHub() {
        const btnPublic = document.getElementById('hub-btn-public-profile');
        if (btnPublic && psychologistData && psychologistData.slug) {
            btnPublic.href = `/${psychologistData.slug}`;
        }
    }

    let currentPageUrl = 'psi_visao_geral.html';

    window.loadPage = function(url) {
        if (!url) return;
        
        window.appHistory = window.appHistory || [];
        window.appForwardHistory = window.appForwardHistory || [];
        
        if (!window.isHistoryNav) {
            if (window.appHistory[window.appHistory.length - 1] !== url) {
                window.appHistory.push(url);
                window.appForwardHistory = [];
            }
        }
        window.isHistoryNav = false;

        currentPageUrl = url;

        // NOVO: Extrai parâmetros do link (ex: psi_forum.html?postId=123)
        const [pageUrl, queryString] = url.split('?');
        if (queryString && queryString.includes('postId=')) {
            const params = new URLSearchParams(queryString);
            window.yeloPostToOpen = params.get('postId');
            if (params.has('commentId')) {
                window.yeloCommentToHighlight = params.get('commentId');
            }
        }

        // --- V6: Limpeza de listeners da página de Blog ---
        if (typeof window.cleanupBlog === 'function') {
            window.cleanupBlog();
            window.cleanupBlog = null;
        }

        // --- Limpeza do estado da página Jornada ---
        if (typeof window.cleanupPaginaJornada === 'function') {
            window.cleanupPaginaJornada();
        }

        // Salva a página atual para persistir após o refresh
        localStorage.setItem('yelo_last_psi_page', url);
        // Spinner de carregamento entre páginas
        mainContent.innerHTML = `
            <div class="loader-wrapper" style="height: 100%; min-height: 400px; align-items: center;">
                <div class="loader-spinner"></div>
            </div>`;
            
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

        // Garante que o menu inferior reapareça se estivesse oculto pelo Smart Scroll
        const bNav = document.querySelector('.mobile-bottom-nav');
        if (bNav) bNav.classList.remove('nav-hidden');
        
        // Garante que o header mobile reapareça caso tenha sido oculto por alguma tela full-screen (como posts do fórum)
        const mHeader = document.querySelector('.mobile-header');
        if (mHeader) mHeader.style.display = '';

        let activeLink = document.querySelector(`.sidebar-nav a[data-page="${url}"]`);
        let activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${url}"]`);
        
        if (!activeLink || !activeBottomLink) {
            let hubPage = '';
            if (['psi_pacientes.html', 'psi_financeiro.html', 'psi_analytics.html', 'psi_favoritos_analytics.html'].includes(url)) {
                hubPage = 'psi_clinica_hub.html';
            } else if (['psi_jornada.html', 'psi_blog.html', 'psi_forum.html', 'psi_comunidade.html', 'psi_hub.html', 'psi_lista_espera.html'].includes(url)) {
                hubPage = 'psi_evolucao_hub.html';
            } else if (['psi_meu_perfil.html', 'psi_assinatura.html', 'psi_caixa_de_entrada.html', 'psi_excluir_conta.html'].includes(url)) {
                hubPage = 'psi_ajustes_hub.html';
            }

            if (hubPage) {
                if (!activeLink) activeLink = document.querySelector(`.sidebar-nav a[data-page="${hubPage}"]`);
                if (!activeBottomLink) activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${hubPage}"]`);
            }
        }

        if (activeLink) activeLink.closest('li').classList.add('active');
        if (activeBottomLink) activeBottomLink.classList.add('active');
        
        // Destaca o sino no header se for a página de avisos
        const mobileAvisosTrigger = document.getElementById('mobile-avisos-trigger');
        if (mobileAvisosTrigger) {
            if (url === 'psi_avisos.html') {
                mobileAvisosTrigger.style.backgroundColor = '#f0fdf4';
                mobileAvisosTrigger.style.color = 'var(--verde-escuro)';
            } else {
                mobileAvisosTrigger.style.backgroundColor = 'transparent';
                mobileAvisosTrigger.style.color = '#1B4332';
            }
        }

        // --- OTIMIZAÇÃO: PRÉ-FETCH DE DADOS (Paralelismo) ---
        // Dispara a busca de dados IMEDIATAMENTE, sem esperar o HTML carregar
        let dataPromise = null;
        if (url.includes('psi_blog.html')) { 
             dataPromise = apiFetch(`${API_BASE_URL}/api/psychologists/me/posts?page=1&limit=3`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_comunidade.html')) {
             dataPromise = apiFetch(`${API_BASE_URL}/api/qna?page=1&limit=15`).then(r => r.ok ? r.json() : null).catch(() => null);
        } else if (url.includes('psi_forum.html')) {
             // Busca 4 itens (3 para exibir + 1 para checar se tem mais), informando o tamanho real da página para o offset
             dataPromise = apiFetch(`${API_BASE_URL}/api/forum/posts?filter=recentes&search=&page=1&limit=4&pageSize=3`).then(r => r.ok ? r.json() : null).catch(() => null);
        }

        // Se for a caixa de entrada, remove a badge
        if (url.includes('caixa_de_entrada')) {
            window.psiUnreadConversations.clear();
            updateSidebarBadge('psi_caixa_de_entrada.html', false);
        }

        // FIX: Garante que o arquivo seja buscado da raiz da pasta /psi/
        const fetchUrl = url.startsWith('/') ? url : `/psi/${url}`;
        fetch(fetchUrl).then(r => r.ok ? r.text() : Promise.reject(url))
            .then(html => {
                mainContent.innerHTML = html;
                
                // --- VERIFICAÇÃO DE BLOQUEIO ---
                verificarBloqueioGeral(url);

                if (url.includes('jornada')) {
                    if (psychologistData && window.updateGamificationWidgets) window.updateGamificationWidgets(psychologistData);
                }
                else if (url.includes('visao_geral')) { if (window.inicializarVisaoGeral) window.inicializarVisaoGeral(); }
                else if (url.includes('comunidade')) { if (window.inicializarComunidade) window.inicializarComunidade(dataPromise); }
                else if (url.includes('psi_hub')) { if (window.inicializarHubComunidade) window.inicializarHubComunidade(); }
                else if (url.includes('psi_ajustes_hub')) inicializarAjustesHub(); 
                else if (url.includes('psi_blog')) { if (window.inicializarBlog) window.inicializarBlog(dataPromise); }
                else if (url.includes('psi_forum')) { if (window.inicializarForum) window.inicializarForum(dataPromise); }
                else if (url.includes('psi_meu_perfil')) { if (window.inicializarLogicaDoPerfil) window.inicializarLogicaDoPerfil(); }
                else if (url.includes('psi_assinatura')) { if (window.inicializarAssinatura) window.inicializarAssinatura(); }
                else if (url.includes('psi_favoritos_analytics.html')) {
                    /// a página se auto-inicializa, mas garantimos que o cleanup de outras páginas rode.
                }
                // Adicione outras inicializações de página aqui
                
                // SEMPRE atualiza a bolinha do sino ao navegar entre as páginas do painel
                if (typeof window.carregarAvisosBackground === 'function') {
                    window.carregarAvisosBackground();
                }
            })
            .catch(e => mainContent.innerHTML = `<p>Erro ao carregar: ${e}</p>`);

        // --- LÓGICA DE SMART SCROLL (PÁGINAS CURTAS) ---
        // Adicionado aqui para rodar a cada carregamento de página
        const scrollableContent = document.querySelector('.dashboard-main');
        const bottomNav = document.querySelector('.mobile-bottom-nav');

        if (scrollableContent && bottomNav && window.innerWidth <= 992) {
            // Usa um timeout para garantir que o DOM foi renderizado e a altura é calculada corretamente
            setTimeout(() => {
                const isScrollable = scrollableContent.scrollHeight > scrollableContent.clientHeight;
                if (!isScrollable) {
                    // Se a página não tem rolagem, encolhe a barra após 2 segundos
                    setTimeout(() => {
                        bottomNav.classList.add('nav-hidden');
                    }, 2000);
                }
            }, 150); // Delay de 150ms para cálculo da altura
        }
    }

    // INIT
    fetchPsychologistData().then(ok => {
        // Remove o loader global com fade-out
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.style.display = 'none', 500);
        }

        if (ok) {
            // --- NOVO: MODAL DE BOAS-VINDAS (PRIMEIRO ACESSO) ---
            const welcomeKey = `Yelo_welcome_seen_${psychologistData.id}`;
            if (!localStorage.getItem(welcomeKey)) {
                const welcomeModal = document.createElement('div');
                welcomeModal.id = 'modal-boas-vindas-psi';
                welcomeModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); display: flex; z-index: 100000; animation: fadeIn 0.3s ease; backdrop-filter: blur(4px);';
                
                const firstName = psychologistData.nome ? psychologistData.nome.split(' ')[0] : 'colega';
                
                welcomeModal.innerHTML = `
                    <style>
                        #modal-boas-vindas-psi {
                            justify-content: center; 
                            align-items: center;
                        }
                        .welcome-modal-box {
                            background: white; 
                            padding: 40px 30px; 
                            border-radius: 20px; 
                            width: 90%; 
                            max-width: 450px; 
                            text-align: center; 
                            box-shadow: 0 10px 40px rgba(0,0,0,0.2); 
                            position: relative; 
                            animation: slideUpWelcome 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                        }
                        @keyframes slideUpWelcome {
                            from { transform: translateY(30px); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                        @media (max-width: 768px) {
                            #modal-boas-vindas-psi {
                                align-items: flex-end; /* Empurra pro chão no celular */
                            }
                            .welcome-modal-box {
                                width: 100%;
                                max-width: 100%;
                                border-radius: 24px 24px 0 0; /* Apenas o topo arredondado */
                                padding: 30px 20px 40px 20px;
                                margin: 0;
                                animation: slideUpSheet 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                            }
                            @keyframes slideUpSheet {
                                from { transform: translateY(100%); }
                                to { transform: translateY(0); }
                            }
                            /* Tracinho visual de "arrastar" no topo */
                            .welcome-modal-box::before {
                                content: '';
                                display: block;
                                width: 40px;
                                height: 5px;
                                background: #e0e0e0;
                                border-radius: 5px;
                                margin: -15px auto 20px auto;
                            }
                        }
                    </style>
                    <div class="welcome-modal-box">
                        <div style="font-size: 3.5rem; margin-bottom: 15px;">💛</div>
                        <h3 style="color: var(--verde-escuro, #1B4332); margin-bottom: 15px; font-family: var(--font-titulos, 'Fraunces', serif); font-size: 1.6rem; line-height: 1.2;">Que alegria ter você aqui, ${firstName}!</h3>
                        <p style="color: #444; line-height: 1.6; margin-bottom: 25px; font-size: 1rem; font-family: var(--font-principal, 'Inter', sans-serif);">
                            A Yelo nasceu do sonho de conectar pessoas à saúde mental de forma humana, acessível e ética. <br><br>
                            Sinta-se em casa. Este é o seu novo consultório digital e a sua nova comunidade. Prepare o seu perfil, interaja no nosso fórum e conte com a gente para apoiar o crescimento da sua prática clínica.
                        </p>
                        <button id="btn-close-welcome" style="background-color: var(--verde-escuro, #1B4332); color: white; border: none; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Começar minha jornada</button>
                    </div>
                `;
                document.body.appendChild(welcomeModal);

                document.getElementById('btn-close-welcome').onclick = () => {
                    const box = welcomeModal.querySelector('.welcome-modal-box');
                    if (box) {
                        box.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease';
                        box.style.transform = window.innerWidth <= 768 ? 'translateY(100%)' : 'translateY(30px)';
                        box.style.opacity = '0';
                    }
                    welcomeModal.style.transition = 'opacity 0.3s ease';
                    welcomeModal.style.opacity = '0';
                    setTimeout(() => welcomeModal.remove(), 300);
                    localStorage.setItem(welcomeKey, 'true');
                };
            }

            // Lógica do Modal de Instabilidade
            if (!localStorage.getItem('Yelo_aviso_instabilidade_lido')) {
                const modalInstabilidade = document.getElementById('modal-aviso-instabilidade');
                const btnEntendi = document.getElementById('btn-entendi-instabilidade');
                const nomeEl = document.getElementById('aviso-instabilidade-nome');
                
                if (modalInstabilidade) {
                    if (nomeEl && psychologistData && psychologistData.nome) {
                        nomeEl.textContent = psychologistData.nome.split(' ')[0];
                    }
                    modalInstabilidade.style.display = 'flex';
                    
                    if (btnEntendi) {
                        btnEntendi.onclick = () => {
                            modalInstabilidade.style.display = 'none';
                            localStorage.setItem('Yelo_aviso_instabilidade_lido', 'true');
                        };
                    }
                }
            }

            // --- LÓGICA DE FEEDBACK DE WHATSAPP (PLG CONVERSÃO) ---
            // Dá 4 segundos para a página carregar tudo antes de mostrar
            setTimeout(async () => {
                try {
                    const res = await apiFetch(`${API_BASE_URL}/api/psychologists/me/pending-whatsapp-feedback`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.id) {
                            const modal = document.createElement('div');
                            modal.id = 'modal-feedback-wpp';
                            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); display: flex; justify-content: center; align-items: center; z-index: 100000; animation: fadeIn 0.3s ease; backdrop-filter: blur(4px);';
                            let guestName = data.guestName || 'um paciente';
                            if (guestName === 'Visitante') guestName = 'um paciente';
                            
                            modal.innerHTML = `
                                <style>
                                    @media (max-width: 768px) {
                                        #modal-feedback-wpp {
                                            align-items: flex-end !important;
                                        }
                                        #modal-feedback-wpp .welcome-modal-box {
                                            width: 100% !important;
                                            max-width: 100% !important;
                                            border-radius: 24px 24px 0 0 !important;
                                            padding: 30px 20px 40px 20px !important;
                                            margin: 0 !important;
                                            animation: slideUpSheet 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
                                        }
                                        #modal-feedback-wpp .welcome-modal-box::before {
                                            content: '';
                                            display: block;
                                            width: 40px;
                                            height: 5px;
                                            background: #e0e0e0;
                                            border-radius: 5px;
                                            margin: -15px auto 20px auto;
                                        }
                                    }
                                </style>
                                <div class="welcome-modal-box" id="feedback-step-1" style="background: white; padding: 40px 30px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; animation: slideUpWelcome 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
                                    <div style="font-size: 3.5rem; margin-bottom: 15px;">👋</div>
                                    <h3 style="color: var(--verde-escuro, #1B4332); margin-bottom: 15px; font-family: var(--font-titulos, 'Fraunces', serif); font-size: 1.6rem; line-height: 1.2;">Opa! Vimos que ${guestName} clicou para falar com você</h3>
                                    <p style="color: #444; line-height: 1.6; margin-bottom: 25px; font-size: 1rem; font-family: var(--font-principal, 'Inter', sans-serif);">
                                        Queremos saber se deu tudo certo com esse contato!
                                    </p>
                                    <div style="display: flex; gap: 10px; justify-content: center; flex-direction: column;">
                                        <button id="btn-feedback-yes" style="background-color: var(--verde-escuro, #1B4332); color: white; border: none; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Sim, recebi mensagem</button>
                                        <button id="btn-feedback-no" style="background-color: transparent; color: #666; border: 1px solid #ccc; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Não recebi mensagem</button>
                                    </div>
                                </div>

                                <div class="welcome-modal-box" id="feedback-step-2" style="display: none; background: white; padding: 40px 30px; border-radius: 20px; width: 90%; max-width: 450px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.2); position: relative; animation: slideUpWelcome 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
                                    <div style="font-size: 3.5rem; margin-bottom: 15px;">🎉</div>
                                    <h3 style="color: var(--verde-escuro, #1B4332); margin-bottom: 15px; font-family: var(--font-titulos, 'Fraunces', serif); font-size: 1.6rem; line-height: 1.2;">Que excelente notícia!</h3>
                                    <p style="color: #444; line-height: 1.6; margin-bottom: 25px; font-size: 1rem; font-family: var(--font-principal, 'Inter', sans-serif);">
                                        Você fechou negócio e ele se tornou seu paciente?
                                    </p>
                                    <div style="display: flex; gap: 10px; justify-content: center; flex-direction: column;">
                                        <button id="btn-feedback-closed-yes" style="background-color: #16a34a; color: white; border: none; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Sim, fechamos!</button>
                                        <button id="btn-feedback-closed-no" style="background-color: transparent; color: #666; border: 1px solid #ccc; padding: 14px 28px; border-radius: 50px; font-weight: bold; cursor: pointer; width: 100%; font-size: 1.05rem; transition: transform 0.2s, background-color 0.2s;">Ainda não / Não fechou</button>
                                    </div>
                                </div>
                            `;
                            document.body.appendChild(modal);

                            const sendFeedback = async (contact_received, deal_closed) => {
                                try {
                                    await apiFetch(`${API_BASE_URL}/api/psychologists/me/whatsapp-feedback`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}` },
                                        body: JSON.stringify({ clickLogId: data.id, contact_received, deal_closed })
                                    });
                                } catch(e) {}
                                
                                modal.style.transition = 'opacity 0.3s ease';
                                modal.style.opacity = '0';
                                setTimeout(() => modal.remove(), 300);
                            };

                            document.getElementById('btn-feedback-no').onclick = () => {
                                showToast('Tudo bem. Notificaremos nossa equipe.', 'info');
                                sendFeedback(false, 'no');
                            };
                            document.getElementById('btn-feedback-yes').onclick = () => {
                                document.getElementById('feedback-step-1').style.display = 'none';
                                document.getElementById('feedback-step-2').classList.remove('hidden');
                                document.getElementById('feedback-step-2').style.display = 'block';
                            };
                            document.getElementById('btn-feedback-closed-yes').onclick = () => {
                                showToast('Parabéns pela nova conquista! 🚀', 'success');
                                sendFeedback(true, 'yes');
                            };
                            document.getElementById('btn-feedback-closed-no').onclick = () => {
                                showToast('Obrigado pelo feedback! Continuaremos te enviando pacientes.', 'info');
                                sendFeedback(true, 'no');
                            };
                        }
                    }
                } catch (err) {}
            }, 4000);

            document.getElementById('dashboard-container').style.display = 'flex';
            document.querySelectorAll('.sidebar-nav a').forEach(l => {
                if (l.classList.contains('btn-logout-action')) return; // Ignora o botão de sair pois já tem listener próprio
                l.onclick = (e) => { 
                    e.preventDefault(); 
                    loadPage(l.getAttribute('data-page'));
                    // FECHA O MENU NO MOBILE AO CLICAR
                    if (window.innerWidth <= 992 && sidebar && sidebar.classList.contains('is-open')) {
                        sidebar.classList.remove('is-open');
                    }
                };
            });
            const urlParams = new URLSearchParams(window.location.search);
            const intentPost = localStorage.getItem('yelo_intent_post');

            if (urlParams.has('status')) {
                loadPage('psi_assinatura.html');
                if (urlParams.get('status') === 'approved') {
                    showToast('Pagamento Aprovado!', 'success');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } else if (urlParams.has('postId') || intentPost) {
                if (intentPost) localStorage.removeItem('yelo_intent_post');
                
                if (urlParams.has('postId')) {
                    window.yeloPostToOpen = urlParams.get('postId');
                    if (urlParams.has('commentId')) {
                        window.yeloCommentToHighlight = urlParams.get('commentId');
                    }
                } else if (intentPost) {
                    window.yeloPostToOpen = intentPost;
                }
                
                window.history.replaceState({}, document.title, window.location.pathname);
                loadPage('psi_forum.html');
            } else {
                // Carrega a última página visitada ou a visão geral como padrão.
                const lastPage = localStorage.getItem('yelo_last_psi_page');
                loadPage(lastPage || 'psi_visao_geral.html');
            }
            
            // --- LÓGICA DE SMART SCROLL (OCULTAR MENU INFERIOR AO ROLAR) ---
            function setupSmartScroll() {
                // Só executa em telas mobile
                if (window.innerWidth > 992) return;

                const bottomNav = document.querySelector('.mobile-bottom-nav');
                // O elemento que de fato rola é o .dashboard-main
                const scrollableContent = document.querySelector('.dashboard-main');
                
                if (!bottomNav || !scrollableContent) return;

                // Adiciona listener para expandir ao clicar na barra encolhida (executa uma vez)
                bottomNav.addEventListener('click', () => {
                    if (bottomNav.classList.contains('nav-hidden')) {
                        // Apenas remove a classe, a navegação continua se o clique foi num link
                        bottomNav.classList.remove('nav-hidden');
                    }
                });

                let lastScrollY = scrollableContent.scrollTop;
                const scrollThreshold = 100; // Distância mínima para começar a ocultar

                scrollableContent.addEventListener('scroll', () => {
                    const currentScrollY = scrollableContent.scrollTop;

                    if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
                        // Rolando para baixo: Oculta o menu
                        bottomNav.classList.add('nav-hidden');
                    } else if (currentScrollY < lastScrollY) {
                        // Rolando para cima: Mostra o menu
                        bottomNav.classList.remove('nav-hidden');
                    }
                    lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
                }, { passive: true });
            }
            setupSmartScroll();

            // --- NOVO: INICIA A LÓGICA DE TOOLTIPS MOBILE ---
            setupMobileBadgeTooltips();
            
            // --- NOVO: INICIA A LÓGICA DE NOTIFICAÇÕES DE NAVEGADOR ---
            if (typeof window.setupSessionNotifications === 'function') {
                window.setupSessionNotifications();
            }

            // --- NOVO: INICIA A LÓGICA DE FEEDBACK DA PLATAFORMA ---
            if (window.PsiFeedback) {
                window.PsiFeedback.checkAndShowModal();
            }

            // --- INICIA PULL TO REFRESH NO MOBILE ---
            if (window.setupPullToRefresh) window.setupPullToRefresh();

            // --- INICIA NAVEGAÇÃO POR SWIPE NO MOBILE ---
            if (window.setupSwipeNavigation) window.setupSwipeNavigation();
        } else {
            // Se falhou mas não deslogou (ex: erro 500 do banco), mostra tela de erro amigável
            // Isso evita que o usuário veja uma tela branca ou seja deslogado injustamente
            if (localStorage.getItem('Yelo_token')) {
                document.body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; color:#1B4332; text-align:center; padding:20px;">
                        <div style="font-size:3rem; margin-bottom:20px;">🛠️</div>
                        <h2>Instabilidade Temporária</h2>
                        <p style="color:#666; max-width:400px; margin:0 auto;">Estamos com uma breve instabilidade na conexão com o banco de dados. Seus dados estão seguros.</p>
                        <button onclick="window.location.reload()" style="padding:12px 30px; background:#1B4332; color:white; border:none; border-radius:50px; cursor:pointer; margin-top:25px; font-weight:bold; font-size:1rem; transition: transform 0.2s;">Tentar Novamente</button>
                    </div>
                `;
            }
        }
    });

    window.setupMobileBadgeTooltips = function() {
        if (document.body.dataset.tooltipsSetup) return;
        document.body.dataset.tooltipsSetup = 'true';

        let activeTooltip = null;

        const createTooltip = (target) => {
            const title = target.getAttribute('title') || target.dataset.originalTitle;
            if (!title) return null;
            if (target.getAttribute('title')) { target.dataset.originalTitle = title; target.removeAttribute('title'); }
            if (activeTooltip) activeTooltip.remove();

            const tooltip = document.createElement('div');
            tooltip.className = 'mobile-badge-tooltip'; 
            tooltip.textContent = title;
            document.body.appendChild(tooltip);
            activeTooltip = tooltip;

            const targetRect = target.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let top = targetRect.bottom + 10;
            tooltip.classList.add('bottom');

            if ((top + tooltipRect.height) > window.innerHeight - 20) {
                top = targetRect.top - tooltipRect.height - 10;
                tooltip.classList.remove('bottom');
                tooltip.classList.add('top');
            }
            
            let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
            if (left < 10) left = 10;
            if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;

            tooltip.style.top = `${top}px`; tooltip.style.left = `${left}px`;
            return tooltip;
        };

        const removeTooltip = () => { if (activeTooltip) { activeTooltip.remove(); activeTooltip = null; } };

        document.body.addEventListener('click', function(e) {
            const target = e.target.closest('.badge-card, .badge-item');
            if (!target) { removeTooltip(); return; }
            if (window.innerWidth <= 992) { e.preventDefault(); e.stopPropagation(); createTooltip(target); }
        });

        document.body.addEventListener('mouseover', function(e) {
            if (window.innerWidth <= 992) return;
            const target = e.target.closest('.badge-card, .badge-item');
            if (target) createTooltip(target);
        });

        document.body.addEventListener('mouseout', function(e) {
            if (window.innerWidth <= 992) return;
            const target = e.target.closest('.badge-card, .badge-item');
            if (target) removeTooltip();
        });
    };

});     