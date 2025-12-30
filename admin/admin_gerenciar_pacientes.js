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

            row.querySelector('[data-label="Nome"]').textContent = patient.nome;
            row.querySelector('[data-label="E-mail"]').textContent = patient.email;
            row.querySelector('[data-label="Data de Cadastro"]').textContent = new Date(patient.createdAt).toLocaleDateString('pt-BR');

            const statusCell = row.querySelector('[data-label="Status"] .status');
            const status = patient.status || 'active'; 
            statusCell.textContent = status === 'active' ? 'Ativo' : 'Inativo';
            statusCell.className = `status status-${status === 'active' ? 'ativo' : 'inativo'}`;

            const actionsCell = row.querySelector('[data-label="Ações"]');
            actionsCell.innerHTML = `
                <button class="btn-tabela btn-details">Ver Detalhes</button>
                <button class="btn-tabela btn-suspend">${status === 'active' ? 'Suspender' : 'Ativar'}</button>
                <button class="btn-tabela btn-tabela-perigo btn-delete">Excluir</button>
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