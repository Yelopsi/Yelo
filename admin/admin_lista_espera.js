// Lógica para a página de Lista de Espera

window.initializePage = function() {
    const tableBody = document.getElementById('waiting-list-body');
    const rowTemplate = document.getElementById('waiting-list-row-template');
    const token = localStorage.getItem('girassol_token'); // Supondo que o token de admin esteja salvo

    if (!tableBody || !rowTemplate || !token) {
        console.error("Elementos essenciais ou token não encontrados para a página da lista de espera.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="error-row">Erro ao carregar a página. Faça login novamente.</td></tr>';
        return;
    }

    // Função para mostrar notificações (toast)
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const template = document.getElementById('toast-template');
        if (!container || !template) return;

        const toast = template.content.cloneNode(true).querySelector('.toast');
        toast.textContent = message;
        toast.classList.add(`toast-${type}`);
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    // Função para enviar convite
    async function sendInvitation(candidateId, button) {
        button.disabled = true;
        button.textContent = 'Enviando...';

        try {
            const response = await fetch('/api/psychologists/waiting-list/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ waitingListId: candidateId })
            });

            const result = await response.json();

            if (response.ok) {
                showToast(result.message, 'success');
                fetchWaitingList(); // Recarrega a lista para mostrar o status atualizado
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }

        } catch (error) {
            showToast(`Erro ao enviar convite: ${error.message}`, 'error');
            button.disabled = false;
            button.textContent = 'Convidar';
        }
    }

    // Função para buscar e renderizar a lista
    async function fetchWaitingList() {
        try {
            const response = await fetch('/api/psychologists/waiting-list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar dados da lista de espera.');
            }

            const waitingList = await response.json();
            tableBody.innerHTML = ''; // Limpa o estado de "carregando"

            if (waitingList.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="empty-row">A lista de espera está vazia.</td></tr>';
                return;
            }

            waitingList.forEach(candidate => {
                const row = rowTemplate.content.cloneNode(true).querySelector('tr');
                row.querySelector('[data-label="Nome"]').textContent = candidate.nome;
                row.querySelector('[data-label="Email"]').textContent = candidate.email;
                row.querySelector('[data-label="CRP"]').textContent = candidate.crp || 'N/A';
                
                const statusBadge = row.querySelector('.status-badge');
                statusBadge.textContent = candidate.status;
                statusBadge.className = `status-badge status-${candidate.status}`;

                row.querySelector('[data-label="Data de Entrada"]').textContent = new Date(candidate.createdAt).toLocaleDateString('pt-BR');

                const actionsCell = row.querySelector('[data-label="Ações"]');
                if (candidate.status === 'pending') {
                    const inviteButton = document.createElement('button');
                    inviteButton.className = 'btn btn-sm btn-principal';
                    inviteButton.textContent = 'Convidar';
                    inviteButton.onclick = () => sendInvitation(candidate.id, inviteButton);
                    actionsCell.appendChild(inviteButton);
                } else {
                    actionsCell.textContent = 'N/A';
                }

                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6" class="error-row">${error.message}</td></tr>`;
        }
    }

    fetchWaitingList();
};