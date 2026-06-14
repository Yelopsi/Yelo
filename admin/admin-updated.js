document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');

    // --- FUNÇÃO DE NAVEGAÇÃO GLOBAL (REFATORADA) ---
    function loadPage(pageUrlWithParams) {
        // Limpa o script da página anterior
        if (typeof window.cleanupPage === 'function') {
            window.cleanupPage();
            window.cleanupPage = null;
        }

        const [pageUrl, queryString] = (pageUrlWithParams || '').split('?');
        window.pageQueryString = queryString || ''; // Armazena params para o próximo script

        const absolutePageUrl = `/admin/${pageUrl}`;
        mainContent.innerHTML = '<p style="text-align:center; padding: 40px;">Carregando...</p>';

        fetch(absolutePageUrl + '?v=' + new Date().getTime())
            .then(r => r.ok ? r.text() : Promise.reject(pageUrl))
            .then(html => {
                mainContent.innerHTML = html;

                const oldScript = document.getElementById('dynamic-page-script');
                if (oldScript) oldScript.remove();

                const script = document.createElement('script');
                script.src = absolutePageUrl.replace('.html', '.js') + '?v=' + new Date().getTime();
                script.id = 'dynamic-page-script';
                
                script.onload = () => {
                    if (typeof window.initializePage === 'function') window.initializePage();
                };
                document.body.appendChild(script);
                updateWelcomeMessage();
            })
            .catch(e => mainContent.innerHTML = '<p>Erro ao carregar conteúdo.</p>');
    }
    window.navigateToPage = loadPage; // Expõe a função globalmente

    function logout() {
        // --- MIGRAÇÃO: Chama a rota do servidor para limpar o Cookie HttpOnly ---
        window.location.href = '/logout'; 
    }

    async function initializeAndProtect() {
        const token = localStorage.getItem('Yelo_token');
        
        // Se não tiver token, manda pro login unificado imediatamente
        if (!token) { 
            logout(); 
            return; 
        }

        try {
            // Verifica se o token é válido no backend
            const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Sessão inválida ou expirada');

            const admin = await response.json();
            window.adminId = admin.id;
            
            // Atualiza o nome no menu lateral
            const adminNameEl = document.querySelector('.nome-admin');
            if (adminNameEl) adminNameEl.textContent = admin.nome;

            // Inicia o restante do painel
            setupPageNavigation();
            updateWelcomeMessage();

            // --- INICIALIZA SOCKET (Conecta o Admin à sala) ---
            connectAdminSocket(token);

        } catch (error) {
            console.error("Erro de autenticação:", error);
            logout(); // Segurança: Se der erro, desloga para evitar estado inconsistente
        }
    }

    function updateWelcomeMessage() {
        const pageTitle = document.querySelector('.titulo-pagina h1');
        const pageSubtitle = document.querySelector('.titulo-pagina p');
        const adminName = document.querySelector('.nome-admin')?.textContent.split(' ')[0] || 'Admin';
        
        const activeLink = document.querySelector('.sidebar-nav li.active');
        
        if (pageTitle && activeLink) {
            const menuText = activeLink.querySelector('span')?.textContent.trim();
            const dataPage = activeLink.getAttribute('data-page');
            const target = activeLink.getAttribute('data-target');

            // Mapa de subtítulos para cada página
            const subtitles = {
                'admin_visao_geral.html': 'Aqui está o resumo da sua plataforma hoje.',
                'admin_caixa_entrada.html': 'Gerencie suas mensagens e conversas.',
                'admin_lista_espera.html': 'Profissionais que aguardam demanda para entrar na plataforma.',
                'admin_avaliacoes.html': 'Acompanhe as avaliações gerais da plataforma.',
                'admin_avaliacoes_psi.html': 'Feedback de retenção e offboarding.',
                'admin_gestao_conteudo.html': 'Modere avaliações, perguntas e edite páginas.',
                'admin_comunidade_gestao.html': 'Gerencie banners e links da comunidade.',
                'admin_minha_conta.html': 'Gerencie seus dados de acesso.',
                'admin_configuracoes.html': 'Ajustes gerais do sistema.',
                'admin_logs_sistema.html': 'Histórico de atividades do sistema.'
            };

            if (dataPage === 'admin_visao_geral.html') {
                pageTitle.textContent = `Bem-vindo, ${adminName}!`;
            } else {
                pageTitle.textContent = menuText;
            }

            if (pageSubtitle) {
                pageSubtitle.textContent = subtitles[dataPage] || '';
            }
        }
    }

    function setupPageNavigation() {
        // Adiciona delegação via Hub também, então monitora os links reais clicados
        const allNavItems = document.querySelectorAll('.sidebar-nav a[data-page], .bottom-nav-item[data-target-page]');
        
        window.loadPage('admin_visao_geral.html'); // Carrega a home por padrão

        allNavItems.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const page = this.getAttribute('data-page') || this.getAttribute('data-target-page');
                if (page) window.loadPage(page);

                // --- CORREÇÃO MOBILE: FECHAR MENU AO CLICAR ---
                const sidebar = document.querySelector('.dashboard-sidebar');
                if (sidebar && sidebar.classList.contains('is-open') && window.innerWidth <= 992) {
                    sidebar.classList.remove('is-open');
                }
            });
        });
    }

    // --- AQUI ESTÁ A CORREÇÃO DO MODAL ---
    function setupConfirmationModal() {
        const modal = document.getElementById('confirmation-modal');
        
        // Se não achar o modal no HTML, avisa no console
        if (!modal) {
            console.warn("Modal HTML não encontrado em admin.html");
            return;
        }

        const confirmBtn = document.getElementById('modal-confirm-btn');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        let confirmCallback = null;

        // Função para FECHAR (Esconde na marra)
        const closeModal = () => {
            modal.style.display = 'none'; // <--- Força display none
            confirmCallback = null;
        };

        // Função Global para ABRIR (Mostra na marra)
        window.openConfirmationModal = (title, body, onConfirm) => {
            const titleEl = document.getElementById('modal-title');
            const bodyEl = document.getElementById('modal-body');
            
            if(titleEl) titleEl.textContent = title;
            if(bodyEl) bodyEl.innerHTML = body;
            
            confirmCallback = onConfirm;
            modal.style.display = 'flex'; // <--- Força display flex (visível)
        };

        if(confirmBtn) confirmBtn.onclick = () => {
            if (typeof confirmCallback === 'function') confirmCallback();
            closeModal();
        };

        if(cancelBtn) cancelBtn.onclick = closeModal;
        
        // Fecha se clicar fora
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };
    }

    function setupGlobalEvents() {
        const logoutButton = document.querySelector('.btn-sair');
        if (logoutButton) logoutButton.onclick = (e) => { e.preventDefault(); logout(); };

        // Listener para quando os dados do admin forem atualizados em outra página (ex: Minha Conta)
        window.addEventListener('adminDataUpdated', (event) => {
            const newName = event.detail?.nome;

            // Atualiza o nome na sidebar
            const adminNameEl = document.querySelector('.nome-admin');
            if (adminNameEl && newName) {
                adminNameEl.textContent = newName;
            }
            /// a função updateWelcomeMessage já lê o nome da sidebar, que foi atualizado
            updateWelcomeMessage();
        });

        // Listener para quando os dados do admin forem atualizados em outra página
        window.addEventListener('adminDataUpdated', updateWelcomeMessage);
    }

    // ==========================================
    // SOCKET.IO (TEMPO REAL)
    // ==========================================
    function connectAdminSocket(token) {
        if (typeof io === 'undefined') {
            console.warn('Socket.io não carregado.');
            return;
        }

        // Usa a URL global (do config.js) ou a origem atual como fallback
        const url = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : window.location.origin;

        const socket = io(url, {
            auth: { token: token },
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ Admin conectado ao Socket.IO:', socket.id);
        });

        socket.on('receiveMessage', (data) => {
            console.log('📩 Nova mensagem recebida:', data);
            
            // 1. Dispara evento global para a página de chat atualizar (se estiver aberta)
            window.dispatchEvent(new CustomEvent('admin:message_received', { detail: data }));

            // 2. Feedback Visual (Toast)
            showToast(`Nova mensagem de ${data.senderType === 'psychologist' ? 'Psicólogo' : 'Paciente'}`);
        });

        // CORREÇÃO: Ouve atualizações de status (lido/entregue) e repassa para a UI
        socket.on('message_status_updated', (data) => {
            console.log('📩 Status atualizado:', data);
            window.dispatchEvent(new CustomEvent('admin:message_status_updated', { detail: data }));
        });

        // Torna global para uso em outras páginas
        window.adminSocket = socket;
        window.showToast = showToast; // Expõe a função de toast globalmente
    }

    function showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconSvg = '';
        if (type === 'success') iconSvg = `<svg width="20" height="20" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        else if (type === 'error') iconSvg = `<svg width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        else iconSvg = `<svg width="20" height="20" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;

        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'all 0.4s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px) scale(0.9)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    initializeAndProtect();
    setupConfirmationModal();
    setupGlobalEvents();

    
});