document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');
    
    // Estado global para contar conversas não lidas
    window.unreadConversations = new Set();

    // --- BADGE DE NOTIFICAÇÃO (CSS INJETADO) ---
    const badgeStyle = document.createElement('style');
    badgeStyle.innerHTML = `
        .sidebar-badge {
            background-color: #FFEE8C; /* Amarelo Yelo */
            color: #1B4332; /* Verde Yelo */
            border-radius: 50%;
            min-width: 18px;
            height: 18px;
            padding: 0 4px;
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            display: none;
            box-shadow: 0 0 0 1px #fff;
            font-size: 11px;
            font-weight: 800;
            align-items: center;
            justify-content: center;
            z-index: 10;
        }
        .sidebar-badge.visible { display: flex; }
        .sidebar-nav li a { position: relative; }
    `;
    document.head.appendChild(badgeStyle);

    // --- ESTILOS KPI E-MAIL (Injetados) ---
    const kpiStyle = document.createElement('style');
    kpiStyle.innerHTML = `
        .kpi-icon.success { background-color: #e8f5e9; color: #1B4332; }
        .kpi-value.success { color: #1B4332; }
        .kpi-icon.warning { background-color: #fff3e0; color: #f57c00; }
        .kpi-value.warning { color: #f57c00; }
        .kpi-icon.danger { background-color: #ffebee; color: #d32f2f; }
        .kpi-value.danger { color: #d32f2f; }
        .tiny-icon { font-size: 18px; vertical-align: middle; margin-right: 4px; }
    `;
    document.head.appendChild(kpiStyle);

    // Função para controlar a badge no menu
    window.updateSidebarBadge = function(pageName, show) {
        const link = document.querySelector(`.sidebar-nav a[data-page="${pageName}"]`);
        if (!link) return;
        
        let badge = link.querySelector('.sidebar-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'sidebar-badge';
            link.appendChild(badge);
        }
        
        if (show) {
            const count = window.unreadConversations.size;
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        } else {
            badge.classList.remove('visible');
            badge.textContent = '';
        }
    };

    // --- HELPER: BUSCAR HORÁRIOS DISPONÍVEIS (Para Reagendamento) ---
    window.fetchAvailableSlots = async function() {
        const token = localStorage.getItem('Yelo_token');
        if (!token) return [];
        const res = await fetch(`${API_BASE_URL}/api/appointments/available`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        return await res.json();
    };

    // --- HELPER: EXCLUIR AGENDAMENTO (Botão Lixeira) ---
    window.deleteAppointment = async function(id, callback) {
        if (!confirm('Tem certeza que deseja excluir este agendamento?')) return;

        try {
            const token = localStorage.getItem('Yelo_token');
            const res = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                window.showToast('Agendamento excluído.', 'success');
                if (callback) callback(); // Atualiza o calendário
            } else {
                window.showToast('Erro ao excluir.', 'error');
            }
        } catch (error) {
            console.error(error);
            window.showToast('Erro de conexão.', 'error');
        }
    };

    // --- FUNÇÃO DE NAVEGAÇÃO GLOBAL (REFATORADA) ---
    function loadPage(pageUrlWithParams) {
        // Limpa o script da página anterior
        if (typeof window.cleanupPage === 'function') {
            window.cleanupPage();
            window.cleanupPage = null;
        }

        const [pageUrl, queryString] = (pageUrlWithParams || '').split('?');
        window.currentAdminPageUrl = pageUrlWithParams; // Salva para o Pull-to-Refresh Global
        window.pageQueryString = queryString || ''; // Armazena params para o próximo script

        // Se for a caixa de entrada, remove a badge
        if (pageUrl === 'admin_caixa_entrada.html') {
            window.unreadConversations.clear();
            window.updateSidebarBadge('admin_caixa_entrada.html', false);
        }

        // --- LÓGICA DE HUB: Sincronizar estado ativo na Sidebar e Bottom Nav ---
        document.querySelectorAll('.sidebar-nav li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));

        let activeLink = document.querySelector(`.sidebar-nav a[data-page="${pageUrl}"]`);
        let activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${pageUrl}"]`);
        
        if (!activeLink || !activeBottomLink) {
            let hubPage = '';
            if (['admin_caixa_entrada.html', 'admin_avisos.html', 'admin_followup.html'].includes(pageUrl)) hubPage = 'admin_comunicacao_hub.html';
            else if (['admin_gerenciar_psicologos.html', 'admin_gerenciar_pacientes.html', 'admin_lista_espera.html'].includes(pageUrl)) hubPage = 'admin_usuarios_hub.html';
            else if (['admin_gestao_conteudo.html', 'admin_comunidade_gestao.html', 'admin_moderacao_forum.html', 'admin_avaliacoes.html', 'admin_avaliacoes_psi.html'].includes(pageUrl)) hubPage = 'admin_conteudo_hub.html';
            else if (['admin_financeiro.html', 'admin_indicadores.html', 'admin_downloads.html', 'relatorios'].includes(pageUrl) || pageUrl === 'relatorios') hubPage = 'admin_dados_hub.html';
            else if (['admin_minha_conta.html', 'admin_configuracoes.html', 'admin_logs_sistema.html'].includes(pageUrl)) hubPage = 'admin_configuracoes_hub.html';

            if (hubPage) {
                if (!activeLink) activeLink = document.querySelector(`.sidebar-nav a[data-page="${hubPage}"]`);
                if (!activeBottomLink) activeBottomLink = document.querySelector(`.bottom-nav-item[data-target-page="${hubPage}"]`);
            }
        }

        if (activeLink) activeLink.closest('li').classList.add('active');
        if (activeBottomLink) activeBottomLink.classList.add('active');

        // Tratamento especial para "Relatórios" que é uma div embutida
        if (pageUrl === 'relatorios') {
            document.getElementById('main-content').style.display = 'none';
            document.getElementById('relatorios').style.display = 'block';
            loadReports();
            if (typeof window.carregarFeedbacksWhatsApp === 'function') window.carregarFeedbacksWhatsApp();
            return;
        } else {
            const relSection = document.getElementById('relatorios');
            if(relSection) relSection.style.display = 'none';
            mainContent.style.display = 'block';
        }

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
                    // FIX: Força o recálculo de layout do calendário após carregar CSS
                    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
                };
                document.body.appendChild(script);
                updateWelcomeMessage();

                // --- LÓGICA DE SMART SCROLL (PÁGINAS CURTAS) ---
                const scrollableContent = document.querySelector('.dashboard-main');
                const bottomNav = document.querySelector('.mobile-bottom-nav');
                if (scrollableContent && bottomNav && window.innerWidth <= 992) {
                    // Restaura a barra a cada carregamento de página
                    bottomNav.classList.remove('nav-hidden'); 
                    setTimeout(() => {
                        const isScrollable = scrollableContent.scrollHeight > scrollableContent.clientHeight;
                        if (!isScrollable) {
                            setTimeout(() => bottomNav.classList.add('nav-hidden'), 2000);
                        }
                    }, 150);
                }
            })
            .catch(e => mainContent.innerHTML = '<p>Erro ao carregar conteúdo.</p>');
    }
    window.loadPage = loadPage; // Padrão unificado (App-Like)
    window.navigateToPage = loadPage; // Mantém compatibilidade com botões antigos

    function logout() {
        localStorage.removeItem('Yelo_token');
        localStorage.removeItem('Yelo_token_admin');
        window.location.href = '/login'; 
    }

    async function initializeAndProtect() {
        const token = localStorage.getItem('Yelo_token');
        
        // --- FIX: Não expulsa imediatamente se não tiver token no localStorage.
        // Tenta validar via Cookie primeiro fazendo a requisição ao backend.

        try {
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Verifica se o token é válido no backend
            const response = await fetch(`${API_BASE_URL}/api/admin/me`, {
                headers: headers
            });

            if (response.status === 401 || response.status === 403) {
                throw new Error('Sessão inválida ou expirada');
            }
            
            if (!response.ok) {
                console.error(`[Admin] Erro no servidor: ${response.status}`);
                // Não faz logout em caso de erro 500, apenas para a execução
                return;
            }

            const admin = await response.json();
            window.adminId = admin.id;
            
            // Atualiza o nome no menu lateral
            const adminNameEl = document.querySelector('.nome-admin');
            if (adminNameEl) adminNameEl.textContent = admin.nome;

            // Atualiza as fotos de avatar se o admin tiver uma foto salva
            if (admin.fotoUrl) {
                const sidebarPhoto = document.getElementById('admin-sidebar-photo');
                const mobilePhoto = document.getElementById('admin-mobile-photo');
                if (sidebarPhoto) sidebarPhoto.src = admin.fotoUrl;
                if (mobilePhoto) mobilePhoto.src = admin.fotoUrl;
            }

            // Inicia o restante do painel
            setupPageNavigation();
            updateWelcomeMessage();

            // --- INICIALIZA LÓGICA DO SMART SCROLL ---
            setupSmartScroll();

            // --- INICIALIZA SOCKET (Conecta o Admin à sala) ---
            connectAdminSocket(token);
            
            // --- INICIALIZA UPLOAD DE FOTO (admin_modais.js) ---
            if(window.setupAdminPhotoUpload) window.setupAdminPhotoUpload();

            // --- FIX: Remove loader da tela
            const loader = document.getElementById('global-loader');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }
            document.getElementById('dashboard-container').style.display = 'flex';

        } catch (error) {
            console.error("Erro de autenticação:", error);
            logout(); // Segurança: Se der erro, desloga para evitar estado inconsistente
        }
    }

    function updateWelcomeMessage() {
        // CORREÇÃO: Seletores ajustados para a estrutura do admin.html (.welcome-header)
        const pageTitle = document.querySelector('.welcome-header h1');
        const pageSubtitle = document.querySelector('.welcome-header p');
        const adminName = document.querySelector('.nome-admin')?.textContent.split(' ')[0] || 'Admin';
        
        const activeLink = document.querySelector('.sidebar-nav li.active');
        const headerActions = document.getElementById('dynamic-header-actions');
        if (headerActions) headerActions.innerHTML = ''; // Limpa botões antigos ao mudar de página
        
        if (pageTitle && activeLink) {
            const dataPage = activeLink.getAttribute('data-page');
            const titleFromData = activeLink.getAttribute('data-title');
            const subtitleFromData = activeLink.getAttribute('data-subtitle');

            if (dataPage === 'admin_visao_geral.html') {
                pageTitle.textContent = `Bem-vindo, ${adminName}!`;
                // Mantém o subtítulo padrão ou usa o do data-attribute se disponível
                if (pageSubtitle) pageSubtitle.textContent = subtitleFromData || 'Acompanhe os principais indicadores e métricas da plataforma.';
            } else {
                // Para outras páginas, usa o título e subtítulo definidos no link
                pageTitle.textContent = titleFromData || activeLink.querySelector('span')?.textContent.trim();
                if (pageSubtitle) pageSubtitle.textContent = subtitleFromData || '';
            }

            // Injeta o botão de exportação se estiver na tela de Lista de Espera
            if (dataPage === 'admin_lista_espera.html' && headerActions) {
                headerActions.innerHTML = `<button onclick="exportarListaDeEspera(this)" class="btn-export-csv"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px; vertical-align: text-bottom;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Exportar CSV</button>`;
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

    // --- SMART SCROLL (COMPORTAMENTO APP-LIKE MOBILE) ---
    function setupSmartScroll() {
        if (window.innerWidth > 992) return;

        const bottomNav = document.querySelector('.mobile-bottom-nav');
        const scrollableContent = document.querySelector('.dashboard-main');
        
        if (!bottomNav || !scrollableContent) return;

        bottomNav.addEventListener('click', () => {
            if (bottomNav.classList.contains('nav-hidden')) {
                bottomNav.classList.remove('nav-hidden');
            }
        });

        let lastScrollY = scrollableContent.scrollTop;
        const scrollThreshold = 100;

        scrollableContent.addEventListener('scroll', () => {
            const currentScrollY = scrollableContent.scrollTop;
            if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
                bottomNav.classList.add('nav-hidden');
            } else if (currentScrollY < lastScrollY) {
                bottomNav.classList.remove('nav-hidden');
            }
            lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
        }, { passive: true });
    }

    function setupGlobalEvents() {
        const logoutButton = document.getElementById('btn-logout');
        if (logoutButton) logoutButton.onclick = (e) => { logout(); };

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
    // NOVA FUNÇÃO: FIXAR POST NO FÓRUM
    // ==========================================
    window.togglePinPost = async function(postId, isCurrentlyPinned) {
        const shouldPin = !isCurrentlyPinned;
        const actionText = shouldPin ? 'fixar' : 'desafixar';

        // Usa o modal de confirmação global que já existe
        window.openConfirmationModal(
            'Confirmar Ação',
            `Você tem certeza que deseja <strong>${actionText}</strong> este post?`,
            async () => {
                const modalBtn = document.getElementById('modal-confirm-btn');
                if(modalBtn) modalBtn.disabled = true;

                try {
                    const token = localStorage.getItem('Yelo_token');
                    const response = await fetch(`${API_BASE_URL}/api/admin/forum/posts/${postId}/pin`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ isPinned: shouldPin })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        window.showToast(result.message, 'success');
                        if(typeof window.initializePage === 'function') window.initializePage(); // Recarrega a lista
                    } else {
                        throw new Error(result.error || 'Não foi possível completar a ação.');
                    }
                } catch (error) {
                    window.showToast(`Erro: ${error.message}`, 'error');
                } finally {
                    if(modalBtn) modalBtn.disabled = false; // Destrava para o próximo uso
                }
            }
        );
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
            // Envia token se existir, senão vai vazio (o backend deve tratar ou usar cookie se suportado)
            auth: token ? { token: token } : {},
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            console.log('✅ Admin conectado ao Socket.IO:', socket.id);
        });

        socket.on('receiveMessage', (data) => {
            // 1. Dispara evento global para a página de chat atualizar (se estiver aberta)
            window.dispatchEvent(new CustomEvent('admin:message_received', { detail: data }));

            // Verifica se o usuário já está na caixa de entrada
            // CORREÇÃO: Voltando ao método que funciona no perfil do PSI, verificando a classe 'active' no menu.
            const activePageLink = document.querySelector('.sidebar-nav li.active a');
            const isInboxOpen = activePageLink && activePageLink.getAttribute('data-page') === 'admin_caixa_entrada.html';

            if (!isInboxOpen) {
                // 2. Feedback Visual (Toast) APENAS se não estiver na inbox
                showToast(`Nova mensagem de ${data.senderType === 'psychologist' ? 'Psicólogo' : 'Paciente'}`);

                // 3. Atualiza Badge no Menu (Adiciona conversa ao Set)
                if (data.conversationId) window.unreadConversations.add(data.conversationId);
                window.updateSidebarBadge('admin_caixa_entrada.html', true);
            }
        });

        // CORREÇÃO: Ouve atualizações de status (lido/entregue) e repassa para a UI
        socket.on('message_status_updated', (data) => {
            // console.log("Admin Socket: Status atualizado", data);
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
        if (type === 'success') iconSvg = `<svg width="18" height="18" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
        else if (type === 'error') iconSvg = `<svg width="18" height="18" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        else iconSvg = `<svg width="18" height="18" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;

        toast.innerHTML = `${iconSvg}<span>${message}</span>`;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.transition = 'all 0.4s ease';
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px) scale(0.9)';
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // --- FUNÇÃO GLOBAL: EXPORTAR LISTA DE ESPERA ---
    window.exportarListaDeEspera = async function(btnElement) {
        const originalText = btnElement ? btnElement.innerHTML : 'Exportar CSV';
        if (btnElement) { btnElement.innerHTML = '⏳ Gerando...'; btnElement.disabled = true; }

        try {
            const token = localStorage.getItem('Yelo_token'); 
            const res = await fetch('/api/admin/export/waitlist', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error('Falha ao exportar.');
            const data = await res.json();
            
            if(!data || data.length === 0) {
                showToast('A lista de espera está vazia.', 'info');
                return;
            }

            const header = "Nome;Telefone;Email;Status;Data de Cadastro\n";
            const rows = data.map(item => `"${item.nome || ''}";"${item.telefone || ''}";"${item.email || ''}";"${item.status || ''}";"${new Date(item.createdAt).toLocaleDateString('pt-BR')}"`).join("\n");
            const csvContent = "\uFEFF" + header + rows;
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", "lista_de_espera_yelo.csv");
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch(e) {
            console.error("Erro ao exportar:", e);
            showToast("Erro ao exportar a lista.", 'error');
        } finally {
            if (btnElement) { btnElement.innerHTML = originalText; btnElement.disabled = false; }
        }
    };

    // --- FUNÇÃO PARA CARREGAR OS FEEDBACKS DO WHATSAPP ---
    window.carregarFeedbacksWhatsApp = async function() {
        const tbody = document.getElementById('whatsapp-feedback-tbody');
        if (!tbody) return;
        try {
            const API_BASE_URL = window.API_BASE_URL || '';
            const token = localStorage.getItem('Yelo_token_admin') || localStorage.getItem('Yelo_token');
            const res = await fetch(`${API_BASE_URL}/api/admin/whatsapp-feedbacks`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha ao buscar dados');
            const feedbacks = await res.json();
            
            // --- CÁLCULO DOS KPIs ---
            const total = feedbacks.length;
            const respondidos = feedbacks.filter(f => f.feedbackGiven).length;
            const taxaResposta = total > 0 ? ((respondidos / total) * 100).toFixed(1) : 0;
            const recebidas = feedbacks.filter(f => f.feedbackGiven && f.contactReceived).length;
            const fechados = feedbacks.filter(f => f.feedbackGiven && f.contactReceived && f.dealClosed === 'yes').length;

            const elTotal = document.getElementById('kpi-wpp-total');
            const elTxResposta = document.getElementById('kpi-wpp-tx-resposta');
            const elRecebidas = document.getElementById('kpi-wpp-recebidas');
            const elFechados = document.getElementById('kpi-wpp-fechados');

            if (elTotal) elTotal.textContent = total;
            if (elTxResposta) elTxResposta.textContent = taxaResposta + '%';
            if (elRecebidas) elRecebidas.textContent = recebidas;
            if (elFechados) elFechados.textContent = fechados;
            
            if (feedbacks.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999; font-style: italic;">Nenhum clique registrado ainda.</td></tr>';
                return;
            }
            tbody.innerHTML = feedbacks.map(f => {
                const dataClique = new Date(f.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                let contato = '<span style="color:#888;">⏳ Aguardando psi</span>';
                let fechou = '-';
                let status = '<span style="background:#fef08a; color:#b45309; padding:4px 8px; border-radius:12px; font-size:0.85rem; font-weight:bold;">Pendente</span>';
                if (f.feedbackGiven) {
                    status = '<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:12px; font-size:0.85rem; font-weight:bold;">Respondido</span>';
                    if (f.contactReceived) {
                        contato = '✅ Sim';
                        fechou = f.dealClosed === 'yes' ? '✅ <strong style="color:#166534">Fechou!</strong>' : '❌ Não';
                    } else {
                        contato = '❌ Não chegou';
                        fechou = '-';
                    }
                }
                return `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 15px;">${dataClique}</td><td style="padding: 10px 15px;"><strong>${f.psychologist ? f.psychologist.nome : 'Psi Removido'}</strong></td><td style="padding: 10px 15px;">${f.guestName || 'Um paciente'}</td><td style="padding: 10px 15px; text-align: center;">${contato}</td><td style="padding: 10px 15px; text-align: center;">${fechou}</td><td style="padding: 10px 15px; text-align: center;">${status}</td></tr>`;
            }).join('');
        } catch (error) {
            console.error('Erro ao carregar feedbacks:', error);
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red; padding: 20px;">Erro ao carregar métricas de conversão.</td></tr>';
        }
    };

    // --- CONTROLE DE MENSAGENS DE WHATSAPP ENVIADAS (MEMÓRIA LOCAL) ---
    window.registrarEnvioWpp = function(psiId, link, event) {
        if (event) event.preventDefault();
        
        let sent = JSON.parse(localStorage.getItem('yelo_wpp_sent_pending') || '[]');
        const idStr = String(psiId);
        if (!sent.includes(idStr) && !sent.includes(Number(psiId))) {
            sent.push(idStr);
            localStorage.setItem('yelo_wpp_sent_pending', JSON.stringify(sent));
        }
        
        // Atualiza visualmente o botão que foi clicado imediatamente
        if (event && event.currentTarget) {
            event.currentTarget.classList.add('wpp-enviado');
            event.currentTarget.style.backgroundColor = '#d1fae5';
            event.currentTarget.style.color = '#059669';
            event.currentTarget.style.borderColor = '#d1fae5';
            event.currentTarget.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Enviado';
        }
        
        window.open(link, '_blank');
    };

    window.verificarWppEnviado = function(psiId) {
        let sent = JSON.parse(localStorage.getItem('yelo_wpp_sent_pending') || '[]');
        return sent.includes(String(psiId)) || sent.includes(Number(psiId));
    };

    initializeAndProtect();
    if(window.setupConfirmationModal) window.setupConfirmationModal();
    if(window.setupVipModal) window.setupVipModal();
    if(window.setupReportModal) window.setupReportModal();
    setupGlobalEvents();

});