window.initializePage = function() {
    const tableBody = document.getElementById('patients-table-body');
    const rowTemplate = document.getElementById('patient-row-template');
    const token = localStorage.getItem('Yelo_token');

    // Configuração da API
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';

    if (!tableBody || !rowTemplate || !token) {
        console.error("Elementos essenciais ou token não encontrados.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="5" class="error-row">Erro ao carregar a página.</td></tr>';
        return;
    }

    // --- 1. LÓGICA DE BUSCA ---
    const searchInput = document.querySelector('.campo-busca');
    let debounceTimer;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchPatients(searchInput.value), 500);
        });
    }

    async function fetchPatients(search = '') {
        try {
            const url = `${API_BASE_URL}/api/admin/patients?search=${encodeURIComponent(search)}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar dados dos pacientes.');
            }

            const result = await response.json();
            // O backend retorna objeto paginado { data: [...] }, extraímos o array
            renderTable(result.data || []);

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="5" class="error-row">${error.message}</td></tr>`;
        }
    }

    function renderTable(patients) {
        tableBody.innerHTML = '';

        if (patients.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum paciente encontrado.</td></tr>';
            return;
        }

        patients.forEach(patient => {
            const row = rowTemplate.content.cloneNode(true).querySelector('tr');

            row.querySelector('[data-label="Nome"]').innerHTML = `
                <div style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center; gap: 8px;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                        ${patient.nome.charAt(0).toUpperCase()}
                    </div>
                    <span>${patient.nome}</span>
                </div>
            `;
            row.querySelector('[data-label="E-mail"]').innerHTML = `<span style="color: #555;">${patient.email}</span>`;
            row.querySelector('[data-label="Data de Cadastro"]').innerHTML = `<span style="color: #666; font-size: 0.9rem;">${new Date(patient.createdAt).toLocaleDateString('pt-BR')}</span>`;

            const statusCell = row.querySelector('[data-label="Status"] .status');
            const status = patient.status || 'active'; 
            statusCell.textContent = status === 'active' ? 'Ativo' : 'Inativo';
            statusCell.className = `status status-${status === 'active' ? 'ativo' : 'inativo'}`;

            const actionsCell = row.querySelector('[data-label="Ações"]');
            actionsCell.style.whiteSpace = 'nowrap';
            actionsCell.innerHTML = `
                <button class="btn-tabela btn-details" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    Detalhes
                </button>
                <button class="btn-tabela btn-suspend" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    ${status === 'active' ? 'Suspender' : 'Ativar'}
                </button>
                <button class="btn-tabela btn-tabela-perigo btn-delete" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    Excluir
                </button>
            `;

            // --- 2. BOTÃO VER DETALHES ---
            actionsCell.querySelector('.btn-details').addEventListener('click', () => {
                const details = `
                    <p><strong>Nome:</strong> ${patient.nome}</p>
                    <p><strong>Email:</strong> ${patient.email}</p>
                    <p><strong>Telefone:</strong> ${patient.telefone || 'Não informado'}</p>
                    <p><strong>Idade:</strong> ${patient.faixa_etaria || '-'}</p>
                    <p><strong>Gênero:</strong> ${patient.identidade_genero || '-'}</p>
                    <p><strong>Preferência Profissional:</strong> ${patient.genero_profissional || '-'}</p>
                    <p><strong>Cadastrado em:</strong> ${new Date(patient.createdAt).toLocaleString('pt-BR')}</p>
                `;
                if (window.openConfirmationModal) {
                    // Reutiliza o modal global apenas para exibir (o callback vazio fecha o modal)
                    window.openConfirmationModal('Detalhes do Paciente', details, () => {});
                } else {
                    alert(`Detalhes:\nNome: ${patient.nome}\nEmail: ${patient.email}\nTelefone: ${patient.telefone}`);
                }
            });

            // --- 3. BOTÃO SUSPENDER/ATIVAR ---
            actionsCell.querySelector('.btn-suspend').addEventListener('click', () => {
                const newStatus = status === 'active' ? 'inactive' : 'active';
                const actionText = status === 'active' ? 'suspender' : 'ativar';

                const executeSuspend = async () => {
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/admin/patients/${patient.id}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ status: newStatus })
                        });
                        if (res.ok) {
                            fetchPatients(searchInput ? searchInput.value : '');
                            if (window.showToast) window.showToast(`Paciente ${newStatus === 'active' ? 'ativado' : 'suspenso'} com sucesso.`);
                        } else { alert('Erro ao alterar status.'); }
                    } catch (e) { console.error(e); }
                };

                if (window.openConfirmationModal) window.openConfirmationModal('Alterar Status', `Deseja ${actionText} o paciente <b>${patient.nome}</b>?`, executeSuspend);
                else if (confirm(`Deseja ${actionText} ${patient.nome}?`)) executeSuspend();
            });

            // Lógica do Botão Excluir
            const btnDelete = actionsCell.querySelector('.btn-delete');
            btnDelete.addEventListener('click', () => {
                const executeDelete = async () => {
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/admin/patients/${patient.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (response.ok) {
                            row.remove();
                            if (window.showToast) window.showToast('Usuário excluído com sucesso.');
                        } else {
                            alert('Erro ao excluir usuário.');
                        }
                    } catch (error) {
                        console.error(error);
                        alert('Erro de conexão.');
                    }
                };

                if (window.openConfirmationModal) {
                    window.openConfirmationModal('Excluir Usuário', `Tem certeza que deseja excluir <b>${patient.nome}</b>?`, executeDelete);
                } else {
                    if (confirm(`Excluir ${patient.nome}?`)) executeDelete();
                }
            });

            tableBody.appendChild(row);
        });
    }

    fetchPatients();
};