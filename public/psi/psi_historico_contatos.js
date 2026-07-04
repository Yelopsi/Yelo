// Arquivo: psi_historico_contatos.js
// Responsável por carregar o histórico de contatos do WhatsApp do psicólogo logado.

window.loadContactHistory = async function() {
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
        if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: red;">Erro ao carregar os dados.</td></tr>`;
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
            if (log.contactReceived === true) mensagensRecebidas++;
            if (log.dealClosed === 'yes' || log.dealClosed === 'started') negociosFechados++;

            const dataFormatada = new Date(log.createdAt).toLocaleDateString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            // Determinar badge
            let badgeClass = 'pendente';
            let badgeText = 'Pendente de Feedback';

            if (log.feedbackGiven) {
                if (log.dealClosed === 'yes' || log.dealClosed === 'started') {
                    badgeClass = 'fechado';
                    badgeText = '✅ Fechou Negócio';
                } else if (log.dealClosed === 'talking') {
                    badgeClass = 'pendente';
                    badgeText = '⏳ Em negociação';
                } else if (log.dealClosed === 'not_started' || log.dealClosed === 'ghosted' || log.dealClosed === 'no') {
                    badgeClass = 'nao-fechado';
                    badgeText = '❌ Não Fechou';
                } else if (!log.contactReceived || log.dealClosed === 'no_contact' || log.dealClosed === 'wpp_issue' || log.dealClosed === 'unknown') {
                    badgeClass = 'fantasma';
                    badgeText = '👻 Paciente Fantasma';
                } else {
                    badgeClass = 'pendente';
                    badgeText = 'Feedback Registrado';
                }
            }

            let actionBtn = '';
            
            // Lógica de proteção de indicadores: Não permite reverter um fechamento.
            if (log.dealClosed !== 'yes' && log.dealClosed !== 'started') {
                
                const isFantasma = (!log.contactReceived || log.dealClosed === 'no_contact' || log.dealClosed === 'wpp_issue' || log.dealClosed === 'unknown');
                const isNaoFechou = (log.dealClosed === 'not_started' || log.dealClosed === 'ghosted' || log.dealClosed === 'no');
                const isTalking = (log.dealClosed === 'talking');

                if (isFantasma) {
                    actionBtn += `<button onclick="window.updateStatus('${log.id}', true, 'talking')" style="margin-left: 10px; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; border-radius: 50px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">💬 Retornou!</button>`;
                }
                
                if (isNaoFechou) {
                    actionBtn += `<button onclick="window.updateStatus('${log.id}', true, 'started')" style="margin-left: 10px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 50px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">✅ Mudou de Ideia!</button>`;
                }

                if (isTalking) {
                    actionBtn += `<button onclick="window.updateStatus('${log.id}', true, 'not_started')" style="margin-left: 10px; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; border-radius: 50px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">❌ Desistiu</button>`;
                    actionBtn += `<button onclick="window.updateStatus('${log.id}', true, 'started')" style="margin-left: 5px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 50px; padding: 4px 12px; font-size: 0.75rem; font-weight: 600; cursor: pointer;">✅ Fechamos!</button>`;
                }
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Paciente / Contato" style="font-weight: 500;">${log.guestName || 'Um paciente'}</td>
                <td data-label="Status do Retorno"><span class="status-badge ${badgeClass}">${badgeText}</span>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });

        // Atualiza KPIs
        if (kpiCliques) kpiCliques.textContent = totalCliques;
        if (kpiRecebidos) kpiRecebidos.textContent = mensagensRecebidas;
        if (kpiFechados) kpiFechados.textContent = negociosFechados;
        
        if (kpiConversao) {
            // A taxa de conversão agora é calculada sobre os contatos reais recebidos, não sobre os cliques!
            const taxa = mensagensRecebidas > 0 ? Math.round((negociosFechados / mensagensRecebidas) * 100) : 0;
            kpiConversao.textContent = `${taxa}%`;
        }
    }
};

window.updateStatus = async function(id, contact_received, deal_closed) {
    let msg = 'Tem certeza que deseja atualizar o status desse paciente?';
    if (deal_closed === 'started') msg = 'Parabéns! Deseja confirmar que este paciente Fechou Negócio? Seus indicadores vão subir!';
    if (deal_closed === 'not_started') msg = 'Tem certeza que deseja dar baixa nesse paciente? Ele sairá da negociação.';
    if (deal_closed === 'talking') msg = 'Ótimo! O paciente mandou mensagem. Deseja movê-lo para Em Negociação?';

    if (!confirm(msg)) return;

    try {
        const token = localStorage.getItem('Yelo_token');
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/whatsapp-feedback`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                clickLogId: id,
                contact_received: contact_received,
                deal_closed: deal_closed
            })
        });
        
        if (res.ok) {
            if (window.showToast) window.showToast('Status atualizado com sucesso!', 'success');
            window.loadContactHistory(); // recarrega a tabela e KPIs
        } else {
            if (window.showToast) window.showToast('Erro ao atualizar. Tente novamente.', 'error');
        }
    } catch(err) {
        console.error(err);
        if (window.showToast) window.showToast('Erro de conexão.', 'error');
    }
}

// Inicia a carga inicial
window.loadContactHistory();
