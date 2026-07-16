(function() {
    // Configuração da API
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : 'http://localhost:3001';
    const token = localStorage.getItem('Yelo_token');

    let currentSort = { column: 'date', direction: 'asc' };

    function init() {
        // Configura filtro de data padrão (últimos 30 dias)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const tomorrow = new Date(today); 
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const elStart = document.getElementById('global-date-start');
        const elEnd = document.getElementById('global-date-end');
        
        if (elStart && elEnd) {
            if (typeof flatpickr !== 'undefined') {
                const config = {
                    dateFormat: "Y-m-d",
                    altInput: true,
                    altFormat: "d/m/Y",
                    locale: "pt",
                    disableMobile: false // Força a roleta nativa no mobile
                };
                flatpickr(elStart, { ...config, defaultDate: thirtyDaysAgo });
                flatpickr(elEnd, { ...config, defaultDate: tomorrow });
            } else {
                // Fallback de segurança se a biblioteca não carregar
                const formatDate = (d) => { const year = d.getFullYear(); const month = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
                elStart.type = 'date';
                elEnd.type = 'date';
                elStart.value = formatDate(thirtyDaysAgo);
                elEnd.value = formatDate(tomorrow);
            }
        }

        loadFollowUpList();
        
        const btnRefresh = document.getElementById('btn-refresh-followup');
        if(btnRefresh) btnRefresh.addEventListener('click', loadFollowUpList);
        
        // Listeners para filtros
        document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);
        document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);
        
        // Listeners para ordenação
        document.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => handleSort(th.dataset.sort));
        });

        // Adiciona o listener para as mudanças no select de status
        const tbody = document.getElementById('followup-table-body');
        if(tbody) {
            tbody.addEventListener('change', handleStatusChange);
            tbody.addEventListener('click', handleTableClick); // Novo listener para cliques (WhatsApp)
        }
    }

    let allLoadedItems = []; // Armazena todos os itens carregados para filtragem local

    async function loadFollowUpList() {
        const tbody = document.getElementById('followup-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="loading-row">Carregando...</td></tr>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/followups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar dados de follow-up.');

            const data = await response.json();
            // Garante que seja um array
            allLoadedItems = Array.isArray(data) ? data : (data.data || []);
            console.log("Follow-ups carregados:", allLoadedItems.length); // Debug
            
            applyFilters();
        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="5" class="error-row">Erro ao carregar: ${error.message}</td></tr>`;
        }
    }

    function clearFilters() {
        document.getElementById('global-date-start').value = '';
        document.getElementById('global-date-end').value = '';
        applyFilters();
    }

    function applyFilters() {
        const tbody = document.getElementById('followup-table-body');
        
        // 1. Captura valores dos filtros
        const dateStart = document.getElementById('global-date-start').value;
        const dateEnd = document.getElementById('global-date-end').value;

        // 2. Filtra o array local
        const filteredItems = allLoadedItems.filter(item => {
            const itemDateObj = new Date(item.date);
            const itemDateStr = itemDateObj.toLocaleDateString('pt-BR');
            
            // Filtro Global de Data
            if (dateStart) {
                const start = new Date(dateStart);
                if (itemDateObj < start) return false;
            }
            if (dateEnd) {
                const end = new Date(dateEnd);
                // Ajusta para o final do dia
                end.setHours(23, 59, 59, 999);
                if (itemDateObj > end) return false;
            }

            return true;
        });

        // 3. Ordenação
        filteredItems.sort((a, b) => {
            // NOVA LÓGICA: Itens classificados (resolvidos) vão para o final
            const classifiedStatuses = ['contact_made', 'contact_failed', 'opt_out'];
            const isClassifiedA = classifiedStatuses.includes(a.status);
            const isClassifiedB = classifiedStatuses.includes(b.status);

            if (isClassifiedA !== isClassifiedB) return isClassifiedA ? 1 : -1;

            let valA = a[currentSort.column];
            let valB = b[currentSort.column];

            if (currentSort.column === 'date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });

        updateKPIs(filteredItems);
        renderTable(filteredItems, tbody);
    }

    function handleSort(column) {
        if (currentSort.column === column) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = column;
            currentSort.direction = 'asc';
        }
        applyFilters();
    }

    function updateKPIs(items) {
        const total = items.length;
        if (total === 0) return;

        // Contagens
        const success = items.filter(i => i.status === 'contact_made').length;
        const failed = items.filter(i => i.status === 'contact_failed').length;
        const pending = items.filter(i => i.status === 'pending' || i.status === 'not_attempted').length;
        const optout = items.filter(i => i.status === 'opt_out').length;

        // 1. Taxa de Contato Realizado (KPI-mãe)
        // Fórmula: contato_realizado // (contato_realizado + contato_nao_realizado)
        const totalAttempts = success + failed;
        const successRate = totalAttempts > 0 ? Math.round((success / totalAttempts) * 100) : 0;
        
        const elSuccess = document.getElementById('kpi-success-rate');
        const elSuccessLabel = document.getElementById('kpi-success-label');
        elSuccess.textContent = `${successRate}%`;
        
        // Leitura: < 50% (Ruim), 50-70% (Aceitável), > 70% (Bom)
        if (successRate >= 70) { elSuccess.style.color = '#27ae60'; elSuccessLabel.textContent = "Bom matching"; }
        else if (successRate >= 50) { elSuccess.style.color = '#f39c12'; elSuccessLabel.textContent = "Aceitável"; }
        else { elSuccess.style.color = '#e74c3c'; elSuccessLabel.textContent = "Problema estrutural"; }

        // 2. Taxa de Falha (Qualidade Global)
        // Fórmula Global: contato_nao_realizado // total
        // Nota: O ideal é por psicólogo, mas aqui mostramos a média do sistema
        const failureRate = Math.round((failed / total) * 100);
        const elFailure = document.getElementById('kpi-failure-rate');
        elFailure.textContent = `${failureRate}%`;
        // Se falha > 30%, alerta vermelho
        elFailure.style.color = failureRate > 30 ? '#e74c3c' : '#2c3e50';

        // 3. Taxa de "Ainda não tentou" (Timing)
        // Fórmula: Ainda não tentou // total
        const pendingRate = Math.round((pending / total) * 100);
        const elPending = document.getElementById('kpi-pending-rate');
        elPending.textContent = `${pendingRate}%`;
        
        // Mantém cor neutra pois é um indicador de fluxo/experimento, não de erro
        elPending.style.color = '#2c3e50';

        // 4. Taxa de Opt-out (Atrito)
        // Fórmula: Não quer receber // total
        const optoutRate = Math.round((optout / total) * 100);
        const elOptout = document.getElementById('kpi-optout-rate');
        elOptout.textContent = `${optoutRate}%`;

        // Leitura: < 5% (Saudável), 5-10% (Alerta), > 10% (Invasivo)
        if (optoutRate < 5) elOptout.style.color = '#27ae60';
        else if (optoutRate <= 10) elOptout.style.color = '#f39c12';
        else elOptout.style.color = '#e74c3c';
    }

    // Função para salvar no backend
    async function updateFollowUp(id, payload) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/followups/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) throw new Error('Falha ao atualizar status');
        } catch (error) {
            console.error("Erro ao atualizar follow-up:", error);
            alert("Não foi possível salvar a alteração. Verifique sua conexão.");
        }
    }

    function handleTableClick(e) {
        // Intercepta o clique no botão do WhatsApp
        const btnWhatsapp = e.target.closest('.btn-whatsapp');
        if (btnWhatsapp) {
            const row = btnWhatsapp.closest('tr');
            const badge = row.querySelector('.status-badge');
            const id = btnWhatsapp.dataset.id;
            
            // Lógica visual imediata: Marca como "Mensagem Enviada"
            if (badge && badge.dataset.status === 'pending') {
                badge.textContent = 'Mensagem enviada';
                badge.style.backgroundColor = '#cce5ff'; // Azul claro
                badge.style.color = '#004085';
                badge.dataset.status = 'sent';
                
                // Salva no backend
                updateFollowUp(id, { 
                    status: 'pending', 
                    message_sent_at: new Date().toISOString() 
                });
            }
            
            // O link <a> continua funcionando e abre a nova aba normalmente
        }

        // Lógica do botão de destravar (Unlock)
        const btnUnlock = e.target.closest('.btn-unlock');
        if (btnUnlock) {
            window.openConfirmationModal(
                'Destravar Status',
                'Deseja destravar este item para alterar o status?',
                () => {
                    const wrapper = btnUnlock.closest('.actions-wrapper');
                    const select = wrapper.previousElementSibling.querySelector('select');
                    if(select) select.disabled = false;
                    wrapper.remove(); // Remove o container com os botões
                }
            );
        }

        // Lógica do botão de excluir
        const btnDelete = e.target.closest('.btn-delete-followup');
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            window.openConfirmationModal(
                'Excluir Contato',
                'Tem certeza que deseja excluir este contato da lista? Esta ação não pode ser desfeita.',
                () => executeDeleteFollowup(id)
            );
        }
    }

    function handleStatusChange(e) {
        if (e.target.classList.contains('followup-select')) {
            const select = e.target;
            const value = select.value;
            const id = select.dataset.id;

            // Salva no backend
            updateFollowUp(id, { status: value });

            // Atualiza o estado local e re-renderiza a tabela (isso move o item para o fim)
            const item = allLoadedItems.find(i => i.id == id);
            if (item) item.status = value;
            
            applyFilters();
        }
    }

    async function executeDeleteFollowup(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/followups/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao excluir');
            
            // Remove da UI otimisticamente
            const itemIndex = allLoadedItems.findIndex(i => i.id == id);
            if (itemIndex > -1) {
                allLoadedItems.splice(itemIndex, 1);
            }
            applyFilters(); // Re-renderiza a tabela
            
            if(window.showToast) window.showToast('Contato excluído com sucesso.');

        } catch (error) {
            console.error("Erro ao excluir:", error);
            if(window.showToast) window.showToast('Erro ao excluir contato.', 'error');
        }
    }

    function renderTable(items, tbody) {
        tbody.innerHTML = '';

        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: #666;">Nenhum follow-up pendente para hoje. 🎉</td></tr>';
            return;
        }

        items.forEach(item => {
            const dateObj = new Date(item.date);
            const formattedDate = dateObj.toLocaleDateString('pt-BR');
            
            // --- Limpeza e Formatação do Telefone para o Link ---
            let cleanPhone = (item.targetPhone || '').replace(/\D/g, '');
            if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
                cleanPhone = '55' + cleanPhone; // Adiciona DDI Brasil se faltar
            }

            // Mensagem pré-formatada para o WhatsApp de acordo com o Tipo
            let msg = '';
            let labelTipo = '';
            const firstName = (item.targetName || '').split(' ')[0];
            const patientName = item.patientName || 'um paciente';

            if (item.type === 'psi_negotiation') {
                labelTipo = `<span style="background:#fef3c7; color:#d97706; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 5px;">[Psi - Fechamento]</span>`;
                msg = `Olá, ${firstName}! Tudo bem? Vi aqui que na semana passada você estava em contato com o(a) paciente ${patientName}. Passando para saber se deu tudo certo e se vocês chegaram a iniciar as sessões! 🎉\n\nQuando tiver um tempinho, poderia atualizar o desfecho desse contato lá na Yelo? É só acessar em\n\nwww.yelopsi.com.br/login\n\nir na aba *'Evolução'* > *'Histórico de Contatos'* e alterar a coluna *'Status de Retorno'*. Saber se esse paciente fechou com você nos ajuda muito a otimizar o algoritmo para te enviar mais pacientes com esse exato perfil.\n\nAbraços! 🌿`;
            } else if (item.type === 'psi_feedback') {
                labelTipo = `<span style="background:#fee2e2; color:#ef4444; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 5px;">[Psi - Feedback]</span>`;
                msg = `Olá, ${firstName}! Como vai? \n\nNotamos que o(a) paciente ${patientName} clicou para falar com você já faz um tempinho, mas ainda não recebemos o seu feedback sobre como foi esse contato. Esse preenchimento é super rápido e obrigatório, pois é ele quem 'treina' a nossa Inteligência Artificial a atrair os pacientes que mais combinam com a sua clínica.\n\nVocê consegue nos dar esse retorno rapidinho? \n\nPra facilitar, estou reenviando aqui o link. Nem precisa fazer o login ☺️\n\nwww.yelopsi.com.br/login\n\nQualquer dúvida pode me chamar por aqui. \nUm abraço 🌿`;
            } else {
                labelTipo = `<span style="background:#e0e7ff; color:#4f46e5; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; margin-right: 5px;">[Paciente]</span>`;
                msg = `Olá! Tudo bem? Vi que você se interessou pelo perfil de ${item.psychologistName} na Yelo há alguns dias. Conseguiu agendar sua consulta ou precisa de ajuda?`;
            }

            const whatsappLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : '#';
            let whatsappTitle = "Enviar Mensagem no WhatsApp";

            // Cálculo de dias decorridos
            const daysDiff = Math.floor((new Date() - dateObj) / (1000 * 60 * 60 * 24));
            
            // Determina estado visual inicial
            let badgeHtml = '';
            let rowStyle = '';
            let selectDisabled = false;
            let selectedValue = '';
            let whatsappStyle = 'margin-right: 4px;'; // Reduzido margem
            let showUnlock = false;

            if (item.status === 'contact_made') {
                badgeHtml = `<span class="status-badge" style="background:#dcfce7; color:#166534; font-size: 0.75rem; border: 1px solid #bbf7d0; padding: 4px 10px; border-radius: 20px;">Contato realizado</span>`;
                selectDisabled = true;
                selectedValue = 'contact_made';
                showUnlock = true;
            } else if (item.status === 'contact_failed') {
                badgeHtml = `<span class="status-badge" style="background:#fef2f2; color:#b91c1c; font-size: 0.75rem; border: 1px solid #fecaca; padding: 4px 10px; border-radius: 20px;">Sem resposta</span>`;
                selectDisabled = true;
                selectedValue = 'contact_failed';
                showUnlock = true;
            } else if (item.status === 'not_attempted') {
                badgeHtml = `<span class="status-badge" style="background:#fffbeb; color:#b45309; font-size: 0.75rem; border: 1px solid #fde68a; padding: 4px 10px; border-radius: 20px;">Ainda não tentou</span>`;
                selectDisabled = true;
                selectedValue = 'not_attempted';
                showUnlock = true;
            } else if (item.status === 'opt_out') {
                badgeHtml = `<span class="status-badge" style="background:#f3f4f6; color:#4b5563; font-size: 0.75rem; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 20px;">Opt-out</span>`;
                selectDisabled = true;
                selectedValue = 'opt_out';
                whatsappStyle += ' pointer-events: none; opacity: 0.5; cursor: not-allowed;';
                showUnlock = true;
            } else if (item.message_sent_at) {
                badgeHtml = `<span class="status-badge" data-status="sent" style="background:#e0f2fe; color:#0369a1; font-size: 0.75rem; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 20px;">Mensagem enviada</span>`;
            } else {
                badgeHtml = `<span class="status-badge" data-status="pending" style="background:#f8f9fa; color:#6c757d; font-size: 0.75rem; border: 1px solid #dee2e6; padding: 4px 10px; border-radius: 20px;">Pendente</span>`;
                selectedValue = ''; // Deixa em branco para forçar escolha
            }
            
            // Desabilita botão se não tiver telefone válido
            if (!cleanPhone) {
                whatsappStyle += ' opacity: 0.5; cursor: not-allowed; pointer-events: none;';
                whatsappTitle = "Telefone não disponível (Visitante não informou)";
            }

            const tr = document.createElement('tr');
            if(rowStyle) tr.style.cssText = rowStyle;

            tr.innerHTML = `
                <td data-label="Data" style="padding: 15px;">
                    <div style="font-size: 0.95rem; font-weight: 600; color: #333;">${formattedDate}</div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">há ${daysDiff} dias</div>
                </td>
                <td data-label="Alvo do Follow-up" style="padding: 15px;">
                    <div style="margin-bottom: 5px;">${labelTipo}</div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 3px;">${item.targetName}</div>
                    <div style="color: #666; font-size: 0.85rem; display: flex; align-items: center; gap: 5px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        ${formatPhone(item.targetPhone) || 'Sem telefone'}
                    </div>
                </td>
                <td data-label="Contexto" style="padding: 15px; color: #666; font-size: 0.9rem;">
                    Paciente: <strong>${item.patientName}</strong><br>
                    Psi: <strong>${item.psychologistName}</strong>
                </td>
                <td data-label="Status" style="padding: 15px;">
                    ${badgeHtml}
                    ${item.status === 'contact_made' || item.status === 'opt_out' ? '' : `<div style="font-size: 0.75rem; color: #10b981; margin-top: 6px; font-weight: 600; display: flex; align-items: center; gap: 4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Autorizado</div>`}
                </td>
                <td data-label="Ações" style="padding: 15px;">
                    <div class="actions-cell" style="display: flex; align-items: center; justify-content: center; width: 100%; gap: 10px; flex-wrap: wrap;">
                        <a href="${whatsappLink}" target="_blank" class="btn-icon btn-whatsapp" data-id="${item.id}" title="${whatsappTitle}" style="${whatsappStyle} background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </a>
                        <div class="select-wrapper" style="position: relative; display: inline-block;">
                            <select class="form-control followup-select" data-id="${item.id}" ${selectDisabled ? 'disabled' : ''} style="padding: 8px 12px; border-radius: 8px; font-size: 0.85rem; min-width: 160px; background-color: ${selectDisabled ? '#f8f9fa' : '#fff'}; border: 1px solid #ddd; cursor: pointer;">
                                <option value="" ${!selectedValue ? 'selected' : ''} disabled>Registrar resultado...</option>
                                <option value="contact_made" ${selectedValue === 'contact_made' ? 'selected' : ''}>✅ Contato realizado</option>
                                <option value="contact_failed" ${selectedValue === 'contact_failed' ? 'selected' : ''}>❌ Sem resposta</option>
                                <option value="not_attempted" ${selectedValue === 'not_attempted' ? 'selected' : ''}>⏳ Ainda não tentou</option>
                                <option value="opt_out" ${selectedValue === 'opt_out' ? 'selected' : ''}>🚫 Opt-out</option>
                            </select>
                        </div>
                        <div class="actions-wrapper" style="display: flex; gap: 5px;">
                            ${showUnlock ? `<button class="btn-unlock" data-id="${item.id}" title="Destravar Status" style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; cursor: pointer; padding: 8px; color: #666; transition: all 0.2s;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg></button>` : ''}
                            ${showUnlock ? `<button class="btn-delete-followup" data-id="${item.id}" title="Excluir Contato" style="background: #fff1f2; border: 1px solid #ffe4e6; border-radius: 8px; cursor: pointer; padding: 8px; color: #e11d48; transition: all 0.2s;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>` : ''}
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function formatPhone(phone) {
        if (!phone) return '';
        return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    init();
})();