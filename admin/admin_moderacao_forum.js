// admin/admin_moderacao_forum.js

window.initializePage = function() {
    const tbody = document.getElementById('lista-denuncias');
    const emptyState = document.getElementById('empty-state-reports');
    const token = localStorage.getItem('Yelo_token');

    async function carregarDenuncias() {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Carregando...</td></tr>';
        emptyState.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/forum/reports`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar denúncias.');
            }

            const reports = await response.json();
            renderReports(reports);

        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: red;">${error.message}</td></tr>`;
        }
    }

    function renderReports(reports) {
        tbody.innerHTML = '';
        if (reports.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        reports.forEach(report => {
            const tr = document.createElement('tr');
            const statusClass = report.contentStatus.includes('hidden') ? 'status-inactive' : 'status-pending';
            const statusText = report.contentStatus.includes('hidden') ? 'Removido' : 'Pendente';

            const pinButtonHTML = report.contentType === 'post' ? `
                <button 
                  class="btn-tabela btn-fixar ${report.isPinned ? 'pinned' : ''}" 
                  onclick="togglePinPost('${report.contentId}', ${report.isPinned})">
                  <span>${report.isPinned ? 'Desafixar' : 'Fixar'}</span>
                </button>
            ` : '';

            tr.innerHTML = `
                <td data-label="Data">${new Date(report.firstReportDate).toLocaleDateString('pt-BR')}</td>
                <td data-label="Tipo">${report.contentType === 'post' ? 'Post' : 'Comentário'}</td>
                <td data-label="Autor">${report.authorName}</td>
                <td data-label="Denúncias"><span class="badge-count">${report.reportCount}</span></td>
                <td data-label="Status"><span class="status ${statusClass}">${statusText}</span></td>
                <td data-label="Ações">
                    <button class="btn-tabela btn-tabela-aviso" onclick="handleModerate('${report.contentType}', '${report.contentId}', 'approve')">Manter</button>
                    <button class="btn-tabela btn-tabela-perigo" onclick="handleModerate('${report.contentType}', '${report.contentId}', 'remove')">Remover</button>
                    ${pinButtonHTML}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.handleModerate = function(contentType, contentId, action) {
        const actionText = action === 'remove' ? 'remover' : 'manter';
        openConfirmationModal('Confirmar Moderação', `Você tem certeza que deseja <strong>${actionText}</strong> este conteúdo?`, async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/forum/moderate`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ contentType, contentId, action }) });
                const result = await response.json();
                if (response.ok) { showToast(result.message, 'success'); carregarDenuncias(); } else { throw new Error(result.error); }
            } catch (error) { showToast(`Erro: ${error.message}`, 'error'); }
        });
    }
    
    window.carregarDenuncias = carregarDenuncias;
    carregarDenuncias();
};