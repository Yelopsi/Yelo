// admin/admin_verificacoes.js

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('verifications-table-body');
    const emptyState = document.getElementById('verifications-empty-state');
    const modal = document.getElementById('document-viewer-modal');
    const modalContent = document.getElementById('document-viewer-content');
    const modalCloseButtons = modal.querySelectorAll('.modal-close, .modal-cancel');

    // Elementos do novo modal de rejeição
    const rejectionModal = document.getElementById('rejection-reason-modal');
    const rejectionTextarea = document.getElementById('rejection-reason-textarea');
    const confirmRejectionBtn = document.getElementById('confirm-rejection-btn');

    // Função para buscar os dados da API
    async function fetchPendingVerifications() {
        try {
            const token = localStorage.getItem('girassol_token_admin');
            const response = await fetch('/api/admin/verifications', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const verifications = await response.json();
            renderTable(verifications);

        } catch (error) {
            console.error("Erro:", error);
            tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: red;">Erro ao carregar dados.</td></tr>`;
        }
    }

    // Função para renderizar a tabela
    function renderTable(verifications) {
        if (verifications.length === 0) {
            emptyState.style.display = 'block';
            tableBody.parentElement.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        tableBody.parentElement.style.display = 'table';
        tableBody.innerHTML = '';

        verifications.forEach(psy => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="user-cell">
                        <strong>${psy.nome}</strong>
                        <span>${psy.email}</span>
                    </div>
                </td>
                <td>${psy.crp}</td>
                <td>${new Date(psy.createdAt).toLocaleDateString('pt-BR')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action view" data-url="${psy.crpDocumentUrl}">Ver Doc</button>
                        <button class="btn-action approve" data-id="${psy.id}">Aprovar</button>
                        <button class="btn-action reject" data-id="${psy.id}">Rejeitar</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // Função para moderar (aprovar/rejeitar)
    async function moderatePsychologist(id, action, reason = null) {
        const payload = { action };
        if (reason) {
            payload.reason = reason;
        }

        try {
            const token = localStorage.getItem('girassol_token_admin');
            const response = await fetch(`/api/admin/psychologists/${id}/moderate`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Falha na moderação.');

            alert(`Profissional ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso!`);
            fetchPendingVerifications(); // Recarrega a lista

        } catch (error) {
            console.error("Erro na moderação:", error);
            alert('Ocorreu um erro ao processar a ação.');
        }
    }

    // Função para abrir o modal de rejeição
    function openRejectionModal(psychologistId) {
        rejectionModal.classList.add('is-visible');
        rejectionTextarea.value = ''; // Limpa o campo

        // Adiciona um listener de clique que só funciona uma vez
        confirmRejectionBtn.onclick = () => {
            const reason = rejectionTextarea.value.trim();
            if (!reason) {
                alert('Por favor, forneça um motivo para a rejeição.');
                return;
            }
            moderatePsychologist(psychologistId, 'reject', reason);
            rejectionModal.classList.remove('is-visible');
        };
    }

    // Eventos para fechar o modal de rejeição
    rejectionModal.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => btn.addEventListener('click', () => rejectionModal.classList.remove('is-visible')));
    rejectionModal.addEventListener('click', (e) => { if (e.target === rejectionModal) rejectionModal.classList.remove('is-visible'); });

    // Adiciona os event listeners na tabela
    tableBody.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('view')) {
            const url = target.dataset.url;
            // Verifica se é um PDF para usar iframe, senão usa img
            if (url.toLowerCase().endsWith('.pdf')) {
                modalContent.innerHTML = `<iframe src="${url}" width="100%" height="600px" style="border:none;"></iframe>`;
            } else {
                modalContent.innerHTML = `<img src="${url}" style="max-width:100%; height:auto;">`;
            }
            modal.classList.add('is-visible');
        } else if (target.classList.contains('approve')) {
            if (confirm('Tem certeza que deseja APROVAR este profissional?')) moderatePsychologist(target.dataset.id, 'approve');
        } else if (target.classList.contains('reject')) {
            openRejectionModal(target.dataset.id);
        }
    });

    // Eventos para fechar o modal
    modalCloseButtons.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('is-visible')));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('is-visible'); });

    // Inicia o carregamento dos dados
    fetchPendingVerifications();
});