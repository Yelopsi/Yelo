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