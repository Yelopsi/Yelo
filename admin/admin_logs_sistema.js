// admin/admin_logs_sistema.js

window.initializePage = function() {
    const token = localStorage.getItem('girassol_token');
    const tableBody = document.getElementById('logs-table-body');

    if (!tableBody || !token) {
        console.error("Tabela de logs ou token não encontrados.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="error-row">Erro ao carregar a página.</td></tr>';
        return;
    }

    /**
     * Busca os logs da API e os renderiza na tabela.
     */
    async function fetchAndRenderLogs() {
        try {
            const response = await fetch('http://localhost:3001/api/admin/logs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar logs do sistema.');
            }

            const logs = await response.json();
            tableBody.innerHTML = ''; // Limpa o estado de "carregando"

            if (logs.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="3" class="empty-row">Nenhum log encontrado.</td></tr>';
                return;
            }

            logs.forEach(log => {
                const row = document.createElement('tr');
                
                // Adiciona uma classe baseada no nível do log para estilização
                const levelClass = `status-${log.level === 'error' ? 'inativo' : (log.level === 'warn' ? 'pendente' : 'info')}`;

                row.innerHTML = `
                    <td><span class="status ${levelClass}">${log.level.toUpperCase()}</span></td>
                    <td>${log.message}</td>
                    <td>${new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                `;
                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="3" class="error-row">${error.message}</td></tr>`;
        }
    }

    fetchAndRenderLogs();
};