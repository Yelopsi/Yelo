// Arquivo: psi_historico_contatos.js
// Responsável por carregar o histórico de contatos do WhatsApp do psicólogo logado.

(async function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    const tbody = document.getElementById('history-table-body');
    const kpiCliques = document.getElementById('kpi-cliques');
    const kpiRecebidos = document.getElementById('kpi-recebidos');
    const kpiFechados = document.getElementById('kpi-fechados');
    const kpiConversao = document.getElementById('kpi-conversao');

    try {
        const response = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/contact-history`);
        if (!response.ok) throw new Error('Falha ao carregar histórico.');
        const history = await response.json();

        renderHistory(history);
    } catch (err) {
        console.error('Erro ao carregar histórico de contatos:', err);
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar os dados.</td></tr>`;
    }

    function renderHistory(logs) {
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3">
                        <div class="empty-state">
                            <div class="empty-state-icon">📭</div>
                            <h3>Nenhum clique registrado ainda</h3>
                            <p>Os pacientes que clicarem no seu WhatsApp aparecerão aqui.</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        let totalCliques = logs.length;
        let mensagensRecebidas = 0;
        let negociosFechados = 0;

        tbody.innerHTML = '';
        logs.forEach(log => {
            if (log.contactReceived) mensagensRecebidas++;
            if (log.dealClosed) negociosFechados++;

            const dataFormatada = new Date(log.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Determinar badge
            let badgeClass = 'pendente';
            let badgeText = 'Pendente de Feedback';

            if (log.feedbackGiven) {
                if (log.dealClosed) {
                    badgeClass = 'fechado';
                    badgeText = 'Fechou Negócio';
                } else if (log.contactReceived && !log.dealClosed) {
                    badgeClass = 'nao-fechado';
                    badgeText = 'Não Fechou';
                } else {
                    badgeClass = 'fantasma';
                    badgeText = 'Paciente Fantasma';
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Paciente / Contato" style="font-weight: 500;">${log.guestName || 'Um paciente'}</td>
                <td data-label="Status do Retorno"><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza KPIs
        if (kpiCliques) kpiCliques.textContent = totalCliques;
        if (kpiFechados) kpiFechados.textContent = negociosFechados;
        
        if (kpiConversao) {
            const taxa = totalCliques > 0 ? Math.round((negociosFechados / totalCliques) * 100) : 0;
            kpiConversao.textContent = `${taxa}%`;
        }
    }
})();
