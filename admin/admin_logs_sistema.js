window.initializePage = async function() {
    console.log("Inicializando Monitoramento do Sistema...");
    
    const localApiUrl = (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    // --- LÓGICA DE CARREGAMENTO ---
    async function fetchSystemData() {
        const logsList = document.getElementById('logs-list');
        if (!logsList) return; // Segurança caso a página não tenha carregado

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
                    infrastructure: { status: 'healthy', memory: 0 }
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
            renderLogsList(logs);

        } catch (error) {
            console.error(error);
            logsList.innerHTML = `<p style="color:red;">Erro: ${error.message}</p>`;
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

    function renderLogsList(logs) {
        const container = document.getElementById('logs-list');
        
        // FILTRO: Remove logs de "info" (acessos) e mostra apenas Erros/Warnings
        const filteredLogs = logs.filter(log => log.level === 'error' || log.level === 'warning' || log.level === 'warn');

        if (!filteredLogs || filteredLogs.length === 0) {
            container.innerHTML = '<p style="color:#999;">Nenhum erro crítico ou aviso recente.</p>';
            return;
        }

        container.innerHTML = filteredLogs.map(log => {
            const date = new Date(log.createdAt).toLocaleString('pt-BR');
            const levelClass = `level-${log.level || 'info'}`;
            return `
                <div class="log-row">
                    <div style="flex: 1;">
                        <span class="log-level ${levelClass}">${log.level || 'INFO'}</span>
                        <span style="margin-left: 10px; color: #333;">${log.message}</span>
                    </div>
                    <div style="color: #999; font-size: 0.8rem; min-width: 140px; text-align: right;">
                        ${date}
                    </div>
                </div>
            `;
        }).join('');
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

    // Inicia
    fetchSystemData();
};