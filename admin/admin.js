document.addEventListener('DOMContentLoaded', function() {
    const mainContent = document.getElementById('main-content');

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

        } catch (error) {
            console.error("Erro de autenticação:", error);
            logout(); // Segurança: Se der erro, desloga para evitar estado inconsistente
        }
    }

    function updateWelcomeMessage() {
        const pageTitle = document.querySelector('.titulo-pagina h1');
        const adminName = document.querySelector('.nome-admin')?.textContent.split(' ')[0] || 'Admin';
        if (pageTitle && mainContent && mainContent.innerHTML.includes('kpi-grid')) {
            pageTitle.textContent = `Bem-vindo, ${adminName}!`;
        }
    }

    function setupPageNavigation() {
        const navLinks = document.querySelectorAll('.sidebar-nav li');
        
        function loadPage(pageUrl) {
            const absolutePageUrl = `/admin/${pageUrl}`;
            mainContent.innerHTML = '<p style="text-align:center; padding: 40px;">Carregando...</p>';
    
            fetch(absolutePageUrl)
                .then(r => r.ok ? r.text() : Promise.reject(pageUrl))
                .then(html => {
                    mainContent.innerHTML = html;
                    
                    // Remove script antigo e insere o novo
                    const oldScript = document.getElementById('dynamic-page-script');
                    if (oldScript) oldScript.remove();

                    const script = document.createElement('script');
                    script.src = absolutePageUrl.replace('.html', '.js');
                    script.id = 'dynamic-page-script';
                    
                    script.onload = () => {
                        if (typeof window.initializePage === 'function') window.initializePage();
                    };
                    document.body.appendChild(script);
                    updateWelcomeMessage();
                })
                .catch(e => mainContent.innerHTML = '<p>Erro ao carregar conteúdo.</p>');
        }
            
        const initialLink = document.querySelector('.sidebar-nav li.active');
        if (initialLink) loadPage(initialLink.getAttribute('data-page'));

        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                navLinks.forEach(i => i.classList.remove('active'));
                this.classList.add('active');
                
                // Garante que a seção de relatórios esteja oculta e o main visível
                document.getElementById('relatorios').style.display = 'none';
                mainContent.style.display = 'block';

                loadPage(this.getAttribute('data-page'));
            });
        });

        // Listener para o botão de Relatórios
        const btnRelatorios = document.querySelector('button[data-target="relatorios"]');
        if (btnRelatorios) {
            btnRelatorios.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(i => i.classList.remove('active'));
                
                mainContent.style.display = 'none';
                document.getElementById('relatorios').style.display = 'block';
                
                loadReports();
            });
        }
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
            const totalVisits = visitsArray.reduce((acc, curr) => {
                // Tenta pegar .total ou .count, converte pra numero, se falhar usa 0
                const val = Number(curr.total || curr.count || 0); 
                return acc + val;
            }, 0);

            const visitsEl = document.getElementById('kpi-visits');
            if (visitsEl) visitsEl.innerText = totalVisits;

            // Outros KPIs
            if (data.community) {
                if(document.getElementById('kpi-questions')) document.getElementById('kpi-questions').innerText = data.community.questionsTotal || 0;
                if(document.getElementById('kpi-answered')) document.getElementById('kpi-answered').innerText = data.community.questionsAnswered || 0;
                if(document.getElementById('kpi-answers-total')) document.getElementById('kpi-answers-total').innerText = data.community.answersTotal || 0;
                if(document.getElementById('kpi-blog')) document.getElementById('kpi-blog').innerText = data.community.blogPosts || 0;
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

        // Transforma array [{plano: 'Semente', total: 5}, ...] em arrays separados
        const labels = data.map(item => item.plano);
        const values = data.map(item => item.total);
        
        // Cores específicas para os planos
        const colors = labels.map(p => {
            if(p === 'Semente') return '#81C784'; // Verde claro
            if(p === 'Luz') return '#FFD54F';     // Amarelo
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