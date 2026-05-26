window.initializePage = function() {
    console.log("Página de Gestão de Pacientes Inicializada.");

    const tableBody = document.getElementById('patients-table-body');
    const searchInput = document.getElementById('search-input');
    let searchTimeout;

    async function fetchAndRenderPatients(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="6" class="loading-row" style="text-align: center; padding: 40px; color: var(--cinza-texto);"><span class="loading-spinner-sm"></span> Carregando pacientes...</td></tr>`;

        const searchTerm = searchInput.value;
        const params = new URLSearchParams(window.pageQueryString);
        const status = params.get('status') || '';

        try {
            const response = await apiFetch(`/api/admin/patients?page=${page}&search=${searchTerm}&status=${status}`);
            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const { data, totalPages, currentPage } = await response.json();
            renderTable(data);
            renderPagination(totalPages, currentPage);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" class="error-row" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar dados.</td></tr>`;
        }
    }

    function renderTable(patients) {
        tableBody.innerHTML = '';
        if (patients.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" class="empty-row" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhum paciente encontrado.</td></tr>`;
            return;
        }

        patients.forEach(patient => {
            const isDeleted = patient.deletedAt !== null && patient.deletedAt !== undefined;
            const dataCadastro = new Date(patient.createdAt).toLocaleDateString('pt-BR');
            
            const nameMatch = patient.nome.match(/\[ID: (\d+)\] (.*)/);
            const patientId = nameMatch ? nameMatch[1] : patient.id;
            const patientName = nameMatch ? nameMatch[2].trim() : patient.nome;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="ID"><strong>${patientId}</strong></td>
                <td data-label="Nome">${patientName}</td>
                <td data-label="E-mail">${patient.email}</td>
                <td data-label="Cadastro">${dataCadastro}</td>
                <td data-label="Status"><span class="status ${isDeleted ? 'status-inactive' : 'status-active'}">${isDeleted ? 'Na Lixeira' : 'Ativo'}</span></td>
                <td data-label="Ações" style="white-space: nowrap;">
                    ${isDeleted 
                        ? `
                            <button class="btn-tabela btn-restore" data-id="${patientId}" title="Restaurar Paciente">Restaurar</button>
                            <button class="btn-tabela btn-tabela-perigo btn-force-delete" data-id="${patientId}" data-name="${patientName}" title="Excluir Permanentemente">Excluir Perm.</button>
                        ` 
                        : `
                            <button class="btn-tabela btn-tabela-perigo btn-delete" data-id="${patientId}" data-name="${patientName}" title="Mover para Lixeira">Excluir</button>
                        `
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });

        setupActionButtons();
    }

    function setupActionButtons() {
        tableBody.querySelectorAll('.btn-delete').forEach(button => {
            button.onclick = function() {
                const id = this.dataset.id;
                const name = this.dataset.name;
                window.openConfirmationModal('Mover para Lixeira', `Tem certeza que deseja mover o paciente <strong>${name}</strong> para a lixeira?`, () => softDeletePatient(id));
            };
        });

        tableBody.querySelectorAll('.btn-force-delete').forEach(button => {
            button.onclick = function() {
                const id = this.dataset.id;
                const name = this.dataset.name;
                window.openConfirmationModal('Excluir PERMANENTEMENTE', `Esta ação é irreversível. Tem certeza que deseja apagar todos os dados do paciente <strong>${name}</strong>?`, () => forceDeletePatient(id));
            };
        });

        tableBody.querySelectorAll('.btn-restore').forEach(button => {
            button.onclick = function() {
                restorePatient(this.dataset.id);
            };
        });
    }

    async function softDeletePatient(id) {
        try {
            const res = await apiFetch(`/api/admin/patients/${id}`, { method: 'DELETE' });
            if (res.ok) {
                window.showToast('Paciente movido para a lixeira.', 'success');
                fetchAndRenderPatients(new URLSearchParams(window.pageQueryString).get('page') || 1);
            } else throw new Error('Falha ao mover para lixeira.');
        } catch (error) { window.showToast(error.message, 'error'); }
    }

    async function forceDeletePatient(id) {
        try {
            const res = await apiFetch(`/api/admin/patients/${id}/force`, { method: 'DELETE' });
            if (res.ok) {
                window.showToast('Paciente excluído permanentemente.', 'success');
                fetchAndRenderPatients(new URLSearchParams(window.pageQueryString).get('page') || 1);
            } else throw new Error('Falha ao excluir permanentemente.');
        } catch (error) { window.showToast(error.message, 'error'); }
    }

    async function restorePatient(id) {
        try {
            const res = await apiFetch(`/api/admin/patients/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'active' }) });
            if (res.ok) {
                window.showToast('Paciente restaurado com sucesso.', 'success');
                fetchAndRenderPatients(new URLSearchParams(window.pageQueryString).get('page') || 1);
            } else throw new Error('Falha ao restaurar.');
        } catch (error) { window.showToast(error.message, 'error'); }
    }

    function renderPagination(totalPages, currentPage) {
        const container = document.getElementById('pagination-container');
        if (!container) return;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        const createBtn = (page, text, disabled = false) => {
            const btn = document.createElement('button');
            btn.className = `pagination-btn ${page === currentPage ? 'active' : ''}`;
            btn.innerHTML = text;
            btn.dataset.page = page;
            btn.disabled = disabled;
            btn.onclick = () => fetchAndRenderPatients(page);
            return btn;
        };

        container.appendChild(createBtn(currentPage - 1, '&laquo;', currentPage === 1));

        // Lógica para exibir páginas (simplificada)
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                container.appendChild(createBtn(i, i));
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '8px 12px';
                container.appendChild(dots);
            }
        }

        container.appendChild(createBtn(currentPage + 1, '&raquo;', currentPage === totalPages));
    }

    // Listeners
    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAndRenderPatients(1), 500);
    });

    // Carga inicial
    fetchAndRenderPatients();
};