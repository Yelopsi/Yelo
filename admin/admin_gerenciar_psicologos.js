// Este arquivo é carregado dinamicamente por admin.js quando a página de Gestão de Psis é acessada.

window.initializePage = function() {
    console.log("Página de Gestão de Psicólogos Inicializada.");

    const tableBody = document.getElementById('psychologists-table-body');
    const searchInput = document.getElementById('search-input');
    const statusFilter = document.getElementById('status-filter');
    const planoFilter = document.getElementById('plano-filter');
    let searchTimeout;
    let isVipFilterActive = false;

    // Função para buscar e renderizar os dados
    async function fetchAndRenderPsychologists(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="8" class="loading-row" style="text-align: center; padding: 40px; color: var(--cinza-texto);"><span class="loading-spinner-sm"></span> Carregando profissionais...</td></tr>`;

        const searchTerm = searchInput.value;
        const status = statusFilter.value;
        const plano = planoFilter.value;

        try {
            const token = localStorage.getItem('Yelo_token');
            const response = await fetch(`${API_BASE_URL}/api/admin/psychologists?page=${page}&search=${searchTerm}&status=${status}&plano=${plano}&isVip=${isVipFilterActive}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const { data, totalPages, currentPage, kpis } = await response.json();
            renderTable(data);
            renderPagination(totalPages, currentPage);

            // Atualiza os KPIs de Resumo se eles existirem na resposta
            if (kpis) {
                const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || 0; };
                setText('kpi-total-psis', kpis.total);
                setText('kpi-ativos-psis', kpis.active);
                setText('kpi-pendentes-psis', kpis.pending);
                setText('kpi-inativos-psis', kpis.inactive);
                setText('kpi-vip-psis', kpis.vip);
            }
        } catch (error) {
            console.error("Erro ao buscar psicólogos:", error);
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar dados.</td></tr>`;
        }
    }

    // Função para renderizar a tabela
    function renderTable(psychologists) {
        tableBody.innerHTML = '';
        if (psychologists.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhum profissional encontrado.</td></tr>`;
            return;
        }

        psychologists.forEach(psy => {
            const isVip = psy.is_exempt === true;
            const isDeleted = psy.deletedAt !== null && psy.deletedAt !== undefined;
            const dataCadastro = new Date(psy.createdAt).toLocaleDateString('pt-BR');
            
            let statusLabel = psy.status || 'inativo';
            let statusClass = `status-${psy.status || 'inactive'}`;

            if (isDeleted) {
                statusLabel = 'excluído';
                statusClass = 'status-cancelada';
            } else if (psy.status === 'active') {
                if (isVip) {
                    statusLabel = 'VIP';
                } else if (!psy.stripeSubscriptionId && psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date()) {
                    statusLabel = 'Trial';
                    statusClass = 'status-pending'; // Fica amarelo para destacar que ainda não assinou
                } else {
                    statusLabel = 'Ativo';
                }
            } else if (psy.status === 'pending') {
                statusLabel = 'Incompleto'; // CPF não preenchido
            } else if (psy.status === 'inactive') {
                statusLabel = 'Expirado';
            }
            
            const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
            
            let wppCell = '<td data-label="WPP" style="text-align: center;">-</td>';
            // Agora exibe o botão sempre que o profissional tiver um telefone cadastrado
            if (psy.telefone && !isDeleted) {
                const wppLink = window.gerarLinkWhatsAppPending(psy.telefone, psy.nome);
                const jaEnviado = window.verificarWppEnviado(psy.id);
                
                if (jaEnviado) {
                    wppCell = `
                        <td data-label="WPP">
                            <a href="${wppLink}" onclick="window.registrarEnvioWpp(${psy.id}, this.href, event)" class="btn-tabela wpp-enviado" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; text-decoration: none;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                Enviado
                            </a>
                        </td>
                    `;
                } else {
                    wppCell = `
                        <td data-label="WPP">
                            <a href="${wppLink}" onclick="window.registrarEnvioWpp(${psy.id}, this.href, event)" class="btn-tabela" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px; text-decoration: none;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                Enviar
                            </a>
                        </td>
                    `;
                }
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Nome">
                    <a href="#" onclick="navigateToPage('admin_detalhes_psicologo.html?id=${psy.id}'); return false;" style="font-weight: 600; color: var(--verde-escuro); text-decoration: none; display: flex; align-items: center; gap: 8px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                            ${psy.nome.charAt(0).toUpperCase()}
                        </div>
                        <span style="transition: color 0.2s;" onmouseover="this.style.color='var(--cor-Yelo)'" onmouseout="this.style.color='var(--verde-escuro)'">${psy.nome}</span>
                    </a>
                </td>
                <td data-label="Email" style="color: #555;">${psy.email}</td>
                <td data-label="Status"><span class="status ${statusClass}">${statusLabel}</span></td>
                <td data-label="Cadastro" style="color: #666; font-size: 0.9rem;">${dataCadastro}</td>
                <td data-label="Plano"><span style="background-color: ${psy.plano ? 'var(--cor-Yelo)' : '#f1f3f5'}; color: ${psy.plano ? 'var(--verde-escuro)' : '#666'}; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">${planoName}</span></td>
                <td data-label="Status VIP">
                    <button class="btn-vip-toggle ${isVip ? 'active' : ''}" data-id="${psy.id}" ${isDeleted ? 'disabled' : ''} style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 6px 12px; border-radius: 20px; font-weight: 600;">
                        ${isVip ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"></path><path d="M11 3 8 9l4 13"></path><path d="M13 3l3 6-4 13"></path><path d="M2 9h20"></path></svg> VIP' : (isDeleted ? 'Inativo' : 'Tornar VIP')}
                    </button>
                </td>
                ${wppCell}
                <td data-label="Ações" style="white-space: nowrap;">
                    <button class="btn-tabela" onclick="navigateToPage('admin_detalhes_psicologo.html?id=${psy.id}')" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Detalhes
                    </button>
                    ${isDeleted ? `<span style="font-size:0.85rem; color:#999; margin-left:10px; display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Na Lixeira</span>` : `<button class="btn-tabela btn-tabela-perigo btn-delete-psy" data-id="${psy.id}" data-name="${psy.nome}" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        Excluir
                    </button>`}
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
        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active-filter'));
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAndRenderPsychologists(1), 500);
    });
    
    statusFilter.addEventListener('change', () => {
        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active-filter'));
        isVipFilterActive = false;
        fetchAndRenderPsychologists(1);
    });
    
    planoFilter.addEventListener('change', () => {
        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active-filter'));
        isVipFilterActive = false;
        fetchAndRenderPsychologists(1);
    });

    // Configura os cards de KPI como botões de filtro rápido
    const kpiCards = document.querySelectorAll('.kpi-card');
    kpiCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.title = "Clique para filtrar a lista";
        card.addEventListener('click', () => {
            const isActive = card.classList.contains('active-filter');
            const kpiId = card.querySelector('.kpi-numero').id;
            
            // Reseta todos os filtros visuais
            searchInput.value = '';
            statusFilter.value = '';
            planoFilter.value = '';
            isVipFilterActive = false;
            
            // Limpa o estilo de todos os cards
            kpiCards.forEach(c => c.classList.remove('active-filter'));

            // Se não estava ativo, ativa o filtro selecionado
            if (!isActive) {
                card.classList.add('active-filter');
                if (kpiId === 'kpi-ativos-psis') statusFilter.value = 'active';
                else if (kpiId === 'kpi-pendentes-psis') statusFilter.value = 'pending';
                else if (kpiId === 'kpi-inativos-psis') statusFilter.value = 'inactive';
                else if (kpiId === 'kpi-vip-psis') isVipFilterActive = true;
            }
            
            fetchAndRenderPsychologists(1);
        });
    });

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