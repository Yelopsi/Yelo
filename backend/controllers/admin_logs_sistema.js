document.addEventListener('DOMContentLoaded', () => {
    const logsList = document.getElementById('logs-list');
    const loadingEl = document.getElementById('logs-loading');
    const emptyEl = document.getElementById('logs-empty');
    const searchInput = document.getElementById('log-search');
    const filterSelect = document.getElementById('log-filter');

    let allLogs = [];
    let processedLogs = [];

    const BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';

    /**
     * Renderiza a lista de logs processados na tela.
     */
    const renderLogs = (logsToRender) => {
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
    };

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
            if (newLog.level !== 'error') {
                return newLog;
            }

            const userId = newLog.meta?.userEmail;
            if (!userId) {
                return newLog;
            }

            const userActions = logsByUser[userId];
            const currentActionIndex = userActions.findIndex(action => action.id === newLog.id);
            
            if (currentActionIndex > -1 && currentActionIndex < userActions.length - 1) {
                const nextAction = userActions[currentActionIndex + 1];
                const timeDiff = new Date(nextAction.createdAt) - new Date(newLog.createdAt);
                const minutesDiff = timeDiff / (1000 * 60);

                if (minutesDiff < 30) { // Janela de 30 minutos para considerar uma "próxima tentativa"
                    const isSameActionType = (a, b) => {
                        const msgA = a.message.toLowerCase();
                        const msgB = b.message.toLowerCase();
                        if ((msgA.includes('login') || msgA.includes('senha')) && (msgB.includes('login') || msgB.includes('senha'))) return true;
                        if (msgA.includes('pagamento') && msgB.includes('pagamento')) return true;
                        return false;
                    };

                    if (isSameActionType(newLog, nextAction)) {
                        newLog.subsequentAttempt = { type: nextAction.level === 'error' ? 'failure' : 'success' };
                    } else {
                        newLog.subsequentAttempt = { type: 'gave_up' };
                    }
                } else {
                    newLog.subsequentAttempt = { type: 'gave_up' };
                }
            } else {
                newLog.subsequentAttempt = { type: 'gave_up' };
            }

            return newLog;
        });
    };

    /**
     * Busca os logs da API e inicia o processamento.
     */
    const fetchLogs = async () => {
        try {
            loadingEl.style.display = 'block';
            emptyEl.style.display = 'none';
            logsList.innerHTML = '';

            // ATENÇÃO: Substitua pelo seu endpoint real que busca os logs
            const response = await fetch(`${BASE_URL}/api/admin/system-logs`); 
            if (!response.ok) throw new Error('Falha ao carregar os logs do servidor.');
            
            const data = await response.json();
            allLogs = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            processedLogs = processAndCorrelateLogs([...allLogs]);
            
            applyFilters();

        } catch (error) {
            console.error(error);
            loadingEl.style.display = 'none';
            logsList.innerHTML = `<li class="log-item log-level-error">${error.message}</li>`;
        }
    };

    /**
     * Aplica os filtros de busca e tipo de log.
     */
    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const filterType = filterSelect.value;

        let baseList = filterType === 'all' ? allLogs : processedLogs.filter(log => log.level === filterType || (filterType === 'payment' && log.message.toLowerCase().includes('pagamento')));
        if (filterType === 'error') baseList = processedLogs.filter(log => log.level === 'error');

        const filtered = baseList.filter(log => JSON.stringify(log).toLowerCase().includes(searchTerm));
        renderLogs(filtered);
    };

    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', fetchLogs); // Recarrega e reprocessa ao mudar o filtro principal

    fetchLogs();
});
