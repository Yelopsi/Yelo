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
        localStorage.removeItem('Yelo_token');
        // CORREÇÃO: Redireciona para a raiz (/login.html) e não para o login antigo
        window.location.href = '/login.html'; 
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
                'admin_financeiro.html': 'Acompanhe o desempenho financeiro e faturas.',
                'admin_caixa_entrada.html': 'Gerencie suas mensagens e conversas.',
                'admin_gerenciar_psicologos.html': 'Administre os profissionais cadastrados.',
                'admin_gerenciar_pacientes.html': 'Administre os pacientes cadastrados.',
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
            } else if (target === 'relatorios') {
                pageTitle.textContent = 'Relatórios';
                if (pageSubtitle) pageSubtitle.textContent = 'Relatórios detalhados de performance.';
                return; // Sai da função pois já tratou relatórios
            } else {
                pageTitle.textContent = menuText;
            }

            if (pageSubtitle) {
                pageSubtitle.textContent = subtitles[dataPage] || '';
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
            // A função updateWelcomeMessage já lê o nome da sidebar, que foi atualizado
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

        try {
            const token = localStorage.getItem('Yelo_token');
            const query = `?startDate=${startInput.value}&endDate=${endInput.value}`;
            
            const response = await fetch(`${API_BASE_URL}/api/admin/reports/charts${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
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

        } catch (error) {
            console.error("Erro ao carregar relatórios:", error);
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