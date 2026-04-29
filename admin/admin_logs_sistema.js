window.initializePage = async function() {
    console.log("Inicializando Monitoramento do Sistema...");
    
    const localApiUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');
    
    // Elementos da UI de Logs
    const logsList = document.getElementById('logs-list');
    const loadingEl = document.getElementById('logs-loading');
    const emptyEl = document.getElementById('logs-empty');
    const searchInput = document.getElementById('log-search');
    const filterSelect = document.getElementById('log-filter');

    let allLogs = [];
    let processedLogs = [];

    // --- LÓGICA DE CARREGAMENTO ---
    async function fetchSystemData() {
        if (!logsList) return; // Segurança caso a página não tenha carregado

        if(loadingEl) loadingEl.style.display = 'block';
        try {
            // Adiciona timestamp para evitar cache e garantir dados frescos sempre que abrir
            const startTime = performance.now(); // Inicia cronômetro
            const response = await fetch(`${localApiUrl}/api/admin/logs?_t=${new Date().getTime()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const endTime = performance.now(); // Para cronômetro
            const latency = Math.round(endTime - startTime); // Calcula Latência (Ping)

            if (!response.ok) throw new Error('Erro ao buscar dados.');

            const data = await response.json();
            
            let logs = [];
            let health = null;

            // Verifica se o backend retornou o formato novo ou antigo
            if (Array.isArray(data)) {
                // Formato Antigo (Só array) -> Backend precisa ser reiniciado
                console.warn("Backend retornou formato antigo. Reinicie o servidor para dados completos.");
                logs = data;
                // Cria um objeto health fake para não quebrar a tela
                const errorCount = logs.filter(l => l.level === 'error').length;
                health = {
                    database: { status: 'online' },
                    registration: { status: 'active', count: '?' },
                    payment: { status: 'healthy', errors: 0 },
                    system: { status: errorCount === 0 ? 'healthy' : 'warning', errors: errorCount },
                    funnel: { status: 'healthy', started: 0, completed: 0 },
                    security: { status: 'healthy', failures: 0 },
                    infrastructure: { status: 'healthy', memory: 0 },
                    email: { status: 'healthy', errors: 0 } // Fallback para e-mail
                };
            } else {
                // Formato Novo
                logs = data.logs || [];
                health = data.health;
            }

            // Injeta dados calculados no Frontend
            health.performance = { latency: latency };
            health.socket = { connected: window.adminSocket && window.adminSocket.connected };

            renderHealthCards(health);
            
            allLogs = logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            processedLogs = processAndCorrelateLogs([...allLogs]).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Garante que os logs processados também estejam ordenados
            applyFilters();

        } catch (error) {
            console.error(error);
            if(logsList) logsList.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`;
        }
    }

    function renderHealthCards(health) {
        const container = document.getElementById('health-dashboard');
        if (!health) {
            container.innerHTML = '<p>Dados de saúde não disponíveis (Reinicie o servidor).</p>';
            return;
        }

        // Configuração dos Cards
        const cards = [
            {
                title: "Banco de Dados",
                value: health.database.status === 'online' ? "Online & Conectado" : "Erro de Conexão",
                status: health.database.status === 'online' ? 'green' : 'red'
            },
            {
                title: "Cadastros (24h)",
                value: health.registration.count === '?' ? "Dados indisponíveis" : (health.registration.count > 0 ? `${health.registration.count} Novos Usuários` : "Sem novos cadastros"),
                status: health.registration.status === 'active' ? 'green' : 'yellow'
            },
            {
                title: "Pagamentos",
                value: health.payment.status === 'healthy' ? "Operando Normalmente" : `${health.payment.errors} Erros Detectados`,
                status: health.payment.status === 'healthy' ? 'green' : 'red'
            },
            {
                title: "Disparo de E-mails",
                value: (health.email && health.email.status === 'healthy') ? "Operacional" : `${health.email ? health.email.errors : 0} Falhas (24h)`,
                status: (health.email && health.email.status === 'healthy') ? 'green' : ((health.email && health.email.status === 'warning') ? 'yellow' : 'red')
            },
            {
                title: "Erros do Sistema",
                value: health.system.status === 'healthy' ? "Estável" : `${health.system.errors} Erros Recentes`,
                status: health.system.status === 'healthy' ? 'green' : 'red'
            },
            {
                title: "Funil de Busca",
                value: health.funnel.status === 'critical' ? "ALERTA: 0% de Conversão" : `${health.funnel.completed} Concluídos / ${health.funnel.started} Iniciados`,
                status: health.funnel.status === 'healthy' ? 'green' : 'red'
            },
            {
                title: "Segurança (Logins)",
                value: health.security.failures > 0 ? `${health.security.failures} Falhas de Acesso` : "Nenhuma Atividade Suspeita",
                status: health.security.status === 'healthy' ? 'green' : 'yellow'
            },
            {
                title: "Performance (Ping)",
                value: `${health.performance.latency}ms de Latência`,
                status: health.performance.latency < 500 ? 'green' : (health.performance.latency < 1500 ? 'yellow' : 'red')
            },
            {
                title: "Servidor de Chat",
                value: health.socket.connected ? "Conectado (Socket.IO)" : "Desconectado",
                status: health.socket.connected ? 'green' : 'red'
            },
            {
                title: "Acessos Simultâneos",
                value: (health.concurrentUsers !== undefined && health.concurrentUsers !== null) ? `${health.concurrentUsers} Usuários Online` : "N/A",
                status: health.concurrentUsers > 50 ? 'yellow' : 'green' // Lógica de exemplo: amarelo se > 50
            },
            {
                title: "Tempo Médio de Sessão",
                value: (health.avgSessionTime !== undefined && health.avgSessionTime !== null) ? `${Math.round(health.avgSessionTime)} min` : "N/A",
                status: 'green'
            },
            {
                title: "Uso de Memória",
                value: health.infrastructure ? `${health.infrastructure.memory} MB Utilizados` : "N/A",
                status: health.infrastructure ? health.infrastructure.status : 'green'
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="health-card" style="border-left-color: ${card.status === 'green' ? '#2ecc71' : (card.status === 'red' ? '#e74c3c' : '#f1c40f')}">
                <div class="health-info">
                    <h4>${card.title}</h4>
                    <p>${card.value}</p>
                </div>
                <div class="status-indicator status-${card.status}"></div>
            </div>
        `).join('');
    }

    /**
     * Renderiza a lista de logs processados na tela.
     */
    function renderLogsList(logsToRender) {
        if (!logsList || !loadingEl || !emptyEl) return;

        logsList.innerHTML = '';
        loadingEl.style.display = 'none';

        if (logsToRender.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';

        logsToRender.forEach(log => {
            const li = document.createElement('li');
            li.classList.add('log-item', `log-level-${log.level}`);

            const icon = log.level === 'error' ? '❌' : (log.level === 'info' ? '✅' : 'ℹ️');
            const userIdentifier = log.meta?.userEmail || 'Sistema';
            const message = log.message;

            let attemptStatusHTML = '';
            if (log.subsequentAttempt) {
                const status = log.subsequentAttempt;
                let statusClass = '';
                let statusText = '';

                if (status.type === 'success') {
                    statusClass = 'status-success';
                    statusText = `<strong>Resultado:</strong> SUCESSO na tentativa seguinte.`;
                } else if (status.type === 'failure') {
                    statusClass = 'status-failure';
                    statusText = `<strong>Resultado:</strong> FALHA na tentativa seguinte.`;
                } else if (status.type === 'gave_up') {
                    statusClass = 'status-gave-up';
                    statusText = `<strong>Resultado:</strong> DESISTÊNCIA (nenhuma nova tentativa detectada).`;
                }
                
                attemptStatusHTML = `<div class="subsequent-attempt ${statusClass}">${statusText}</div>`;
            }

            li.innerHTML = `
                <div class="log-header">
                    <span class="log-icon">${icon}</span>
                    <strong class="log-user">${userIdentifier}</strong>
                    <span class="log-message">${message}</span>
                    <span class="log-timestamp">${new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                </div>
                ${attemptStatusHTML}
            `;
            logsList.appendChild(li);
        });
    }

    /**
     * Processa os logs brutos para correlacionar erros e tentativas subsequentes.
     */
    const processAndCorrelateLogs = (logs) => {
        const logsByUser = logs.reduce((acc, log) => {
            const userId = log.meta?.userEmail;
            if (userId) {
                if (!acc[userId]) acc[userId] = [];
                acc[userId].push(log);
            }
            return acc;
        }, {});

        for (const userId in logsByUser) {
            logsByUser[userId].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }

        return logs.map(log => {
            const newLog = { ...log };
            if (newLog.level !== 'error') return newLog;

            const userId = newLog.meta?.userEmail;
            if (!userId || !logsByUser[userId]) return newLog;

            const userActions = logsByUser[userId];
            const currentActionIndex = userActions.findIndex(action => action.id === newLog.id);
            
            if (currentActionIndex > -1 && currentActionIndex < userActions.length - 1) {
                const nextAction = userActions[currentActionIndex + 1];
                const timeDiff = new Date(nextAction.createdAt) - new Date(newLog.createdAt);
                const minutesDiff = timeDiff / (1000 * 60);

                if (minutesDiff < 30) { // Janela de 30 minutos
                    const msgA = (newLog.message || '').toLowerCase();
                    const msgB = (nextAction.message || '').toLowerCase();
                    const isSameAction = (msgA.includes('login') && msgB.includes('login')) || (msgA.includes('pagamento') && msgB.includes('pagamento'));
                    
                    newLog.subsequentAttempt = isSameAction ? { type: nextAction.level === 'error' ? 'failure' : 'success' } : { type: 'gave_up' };
                } else { newLog.subsequentAttempt = { type: 'gave_up' }; }
            } else { newLog.subsequentAttempt = { type: 'gave_up' }; }
            return newLog;
        });
    }

    const btnRefresh = document.getElementById('btn-refresh-logs');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            const originalContent = btnRefresh.innerHTML;
            btnRefresh.innerHTML = '⏳ Atualizando...';
            btnRefresh.disabled = true;
            await fetchSystemData();
            btnRefresh.innerHTML = originalContent;
            btnRefresh.disabled = false;
        });
    }

    /**
     * Aplica os filtros de busca e tipo de log.
     */
    const applyFilters = () => {
        if (!searchInput || !filterSelect) return;
        const searchTerm = searchInput.value.toLowerCase();
        const filterType = filterSelect.value;

        let filteredByLevelAndType = processedLogs.filter(log => {
            if (filterType === 'all') return true; // Mostra todos
            if (filterType === 'payment') return (log.message || '').toLowerCase().includes('pagamento');
            // Garante que log.level exista antes de comparar
            return (log.level && log.level === filterType);
        });

        const finalFilteredList = filteredByLevelAndType.filter(log => {
            if (searchTerm === '') return true; // Se não há termo de busca, não filtra por ele
            const logMessage = (log.message || '').toLowerCase();
            const userEmail = (log.meta?.userEmail || '').toLowerCase();
            // Verifica se o termo de busca está na mensagem ou no e-mail do usuário
            return logMessage.includes(searchTerm) || userEmail.includes(searchTerm);
        });

        renderLogsList(finalFilteredList);
    };

    // Inicia
    fetchSystemData();
    if(searchInput) searchInput.addEventListener('input', applyFilters);
    if(filterSelect) filterSelect.addEventListener('change', applyFilters);
};