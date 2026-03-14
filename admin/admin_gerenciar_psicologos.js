// Este arquivo é carregado dinamicamente por admin.js quando a página de Gestão de Psis é acessada.

window.initializePage = function() {
    console.log("Página de Gestão de Psicólogos Inicializada.");

    const tableBody = document.getElementById('psychologists-table-body');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const planoFilter = document.getElementById('plano-filter');
    let searchTimeout;

    // Função para buscar e renderizar os dados
    async function fetchAndRenderPsychologists(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px;">Carregando...</td></tr>`;

        const searchTerm = searchInput.value;
        const status = statusFilter.value;
        const plano = planoFilter.value;

        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/admin/psychologists?page=${page}&search=${searchTerm}&status=${status}&plano=${plano}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const { data, totalPages, currentPage } = await response.json();
            renderTable(data);
            renderPagination(totalPages, currentPage);

        } catch (error) {
            console.error("Erro ao buscar psicólogos:", error);
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: red;">Erro ao carregar dados.</td></tr>`;
        }
    }

    // Função para renderizar a tabela
    function renderTable(psychologists) {
        tableBody.innerHTML = '';
        if (psychologists.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px;">Nenhum psicólogo encontrado.</td></tr>`;
            return;
        }

        psychologists.forEach(psy => {
            const isVip = psy.is_exempt === true;
            const isDeleted = psy.deletedAt !== null && psy.deletedAt !== undefined;
            const statusLabel = isDeleted ? 'excluído' : (psy.status || 'inativo');
            const statusClass = isDeleted ? 'status-cancelada' : `status-${psy.status || 'inactive'}`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Nome">
                    <a href="#" onclick="navigateToPage('admin_detalhes_psicologo.html?id=${psy.id}'); return false;" style="font-weight: 600; color: #1B4332; text-decoration: underline; cursor: pointer;">
                        ${psy.nome}
                    </a>
                </td>
                <td data-label="Email">${psy.email}</td>
                <td data-label="Status"><span class="status ${statusClass}">${statusLabel}</span></td>
                <td data-label="Plano">${psy.plano || 'Nenhum'}</td>
                <td data-label="Status VIP">
                    <button class="btn-vip-toggle ${isVip ? 'active' : ''}" data-id="${psy.id}" ${isDeleted ? 'disabled' : ''}>
                        ${isVip ? '💎 VIP' : (isDeleted ? 'Inativo' : 'Tornar VIP')}
                    </button>
                </td>
                <td data-label="Ações">
                    <button class="btn-tabela" onclick="navigateToPage('admin_detalhes_psicologo.html?id=${psy.id}')">Detalhes</button>
                    ${isDeleted ? `<span style="font-size:0.85rem; color:#999; margin-left:10px;">Na Lixeira</span>` : `<button class="btn-tabela btn-tabela-perigo btn-delete-psy" data-id="${psy.id}" data-name="${psy.nome}">Excluir</button>`}
                </td>
            `;
            tableBody.appendChild(row);
        });

        setupVipButtons();
        setupDeleteButtons();
    }

    // Função para configurar os botões VIP
    function setupVipButtons() {
        document.querySelectorAll('.btn-vip-toggle').forEach(button => {
            // Remove listener antigo para evitar duplicação
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function() {
                const psychologistId = this.dataset.id;
                const row = this.closest('tr');
                const psychologistName = row.querySelector('td[data-label="Nome"]').textContent;
                const isExempt = this.classList.contains('active');
                const currentPlan = row.querySelector('td[data-label="Plano"]').textContent;
                
                window.openVipModal({
                    id: psychologistId,
                    nome: psychologistName,
                    is_exempt: isExempt,
                    plano: isExempt && currentPlan !== 'Nenhum' ? currentPlan : null
                });
            });
        });
    }

    // Função para configurar os botões de Excluir
    function setupDeleteButtons() {
        document.querySelectorAll('.btn-delete-psy').forEach(button => {
            // Remove listener antigo para evitar duplicação
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            newButton.addEventListener('click', function() {
                const id = this.dataset.id;
                const name = this.dataset.name;

                // Usa o modal global definido em admin.js
                window.openConfirmationModal(
                    'Excluir Profissional',
                    `Tem certeza que deseja excluir o psicólogo <strong>${name}</strong>?<br><br>Esta ação removerá o perfil e todos os dados associados permanentemente.`,
                    () => deletePsychologist(id)
                );
            });
        });
    }

    // Função para chamar a API de exclusão
    async function deletePsychologist(id) {
        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                window.showToast('Psicólogo excluído com sucesso.', 'success');
                fetchAndRenderPsychologists(); // Recarrega a tabela
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Erro ao excluir.');
            }
        } catch (error) {
            window.showToast(error.message, 'error');
        }
    }

    // Função de paginação
    function renderPagination(totalPages, currentPage) {
        const container = document.getElementById('pagination-container');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        html += `<button class="pagination-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        html += `<button class="pagination-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
        container.innerHTML = html;

        container.querySelectorAll('.pagination-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                fetchAndRenderPsychologists(parseInt(btn.getAttribute('data-page'), 10));
            });
        });
    }

    // Listeners para os filtros
    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAndRenderPsychologists(1), 500);
    });
    statusFilter.addEventListener('change', () => fetchAndRenderPsychologists(1));
    planoFilter.addEventListener('change', () => fetchAndRenderPsychologists(1));

    // Carga inicial
    fetchAndRenderPsychologists();

    // Define a função de recarga que será usada pelo listener
    const handleVipUpdate = () => {
        console.log("Evento 'vipStatusUpdated' recebido. Recarregando a lista de psicólogos.");
        fetchAndRenderPsychologists();
    };

    // Ouve o evento de atualização do status VIP para recarregar a lista
    window.addEventListener('vipStatusUpdated', handleVipUpdate);

    // Define a função de limpeza que será chamada ao navegar para outra página
    window.cleanupPage = function() {
        console.log("Limpando listener 'vipStatusUpdated' da página de gestão.");
        window.removeEventListener('vipStatusUpdated', handleVipUpdate);
    };
};