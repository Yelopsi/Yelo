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

    // --- FUNÇÃO DE NAVEGAÇÃO GLOBAL (REFATORADA) ---
    function loadPage(pageUrlWithParams) {
        // Limpa o script da página anterior
        if (typeof window.cleanupPage === 'function') {
            window.cleanupPage();
            window.cleanupPage = null;
        }

        const [pageUrl, queryString] = (pageUrlWithParams || '').split('?');
        window.pageQueryString = queryString || ''; // Armazena params para o próximo script

        // Se for a caixa de entrada, remove a badge
        if (pageUrl === 'admin_caixa_entrada.html') {
            window.unreadConversations.clear();
            window.updateSidebarBadge('admin_caixa_entrada.html', false);
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
                };
                document.body.appendChild(script);
                updateWelcomeMessage();
            })
            .catch(e => mainContent.innerHTML = '<p>Erro ao carregar conteúdo.</p>');
    }
    window.navigateToPage = loadPage; // Expõe a função globalmente

    function logout() {
        localStorage.removeItem('Yelo_token');
        // CORREÇÃO: Redireciona para a tela de login unificada
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

        const titleFromData = activeLink.getAttribute('data-title');
        const subtitleFromData = activeLink.getAttribute('data-subtitle');

            if (dataPage === 'admin_visao_geral.html') {
                pageTitle.textContent = `Bem-vindo, ${adminName}!`;
            } else if (target === 'relatorios') {
                pageTitle.textContent = 'Relatórios';
        } else if (titleFromData) {
            pageTitle.textContent = titleFromData;
            } else {
                pageTitle.textContent = menuText;
            }

            if (pageSubtitle) {
            pageSubtitle.textContent = subtitleFromData || '';
            }
        }
    }

    function setupPageNavigation() {
        const allNavItems = document.querySelectorAll('.sidebar-nav li');
        
        const initialLink = document.querySelector('.sidebar-nav li.active[data-page]');
        if (initialLink) loadPage(initialLink.getAttribute('data-page'));

        allNavItems.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                
                // Atualiza visualmente o item ativo
                allNavItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');
                
                const page = this.getAttribute('data-page');
                const target = this.getAttribute('data-target');

                if (page) {
                    // Navegação normal
                    document.getElementById('relatorios').style.display = 'none';
                    mainContent.style.display = 'block';
                    loadPage(page);
                } else if (target === 'relatorios') {
                    // Seção de Relatórios
                    mainContent.style.display = 'none';
                    document.getElementById('relatorios').style.display = 'block';
                    loadReports();
                    updateWelcomeMessage(); // Atualiza o título também para Relatórios
                }

                // --- CORREÇÃO MOBILE: FECHAR MENU AO CLICAR ---
                const sidebar = document.querySelector('.dashboard-sidebar');
                const overlay = document.querySelector('.mobile-overlay');
                if (sidebar && sidebar.classList.contains('is-open')) {
                    sidebar.classList.remove('is-open');
                    overlay.classList.remove('is-visible');
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

    function setupVipModal() {
        const modal = document.getElementById('vip-modal');
        if (!modal) {
            console.warn("Modal VIP não encontrado em admin.html");
            return;
        }
    
        const confirmBtn = document.getElementById('vip-modal-confirm-btn');
        const cancelBtn = document.getElementById('vip-modal-cancel-btn');
        let currentPsyId = null;
    
        const closeModal = () => {
            modal.style.display = 'none';
            currentPsyId = null;
        };
    
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    
        confirmBtn.onclick = async () => {
            const selectedPlanInput = modal.querySelector('input[name="vip_plan"]:checked');
            if (!selectedPlanInput) {
                window.showToast('Por favor, selecione uma opção.', 'error');
                return;
            }
    
            const planValue = selectedPlanInput.value;
            
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Salvando...';
    
            try {
                const token = localStorage.getItem('Yelo_token');
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/${currentPsyId}/vip`, {
                    method: 'PATCH',
                    headers: headers,
                    body: JSON.stringify({ plan: planValue === 'none' ? null : planValue })
                });
    
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Falha ao atualizar status VIP.');
                }
    
                const data = await response.json();
                window.showToast(data.message, 'success');

                // Primeiro, fecha o modal para dar feedback imediato ao usuário.
                closeModal();

                // Dispara um evento para a página de gestão de psis recarregar a lista
                window.dispatchEvent(new CustomEvent('vipStatusUpdated'));
            } catch (error) {
                window.showToast(error.message, 'error');
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirmar Alteração';
            }
        };
    
        // Expõe a função para abrir o modal globalmente
        window.openVipModal = (psychologist) => {
            currentPsyId = psychologist.id;
            const title = document.getElementById('vip-modal-title');
            title.innerHTML = `Gerenciar Isenção: <span style="font-weight: normal;">${psychologist.nome}</span>`;
            
            const currentPlan = psychologist.is_exempt ? (psychologist.plano || 'none') : 'none';
            modal.querySelectorAll('input[name="vip_plan"]').forEach(radio => radio.checked = (radio.value === currentPlan));
    
            modal.style.display = 'flex';
        };
    }

    // --- MODAL DE DENÚNCIA (NOVO) ---
    function setupReportModal() {
        const modal = document.getElementById('report-modal');
        if (!modal) return;

        const closeBtn = document.getElementById('report-modal-close-btn');
        const actionBtn = document.getElementById('report-modal-action-btn');
        let actionCallback = null;

        const closeModal = () => {
            modal.style.display = 'none';
            actionCallback = null;
        };

        // Função global para abrir o modal com dados dinâmicos
        window.openReportModal = (data) => {
            // data: { title, content, author, reason, count, isHtml, actionLabel, onAction }
            document.getElementById('report-modal-title').textContent = data.title || 'Detalhes da Denúncia';
            document.getElementById('report-author').textContent = data.author || 'Anônimo';
            document.getElementById('report-reason').textContent = data.reason || 'Não especificado';
            document.getElementById('report-count').textContent = data.count || 1;
            
            const contentEl = document.getElementById('report-content-area');
            if (data.isHtml) contentEl.innerHTML = data.content;
            else contentEl.textContent = data.content;

            if (actionBtn) {
                actionBtn.textContent = data.actionLabel || 'Remover Conteúdo';
                actionBtn.onclick = () => {
                    if (typeof data.onAction === 'function') data.onAction();
                    closeModal();
                };
            }
            modal.style.display = 'flex';
        };

        if (closeBtn) closeBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
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
            // A função updateWelcomeMessage já lê o nome da sidebar, que foi atualizado
            updateWelcomeMessage();
        });

        // Listener para quando os dados do admin forem atualizados em outra página
        window.addEventListener('adminDataUpdated', updateWelcomeMessage);

        // --- LÓGICA DO MENU MOBILE ---
        const toggleBtn = document.getElementById('toggleSidebar');
        const sidebar = document.querySelector('.dashboard-sidebar');
        const overlay = document.querySelector('.mobile-overlay');

        if (toggleBtn && sidebar && overlay) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('is-open');
                overlay.classList.toggle('is-visible');
            });

            overlay.addEventListener('click', () => {
                sidebar.classList.remove('is-open');
                overlay.classList.remove('is-visible');
            });
        }
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

    function showToast(message) {
        let container = document.getElementById('admin-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-toast-container';
            container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 2147483647; display: flex; flex-direction: column; gap: 10px;";
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = "background: #1B4332; color: #fff; padding: 12px 20px; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); animation: fadeIn 0.3s; font-family: sans-serif; font-size: 0.9rem;";
        
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
    }

    initializeAndProtect();
    setupConfirmationModal();
    setupVipModal();
    setupReportModal();
    setupGlobalEvents();

    // ==========================================
    // MÓDULO DE RELATÓRIOS (Chart.js)
    // ==========================================
    let chartInstances = {}; // Guarda as referências para poder destruir e recriar

    async function loadReports() {
        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');
        
        // Configura datas padrão se vazio
        if (!startInput.value) {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
            endInput.value = today.toISOString().split('T')[0];
        }

        // --- MOSTRA SKELETONS E ESCONDE CONTEÚDO ---
        document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
            const skeleton = card.querySelector('.kpi-skeleton');
            const content = card.querySelector('.kpi-content');
            if(skeleton) skeleton.style.display = 'block';
            if(content) content.style.display = 'none';
        });

        try {
            const token = localStorage.getItem('Yelo_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const query = `?startDate=${startInput.value}&endDate=${endInput.value}`;
            
            const response = await fetch(`${API_BASE_URL}/api/admin/reports/charts${query}`, {
                headers: headers
            });
            const data = await response.json();

            console.log("Dados recebidos do Relatório:", data); // <--- OLHE O CONSOLE (F12)

            // Renderiza Gráficos
            if (typeof renderUsersChart === "function") renderUsersChart(data.users, data.visits || []);
            if (typeof renderDemandChart === "function") renderDemandChart(data.demand);
            if (typeof renderPlansChart === "function") renderPlansChart(data.plans);
            if (typeof renderTimeChart === "function") renderTimeChart(data.timeOfDay);

            // --- CORREÇÃO DO KPI DE VISITAS ---
            // Garante que o array existe e converte explicitamente para Número
            const visitsArray = data.visits || [];
            console.log("Visitas recebidas para KPI:", visitsArray);

            const totalVisits = visitsArray.reduce((acc, curr) => {
                // Converte 'total' (string do BD) para Inteiro. Se falhar, usa 0.
                const val = parseInt(curr.total, 10);
                return acc + (isNaN(val) ? 0 : val);
            }, 0);

            const visitsEl = document.getElementById('kpi-visits');
            // Formata o número para ficar bonito (ex: 1.200)
            if (visitsEl) visitsEl.innerText = totalVisits.toLocaleString('pt-BR');

            // Outros KPIs
            if (data.community) {
                const updateKpi = (id, val) => {
                    const el = document.getElementById(id);
                    // Converte para int para garantir, depois formata
                    if (el) el.innerText = (parseInt(val, 10) || 0).toLocaleString('pt-BR');
                };
                
                updateKpi('kpi-questions', data.community.questionsTotal);
                updateKpi('kpi-answered', data.community.questionsAnswered);
                updateKpi('kpi-answers-total', data.community.answersTotal);
                updateKpi('kpi-blog', data.community.blogPosts);
            }

            // --- NOVOS KPIs FINANCEIROS ---
            if (data.financials) {
                const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                const mrrEl = document.getElementById('kpi-mrr');
                if (mrrEl) mrrEl.innerText = formatCurrency(data.financials.mrr || 0);

                const churnEl = document.getElementById('kpi-churn');
                if (churnEl) churnEl.innerText = `${(data.financials.churnRate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

                const ltvEl = document.getElementById('kpi-ltv');
                if (ltvEl) ltvEl.innerText = formatCurrency(data.financials.ltv || 0);
            }

            // --- ESCONDE SKELETONS E MOSTRA CONTEÚDO ---
            document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
                const skeleton = card.querySelector('.kpi-skeleton');
                const content = card.querySelector('.kpi-content');
                if(skeleton) skeleton.style.display = 'none';
                if(content) content.style.display = 'block';
            });

        } catch (error) {
            console.error("Erro ao carregar relatórios:", error);
            // Em caso de erro, mostra o conteúdo (que estará zerado ou com valor antigo) para não travar no skeleton
            document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
                const skeleton = card.querySelector('.kpi-skeleton');
                const content = card.querySelector('.kpi-content');
                if(skeleton) skeleton.style.display = 'none';
                if(content) content.style.display = 'block';
            });
        }
    }
    // Expõe para o HTML poder chamar no onclick="loadReports()"
    window.loadReports = loadReports;

    // 1. Gráfico de Usuários (Linha)
    function renderUsersChart(data, visitsData) { // Recebe visitsData agora
        const ctx = document.getElementById('chartUsers').getContext('2d');
        if (chartInstances.users) chartInstances.users.destroy(); // Limpa anterior

        // Mapas para alinhar as datas (caso tenha visita num dia mas não tenha cadastro)
        const allDates = [...new Set([...(data || []).map(d => d.data), ...(visitsData || []).map(v => v.data)])].sort();
        
        const labels = allDates.map(d => formatDateBR(d));
        const patients = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.pacientes, 10) : 0; });
        const psis = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.psis, 10) : 0; });
        const visits = allDates.map(d => { const f = (visitsData || []).find(x => x.data === d); return f ? parseInt(f.total, 10) : 0; });

        chartInstances.users = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Acessos (Pageviews)', data: visits, borderColor: '#2980b9', backgroundColor: 'rgba(41, 128, 185, 0.1)', tension: 0.4, fill: true }, // Azul, com preenchimento suave
                    { label: 'Novos Pacientes', data: patients, borderColor: '#2E7D32', tension: 0.3 },
                    { label: 'Novos Psicólogos', data: psis, borderColor: '#F9A825', tension: 0.3 }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // 2. Gráfico de Demanda (Barra Empilhada)
    function renderDemandChart(data) {
        const ctx = document.getElementById('chartDemand').getContext('2d');
        if (chartInstances.demand) chartInstances.demand.destroy();

        const labels = data.map(item => formatDateBR(item.data));
        const done = data.map(item => item.concluidos);
        const drop = data.map(item => item.desistencias);

        chartInstances.demand = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Concluídos', data: done, backgroundColor: '#2E7D32' }, // Verde
                    { label: 'Desistências', data: drop, backgroundColor: '#e74c3c' } // Vermelho
                ]
            },
            options: {
                responsive: true,
                scales: { x: { stacked: true }, y: { stacked: true } },
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // 3. Gráfico de Planos (Pizza)
    function renderPlansChart(data) {
        const ctx = document.getElementById('chartPlans').getContext('2d');
        if (chartInstances.plans) chartInstances.plans.destroy();

        // Transforma array [{plano: 'Essencial', total: 5}, ...] em arrays separados
        const labels = data.map(item => item.plano);
        const values = data.map(item => item.total);
        
        // Cores específicas para os planos
        const colors = labels.map(p => {
            if(p === 'Essencial') return '#81C784'; // Verde claro
            if(p === 'Clínico') return '#FFD54F';     // Amarelo
            if(p === 'Sol') return '#FF8A65';     // Laranja
            return '#ccc';
        });

        chartInstances.plans = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: values, backgroundColor: colors }]
            },
            options: { responsive: true, plugins: { legend: { position: 'right' } } }
        });
    }

    // --- NOVAS FUNÇÕES ---

    function updateCommunityKPIs(stats) {
        if (!stats) return;
        document.getElementById('kpi-questions').innerText = stats.questionsTotal || 0;
        document.getElementById('kpi-answered').innerText = stats.questionsAnswered || 0;
        document.getElementById('kpi-answers-total').innerText = stats.answersTotal || 0;
        document.getElementById('kpi-blog').innerText = stats.blogPosts || 0;
    }

    function renderTimeChart(data) {
        const ctx = document.getElementById('chartTime').getContext('2d');
        if (chartInstances.time) chartInstances.time.destroy();

        // Mapeia os dados do banco para garantir ordem
        const periods = ['Manhã', 'Tarde', 'Noite', 'Madrugada'];
        const values = periods.map(p => {
            const found = data ? data.find(item => item.periodo === p) : null;
            return found ? parseInt(found.total) : 0;
        });

        chartInstances.time = new Chart(ctx, {
            type: 'polarArea', // Fica visualmente bonito para horários
            data: {
                labels: periods,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        'rgba(255, 206, 86, 0.7)', // Manhã (Sol)
                        'rgba(255, 159, 64, 0.7)', // Tarde (Pôr do sol)
                        'rgba(54, 162, 235, 0.7)', // Noite (Azul)
                        'rgba(153, 102, 255, 0.7)' // Madrugada (Roxo)
                    ]
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'right' } } }
        });
    }

    // Auxiliar: Formata data YYYY-MM-DD para DD/MM
    function formatDateBR(dateString) {
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}`;
    }
});