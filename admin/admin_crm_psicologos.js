window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    
    const tableBody = document.getElementById('crm-psis-body');
    const searchInput = document.getElementById('crm-search-psi');
    const statusInput = document.getElementById('crm-status-psi');
    
    const drawerOverlay = document.getElementById('drawer-cs-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-cs-drawer');
    
    let searchTimeout;
    let psisDataCache = [];
    let isVipFilterActive = false;
    let isNotAnalyzedFilterActive = false;

    const drawerContent = drawerOverlay ? drawerOverlay.querySelector('.drawer-content') : null;
    const drawerHeader = drawerOverlay ? drawerOverlay.querySelector('.drawer-header-mobile') : null;

    // Fetch Advanced KPIs for Header (MRR, Activation, Retention)
    async function loadAdvancedKpis() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/founder-metrics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                
                // MRR
                const mrrEl = document.getElementById('crm-mrr');
                if (mrrEl) mrrEl.innerText = `R$ ${data.metrics.currentMRR.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                
                // Retenção (100% - Churn Pago)
                const retentionEl = document.getElementById('crm-retention');
                if (retentionEl) {
                    const retentionPct = Math.max(0, 100 - (data.metrics.churnRate * 100)).toFixed(1);
                    retentionEl.innerText = `${retentionPct}%`;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar KPIs avançados:', e);
        }
    }
    loadAdvancedKpis();

    // --- CONTROLES DO DRAWER ---
    function closeDrawer() { 
        drawerOverlay.classList.remove('active'); 
        if (drawerContent) {
            setTimeout(() => {
                drawerContent.style.removeProperty('transform');
                drawerContent.style.removeProperty('transition');
            }, 300);
        }
    }

    if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', (e) => { if (e.target === drawerOverlay) closeDrawer(); });

    document.querySelectorAll('.crm-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.filterByKpi(e.target.dataset.filter);
        });
    });

    window.filterByKpi = function(filterVal) {
        // Atualiza Pills
        document.querySelectorAll('.crm-pill').forEach(b => b.classList.remove('active'));
        const pill = document.querySelector(`.crm-pill[data-filter="${filterVal}"]`);
        if (pill) pill.classList.add('active');

        // Atualiza Cards
        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
        const card = document.querySelector(`.kpi-card[data-kpi="${filterVal}"]`);
        if (card) card.classList.add('active');

        isVipFilterActive = false;
        isNotAnalyzedFilterActive = false;
        statusInput.value = '';
        
        if (filterVal === 'vip') isVipFilterActive = true;
        else if (filterVal === 'not_analyzed') isNotAnalyzedFilterActive = true;
        else statusInput.value = filterVal;
        
        fetchAndRenderPsis(1);
        
        // Scroll suave para a tabela
        document.querySelector('.kpi-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.currentCrmPage = 1;
    
    document.getElementById('crm-per-page')?.addEventListener('change', () => fetchAndRenderPsis(1));
    document.getElementById('crm-date-start')?.addEventListener('change', () => fetchAndRenderPsis(1));
    document.getElementById('crm-date-end')?.addEventListener('change', () => fetchAndRenderPsis(1));
    
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
        if (window.currentCrmPage > 1) fetchAndRenderPsis(window.currentCrmPage - 1);
    });
    document.getElementById('btn-next-page')?.addEventListener('click', () => {
        fetchAndRenderPsis(window.currentCrmPage + 1);
    });

    // --- SORTING LOGIC ---
    let currentSortColumn = '';
    let currentSortOrder = 'asc';

    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSortColumn === column) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortOrder = 'asc';
            }

            // Update icons
            document.querySelectorAll('th.sortable .sort-icon').forEach(icon => icon.textContent = '');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.textContent = currentSortOrder === 'asc' ? ' ↑' : ' ↓';

            // Sort data cache
            psisDataCache.sort((a, b) => {
                let valA = a[column];
                let valB = b[column];

                if (column === 'score') {
                    valA = window.calculateProfileHealth ? window.calculateProfileHealth(a).score : 0;
                    valB = window.calculateProfileHealth ? window.calculateProfileHealth(b).score : 0;
                } else if (column === 'xp') {
                    valA = a.xp || 0;
                    valB = b.xp || 0;
                } else if (column === 'status') {
                    valA = (a.status || '') + (a.plano || '');
                    valB = (b.status || '') + (b.plano || '');
                } else if (column === 'createdAt') {
                    valA = new Date(a.createdAt || 0).getTime();
                    valB = new Date(b.createdAt || 0).getTime();
                } else if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = (valB || '').toLowerCase();
                }

                if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
                if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
                return 0;
            });

            renderTable(psisDataCache);
        });
    });

    // Lógica de Swipe Down APENAS NO CABEÇALHO (Para não travar o scroll do conteúdo)
    let startY = 0;
    let currentY = 0;
    
    if (drawerHeader && drawerContent) {
        drawerHeader.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768) return;
            startY = e.touches[0].clientY;
            currentY = startY;
            drawerContent.style.setProperty('transition', 'none', 'important');
        }, { passive: true });
        drawerHeader.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;
            if (diffY > 0) { 
                drawerContent.style.setProperty('transform', `translateY(${diffY}px)`, 'important'); 
                e.preventDefault(); 
            }
        }, { passive: false });
        drawerHeader.addEventListener('touchend', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            const diffY = currentY - startY;
            drawerContent.style.setProperty('transition', 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
            if (diffY > 80) { closeDrawer(); setTimeout(() => { drawerContent.style.removeProperty('transform'); drawerContent.style.removeProperty('transition'); }, 300); }
            else { drawerContent.style.setProperty('transform', 'translateY(0)', 'important'); setTimeout(() => { drawerContent.style.removeProperty('transform'); drawerContent.style.removeProperty('transition'); }, 300); }
            startY = 0; currentY = 0;
        });
    }

    // Handle auto search from other pages
    const autoSearchName = localStorage.getItem('autoSearchPsiName');
    if (autoSearchName && searchInput) {
        searchInput.value = autoSearchName;
    }

    searchInput.addEventListener('keyup', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => fetchAndRenderPsis(1), 500);
    });

    async function fetchAndRenderPsis(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="6" class="loading-row" style="text-align: center; padding: 40px; color: var(--cinza-texto);"><span class="loading-spinner-sm"></span> Carregando CRM...</td></tr>`;

        const searchTerm = searchInput.value;
        const status = statusInput.value;
        
        // NOVO LÓGICA PARA FOLLOW-UPS
        if (status === 'pending_actions') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/pending-actions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Falha ao buscar pendências.');
                const pendingData = await response.json();
                renderPendingActionsTable(pendingData);
                const infoEl = document.getElementById('pagination-info');
                if (infoEl) infoEl.textContent = `Mostrando ${pendingData.length} ações`;
                return;
            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar ações pendentes.</td></tr>`;
                return;
            }
        }

        const startDate = document.getElementById('crm-date-start')?.value || '';
        const endDate = document.getElementById('crm-date-end')?.value || '';
        const limit = document.getElementById('crm-per-page')?.value || 20;

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/psychologists?page=${page}&limit=${limit}&search=${searchTerm}&status=${status}&isVip=${isVipFilterActive}&notAnalyzed=${isNotAnalyzedFilterActive}&startDate=${startDate}&endDate=${endDate}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Falha ao buscar dados.');

            const { data, totalPages, currentPage, totalItems, kpis } = await response.json();
            psisDataCache = data;
            
            renderTable(data);
            renderPagination(totalPages, currentPage, totalItems, limit);

            if (kpis) {
                const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value || 0; };
                setText('kpi-total-psis', kpis.total);
                setText('kpi-pagantes-psis', kpis.active_paying || 0);
                setText('kpi-trial-psis', kpis.active_trial || 0);
                setText('kpi-pendentes-psis', kpis.pending);
                setText('kpi-inativos-psis', kpis.inactive);
                setText('kpi-vip-psis', kpis.vip);
                setText('kpi-fila-cs', kpis.fila_cs);
                setText('kpi-lixeira-psis', kpis.deleted || 0);
                setText('kpi-alerta-pendentes', kpis.pending || 0);
                
                // Ativação: (Ativos / Totais) * 100
                const activationEl = document.getElementById('crm-activation');
                if (activationEl && kpis.total > 0) {
                    const ativos = (parseInt(kpis.active_paying) || 0) + (parseInt(kpis.active_trial) || 0) + (parseInt(kpis.vip) || 0);
                    const actPct = ((ativos / kpis.total) * 100).toFixed(1);
                    activationEl.innerText = `${actPct}%`;
                }
            }

            // Auto open logic
            const autoOpenId = localStorage.getItem('autoOpenPsiId');
            if (autoOpenId && data.some(p => String(p.id) === String(autoOpenId))) {
                localStorage.removeItem('autoOpenPsiId');
                localStorage.removeItem('autoSearchPsiName');
                setTimeout(() => window.openCSDrawer(autoOpenId), 300);
            }
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar dados.</td></tr>`;
        }
    }

    function renderPendingActionsTable(data) {
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhuma ação pendente! 🎉</td></tr>`;
            return;
        }

        data.forEach(item => {
            const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : '-';
            let actionBadge = '';
            
            if (item.actionType === 'analysis') actionBadge = '<span class="status status-active">Análise Pronta</span>';
            else if (item.actionType === 'incomplete') actionBadge = '<span class="status status-pending">Perfil Incompleto</span>';
            else if (item.actionType === 'churn') actionBadge = '<span class="status status-cancelada">Churn</span>';
            else if (item.actionType === 'billing_feedback') actionBadge = '<span class="status" style="background:#e0e7ff; color:#4338ca;">Feedback/Cobrança</span>';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Profissional">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="display: flex; flex-direction: column;">
                            <strong style="color: var(--verde-escuro); cursor: pointer;" onclick="window.openCSDrawer('${item.id}')">${item.nome}</strong>
                            <span style="font-size: 0.75rem; color: #666;">${item.telefone || 'Sem telefone'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status">
                    ${actionBadge}
                </td>
                <td data-label="Motivo">
                    <span style="font-size: 0.85rem; color: #475569; font-weight: 500;">${item.reason}</span>
                </td>
                <td data-label="Data">
                    <span style="color: #64748b; font-size: 0.9rem;">${dateStr}</span>
                </td>
                <td data-label="Extra">
                    <span style="font-size: 0.8rem; color: #64748b;">${item.plano || '-'}</span>
                </td>
                <td data-label="Ações CS" style="white-space: nowrap; text-align: right;">
                    <button class="btn-tabela" onclick="window.sendWhatsAppAction('${item.id}', '${item.telefone}', '${item.nome}', '${item.actionType}')" style="background: #25D366; color: white; border: none; padding: 6px 12px; border-radius: 50px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 2px 4px rgba(37,211,102,0.3);">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        Enviar
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    window.sendWhatsAppAction = async function(id, phone, name, actionType) {
        if (!phone || phone === 'null') {
            window.showToast('Profissional sem telefone cadastrado.', 'error');
            return;
        }
        const cleanPhone = phone.replace(/\D/g, '');
        const firstName = name.split(' ')[0];
        let msg = '';
        
        if (actionType === 'analysis') {
            msg = `Olá, ${firstName}! Aqui é do time da Yelo. Vimos que você já preencheu seu perfil, parabéns! Ele está aprovado e pronto para atrair pacientes. Se precisar de dicas, estamos aqui!`;
        } else if (actionType === 'incomplete') {
            msg = `Olá, ${firstName}! Sou da Yelo. Notamos que você se cadastrou, mas não finalizou o perfil. Precisa de ajuda com a foto ou biografia?`;
        } else if (actionType === 'churn') {
            msg = `Olá, ${firstName}! Vimos que seu plano expirou na Yelo. Há algo que poderíamos ter feito melhor? Seu feedback é super importante pra nós!`;
        } else if (actionType === 'billing_feedback') {
            msg = `Olá, ${firstName}! Vimos que você recebeu contatos de pacientes pelo perfil recentemente. Conseguiu fechar agendamentos? Não esqueça de dar o feedback na plataforma!`;
        }

        const link = `https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(msg)}`;
        window.open(link, '_blank');

        // Marcar como enviado no banco
        try {
            const res = await fetch(\`\${API_BASE_URL}/api/admin/psychologists/\${id}/action-sent\`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': \`Bearer \${token}\`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actionType })
            });
            if (res.ok) {
                if (window.showToast) window.showToast('Ação registrada com sucesso!', 'success');
                setTimeout(() => fetchAndRenderPsis(1), 500); // Recarrega a lista
            }
        } catch (e) {
            console.error('Erro ao marcar ação como enviada:', e);
        }
    };

    function renderTable(psis) {
        tableBody.innerHTML = '';
        if (psis.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhum profissional encontrado.</td></tr>`;
            return;
        }

        let copiedList = JSON.parse(localStorage.getItem('yelo_psi_copied_analysis') || '[]');
        let pendingReminders = JSON.parse(localStorage.getItem('yelo_psi_pending_reminder') || '[]');

        psis.forEach(psy => {
            const isVip = psy.is_exempt === true;
            const isDeleted = psy.deletedAt !== null && psy.deletedAt !== undefined;
            
            // 🧠 Sincronização Híbrida: Lê do Banco de Dados (isProfileAnalyzed) ou do cache local do navegador
            const isCopied = psy.isProfileAnalyzed === true || copiedList.includes(String(psy.id));
            const copyBadge = isCopied ? '<span class="badge-copied" title="Análise Copiada" style="margin-left: 5px; font-size: 0.8rem;">✅</span>' : '';
            const pendingBadge = (psy.status === 'pending' && pendingReminders.includes(String(psy.id))) ? '<span class="badge-pending" title="Lembrete Enviado" style="margin-left: 5px; font-size: 0.8rem;">✉️</span>' : '';
            const dataInscricao = new Date(psy.createdAt).toLocaleDateString('pt-BR');

            let statusLabel = psy.status || 'inativo';
            let statusClass = `status-${psy.status || 'inactive'}`;

            if (isDeleted) {
                statusLabel = 'excluído';
                statusClass = 'status-cancelada';
            } else if (psy.status === 'active') {
                if (isVip) statusLabel = 'VIP';
                else if (!psy.stripeSubscriptionId && psy.planExpiresAt && new Date(psy.planExpiresAt) > new Date()) {
                    statusLabel = 'Trial';
                    statusClass = 'status-pending';
                } else statusLabel = 'Ativo';
            } else if (psy.status === 'pending') statusLabel = 'Incompleto';
            else if (psy.status === 'inactive') statusLabel = 'Expirado';

            const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
            const { score } = calculateProfileHealth(psy);

            let scoreColor = '#ef4444';
            if (score >= 75) scoreColor = '#10b981';
            else if (score >= 50) scoreColor = '#f59e0b';

            // Gamificação Level
            const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
            const xpStr = psy.xp ? `${psy.xp} XP` : '0 XP';
            const levelStr = levelMap[psy.authority_level] || 'Iniciante';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Profissional">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        ${psy.fotoUrl ? `<img src="${psy.fotoUrl}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">` : `<div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f5f3ff; color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">${psy.nome.charAt(0).toUpperCase()}</div>`}
                        <div style="display: flex; flex-direction: column;">
                            <strong style="color: var(--verde-escuro); cursor: pointer;" onclick="window.openCSDrawer('${psy.id}')" id="name-psy-${psy.id}">${psy.nome}${copyBadge}${pendingBadge}</strong>
                            <span style="font-size: 0.75rem; color: #666;">${psy.email}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status / Plano">
                    <span class="status ${statusClass}" style="margin-bottom: 4px;">${statusLabel}</span><br>
                    <span style="font-size: 0.8rem; font-weight: 600; color: #475569;">${planoName}</span>
                </td>
                <td data-label="Força do Perfil">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 50px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                            <div style="width: ${score}%; height: 100%; background: ${scoreColor};"></div>
                        </div>
                        <span style="font-size: 0.85rem; font-weight: 600; color: ${scoreColor};">${score}%</span>
                    </div>
                </td>
                <td data-label="Data de Inscrição">
                    <span style="color: #64748b; font-size: 0.9rem; font-weight: 500;">${dataInscricao}</span>
                </td>
                <td data-label="Gamificação">
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: #3b82f6; font-size: 0.9rem;">${levelStr}</strong>
                        <span style="font-size: 0.75rem; color: #64748b;">${xpStr}</span>
                    </div>
                </td>
                <td data-label="Ações CS" style="white-space: nowrap; text-align: right;">
                    <button class="btn-tabela" onclick="window.openCSDrawer('${psy.id}')" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;">
                        Visão 360
                    </button>
                    ${isDeleted ? '' : `<button class="btn-tabela btn-tabela-perigo" onclick="window.forceDeletePsy('${psy.id}', '${psy.nome}')" style="margin-left: 5px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Excluir</button>`}
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    window.forceDeletePsy = function(id, name) {
        if(window.openConfirmationModal) {
            window.openConfirmationModal('Excluir Profissional', `Tem certeza que deseja excluir o psicólogo <strong>${name}</strong> permanentemente?`, async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    if(res.ok) { window.showToast('Excluído com sucesso.', 'success'); fetchAndRenderPsis(1); }
                    else throw new Error('Erro ao excluir');
                } catch(e) { window.showToast(e.message, 'error'); }
            });
        }
    };

    function renderPagination(totalPages, currentPage, totalItems, limit) {
        window.currentCrmPage = currentPage;
        const infoEl = document.getElementById('pagination-info');
        const btnPrev = document.getElementById('btn-prev-page');
        const btnNext = document.getElementById('btn-next-page');
        
        if (!infoEl || !btnPrev || !btnNext) return;

        const effectiveTotal = totalItems || (totalPages * limit) || 0;
        const startItem = effectiveTotal === 0 ? 0 : ((currentPage - 1) * limit) + 1;
        const endItem = Math.min(currentPage * limit, effectiveTotal);
        
        infoEl.textContent = `Mostrando ${startItem}–${endItem} de ${effectiveTotal}`;
        
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = currentPage >= totalPages || totalPages === 0;
    }
    window.loadCrmPsisPage = function(p) { fetchAndRenderPsis(p); };

    // Ouvinte para quando um VIP for atualizado pelo modal global
    window.addEventListener('vipStatusUpdated', () => { fetchAndRenderPsis(1); closeDrawer(); });

    window.cleanupPage = function() {
        window.removeEventListener('vipStatusUpdated', fetchAndRenderPsis);
    };

    fetchAndRenderPsis(1);
};