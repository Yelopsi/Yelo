window.initializePage = async function () {
    console.log("Inicializando Monitoramento do Sistema...");

    const localApiUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    // Elementos da UI de Logs
    const logsList = document.getElementById('logs-list');
    const loadingEl = document.getElementById('logs-loading');
    const emptyEl = document.getElementById('logs-empty');
    const searchInput = document.getElementById('log-search');
    const filterSelect = document.getElementById('log-filter');

    // Define o filtro padrão para "Apenas Erros" ao carregar
    if (filterSelect) filterSelect.value = 'error';

    let allLogs = [];
    let processedLogs = [];

    const VALID_LOG_CATEGORIES = new Set([
        'campaign', 'payment', 'finance', 'email', 'auth', 'security', 'forum', 'copilot', 'admin', 'system'
    ]);

    function escapeHtml(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // --- LÓGICA DE CARREGAMENTO ---
    async function fetchSystemData() {
        if (!logsList) return; // Segurança caso a página não tenha carregado

        if (loadingEl) loadingEl.style.display = 'block';
        try {
            // Adiciona timestamp para evitar cache e garantir dados frescos sempre que abrir
            const startTime = performance.now(); // Inicia cronômetro
            const response = await fetch(`${localApiUrl}/api/admin/logs?_t=${new Date().getTime()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const endTime = performance.now(); // Para cronômetro
            const latency = Math.round(endTime - startTime);

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
            if (logsList) logsList.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`;
        }
    }

    function renderHealthCards(health) {
        const container = document.getElementById('health-dashboard');
        if (!health) {
            container.innerHTML = '<p>Dados de saúde não disponíveis (Reinicie o servidor).</p>';
            return;
        }

        // Configuração dos Cards com avaliação rigorosa
        const cards = [
            {
                title: "Banco de Dados",
                value: health.database.status === 'online' ? "Online & Conectado" : "Erro de Conexão",
                status: health.database.status === 'online' ? 'green' : 'red',
                tooltip: "Mede conectividade. Falha aqui derruba toda a aplicação instantaneamente."
            },
            {
                title: "Cadastros (24h)",
                value: health.registration.count === '?' ? "N/A" : (health.registration.count > 0 ? `${health.registration.count} Novos` : "Zero cadastros"),
                status: health.registration.status === 'active' ? 'green' : (health.registration.count === 0 ? 'yellow' : 'red'),
                tooltip: "Zero novos leads prolongados acendem um alerta crítico no frontend ou tráfego."
            },
            {
                title: "Pagamentos",
                value: health.payment.status === 'healthy' ? "Operando" : `${health.payment.errors} Erros Detectados`,
                status: health.payment.status === 'healthy' ? 'green' : 'red',
                tooltip: "Erros nos gateways implicam perda de faturamento."
            },
            {
                title: "Serviço de E-mails",
                value: (health.email && health.email.status === 'healthy') ? "Operacional" : `${health.email ? health.email.errors : 0} Falhas (24h)`,
                status: (health.email && health.email.status === 'healthy') ? 'green' : ((health.email && health.email.status === 'warning') ? 'yellow' : 'red'),
                tooltip: "Falhas em SMTP atrasam recuperações de senha e travas operacionais."
            },
            {
                title: "Erros de Sistema (Bugs)",
                value: health.system.status === 'healthy' ? "Estável (0)" : `${health.system.errors} Exceções Detectadas`,
                status: health.system.status === 'healthy' ? 'green' : 'red',
                tooltip: "Exceções não tratadas. Manter em zero é vital para saúde do backend."
            },
            {
                title: "Funil de Busca",
                value: health.funnel.status === 'critical' ? "ALERTA (Trava)" : `${health.funnel.completed} Completos / ${health.funnel.started} Iniciados`,
                status: health.funnel.status === 'healthy' ? 'green' : 'red',
                tooltip: "Acompanha se o questionário PLG quebra antes de gerar contatos no WhatsApp."
            },
            {
                title: "Segurança de Logins",
                value: health.security.failures > 0 ? `${health.security.failures} Falhas (Brute-force?)` : "Nenhum Alerta",
                status: health.security.status === 'healthy' ? 'green' : 'yellow',
                tooltip: "Monitora senhas erradas e picos anômalos de falha de autenticação."
            },
            {
                title: "Latência (API Ping)",
                value: `${health.performance.latency}ms`,
                status: health.performance.latency < 500 ? 'green' : (health.performance.latency < 1500 ? 'yellow' : 'red'),
                tooltip: "Tempo de resposta. >1500ms afeta agressivamente a experiência do usuário."
            },
            {
                title: "WebSocket Chat",
                value: health.socket.connected ? "Conectado Ativo" : "Desconectado",
                status: health.socket.connected ? 'green' : 'red',
                tooltip: "Mantém notificações e o chat de CS online. Se offline, requer refresh manual."
            },
            {
                title: "Concorrência",
                value: (health.concurrentUsers !== undefined && health.concurrentUsers !== null) ? `${health.concurrentUsers} Usuários Online` : "N/A",
                status: (health.concurrentUsers > 150) ? 'red' : ((health.concurrentUsers > 50) ? 'yellow' : 'green'),
                tooltip: "Sessões ativas no momento. Picos anormais podem engargalar o Node.js."
            },
            {
                title: "Sessão Média",
                value: (health.avgSessionTime !== undefined && health.avgSessionTime !== null) ? `${Math.round(health.avgSessionTime)} min` : "N/A",
                status: 'green',
                tooltip: "Quanto tempo o usuário permanece ativo. Auxilia em diagnósticos de retenção."
            },
            {
                title: "Memória RAM",
                value: health.infrastructure ? `${health.infrastructure.memory} MB Uso` : "N/A",
                status: health.infrastructure ? health.infrastructure.status : 'green',
                tooltip: "Alocação do Node. Memory Leaks fazem o status ficar vermelho."
            }
        ];

        container.innerHTML = cards.map(card => `
            <div class="health-card" style="border-left-color: ${card.status === 'green' ? '#2ecc71' : (card.status === 'red' ? '#e74c3c' : '#f1c40f')}">
                <div class="health-info" style="width: 100%;">
                    <h4 style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        ${card.title}
                        ${card.tooltip ? `<span class="info-tooltip" data-tooltip="${card.tooltip}">i</span>` : ''}
                    </h4>
                    <p>${card.value}</p>
                </div>
                <div class="status-indicator status-${card.status}" style="flex-shrink: 0; margin-left: 15px;"></div>
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
            li.classList.add('log-item', `log-level-${log.level || 'info'}`);

            const icon = log.level === 'error' ? '❌' : (log.level === 'warning' ? '⚠️' : (log.level === 'info' ? '✅' : 'ℹ️'));
            const safeCat = VALID_LOG_CATEGORIES.has(log.category) ? log.category : 'system';
            const categoryLabel = log.categoryLabel || '⚙️ Sistema';
            const actorLabel = log.actorLabel || log.meta?.userEmail || 'Sistema';
            const actorEmail = (log.actorEmail && log.actorEmail.toLowerCase() !== actorLabel.toLowerCase()) ? log.actorEmail : '';
            const message = log.message || '';
            const rawMessage = log.rawMessage || '';
            const details = log.details || '';

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

            const emailSubHtml = actorEmail
                ? `<span class="log-actor-email">(${escapeHtml(actorEmail)})</span>`
                : '';

            const detailsHtml = details
                ? `<div class="log-friendly-details">${escapeHtml(details)}</div>`
                : '';

            const rawDetailsHtml = (rawMessage && rawMessage !== message)
                ? `<details class="log-raw-details"><summary>Ver detalhe técnico</summary><code>${escapeHtml(rawMessage)}</code></details>`
                : '';

            li.innerHTML = `
                <div class="log-top-row">
                    <span class="log-icon">${icon}</span>
                    <span class="log-category-badge log-cat-${safeCat}">${escapeHtml(categoryLabel)}</span>
                    <span class="log-actor-wrap">
                        <strong class="log-actor-name">${escapeHtml(actorLabel)}</strong>
                        ${emailSubHtml}
                    </span>
                    <span class="log-timestamp">${escapeHtml(new Date(log.createdAt).toLocaleString('pt-BR'))}</span>
                </div>
                <div class="log-friendly-message">${escapeHtml(message)}</div>
                ${detailsHtml}
                ${attemptStatusHTML}
                ${rawDetailsHtml}
            `;
            logsList.appendChild(li);
        });
    }

    /**
     * Processa os logs brutos para correlacionar erros e tentativas subsequentes.
     */
    const processAndCorrelateLogs = (logs) => {
        const getUserKey = (item) => item?.actorEmail || item?.meta?.userEmail || null;

        const logsByUser = logs.reduce((acc, log) => {
            const userId = getUserKey(log);
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

            const userId = getUserKey(newLog);
            if (!userId || !logsByUser[userId]) return newLog;

            const userActions = logsByUser[userId];
            const currentActionIndex = userActions.findIndex(action => action.id === newLog.id);

            if (currentActionIndex > -1 && currentActionIndex < userActions.length - 1) {
                const nextAction = userActions[currentActionIndex + 1];
                const timeDiff = new Date(nextAction.createdAt) - new Date(newLog.createdAt);
                const minutesDiff = timeDiff / (1000 * 60);

                if (minutesDiff < 30) { // Janela de 30 minutos
                    const msgA = ((newLog.message || '') + ' ' + (newLog.rawMessage || '')).toLowerCase();
                    const msgB = ((nextAction.message || '') + ' ' + (nextAction.rawMessage || '')).toLowerCase();
                    const isSameAction =
                        ((msgA.includes('login') || msgA.includes('acess') || msgA.includes('entrou')) &&
                         (msgB.includes('login') || msgB.includes('acess') || msgB.includes('entrou'))) ||
                        ((msgA.includes('pagamento') || msgA.includes('asaas') || msgA.includes('cobrança')) &&
                         (msgB.includes('pagamento') || msgB.includes('asaas') || msgB.includes('cobrança')));

                    newLog.subsequentAttempt = isSameAction ? { type: nextAction.level === 'error' ? 'failure' : 'success' } : { type: 'gave_up' };
                } else { newLog.subsequentAttempt = { type: 'gave_up' }; }
            } else { newLog.subsequentAttempt = { type: 'gave_up' }; }
            return newLog;
        });
    }

    const btnRefresh = document.getElementById('btn-refresh-logs');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            btnRefresh.classList.add('updating');
            const span = btnRefresh.querySelector('span');
            const originalText = span ? span.textContent : 'Atualizar Agora';
            if (span) span.textContent = 'Atualizando...';
            btnRefresh.disabled = true;
            
            await fetchSystemData();
            
            if (span) span.textContent = originalText;
            btnRefresh.classList.remove('updating');
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
            if (filterType === 'payment') {
                const msg = (log.message || '').toLowerCase();
                const rawMsg = (log.rawMessage || '').toLowerCase();
                return (
                    log.category === 'payment' ||
                    log.category === 'finance' ||
                    msg.includes('pagamento') ||
                    msg.includes('asaas') ||
                    msg.includes('cobrança') ||
                    msg.includes('faturamento') ||
                    rawMsg.includes('asaas') ||
                    rawMsg.includes('pagamento')
                );
            }
            // Garante que log.level exista antes de comparar
            return (log.level && log.level === filterType);
        });

        const finalFilteredList = filteredByLevelAndType.filter(log => {
            if (searchTerm === '') return true; // Se não há termo de busca, não filtra por ele
            const fields = [
                log.message,
                log.rawMessage,
                log.actorLabel,
                log.actorEmail,
                log.categoryLabel,
                log.details,
                log.meta?.userEmail
            ];
            return fields.some(f => String(f || '').toLowerCase().includes(searchTerm));
        });

        renderLogsList(finalFilteredList);
    };

    // Inicia
    fetchSystemData();
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    // CORREÇÃO: O filtro deve apenas aplicar o filtro, não refazer o fetch. O botão de refresh faz o fetch.
    if (filterSelect) filterSelect.addEventListener('change', applyFilters);
};