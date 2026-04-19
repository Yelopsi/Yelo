// admin/admin_visao_geral.js

window.initializePage = function() {
    let refreshInterval; // Variável para armazenar o ID do intervalo

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
            el.textContent = (value !== undefined && value !== null) ? value : '--';
            // Efeito visual sutil de atualização
            el.style.transition = 'color 0.3s';
            el.style.color = '#155724'; // Verde escuro momentâneo
            setTimeout(() => el.style.color = '', 500);
        }
    }

    // Listas de IDs para animação de carregamento
    const bigKpis = [
        'kpi-mrr', 'kpi-new-patients', 'kpi-new-psychologists', 'kpi-questionnaires-today',
        'kpi-geral-conversao', 'kpi-total-matches', 'kpi-total-cliques'
    ];
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

             // Mostra spinners nos cards (agora incluindo os novos)
             bigKpis.forEach(id => {
                 const el = document.getElementById(id);
                 const color = ['kpi-mrr', 'kpi-new-patients', 'kpi-new-psychologists', 'kpi-questionnaires-today'].includes(id) ? 'var(--cor-Yelo)' : 'var(--verde-escuro)';
                 const baseColor = ['kpi-mrr', 'kpi-new-patients', 'kpi-new-psychologists', 'kpi-questionnaires-today'].includes(id) ? 'rgba(255,255,255,0.2)' : 'rgba(27,67,50,0.2)';
                 if(el) el.innerHTML = `<span class="loading-spinner-sm" style="display:inline-block; border-color: ${baseColor}; border-top-color: ${color};"></span>`;
             });
             smallKpis.forEach(id => {
                 const el = document.getElementById(id);
                 if(el) el.innerHTML = '<span class="loading-spinner-sm" style="display:inline-block; border-color: rgba(27,67,50,0.2); border-top-color: var(--verde-escuro);"></span>';
             });
         }

         try {
             // Adiciona timeout de 15s para evitar carregamento infinito se a API travar
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 15000);

             // Usa a variável token que já está definida no escopo superior
             const response = await fetch(`${BASE_URL}/api/admin/stats`, {
                 headers: { 'Authorization': `Bearer ${token}` },
                 signal: controller.signal
             });
             clearTimeout(timeoutId);

             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
             } else {
                 updateSafe('kpi-pat-total', '--');
                 updateSafe('kpi-pat-active', '--');
                 updateSafe('kpi-pat-deleted', '--');
             }
 
             if(stats.psychologists) {
                 updateSafe('kpi-psi-total', stats.psychologists.total);
                 updateSafe('kpi-psi-deleted', stats.psychologists.deleted);
                 
                 const plans = stats.psychologists.byPlan || {};
                 updateSafe('kpi-plan-Essencial', plans['Essencial'] || 0);
                 updateSafe('kpi-plan-Clínico', plans['Clínico'] || 0);
                 updateSafe('kpi-plan-sol', plans['Sol'] || 0);
             } else {
                 updateSafe('kpi-psi-total', '--');
                 updateSafe('kpi-psi-deleted', '--');
                 updateSafe('kpi-plan-Essencial', '--');
                 updateSafe('kpi-plan-Clínico', '--');
                 updateSafe('kpi-plan-sol', '--');
             }
 
             if(stats.questionnaires) {
                 updateSafe('kpi-quest-total', stats.questionnaires.total);
                 updateSafe('kpi-quest-deleted', stats.questionnaires.deleted);
             } else {
                 updateSafe('kpi-quest-total', '--');
                 updateSafe('kpi-quest-deleted', '--');
             }
 
             // --- 3. WIDGETS LATERAIS ---
             updateSafe('waiting-list-count', stats.waitingListCount || 0);
             updateSafe('pending-reviews-count', stats.pendingReviewsCount || 0);

             // --- 4. NOVOS KPIs DE CONVERSÃO GERAL ---
             updateSafe('kpi-geral-conversao', `${stats.overallConversionRate || 0}%`);
             updateSafe('kpi-total-matches', (stats.totalMatches || 0).toLocaleString('pt-BR'));
             updateSafe('kpi-total-cliques', (stats.totalClicks || 0).toLocaleString('pt-BR'));

             // Log discreto para você saber que está atualizando
             // console.log(`[Dashboard] Atualizado às ${new Date().toLocaleTimeString()}`);
 
         } catch (error) {
             console.error("Erro no loop do Dashboard:", error);
                         // Limpa os spinners e coloca um estado vazio se a API falhar
            const allKpis = [...new Set([...bigKpis, ...smallKpis])];
            allKpis.forEach(id => {
                const el = document.getElementById(id);
                if (el && (el.innerHTML.includes('loading-spinner') || el.textContent.trim() === '')) {
                    el.textContent = '--';
                }
            });
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
                type: 'line',
                data: {
                    labels: chartData.labels, // Ex: ['Maio', 'Junho', 'Julho']
                    datasets: [
                        {
                            label: 'Novos Pacientes',
                            data: chartData.patientData,
                            backgroundColor: 'rgba(27, 67, 50, 0.1)', // Verde escuro translúcido
                            borderColor: 'rgba(27, 67, 50, 1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        },
                        {
                            label: 'Novos Psicólogos',
                            data: chartData.psychologistData,
                            backgroundColor: 'rgba(255, 238, 140, 0.3)', // Amarelo Yelo translúcido
                            borderColor: '#F59E0B', // Laranja/Amarelo forte para destaque na linha
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
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

    // Carrega o Chart.js apenas se ainda não existir (previne travamento em navegação SPA)
    if (typeof Chart === 'undefined') {
        const chartJsScript = document.createElement('script');
        chartJsScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        chartJsScript.onload = () => {
            startAutoRefresh();
        };
        document.head.appendChild(chartJsScript);
    } else {
        startAutoRefresh();
    }

    // Limpa o intervalo quando a página for "desmontada" (função chamada pelo admin.js)
    window.cleanupPage = () => clearInterval(refreshInterval);

        // --- NAVEGAÇÃO DOS CARDS DE AÇÃO RÁPIDA ---
        const actionLinks = document.querySelectorAll('[data-page-link]');
        actionLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = link.getAttribute('data-page-link');
                if (targetPage && typeof window.loadPage === 'function') {
                    window.loadPage(targetPage);
                }
            });
        });
};