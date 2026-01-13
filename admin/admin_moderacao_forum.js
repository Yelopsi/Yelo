window.initializePage = function() {

    // Expõe a função de recarregar no escopo global para o botão
    window.carregarDenuncias = fetchAndRenderReports;

    fetchAndRenderReports();
};

async function fetchAndRenderReports() {
    const tableBody = document.getElementById('lista-denuncias');
    const emptyState = document.getElementById('empty-state-reports');
    if (!tableBody || !emptyState) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px;">Carregando denúncias...</td></tr>`;
    emptyState.style.display = 'none';

    try {
        const token = localStorage.getItem('Yelo_token');
        const response = await fetch(`${API_BASE_URL}/api/admin/forum/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Falha ao buscar denúncias.');

        const reports = await response.json();
        renderTable(reports);

    } catch (error) {
        console.error("Erro ao buscar denúncias:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: red;">Erro ao carregar dados.</td></tr>`;
    }
}

function renderTable(reports) {
    const tableBody = document.getElementById('lista-denuncias');
    const emptyState = document.getElementById('empty-state-reports');
    tableBody.innerHTML = '';

    if (reports.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    emptyState.style.display = 'none';

    reports.forEach(report => {
        const row = document.createElement('tr');
        
        const reportDate = new Date(report.firstReportDate).toLocaleDateString('pt-BR');
        const contentType = report.contentType === 'post' ? 'Tópico' : 'Comentário';
        
        let statusHtml = '';
        let actionsHtml = '';

        switch (report.contentStatus) {
            case 'active':
            case 'pending':
                statusHtml = `<span class="status status-pending">Pendente</span>`;
                actionsHtml = `
                    <button class="btn-tabela btn-aprovar" onclick="handleModeration('${report.contentType}', ${report.contentId}, 'approve')">Manter</button>
                    <button class="btn-tabela btn-reprovar" onclick="handleModeration('${report.contentType}', ${report.contentId}, 'remove')">Remover</button>
                    <button class="btn-tabela" onclick="viewReportDetails(${JSON.stringify(report).replace(/"/g, '&quot;')})">Detalhes</button>
                `;
                break;
            case 'hidden_by_admin':
                statusHtml = `<span class="status status-inactive">Removido</span>`;
                actionsHtml = `<span>Ação Concluída</span>`;
                break;
            case 'approved_by_admin':
                 statusHtml = `<span class="status status-active">Mantido</span>`;
                 actionsHtml = `<span>Ação Concluída</span>`;
                 break;
            default:
                statusHtml = `<span class="status">${report.contentStatus}</span>`;
                actionsHtml = `<span>-</span>`;
        }

        row.innerHTML = `
            <td data-label="Data">${reportDate}</td>
            <td data-label="Tipo">${contentType}</td>
            <td data-label="Autor do Conteúdo">${report.authorName || 'Desconhecido'}</td>
            <td data-label="Denúncias"><span class="badge-count">${report.reportCount}</span></td>
            <td data-label="Status">${statusHtml}</td>
            <td data-label="Ações">${actionsHtml}</td>
        `;
        tableBody.appendChild(row);
    });

    window.handleModeration = handleModeration;
    window.viewReportDetails = viewReportDetails;
}

function viewReportDetails(report) {
    if (window.openReportModal) {
        window.openReportModal({
            title: `Denúncia em ${report.contentType === 'post' ? 'Tópico' : 'Comentário'}`,
            content: report.contentText,
            author: report.authorName,
            reason: 'Múltiplas denúncias',
            count: report.reportCount,
            isHtml: false,
            actionLabel: 'Remover Conteúdo',
            onAction: () => handleModeration(report.contentType, report.contentId, 'remove')
        });
    } else {
        alert('Função de modal não encontrada.');
    }
}

async function handleModeration(contentType, contentId, action) {
    const actionText = action === 'approve' ? 'manter' : 'remover';
    
    window.openConfirmationModal(
        `Confirmar Moderação`,
        `Tem certeza que deseja <strong>${actionText}</strong> este conteúdo?`,
        async () => {
            try {
                const token = localStorage.getItem('Yelo_token');
                const response = await fetch(`${API_BASE_URL}/api/admin/forum/moderate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ contentType, contentId, action }) });
                if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Falha ao moderar.'); }
                const result = await response.json();
                showToast(result.message, 'success');
                fetchAndRenderReports();
            } catch (error) { showToast(error.message, 'error'); }
        }
    );
}