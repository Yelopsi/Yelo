// Lógica para a página de Lista de Espera

window.initializePage = function() {
    const tableBody = document.getElementById('waiting-list-body');
    const rowTemplate = document.getElementById('waiting-list-row-template');
    const token = localStorage.getItem('Yelo_token'); // Supondo que o token de admin esteja salvo

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
        button.innerHTML = '<span class="loading-spinner-sm"></span> Enviando...';

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
            button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> Convidar`;
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
                row.querySelector('[data-label="Nome"]').innerHTML = `
                    <div style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                            ${candidate.nome.charAt(0).toUpperCase()}
                        </div>
                        <span>${candidate.nome}</span>
                    </div>
                `;
                row.querySelector('[data-label="Email"]').innerHTML = `<span style="color: #555;">${candidate.email}</span>`;
                row.querySelector('[data-label="CRP"]').innerHTML = `<span style="color: #666; font-size: 0.9rem;">${candidate.crp || 'N/A'}</span>`;
                
                const statusBadge = row.querySelector('.status-badge');
                statusBadge.textContent = candidate.status === 'pending' ? 'Pendente' : (candidate.status === 'invited' ? 'Convidado' : candidate.status);
                statusBadge.className = `status status-${candidate.status === 'invited' ? 'ativo' : 'pendente'}`;

                row.querySelector('[data-label="Data de Entrada"]').innerHTML = `<span style="color: #666; font-size: 0.9rem;">${new Date(candidate.createdAt).toLocaleDateString('pt-BR')}</span>`;

                const actionsCell = row.querySelector('[data-label="Ações"]');
                if (candidate.status === 'pending' || candidate.status === 'invited') {
                    const inviteButton = document.createElement('button');
                    inviteButton.className = 'btn-tabela btn-fixar';
                    inviteButton.style.display = 'inline-flex';
                    inviteButton.style.alignItems = 'center';
                    inviteButton.style.gap = '5px';
                    inviteButton.style.padding = '6px 12px';
                    inviteButton.style.borderRadius = '20px';
                    inviteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg> ${candidate.status === 'invited' ? 'Reenviar Convite' : 'Convidar'}`;
                    inviteButton.onclick = () => sendInvitation(candidate.id, inviteButton);
                    actionsCell.appendChild(inviteButton);
                } else {
                    actionsCell.innerHTML = '<span style="color: #999; font-size: 0.85rem;">Já cadastrado</span>';
                }

                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--coral-quente);">${error.message}</td></tr>`;
        }
    }

    fetchWaitingList();
};