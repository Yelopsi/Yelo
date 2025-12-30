// admin/admin_visao_geral.js

window.initializePage = function() {
    let refreshInterval; // Variável para armazenar o ID do intervalo

    // Adiciona o script do Chart.js dinamicamente
    const chartJsScript = document.createElement('script');
    chartJsScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    document.head.appendChild(chartJsScript);

    // --- CORREÇÃO DE ROTA ---
    // Pega do config.js ou assume localhost:3001
    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') 
        ? window.API_BASE_URL 
        : 'http://localhost:3001';

    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        // Se não houver token, a lógica em admin.js já fará o logout.
        console.error("Token de autenticação não encontrado.");
        return;
    }

    /**
     * Formata um número como moeda brasileira (BRL).
     * @param {number} value - O valor a ser formatado.
     * @returns {string} - O valor formatado como R$ 1.234,56.
     */
    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    // --- COLE ISSO LOGO ABAIXO DE formatCurrency ---
    
    // Função Auxiliar: Só atualiza se o elemento existir (Evita travamento)
    function updateSafe(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            // Efeito visual sutil de atualização
            el.style.transition = 'color 0.3s';
            el.style.color = '#155724'; // Verde escuro momentâneo
            setTimeout(() => el.style.color = '', 500);
        }
    }

    // Listas de IDs para animação de carregamento
    const bigKpis = ['kpi-mrr', 'kpi-new-patients', 'kpi-new-psychologists', 'kpi-questionnaires-today'];
    const smallKpis = [
        'kpi-pat-total', 'kpi-pat-active', 'kpi-pat-deleted',
        'kpi-psi-total', 'kpi-psi-deleted',
        'kpi-plan-Essencial', 'kpi-plan-Clínico', 'kpi-plan-sol',
        'kpi-quest-total', 'kpi-quest-deleted',
        'waiting-list-count', 'pending-reviews-count'
    ];

    /**
     * Busca os dados da API e atualiza os cards do dashboard.
     * @param {boolean} showLoading - Se true, mostra spinners antes de buscar.
     */
    // --- SUBSTITUA A SUA FUNÇÃO fetchAndRenderStats POR ESTA ---

    async function fetchAndRenderStats(showLoading = false) {
         const btnRefresh = document.getElementById('btn-refresh-dashboard');
         
         if (showLoading) {
             // Anima o ícone do botão
             if(btnRefresh) {
                 const icon = btnRefresh.querySelector('svg');
                 if(icon) icon.classList.add('spin-anim');
                 btnRefresh.disabled = true;
             }

             // Mostra spinners nos cards
             bigKpis.forEach(id => {
                 const el = document.getElementById(id);
                 if(el) el.innerHTML = '<div class="loading-spinner" style="display:block"></div>';
             });
             smallKpis.forEach(id => {
                 const el = document.getElementById(id);
                 if(el) el.innerHTML = '<div class="loading-spinner-sm"></div>';
             });
         }

         try {
             // Usa a variável token que já está definida no escopo superior
             const response = await fetch(`${BASE_URL}/api/admin/stats`, {
                 headers: { 'Authorization': `Bearer ${token}` }
             });
             
             if (!response.ok) return; 
             const stats = await response.json();
 
             // --- 1. CARDS PRINCIPAIS (TOPO) ---
             updateSafe('kpi-mrr', formatCurrency(stats.mrr || 0));
             updateSafe('kpi-new-patients', stats.newPatients30d || 0);
             updateSafe('kpi-new-psychologists', stats.newPsis30d || 0);
             updateSafe('kpi-questionnaires-today', stats.questToday || 0); // Aqui entra o contador consertado
 
             // --- 2. RAIO-X (EMBAIXO) ---
             if(stats.patients) {
                 updateSafe('kpi-pat-total', stats.patients.total);
                 updateSafe('kpi-pat-active', stats.patients.active);
                 updateSafe('kpi-pat-deleted', stats.patients.deleted);
             }
 
             if(stats.psychologists) {
                 updateSafe('kpi-psi-total', stats.psychologists.total);
                 updateSafe('kpi-psi-deleted', stats.psychologists.deleted);
                 
                 const plans = stats.psychologists.byPlan || {};
                 updateSafe('kpi-plan-Essencial', plans['Essencial'] || 0);
                 updateSafe('kpi-plan-Clínico', plans['Clínico'] || 0);
                 updateSafe('kpi-plan-sol', plans['Sol'] || 0);
             }
 
             if(stats.questionnaires) {
                 updateSafe('kpi-quest-total', stats.questionnaires.total);
                 updateSafe('kpi-quest-deleted', stats.questionnaires.deleted);
             }
 
             // --- 3. WIDGETS LATERAIS ---
             updateSafe('waiting-list-count', stats.waitingListCount || 0);
             updateSafe('pending-reviews-count', stats.pendingReviewsCount || 0);

             // Log discreto para você saber que está atualizando
             // console.log(`[Dashboard] Atualizado às ${new Date().toLocaleTimeString()}`);
 
         } catch (error) {
             console.error("Erro no loop do Dashboard:", error);
         } finally {
             // Remove animação do botão
             if(btnRefresh) {
                 const icon = btnRefresh.querySelector('svg');
                 if(icon) icon.classList.remove('spin-anim');
                 btnRefresh.disabled = false;
             }
         }
     }

    let newUsersChartInstance = null; // Variável para armazenar a instância do gráfico

    /**
     * Renderiza o gráfico de novos usuários.
     */
    async function renderNewUsersChart() {
        try {
            const response = await fetch(`${BASE_URL}/api/admin/charts/new-users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados do gráfico.');

            const chartData = await response.json();

            if (newUsersChartInstance) {
                newUsersChartInstance.destroy(); // Destrói o gráfico antigo antes de criar um novo
            }

            const chartCanvas = document.getElementById('new-users-chart');
            // BLINDAGEM: Se o elemento não existir (usuário mudou de página), para a execução silenciosamente
            if (!chartCanvas) return;

            const ctx = chartCanvas.getContext('2d');

            newUsersChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.labels, // Ex: ['Maio', 'Junho', 'Julho']
                    datasets: [
                        {
                            label: 'Novos Pacientes',
                            data: chartData.patientData,
                            backgroundColor: 'rgba(27, 67, 50, 0.7)', // Verde escuro
                            borderColor: 'rgba(27, 67, 50, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Novos Psicólogos',
                            data: chartData.psychologistData,
                            backgroundColor: 'rgba(255, 238, 140, 0.7)', // Amarelo Yelo
                            borderColor: 'rgba(255, 238, 140, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Erro ao renderizar gráfico:", error);
            const chartCanvas = document.getElementById('new-users-chart');
            if (chartCanvas && chartCanvas.parentElement) {
                chartCanvas.parentElement.innerHTML = '<p>Não foi possível carregar o gráfico.</p>';
            }
        }
    }

    // Função para iniciar a atualização automática
    function startAutoRefresh() {
        // Configura o botão de atualizar manual
        const btnRefresh = document.getElementById('btn-refresh-dashboard');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                fetchAndRenderStats(true); // Força animação no clique manual
                renderNewUsersChart();
            });
        }

        // Busca os dados imediatamente na primeira vez (com animação)
        fetchAndRenderStats(true);
        renderNewUsersChart();

        // Configura o intervalo para atualizar a cada 60 segundos (60000 ms)
        // No refresh automático, passamos false para não piscar a tela com spinners
        refreshInterval = setInterval(() => fetchAndRenderStats(false), 60000);
    }

    // Inicia o processo ao carregar a página
    chartJsScript.onload = () => {
        startAutoRefresh();
    };

    // Limpa o intervalo quando a página for "desmontada" (função chamada pelo admin.js)
    window.cleanupPage = () => clearInterval(refreshInterval);
};