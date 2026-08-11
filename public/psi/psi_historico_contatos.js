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
            
            let badgeStyle = '';
            let clickAction = '';
            
            // Lógica de proteção de indicadores: Não permite reverter um fechamento.
            // Só permite alterar se o feedback inicial já foi dado (modal principal)
            if (log.feedbackGiven && log.dealClosed !== 'yes' && log.dealClosed !== 'started') {
                badgeClass += ' clickable';
                badgeStyle = 'title="Clique para atualizar status"';
                clickAction = `onclick="window.abrirModalStatus('${log.id}', ${log.contactReceived}, '${log.dealClosed}')"`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Paciente / Contato" style="font-weight: 500;">${log.guestName || 'Um paciente'}</td>
                <td data-label="Status do Retorno"><span class="status-badge ${badgeClass}" ${badgeStyle} ${clickAction}>${badgeText}</span></td>
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

window.abrirModalStatus = function(id, contact_received, deal_closed) {
    const modal = document.getElementById('yelo-status-modal');
    const container = document.getElementById('yelo-modal-options-container');
    container.innerHTML = '';

    const isFantasma = (!contact_received || deal_closed === 'no_contact' || deal_closed === 'wpp_issue' || deal_closed === 'unknown');
    const isNaoFechou = (deal_closed === 'not_started' || deal_closed === 'ghosted' || deal_closed === 'no');
    const isTalking = (deal_closed === 'talking');

    if (isFantasma) {
        container.innerHTML += `<button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'talking')">💬 Retornou o contato!</button>`;
    }
    
    if (isNaoFechou) {
        container.innerHTML += `<button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'started')">✅ Mudou de Ideia e Fechou!</button>`;
    }

    if (isTalking) {
        container.innerHTML += `<button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'started')">✅ Fechamos Negócio!</button>`;
        container.innerHTML += `<button class="yelo-modal-btn" onclick="window.showHistoricoStep3('${id}')">❌ Paciente Desistiu</button>`;
        
        container.innerHTML += `
            <div id="historico-step3-${id}" style="display:none; flex-direction:column; gap:10px; margin-top:10px;">
                <p style="margin: 0 0 5px 0; font-size: 0.9rem; color: #444; font-weight: bold; text-align: center;">Qual o motivo?</p>
                <button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'not_started_price')">💰 Preço incompatível</button>
                <button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'not_started_schedule')">⏰ Horário incompatível</button>
                <button class="yelo-modal-btn" onclick="window.updateStatus('${id}', true, 'not_started_other')">🤷‍♂️ Outro motivo</button>
            </div>
        `;
    }

    window.showHistoricoStep3 = function(logId) {
        document.getElementById(`historico-step3-${logId}`).style.display = 'flex';
    };

    modal.style.display = 'flex';
};

window.updateStatus = async function(id, contact_received, deal_closed) {
    fecharModalStatus(); // From the HTML script block
    try {
        const token = localStorage.getItem('Yelo_token');
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
        const res = await window.apiFetch(`${API_BASE_URL}/api/psychologists/me/whatsapp-feedback`, {
            method: 'POST', // Mudado de PUT para POST para corrigir o 404
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
