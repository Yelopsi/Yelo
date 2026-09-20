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
        'kpi-psi-total', 'kpi-psi-active', 'kpi-psi-deleted',
        'kpi-plan-Essencial', 'kpi-plan-Clínico', 'kpi-plan-sol',
        'kpi-psi-paying', 'kpi-psi-trials',
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

             if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 console.error("🔥 DETALHES DO ERRO DA API (500):", errData);
                 throw new Error(`HTTP error! status: ${response.status} - ${errData.debugMessage || errData.error || ''}`);
             }
             const stats = await response.json();
 
             // --- 1. CARDS PRINCIPAIS (TOPO) ---
             updateSafe('kpi-mrr', formatCurrency(stats.mrr || 0));
             updateSafe('kpi-new-patients', stats.newPatients30d || 0);
             updateSafe('kpi-new-psychologists', stats.newPsis30d || 0);
             updateSafe('kpi-questionnaires-today', stats.questToday || 0); // Aqui entra o contador consertado
 
             // --- 2. RAIO-X (EMBAIXO) ---
             if(stats.psychologists) {
                 updateSafe('kpi-psi-total', stats.psychologists.total);
                 updateSafe('kpi-psi-active', stats.psychologists.active);
                 updateSafe('kpi-psi-deleted', stats.psychologists.deleted);
                 
                 const currentPaying = parseInt(stats.psychologists.paying) || 0;
                 updateSafe('kpi-psi-paying', currentPaying);
                 updateSafe('kpi-psi-trials', stats.psychologists.trials);

                 // --- 👑 EASTER EGG: RECORDE DE ASSINANTES (Controlado pelo Backend) ---
                 if (stats.isNewRecord) {
                     if (typeof confetti === 'function') {
                         setTimeout(() => {
                             const duration = 3000;
                             const animationEnd = Date.now() + duration;
                             const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 99999 };
                             
                             const interval = setInterval(function() {
                                 const timeLeft = animationEnd - Date.now();
                                 if (timeLeft <= 0) return clearInterval(interval);
                                 const particleCount = 50 * (timeLeft / duration);
                                 // Origens nos cantos esquerdo e direito
                                 confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random() * 0.2 + 0.1, y: Math.random() - 0.2 } }));
                                 confetti(Object.assign({}, defaults, { particleCount, origin: { x: Math.random() * 0.2 + 0.7, y: Math.random() - 0.2 } }));
                             }, 250);
                         }, 600); // pequeno delay para a renderização do número
                     }
                 }
                 
                 const plans = stats.psychologists.byPlan || {};
                 updateSafe('kpi-plan-Essencial', plans['Essencial'] || 0);
                 updateSafe('kpi-plan-Clínico', plans['Clínico'] || 0);
                 updateSafe('kpi-plan-sol', plans['Sol'] || 0);
             } else {
                 updateSafe('kpi-psi-total', '--');
                 updateSafe('kpi-psi-active', '--');
                 updateSafe('kpi-psi-deleted', '--');
                 updateSafe('kpi-psi-paying', '--');
                 updateSafe('kpi-psi-trials', '--');
                 updateSafe('kpi-plan-Essencial', '--');
                 updateSafe('kpi-plan-Clínico', '--');
                 updateSafe('kpi-plan-sol', '--');
             }
 
             // --- 3. WIDGETS LATERAIS ---
             updateSafe('waiting-list-count', stats.waitingListCount || 0);
             updateSafe('pending-reviews-count', stats.pendingReviewsCount || 0);

             // --- 4. NOVOS KPIs DE CONVERSÃO GERAL ---
             updateSafe('kpi-geral-conversao', `${stats.overallConversionRate || 0}%`);
             updateSafe('kpi-total-matches', (stats.totalMatches || 0).toLocaleString('pt-BR'));
             updateSafe('kpi-total-cliques', (stats.totalClicks || 0).toLocaleString('pt-BR'));
             updateSafe('kpi-waiting-list', stats.waitingListCount || 0);


             // --- 5. MARCOS DE CRESCIMENTO E BREAKEVEN ---
             const currentPaying = parseInt(stats.psychologists.paying) || 0;
             try {
                 updateSafe('milestone-current-val', currentPaying);
                 
                 // Fetch CMO data for Ads expenses
                 const cmoRes = await fetch(BASE_URL + '/api/cmo/dashboard', { headers: { 'Authorization': 'Bearer ' + token } });
                 if (cmoRes.ok) {
                     const cmoData = await cmoRes.json();
                     
                     // Proteção contra retornos vazios ou nulos (NaN)
                     let metaSpend = parseFloat(cmoData?.ads?.meta?.spend) || 0;
                     let googleSpend = parseFloat(cmoData?.ads?.google?.spend) || 0;
                     let totalAds = metaSpend + googleSpend;
                     
                     // Alvo Breakeven = (Custo Ads / 99) + 5
                     let breakevenTarget = Math.ceil((totalAds / 99) + 5);
                     if (isNaN(breakevenTarget) || breakevenTarget < 10) breakevenTarget = 10; // Fallback seguro
                     updateSafe('milestone-breakeven-target', breakevenTarget);

                     // Calcular média de crescimento móvel (Baseado no netGrowth90d calculado pelo backend)
                     // A divisão por 3 nos dá a média mensal de crescimento líquido dos últimos 3 meses
                     let netGrowthPerMonth = 0;
                     if (stats.netGrowth90d !== undefined && stats.netGrowth90d !== null) {
                         netGrowthPerMonth = stats.netGrowth90d / 3;
                     } else {
                         // Fallback APENAS se a API falhar em trazer o dado
                         const rawNew30d = parseInt(stats.newPsis30d) || 0;
                         // Pega os novos de 30d, e tira uma estimativa conservadora de 50% de churn se não houver dados reais
                         netGrowthPerMonth = rawNew30d > 0 ? (rawNew30d / 2) : 0; 
                     }

                     function formatProjection(target) {
                        const pct = (currentPaying / target) * 100;
                        const pctSpan = pct >= 100 
                            ? `<span style="font-size: 0.75rem; font-weight: bold; color: #10b981; margin-left: 6px;">✓ 100%</span>`
                            : `<span style="font-size: 0.75rem; font-weight: bold; color: #10b981; margin-left: 6px;">▲ ${pct.toFixed(1).replace('.', ',')}%</span>`;

                        if (currentPaying >= target) return `Atingido ${pctSpan}`;
                        
                        // Se o crescimento líquido (novos - churn) for menor ou igual a 0, não vai atingir
                        if (netGrowthPerMonth <= 0) return `Estagnado ${pctSpan}`;
                        
                        const monthsNeeded = (target - currentPaying) / netGrowthPerMonth;
                        // Limitar a projeção máxima a 5 anos (60 meses) para não gerar datas absurdas
                        if (monthsNeeded > 60 || !isFinite(monthsNeeded)) return `Longo Prazo ${pctSpan}`;

                        const projDate = new Date();
                        projDate.setMonth(projDate.getMonth() + Math.ceil(monthsNeeded));
                        
                        let fMonth = projDate.toLocaleString('pt-BR', { month: 'short' });
                        let fYear = projDate.getFullYear();
                        let dateStr = (fMonth + '/' + fYear).replace('.', '');

                        return `${dateStr} ${pctSpan}`;
                    }

                     const projBreakeven = document.getElementById('milestone-breakeven-proj');
                     if (projBreakeven) projBreakeven.innerHTML = formatProjection(breakevenTarget);

                     const proj70 = document.getElementById('milestone-70-proj');
                     if (proj70) proj70.innerHTML = formatProjection(70);

                     const proj120 = document.getElementById('milestone-120-proj');
                     if (proj120) proj120.innerHTML = formatProjection(120);

                     // MAX_SCALE
                     const MAX_SCALE = Math.max(120, currentPaying, breakevenTarget);
                     const percentCurrent = Math.min(100, (currentPaying / MAX_SCALE) * 100);
                     
                     const fill = document.getElementById('milestone-progress-fill');
                     if (fill) fill.style.width = percentCurrent + '%';

                     const markerBreak = document.getElementById('marker-breakeven');
                     if (markerBreak) markerBreak.style.left = Math.min(100, (breakevenTarget / MAX_SCALE) * 100) + '%';
                     
                     const marker70 = document.getElementById('marker-70');
                     if (marker70) marker70.style.left = Math.min(100, (70 / MAX_SCALE) * 100) + '%';
                     
                     const marker120 = document.getElementById('marker-120');
                     if (marker120) marker120.style.left = Math.min(100, (120 / MAX_SCALE) * 100) + '%';
                 }
             } catch(e) {
                 console.error('Erro ao atualizar marcos:', e);
             }


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

    window.switchChartTab = function(tabName) {
        const tabUsers = document.getElementById('tab-new-users');
        const tabClicks = document.getElementById('tab-clicks');
        const viewUsers = document.getElementById('view-new-users');
        const viewClicks = document.getElementById('view-clicks');
        
        if (!tabUsers || !tabClicks || !viewUsers || !viewClicks) return;

        if (tabName === 'new-users') {
            tabUsers.style.background = 'white';
            tabUsers.style.color = '#0f172a';
            tabUsers.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            tabClicks.style.background = 'transparent';
            tabClicks.style.color = '#475569';
            tabClicks.style.boxShadow = 'none';
            
            viewUsers.style.display = 'block';
            viewClicks.style.display = 'none';
        } else {
            tabClicks.style.background = 'white';
            tabClicks.style.color = '#0f172a';
            tabClicks.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            
            tabUsers.style.background = 'transparent';
            tabUsers.style.color = '#475569';
            tabUsers.style.boxShadow = 'none';
            
            viewUsers.style.display = 'none';
            viewClicks.style.display = 'block';
        }
    };

    let clicksEvolutionChartInstance = null;

    window.loadClicksChartData = async function() {
        try {
            const chartCanvas = document.getElementById('clicksEvolutionChart');
            if (!chartCanvas) return;
            
            const response = await fetch(`${BASE_URL}/api/admin/charts/clicks-growth`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados do gráfico B2C.');
            const chartData = await response.json();

            if (clicksEvolutionChartInstance) {
                clicksEvolutionChartInstance.destroy();
            }

            const ctx = chartCanvas.getContext('2d');
            clicksEvolutionChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: 'Cliques Pagos (Real)',
                            data: chartData.realData.paidClicks,
                            borderColor: '#8b5cf6', // Roxo
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointHitRadius: 20,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Cliques Orgânicos (Real)',
                            data: chartData.realData.organicClicks,
                            borderColor: '#10b981', // Verde Forte
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.3,
                            pointHitRadius: 20,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Cliques Orgânicos (Esperado)',
                            data: chartData.expectedData.clicks,
                            borderColor: '#94a3b8', // Cinza tracejado
                            borderDash: [5, 5],
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3,
                            pointHitRadius: 20,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Sessões Orgânicas (Real)',
                            data: chartData.realData.organicSessions,
                            borderColor: '#3b82f6', // Azul
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3,
                            pointHitRadius: 20,
                            yAxisID: 'y1'
                        },
                        {
                            label: 'Sessões SEO (Projeção)',
                            data: chartData.expectedData.sessions,
                            borderColor: '#cbd5e1', // Cinza mais claro
                            borderWidth: 2,
                            fill: false,
                            tension: 0.3,
                            pointHitRadius: 20,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    layout: { padding: { right: 30, left: 10, top: 10, bottom: 10 } },
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'Cliques', color: '#64748b' },
                            beginAtZero: true
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Sessões', color: '#64748b' },
                            grid: { drawOnChartArea: false },
                            beginAtZero: true
                        }
                    },
                    plugins: { tooltip: { mode: 'index', intersect: false } }
                }
            });
        } catch (error) {
            console.error("Erro ao carregar gráfico B2C:", error);
        }
    };

    // Função para iniciar a atualização automática
    function startAutoRefresh() {
        // Configura o botão de atualizar manual
        const btnRefresh = document.getElementById('btn-refresh-dashboard');
        if (btnRefresh) {
            btnRefresh.addEventListener('click', () => {
                fetchAndRenderStats(true); // Força animação no clique manual
                renderNewUsersChart();
                if(window.loadClicksChartData) window.loadClicksChartData();
            });
        }

        // Busca os dados imediatamente na primeira vez (com animação)
        fetchAndRenderStats(true);
        renderNewUsersChart();
        if(window.loadClicksChartData) window.loadClicksChartData();

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