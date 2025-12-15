window.initializePage = function() {
    console.log("Iniciando Gerenciador de Psicólogos..."); 
    const tableBody = document.getElementById('psychologists-table-body');
    const rowTemplate = document.getElementById('psychologist-row-template');
    const token = localStorage.getItem('girassol_token');
    
    // Usa o endereço definido no config.js ou força o localhost:3001
    const API_PREFIX = (typeof API_BASE_URL !== 'undefined') 
        ? API_BASE_URL 
        : 'http://localhost:3001';
    if (!tableBody || !rowTemplate || !token) {
        console.error("Elementos essenciais ou token não encontrados.");
        if(tableBody) tableBody.innerHTML = '<tr><td colspan="7">Erro ao carregar tabela. Dê um F5.</td></tr>';
        return;
    }

    const LIMIT = 10;
    let currentPage = 1;
    let currentFilters = { search: '', status: '', plano: '' };

    // --- CORREÇÃO BLINDADA: Verifica se o Modal EXISTE VISUALMENTE ---
    function confirmarAcao(titulo, mensagem, callback) {
        const modalElement = document.getElementById('confirmation-modal'); // Procura o HTML
        
        // Só tenta abrir o modal se a função existir E o HTML estiver na página
        if (typeof window.openConfirmationModal === 'function' && modalElement) {
            window.openConfirmationModal(titulo, mensagem, callback);
        } else {
            // PLANO B: Se não achar o modal, usa o confirm nativo do navegador
            // Remove tags HTML para o texto ficar limpo no alerta padrão
            const msgTexto = mensagem.replace(/<[^>]*>/g, ''); 
            if (confirm(`${titulo}\n\n${msgTexto}`)) {
                callback();
            }
        }
    }

    async function fetchPsychologists(page = 1, filters = {}) {
        tableBody.innerHTML = '<tr><td colspan="7" class="loading-row">Carregando dados...</td></tr>';
        
        const params = new URLSearchParams();
        params.append('limit', LIMIT);
        params.append('page', page);
        if (filters.search) params.append('search', filters.search);
        if (filters.status) params.append('status', filters.status);
        if (filters.plano) params.append('plano', filters.plano);

        try {
            const response = await fetch(`${API_PREFIX}/api/admin/psychologists?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Erro na API.');
            const result = await response.json();
            renderTable(result.data);

        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `<tr><td colspan="7" class="error-row">${error.message}</td></tr>`;
        }
    }

    function renderTable(psychologists) {
        tableBody.innerHTML = ''; 

        if (!psychologists || psychologists.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="empty-row">Nenhum profissional encontrado.</td></tr>';
            return;
        }

        psychologists.forEach(psy => {
            const row = rowTemplate.content.cloneNode(true).querySelector('tr');

            row.querySelector('[data-label="Nome"]').textContent = psy.nome;
            row.querySelector('[data-label="E-mail"]').textContent = psy.email;
            row.querySelector('[data-label="CRP"]').textContent = psy.crp;
            row.querySelector('[data-label="Plano"]').textContent = psy.plano || '-';
            row.querySelector('[data-label="Cliques"]').textContent = '- / -';

            const statusCell = row.querySelector('[data-label="Status"] .status');
            statusCell.textContent = psy.status === 'active' ? 'Ativo' : (psy.status === 'inactive' ? 'Inativo' : psy.status);
            statusCell.className = `status status-${psy.status}`;

            const actionsCell = row.querySelector('[data-label="Ações"]');
            const isSuspended = psy.status === 'inactive';

            actionsCell.innerHTML = `
                <button class="btn-tabela btn-details">Ver</button>
                <button class="btn-tabela btn-suspend" style="margin: 0 5px;">${isSuspended ? 'Ativar' : 'Suspender'}</button>
                <button class="btn-tabela btn-tabela-perigo btn-delete">Excluir</button>
            `;

            actionsCell.querySelector('.btn-details').addEventListener('click', () => {
                if (psy.slug) window.open(`/${psy.slug}`, '_blank');
                else alert('Usuário sem link personalizado.');
            });

            actionsCell.querySelector('.btn-suspend').addEventListener('click', () => {
                console.log("Cliquei em Suspender:", psy.nome);
                const newStatus = isSuspended ? 'active' : 'inactive';
                
                confirmarAcao('Alterar Status', `Deseja mudar o status de <b>${psy.nome}</b>?`, async () => {
                    try {
                        const res = await fetch(`${API_PREFIX}/api/admin/psychologists/${psy.id}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ status: newStatus })
                        });
                        if(res.ok) fetchPsychologists(currentPage, currentFilters);
                        else alert("Erro ao alterar status");
                    } catch (e) { alert(e.message); }
                });
            });

            actionsCell.querySelector('.btn-delete').addEventListener('click', () => {
                console.log("Cliquei em Excluir:", psy.nome);
                
                confirmarAcao('Excluir Profissional', `Tem certeza que deseja apagar <b>${psy.nome}</b>? Essa ação não tem volta.`, async () => {
                    try {
                        const res = await fetch(`${API_PREFIX}/api/admin/psychologists/${psy.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (res.ok) {
                            row.remove(); 
                        } else {
                            const err = await res.json();
                            alert("Erro: " + (err.error || "Falha ao excluir"));
                        }
                    } catch (e) { alert(e.message); }
                });
            });

            tableBody.appendChild(row);
        });
    }

    // --- LÓGICA DE FILTROS CORRIGIDA ---
    
    // 1. Seleção Robusta por IDs
    const searchInput = document.querySelector('.campo-busca');
    const statusSelect = document.getElementById('filtro-status'); // Pega pelo ID novo
    const planoSelect = document.getElementById('filtro-plano');   // Pega pelo ID novo
    
    function applyFilters() {
        // Verifica se o elemento existe antes de pegar o valor (evita erros se o HTML demorar)
        currentFilters.search = searchInput ? searchInput.value : '';
        currentFilters.status = statusSelect ? statusSelect.value : '';
        currentFilters.plano = planoSelect ? planoSelect.value : '';
        
        console.log("Filtros aplicados:", currentFilters); // Debug: Veja no console o que está sendo enviado
        fetchPsychologists(1, currentFilters);
    }

    // 2. Event Listeners (Gatilhos)
    let debounceTimer;
    if(searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyFilters, 500); 
        });
    }

    if(statusSelect) statusSelect.addEventListener('change', applyFilters);
    if(planoSelect) planoSelect.addEventListener('change', applyFilters);

    // --- NOVO: Botão Adicionar Psicólogo ---
    const btnAdd = document.getElementById('btn-add-psi');
    if (btnAdd) {
        btnAdd.addEventListener('click', () => {
            // Adicionamos o ?mode=admin para avisar a página de destino que somos nós
            window.open('/psi_registro.html?mode=admin', '_blank');
        });
    }

    // Carregamento Inicial
    fetchPsychologists(1);
};