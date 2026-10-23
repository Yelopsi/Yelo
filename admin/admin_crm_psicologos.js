window.initializePage = function () {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');

    const tableBody = document.getElementById('crm-psis-body');
    const tableHead = document.getElementById('crm-table-head') || document.querySelector('.tabela-gerenciamento thead');
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

    // Renderiza a setinha e badge de comparação com o mês anterior
    function renderMetricDiff(el, diff, prevRate) {
        if (!el) return;
        if (diff === undefined || diff === null || isNaN(diff)) {
            el.innerHTML = '';
            return;
        }

        const diffPct = (diff * 100).toFixed(1);
        const numDiff = parseFloat(diffPct);
        const prevPct = prevRate !== undefined && !isNaN(prevRate) ? (prevRate * 100).toFixed(1) : null;
        const prevText = prevPct !== null ? ` (mês ant: ${prevPct}%)` : '';

        if (numDiff > 0) {
            el.innerHTML = `
                <span style="background: rgba(52, 211, 153, 0.15); color: #34d399; padding: 2px 6px; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Melhorou ${diffPct}% em relação aos 30 dias anteriores${prevText}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    +${diffPct}%
                </span>
            `;
        } else if (numDiff < 0) {
            el.innerHTML = `
                <span style="background: rgba(248, 113, 113, 0.15); color: #f87171; padding: 2px 6px; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;" title="Piorou ${Math.abs(numDiff)}% em relação aos 30 dias anteriores${prevText}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    ${diffPct}%
                </span>
            `;
        } else {
            el.innerHTML = `
                <span style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.7); padding: 2px 6px; border-radius: 6px; font-weight: 500; display: inline-flex; align-items: center; gap: 3px;" title="Estável em relação aos 30 dias anteriores${prevText}">
                    <span style="font-weight: bold; line-height: 1;">=</span> 0.0%
                </span>
            `;
        }
    }

    // Fetch Advanced KPIs for Header (MRR, Activation, Retention) nos últimos 30 dias com comparativo
    async function loadAdvancedKpis() {
        try {
            const [founderRes, statsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/founder-metrics`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (founderRes.ok) {
                const data = await founderRes.json();
                const metrics = data.metrics || {};

                // 1. Ativação (30 dias vs 30 dias anteriores)
                const activationEl = document.getElementById('crm-activation');
                const activationDiffEl = document.getElementById('crm-activation-diff');
                const activationTooltip = document.getElementById('tooltip-activation');
                if (activationEl && metrics.activationRate !== undefined) {
                    const actPct = (metrics.activationRate * 100).toFixed(1);
                    activationEl.innerText = `${actPct}%`;
                    renderMetricDiff(activationDiffEl, metrics.activationDiff, metrics.prevActivationRate);
                    if (activationTooltip && metrics.activationTotal !== undefined) {
                        const prevPct = (metrics.prevActivationRate !== undefined) ? (metrics.prevActivationRate * 100).toFixed(1) : '0.0';
                        activationTooltip.setAttribute('data-tooltip', `${metrics.activationActive || 0} de ${metrics.activationTotal || 0} psicólogos cadastrados nos últimos 30 dias (${actPct}%) ativaram o perfil. Mês anterior: ${prevPct}%.`);
                    }
                }

                // 2. Retenção Pós-Trial (30 dias vs 30 dias anteriores)
                const retentionEl = document.getElementById('crm-retention');
                const retentionDiffEl = document.getElementById('crm-retention-diff');
                const postTrialTooltip = document.getElementById('tooltip-post-trial');
                if (retentionEl) {
                    const postTrialPct = (metrics.postTrialRetentionRate !== undefined)
                        ? (metrics.postTrialRetentionRate * 100).toFixed(1)
                        : '0.0';
                    retentionEl.innerText = `${postTrialPct}%`;
                    renderMetricDiff(retentionDiffEl, metrics.postTrialDiff, metrics.prevPostTrialRetentionRate);
                    if (postTrialTooltip) {
                        const totalBase = metrics.postTrialTotal !== undefined ? metrics.postTrialTotal : ((metrics.payingUsers || 0) + (metrics.churnedUsers || 0));
                        const paying = metrics.postTrialPaying !== undefined ? metrics.postTrialPaying : (metrics.payingUsers || 0);
                        const prevPct = (metrics.prevPostTrialRetentionRate !== undefined) ? (metrics.prevPostTrialRetentionRate * 100).toFixed(1) : '--';
                        postTrialTooltip.setAttribute('data-tooltip', `${paying} de ${totalBase} psicólogos (${postTrialPct}%) continuam pagantes ativos após o trial nos últimos 30 dias. Mês anterior: ${prevPct}%.`);
                    }
                }

                // 3. Renovação de Mensalidade (30 dias vs 30 dias anteriores)
                const renewalEl = document.getElementById('crm-renewal-rate');
                const renewalDiffEl = document.getElementById('crm-renewal-diff');
                const renewalTooltip = document.getElementById('tooltip-renewal');
                if (renewalEl) {
                    const renewalPct = (metrics.renewalRate !== undefined)
                        ? (metrics.renewalRate * 100).toFixed(1)
                        : '0.0';
                    renewalEl.innerText = `${renewalPct}%`;
                    renderMetricDiff(renewalDiffEl, metrics.renewalDiff, metrics.prevRenewalRate);
                    if (renewalTooltip && metrics.eligibleForRenewal !== undefined) {
                        const prevPct = (metrics.prevRenewalRate !== undefined) ? (metrics.prevRenewalRate * 100).toFixed(1) : '--';
                        renewalTooltip.setAttribute('data-tooltip', `${metrics.renewedUsers || 0} de ${metrics.eligibleForRenewal || 0} psicólogos elegíveis (${renewalPct}%) renovaram nos últimos 30 dias. Mês anterior: ${prevPct}%.`);
                    }
                }
            }

            if (statsRes.ok) {
                const stats = await statsRes.json();
                // MRR (espelhando a lógica e valor do admin_visao_geral)
                const mrrEl = document.getElementById('crm-mrr');
                if (mrrEl) {
                    mrrEl.innerText = (stats.mrr || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                    });
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
            window.filterByKpi(e.currentTarget.dataset.filter);
        });
    });

    window.filterByKpi = function (filterVal) {
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
        document.querySelector('.tabela-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    let currentTableMode = 'standard';

    function updateTableHeaders(mode) {
        if (currentTableMode === mode && tableHead && tableHead.innerHTML.trim() !== '') return;
        currentTableMode = mode;
        if (!tableHead) return;

        if (mode === 'pending_actions') {
            tableHead.innerHTML = `
                <tr>
                    <th style="min-width: 180px;">Profissional</th>
                    <th>Status da Ação</th>
                    <th>Motivo do Contato</th>
                    <th>Data / Previsão</th>
                    <th>Plano</th>
                    <th style="text-align: right; min-width: 140px;">Ações CS</th>
                </tr>
            `;
        } else {
            tableHead.innerHTML = `
                <tr>
                    <th class="sortable" data-sort="nome" style="cursor: pointer; user-select: none;" title="Clique para ordenar">Profissional <span class="sort-icon" style="font-size: 0.8rem; color: #94a3b8; margin-left: 5px;">${currentSortColumn === 'nome' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>
                    <th class="sortable" data-sort="status" style="cursor: pointer; user-select: none;" title="Clique para ordenar">Status / Plano <span class="sort-icon" style="font-size: 0.8rem; color: #94a3b8; margin-left: 5px;">${currentSortColumn === 'status' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>
                    <th class="sortable" data-sort="score" style="cursor: pointer; user-select: none;" title="Clique para ordenar">Força do Perfil <span class="sort-icon" style="font-size: 0.8rem; color: #94a3b8; margin-left: 5px;">${currentSortColumn === 'score' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>
                    <th class="sortable" data-sort="utm_source" style="cursor: pointer; user-select: none;" title="Clique para ordenar">Origem (UTM) <span class="sort-icon" style="font-size: 0.8rem; color: #94a3b8; margin-left: 5px;">${currentSortColumn === 'utm_source' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>
                    <th class="sortable" data-sort="createdAt" style="cursor: pointer; user-select: none;" title="Clique para ordenar">Data de Inscrição <span class="sort-icon" style="font-size: 0.8rem; color: #94a3b8; margin-left: 5px;">${currentSortColumn === 'createdAt' ? (currentSortOrder === 'asc' ? ' ↑' : ' ↓') : ''}</span></th>
                    <th style="text-align: right; min-width: 140px;">Ações CS</th>
                </tr>
            `;
        }
    }

    if (tableHead) {
        tableHead.addEventListener('click', (e) => {
            const th = e.target.closest('th.sortable');
            if (!th) return;

            const column = th.dataset.sort;
            if (!column) return;

            if (currentSortColumn === column) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortOrder = 'asc';
            }

            // Update icons
            tableHead.querySelectorAll('th.sortable .sort-icon').forEach(icon => icon.textContent = '');
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
    }

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
        if (status === 'pending_actions' || status === 'pending_paid_churn' || status === 'pending_expiring_trial' || status === 'pending_incomplete') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/pending-actions`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Falha ao buscar pendências.');
                const pendingData = await response.json();
                let actionsArray = pendingData.pendingActions || pendingData;

                if (status === 'pending_paid_churn') {
                    actionsArray = actionsArray.filter(a => ['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType));
                } else if (status === 'pending_expiring_trial') {
                    actionsArray = actionsArray.filter(a => a.actionType === 'expiring_trial');
                } else if (status === 'pending_incomplete') {
                    actionsArray = actionsArray.filter(a => a.actionType === 'incomplete');
                }

                renderPendingActionsTable(actionsArray);
                
                const infoEl = document.getElementById('pagination-info');
                if (infoEl) infoEl.textContent = `Mostrando ${actionsArray.length} ações`;
                return;
            } catch (error) {
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar ações pendentes.</td></tr>`;
                return;
            }
        }

        if (status === 'low_performance') {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/psychologists/low-performance`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Falha ao buscar performance.');
                const data = await response.json();
                
                const aiKpiEl = document.getElementById('kpi-ai-psis');
                if (aiKpiEl) aiKpiEl.textContent = data.count || 0;

                psisDataCache = data.psychologists || [];
                renderTable(psisDataCache);
                
                const infoEl = document.getElementById('pagination-info');
                if (infoEl) infoEl.textContent = `Mostrando ${psisDataCache.length} psicólogos para análise (Média: ${Math.round(data.platformAvgCtr*100)}% conversão | ${Math.round(data.platformAvgMatches)} aparições)`;
                return;
            } catch (error) {
                console.error(error);
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar análise de performance.</td></tr>`;
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
                setText('kpi-churn-month-psis', kpis.churn_month || 0);
                setText('kpi-pendentes-psis', kpis.pending);
                setText('kpi-inativos-psis', kpis.inactive);
                setText('kpi-whatsapp-psis', kpis.utm_whatsapp || 0);
                setText('kpi-meta-psis', kpis.utm_meta || 0);
                setText('kpi-instagram-psis', kpis.utm_instagram_bio || 0);
                setText('kpi-google-psis', kpis.utm_google || 0);
                setText('kpi-outros-psis', kpis.utm_outros || 0);
                setText('kpi-alerta-pendentes', kpis.pending || 0);

                // Ativação: só sobrescreve se houver filtro customizado de data ativo no CRM
                const activationEl = document.getElementById('crm-activation');
                if ((startDate || endDate) && activationEl && kpis.total > 0) {
                    const ativos = (parseInt(kpis.active_paying) || 0) + (parseInt(kpis.active_trial) || 0) + (parseInt(kpis.vip) || 0);
                    const actPct = ((ativos / kpis.total) * 100).toFixed(1);
                    activationEl.innerText = `${actPct}%`;
                    const diffEl = document.getElementById('crm-activation-diff');
                    if (diffEl) diffEl.innerHTML = `<span style="color: rgba(255,255,255,0.6); font-size: 0.72rem;">período filtrado</span>`;
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
        updateTableHeaders('pending_actions');
        tableBody.innerHTML = '';
        if (data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhuma ação pendente! 🎉</td></tr>`;
            return;
        }

        window.__pendingActionsMap = window.__pendingActionsMap || new Map();
        window.__pendingActionsList = Array.isArray(data) ? data : [];

        data.forEach(item => {
            const actionKey = `${item.id}_${item.actionType}`;
            window.__pendingActionsMap.set(actionKey, item);

            let dateStr = '-';
            if (item.actionType === 'expiring_trial' && item.planExpiresAt) {
                dateStr = new Date(item.planExpiresAt).toLocaleDateString('pt-BR');
            } else if (item.createdAt) {
                dateStr = new Date(item.createdAt).toLocaleDateString('pt-BR');
            }

            let actionBadge = '';
            if (item.actionType === 'analysis') actionBadge = '<span class="status status-active">Análise Pronta</span>';
            else if (item.actionType === 'incomplete') actionBadge = '<span class="status status-pending">Perfil Incompleto</span>';
            else if (item.actionType === 'churn') actionBadge = '<span class="status status-cancelada">Churn Trial</span>';
            else if (item.actionType === 'paid_churn') actionBadge = '<span class="status status-cancelada" style="background:#ffe4e6; color:#be123c;">Churn Pago</span>';
            else if (item.actionType === 'billing_feedback') actionBadge = '<span class="status" style="background:#e0e7ff; color:#4338ca;">Feedback/Cobrança</span>';
            else if (item.actionType === 'expiring_trial') actionBadge = '<span class="status" style="background:#fef08a; color:#b45309;">Trial Expirando</span>';
            else if (item.actionType === 'low_performance') actionBadge = '<span class="status" style="background:#f3e8ff; color:#7c3aed;">Análise (IA)</span>';
            else if (item.actionType === 'conversion_failure') actionBadge = '<span class="status" style="background:#fee2e2; color:#b91c1c;">Falha Conversão</span>';
            else if (item.actionType === 'negotiation') actionBadge = '<span class="status" style="background:#ffedd5; color:#c2410c;">Em Negociação</span>';

            let nameHtml = `<strong style="color: var(--verde-escuro); cursor: pointer; white-space: normal; word-break: break-word; overflow-wrap: break-word; line-height: 1.35;" onclick="window.openCSDrawer('${item.id}')" id="name-psy-${item.id}">${item.nome}</strong>`;
            
            if (item.actionType === 'low_performance' && item.aiOptimizationHistory) {
                const history = Array.isArray(item.aiOptimizationHistory) ? item.aiOptimizationHistory : [];
                if (history.some(h => h.action === 'whatsapp_ai_diagnosis')) {
                    nameHtml = `<strong style="color: var(--verde-escuro); cursor: pointer; white-space: normal; word-break: break-word; overflow-wrap: break-word; line-height: 1.35;" onclick="window.openCSDrawer('${item.id}')" id="name-psy-${item.id}">${item.nome} <span class="badge-pending" title="Contato IA Realizado" style="margin-left: 5px; font-size: 0.8rem;">🤖📱</span></strong>`;
                }
            }

            const planoLabel = item.plano ? (item.plano.charAt(0).toUpperCase() + item.plano.slice(1).toLowerCase()) : '-';
            let btnPrimaryLabel = 'Contatar (WhatsApp)';
            let btnPrimaryClass = 'btn-tabela btn-tabela-wpp';
            let btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>';

            if (item.actionType === 'conversion_failure') {
                btnPrimaryLabel = 'Reverter Falha (IA)';
                btnPrimaryClass = 'btn-tabela btn-tabela-conversion';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>';
            } else if (item.actionType === 'analysis') {
                btnPrimaryLabel = 'Enviar Análise (IA)';
                btnPrimaryClass = 'btn-tabela btn-tabela-analysis';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>';
            } else if (item.actionType === 'low_performance') {
                btnPrimaryLabel = 'Diagnóstico (IA)';
                btnPrimaryClass = 'btn-tabela btn-tabela-lowperf';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
            } else if (item.actionType === 'expiring_trial') {
                btnPrimaryLabel = 'Converter Plano (IA)';
                btnPrimaryClass = 'btn-tabela btn-tabela-trial';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
            } else if (item.actionType === 'churn') {
                btnPrimaryLabel = 'Resgate Trial (IA)';
                btnPrimaryClass = 'btn-tabela btn-tabela-churn';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="4"></circle><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"></line><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"></line><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"></line><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"></line></svg>';
            } else if (item.actionType === 'paid_churn') {
                btnPrimaryLabel = 'Recuperar Assinante';
                btnPrimaryClass = 'btn-tabela btn-tabela-paidchurn';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>';
            } else if (item.actionType === 'billing_feedback') {
                btnPrimaryLabel = 'Checar Contato';
                btnPrimaryClass = 'btn-tabela btn-tabela-feedback';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
            } else if (item.actionType === 'incomplete') {
                btnPrimaryLabel = 'Ativar Perfil';
                btnPrimaryClass = 'btn-tabela btn-tabela-incomplete';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7.5" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>';
            } else if (item.actionType === 'negotiation') {
                btnPrimaryLabel = 'Acompanhar Negociação';
                btnPrimaryClass = 'btn-tabela btn-tabela-negotiation';
                btnPrimaryIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>';
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Profissional">
                    <div style="display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0;">
                        <div style="display: flex; flex-direction: column; min-width: 0; flex: 1;">
                            ${nameHtml}
                            <span style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${item.telefone || 'Sem telefone'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status da Ação">
                    ${actionBadge}
                </td>
                <td data-label="Motivo do Contato">
                    <span class="motivo-contato-texto">${item.reason}</span>
                </td>
                <td data-label="Data / Previsão">
                    <span style="color: #64748b; font-size: 0.88rem; font-weight: 500;">${dateStr}</span>
                </td>
                <td data-label="Plano">
                    <span style="font-size: 0.82rem; color: #64748b; font-weight: 500;">${planoLabel}</span>
                </td>
                <td data-label="Ações CS" style="white-space: nowrap; text-align: right;">
                    <button class="${btnPrimaryClass}" onclick="window.sendPendingAction('${item.id}', '${item.actionType}', this)" title="${btnPrimaryLabel}">
                        ${btnPrimaryIcon} <span>${btnPrimaryLabel}</span>
                    </button>
                    <button class="btn-tabela btn-tabela-dispensar" onclick="window.dismissAction('${item.id}', '${item.actionType}')" style="margin-left: 6px;" title="Ignorar esta ação">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> <span>Ignorar</span>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    window.sendPendingAction = function (id, actionType, btnElement) {
        const actionKey = `${id}_${actionType}`;
        let item = window.__pendingActionsMap?.get(actionKey);
        if (!item) {
            const list = window.__pendingActionsList || [];
            item = list.find(a => String(a.id) === String(id) && a.actionType === actionType) || list.find(a => String(a.id) === String(id));
        }
        if (!item) {
            const nameEl = document.getElementById(`name-psy-${id}`);
            const name = nameEl ? nameEl.innerText.trim() : 'Colega';
            item = { id, nome: name, telefone: null, actionType };
        }
        window.sendWhatsAppAction(
            item.id,
            item.telefone,
            item.nome,
            item.actionType,
            item.patientName || '',
            item.feedbackToken || '',
            encodeURIComponent(JSON.stringify(item.metrics || {})),
            btnElement
        );
    };

    window.dismissAction = function(id, actionType) {
        if (window.openConfirmationModal) {
            window.openConfirmationModal('Descartar Ação', 'Deseja ignorar esta ação e removê-la da lista (nenhuma mensagem será enviada)?', async () => {
                await performDismiss(id, actionType);
            });
        } else {
            if (!confirm('Deseja ignorar esta ação e removê-la da lista (nenhuma mensagem será enviada)?')) return;
            performDismiss(id, actionType);
        }
    };

    async function performDismiss(id, actionType) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/action-sent`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actionType, messageContent: 'Ação ignorada/descartada pelo Admin.' })
            });
            if (res.ok) {
                if (window.showToast) window.showToast('Ação descartada com sucesso!', 'success');
                const statusInput = document.getElementById('crm-status-psi');
                if (statusInput && statusInput.value === 'pending_actions') {
                    setTimeout(() => fetchAndRenderPsis(window.currentCrmPage || 1), 500);
                }
            } else {
                if (window.showToast) window.showToast('Erro ao descartar ação', 'error');
            }
        } catch (e) {
            console.error('Erro ao descartar ação', e);
            if (window.showToast) window.showToast('Erro na requisição', 'error');
        }
    }

    function formatForWhatsApp(text) {
        if (!text || typeof text !== 'string') return '';
        return text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/^```[a-zA-Z]*\n?/gm, '')
            .replace(/```$/gm, '')
            .replace(/^["'“”](.*)["'“”]$/s, '$1')
            .replace(/^[-*_]{3,}\s*$/gm, '')
            .replace(/^#{1,6}\s*(.+)$/gm, '*$1*')
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1: $2')
            .replace(/\*\*([^*\n]+?)\*\*/g, '*$1*')
            .replace(/__([^_\n]+?)__/g, '_$1_')
            .replace(/^[-]\s+/gm, '* ')
            .replace(/\*[ \t]+([^*\n]+?)[ \t]+\*/g, '*$1*')
            .replace(/\*[ \t]+([^*\n]+?)\*/g, '*$1*')
            .replace(/\*([^*\n]+?)[ \t]+\*/g, '*$1*')
            .replace(/_[ \t]+([^_\n]+?)[ \t]+_/g, '_$1_')
            .replace(/_[ \t]+([^_\n]+?)_/g, '_$1_')
            .replace(/_([^_\n]+?)[ \t]+_/g, '_$1_')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    window.sendWhatsAppAction = async function (id, phone, name, actionType, patientName = '', feedbackToken = '', metricsStr = '{}', btnElement = null) {
        if (btnElement && btnElement.disabled) return;

        let originalHtml = '';
        if (btnElement) {
            originalHtml = btnElement.innerHTML;
            btnElement.disabled = true;
            btnElement.innerHTML = `<svg style="animation: spin 1s linear infinite; margin-right: 4px; vertical-align: middle;" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> <span>Gerando...</span>`;
        }

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        let popupWindow = null;
        let cleanPhone = (phone || '').toString().replace(/\D/g, '');

        if (!cleanPhone) {
            const manualPhone = prompt(`O profissional ${name || 'selecionado'} não possui telefone cadastrado.\n\nInforme o número do WhatsApp com DDD para abrir a conversa (ou clique em OK/Cancelar para apenas gerar e copiar o texto da mensagem):`, '');
            if (manualPhone && manualPhone.trim()) {
                cleanPhone = manualPhone.replace(/\D/g, '');
            }
        }

        // Se tiver telefone e for desktop, abre uma aba em branco imediatamente durante o clique do usuário para o navegador nunca bloquear como popup
        if (!isMobile && cleanPhone) {
            try {
                popupWindow = window.open('about:blank', '_blank');
                if (popupWindow) {
                    popupWindow.document.write('<title>Yelo CRM - Gerando...</title><body style="background:#0f172a;color:#f8fafc;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="text-align:center;"><p style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">🌿 Gerando mensagem com IA...</p><p style="color:#94a3b8;font-size:0.9rem;">Abrindo WhatsApp em instantes...</p></div></body>');
                }
            } catch (_) {}
        }

        try {
            const firstName = (name || 'Colega').split(' ')[0];
            const metrics = metricsStr && metricsStr !== '{}' ? JSON.parse(decodeURIComponent(metricsStr)) : {};
            let msg = '';

            if (actionType === 'analysis') {
                try {
                    if (window.showToast) window.showToast('Gerando mensagem de boas-vindas / análise com IA... Aguarde.', 'info');
                    const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                    const resAnalise = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/analyze`, {
                        headers: { 'Authorization': `Bearer ${tokenAdmin}` },
                        credentials: 'include'
                    });
                if (resAnalise.ok) {
                    const data = await resAnalise.json();
                    if (data && data.message) {
                        msg = data.message;
                        await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/analyzed`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAdmin}` },
                            credentials: 'include',
                            body: JSON.stringify({ isProfileAnalyzed: true })
                        }).catch(() => {});
                    }
                }
            } catch (e) {
                console.warn("Aviso ao buscar análise de perfil:", e);
            }

            if (!msg) {
                msg = `Olá, ${firstName}! Tudo bem?\n\nEu sou o Anderson, da Yelo. Pedi à nossa equipe de Growth para dar uma olhada no seu perfil agora que você está dando os primeiros passos na plataforma e trouxe algumas sugestões práticas para te ajudar a atrair pacientes. 🌿\n\nQue ótimo ver o seu perfil ativo na plataforma! Você já deu o passo principal para construir sua vitrine clínica por aqui.\n\nNeste início, a nossa principal recomendação é enriquecer um pouco mais a sua biografia falando diretamente com a dor do paciente e detalhando como funciona o seu acolhimento.\n\n• Ferramenta: *Ajustes > Meu Perfil*\n• O que fazer: divida o texto em parágrafos curtos (a maioria dos pacientes lê pelo celular) e alinhe seus temas de atuação com o que você descreve na bio.\n\nNos próximos dias, vale acompanhar a evolução das suas aparições nas buscas e visualizações de perfil no seu painel. Qualquer dúvida, conte comigo por aqui! 🚀`;
            }
        } else if (actionType === 'incomplete') {
            msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nVi que você deu o primeiro passo e iniciou o seu cadastro na nossa plataforma, mas acabou não finalizando o preenchimento do seu perfil. Eu sei bem que a rotina de atendimentos acaba engolindo o nosso tempo, né? rs\n\nPassei só para te lembrar que os seus 7 dias de teste gratuito (sem precisar cadastrar cartão de crédito) só começam a contar depois que o seu perfil estiver completo e a sua página disponível para receber pacientes!\n\nÉ a oportunidade perfeita para você testar na prática como a plataforma te conecta com pacientes direto no seu WhatsApp, lembrando que a gente não cobra nenhuma taxa ou comissão pelas suas sessões.\n\nFalta bem pouco para o seu perfil ficar ativo nas buscas. Se precisar de uma mãozinha para preencher a sua bio ou tiver qualquer dúvida, é só me dar um toque respondendo esta mensagem. Sigo super à disposição por aqui!`;
        
        } else if (actionType === 'expired_pix_fomo') {
            const m = metrics || {};
            const approach = m.approach || 'Psicologia';
            
            let performanceText = '';
            if (m.startedTherapyCount > 0 || m.negotiatingCount > 0) {
                let statusDetails = [];
                if (m.startedTherapyCount > 0) {
                    statusDetails.push(`*${m.startedTherapyCount} paciente(s) já iniciou(aram) terapia*`);
                }
                if (m.negotiatingCount > 0) {
                    statusDetails.push(`*${m.negotiatingCount} ainda está(ão) em negociação*`);
                }
                
                performanceText = `alcançando *${m.appearances || 0} aparições em buscas*, *${m.views || 0} visualizações na sua página* e *${m.clicks || 0} cliques para o seu WhatsApp*. Desses contatos, sabemos que ${statusDetails.join(' e ')} com você!`;
            } else if (m.clicks > 0) {
                performanceText = `alcançando *${m.appearances || 0} aparições em buscas* e *${m.clicks || 0} pacientes chegaram a te chamar no WhatsApp* para negociar.`;
            } else {
                performanceText = `alcançando *${m.appearances || 0} aparições em buscas de pacientes*.`;
            }

            let potentialText = '';
            if (m.dealClosed) {
                potentialText = `A sua apresentação focada na *${approach}* tem um potencial gigante para continuar atraindo os pacientes certos para a sua clínica.`;
            } else if (m.clicks > 0) {
                potentialText = `A sua apresentação focada na *${approach}* tem um potencial gigante e é só questão de tempo até convertermos esses contatos em pacientes reais para a sua clínica.`;
            } else {
                potentialText = `A sua apresentação focada na *${approach}* tem um diferencial enorme e o algoritmo estava justamente aprendendo o seu perfil para te ranquear melhor.`;
            }

            msg = `Bom dia, ${firstName}! Como vai?\n\nPassando por aqui com um aviso importante: a sua assinatura da Yelo venceu ontem e, por conta disso, o seu perfil acabou entrando em pausa no sistema e saiu do ar temporariamente.\n\nComo acompanho de perto a sua trajetória, não queria deixar você perder a ótima tração que construímos juntos. O seu perfil vinha com uma visibilidade excelente — ${performanceText}\n\n${potentialText}\n\nPara o seu perfil voltar ao ar imediatamente e não quebrarmos o ritmo que o algoritmo já gerou para você, basta regularizar a assinatura.\n\nÉ bem simples: basta acessar a sua conta, ir no menu *Ajustes > Assinaturas e Planos* e atualizar a forma de pagamento.\n\nSe precisar de qualquer ajuda com o acesso, sigo totalmente à disposição. 🌿`;

        } else if (actionType === 'paid_churn') {
            const currentMonthName = new Date().toLocaleString('pt-BR', { month: 'long' });
            const m = metrics || {};
            const churnType = m.churnType || 'expired_cycle';
            
            let X = m.clicks || 0, Y = m.dealClosedCount || 0, VALOR = m.sessionPrice ? String(m.sessionPrice).replace('.', ',') : '150,00';
            let approach = m.approach || 'Psicologia Clínica';
            
            try {
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : token;
                const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/full-details`, {
                    headers: { 'Authorization': `Bearer ${tokenAdmin}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.whatsappLogs) {
                        const now = new Date();
                        const currentMonthLogs = data.whatsappLogs.filter(log => {
                            const logDate = new Date(log.createdAt);
                            return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
                        });
                        if (currentMonthLogs.length > 0) {
                            X = currentMonthLogs.length;
                            Y = currentMonthLogs.filter(log => log.status === 'fechou' || log.dealClosed === 'yes').length;
                        }
                    }
                    const psy = data.psychologist || data;
                    if (psy.valorSessao) VALOR = parseFloat(psy.valorSessao).toFixed(2).replace('.', ',');
                    if (psy.abordagens_tecnicas && psy.abordagens_tecnicas.length > 0) approach = psy.abordagens_tecnicas[0];
                }
            } catch(e) { console.error('Erro ao buscar stats para churn', e); }

            // Trava de segurança: só disponibilizar para quem recebeu ao menos 2 contatos de pacientes
            if (X < 2) {
                if (window.showToast) window.showToast('Ação de recall disponível apenas para profissionais com ao menos 2 contatos de pacientes.', 'warning');
                return;
            }

            const contatoStr = X === 1 ? 'contato de paciente' : 'contatos de pacientes';
            const pacienteStr = Y === 1 ? 'paciente novo' : 'pacientes novos';

            let perfSnippet = '';
            if (Y > 0) {
                perfSnippet = `Dei uma olhada nos seus resultados recentes e vi que você recebeu ${X} ${contatoStr} e fechou com ${Y} ${pacienteStr} pela Yelo (o que a R$ ${VALOR} por sessão já pagou a sua assinatura com muita folga!). 🚀`;
            } else if (X > 0) {
                perfSnippet = `Dei uma olhada nos seus números e vi que você já recebeu ${X} ${contatoStr} pelo WhatsApp. O seu perfil com foco em *${approach}* estava ganhando uma tração bem legal! 🚀`;
            } else {
                perfSnippet = `O seu perfil voltado para *${approach}* tem um diferencial excelente e o algoritmo da plataforma já estava começando a posicionar você melhor nas buscas! 🌱`;
            }

            // CENÁRIO 1: CARTÃO DE CRÉDITO RECUSADO NA RENOVAÇÃO
            if (churnType === 'card_declined') {
                msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nEstou passando para te dar um toque rápido e super importante sobre a sua conta: o nosso sistema tentou renovar automaticamente a sua assinatura mensal, mas a operadora do seu cartão recusou a cobrança (geralmente é só limite do mês virando ou um bloqueio preventivo do banco para pagamentos recorrentes online).\n\nPor conta disso, o seu perfil entrou em pausa temporária para novos pacientes.\n\n${perfSnippet}\n\nNão quero de forma alguma que você saia do ar e perca o embalo de novos agendamentos que estamos construindo juntos.\n\nPara o seu perfil voltar ao ar imediatamente, é super simples: basta acessar sua conta na Yelo, ir na aba *"Ajustes" > "Assinaturas e Planos"* e atualizar o seu cartão ou emitir um Pix.\n\nSe preferir, posso te enviar a chave Pix direto por aqui também. Qualquer dúvida, estou à disposição! 🌿`;

            // CENÁRIO 2: PIX DE RENOVAÇÃO EXPIRADO
            } else if (churnType === 'pix_expired') {
                msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando rapidinho para te avisar que o código Pix de renovação da sua mensalidade da Yelo acabou vencendo e expirou no sistema.\n\nPor conta disso, o seu perfil entrou em pausa automática nas buscas de pacientes.\n\n${perfSnippet}\n\nComo não quero que você perca os pacientes que estão procurando atendimento na sua especialidade, quer que eu te envie um novo código Pix copia-e-cola direto por aqui para você reativar em 1 minuto?\n\n*(Dica: se preferir não ter que se preocupar com datas todo mês, você também pode cadastrar um cartão de crédito no seu painel em Ajustes > Assinaturas e Planos).*\n\nSigo à disposição por aqui! Um abraço. 🌿`;

            // CENÁRIO 3: CANCELAMENTO VOLUNTÁRIO / ESTORNO
            } else if (churnType === 'voluntary_refund') {
                msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nVi aqui no sistema que você optou por encerrar a sua assinatura e o seu plano foi desativado.\n\nQueria te mandar essa mensagem primeiro para agradecer pelo período em que estivemos juntos e, principalmente, para te ouvir com sinceridade. Como estamos sempre aprimorando a Yelo para os psicólogos clínicos, seu feedback é precioso pra gente:\n\n${perfSnippet}\n\nO que mais pesou na sua decisão de não continuar neste momento? Faltou algum suporte nosso, o retorno de pacientes foi diferente do esperado ou foi uma questão de momento pessoal/financeiro?\n\nFico super aberto para entender e, caso queira conversar, as portas da Yelo estarão sempre abertas para você. Um grande abraço! 🌱`;

            // CENÁRIO 4: TÉRMINO DE CICLO GERAL
            } else {
                msg = `Olá, ${firstName}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nPassando para te dar um toque sobre a sua assinatura da Yelo: o seu ciclo mensal chegou ao fim e o seu perfil entrou em pausa para novas buscas.\n\n${perfSnippet}\n\nPara não quebrar a consistência que o algoritmo já gerou para você e manter o seu consultório virtual ativo recebendo pacientes, basta renovar o plano.\n\nÉ bem prático: acesse seu painel na Yelo, vá em *"Ajustes" > "Assinaturas e Planos"* e escolha o pagamento via Cartão ou Pix.\n\nSe precisar de qualquer ajuda com o acesso, estou à disposição! 🌿`;
            }
} else if (actionType === 'churn') {
            try {
                if (window.showToast) window.showToast('Gerando copy de resgate com IA... Aguarde.', 'info');
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                const resAi = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/ai-churn-message`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await resAi.json();
                if (data.whatsappCopy) {
                    msg = data.whatsappCopy;
                } else {
                    if (window.showToast) window.showToast(data.error || "Erro ao gerar copy de resgate", "error");
                    return;
                }
            } catch (e) {
                if (window.showToast) window.showToast("Erro na IA: " + e.message, "error");
                return;
            }
        } else if (actionType === 'expiring_trial') {
            try {
                if (window.showToast) window.showToast('Gerando mensagem consultiva com IA... Aguarde.', 'info');
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                const resAi = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/ai-expiring-trial-message`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await resAi.json();
                if (data.whatsappCopy) {
                    msg = data.whatsappCopy;
                } else {
                    if (window.showToast) window.showToast(data.error || "Erro ao gerar copy consultiva", "error");
                    return;
                }
            } catch (e) {
                if (window.showToast) window.showToast("Erro na IA: " + e.message, "error");
                return;
            }
        } else if (actionType === 'billing_feedback') {
            let baseUrlFeedback = window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://www.yelopsi.com.br';
            let linkFeedback = feedbackToken ? `${baseUrlFeedback}/magic-feedback?token=${feedbackToken}` : `${baseUrlFeedback}/psi/dashboard`;
            
            const pendingCount = metrics.pendingCount || 1;
            const isFirst = metrics.isFirstFeedbackRequest !== false;
            
            let introText = '';
            
            if (pendingCount > 1) {
                introText = `Alguns pacientes entraram`;
            } else {
                if (patientName && patientName.toLowerCase() !== 'visitante' && patientName.toLowerCase() !== 'um paciente') {
                    introText = `O(a) paciente ${patientName} entrou`;
                } else {
                    introText = `Um paciente entrou`;
                }
            }

            if (isFirst) {
                msg = `Olá, ${firstName}! Tudo bem?\n\n${introText} em contato com você pela Yelo. Você pode acessar o link abaixo e informar:\n\n• A mensagem chegou?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\n*Responder agora:*\n👉 ${linkFeedback}\n\nObrigado! 🌿`;
            } else {
                let introTextRecorrente = '';
                if (pendingCount > 1) {
                    introTextRecorrente = `mais alguns pacientes tentaram`;
                } else {
                    if (patientName && patientName.toLowerCase() !== 'visitante' && patientName.toLowerCase() !== 'um paciente') {
                        introTextRecorrente = `o(a) paciente ${patientName} tentou`;
                    } else {
                        introTextRecorrente = `mais um paciente tentou`;
                    }
                }
                
                msg = `Olá, ${firstName}! Tudo bem?\n\nO seu perfil continua gerando resultados na Yelo! ✨\nPercebemos que ${introTextRecorrente} entrar em contato com você recentemente.\n\nPara mantermos o seu perfil forte e continuarmos te indicando no nosso ranking, precisamos apenas da sua confirmação rápida. Acesse o link abaixo e nos conte:\n\n• A mensagem chegou?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto!\n\n*Responder agora:*\n👉 ${linkFeedback}\n\nMuito obrigado pela parceria! 🌿`;
            }
        } else if (actionType === 'low_performance') {
            try {
                if (window.showToast) window.showToast('Gerando consultoria com IA... Aguarde.', 'info');
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                const resAi = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/ai-diagnosis`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await resAi.json();
                if (data.whatsappCopy) {
                    msg = data.whatsappCopy;
                } else {
                    if (window.showToast) window.showToast(data.error || "Erro ao gerar consultoria", "error");
                    return;
                }
            } catch (e) {
                if (window.showToast) window.showToast("Erro na IA: " + e.message, "error");
                return;
            }
        } else if (actionType === 'conversion_failure') {
            try {
                if (window.showToast) window.showToast('Analisando perfil para fundo de funil... Aguarde.', 'info');
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                const resAi = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/ai-conversion-failure`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                if (resAi.ok) {
                    const data = await resAi.json();
                    if (data && data.whatsappCopy) {
                        msg = data.whatsappCopy;
                    }
                }
            } catch (e) {
                console.warn("Aviso ao buscar copy de conversão:", e);
            }

            if (!msg) {
                msg = `Olá, ${firstName}! Tudo bem?\n\nEstava acompanhando as métricas do seu perfil na Yelo e é muito bom ver que a sua página está gerando interesse e atraindo cliques no WhatsApp! Notei, porém, que os últimos contatos acabaram ainda não avançando para o agendamento.\n\nQuando o paciente clica no WhatsApp, os primeiros minutos de acolhimento e a forma de conduzir a conversa até o valor da sessão fazem toda a diferença. Recomendo dar uma olhada na ferramenta *Clínica > Manual de Conversão* lá no seu painel — preparamos roteiros práticos justamente para evitar que o paciente deixe no vácuo.\n\nQualquer dúvida ou se quiser trocar uma ideia sobre a abordagem inicial, estou por aqui! 🌿`;
            }
        } else if (actionType === 'negotiation') {
            const metrics = metricsStr && metricsStr !== '{}' ? JSON.parse(decodeURIComponent(metricsStr)) : {};
            const dataNeg = metrics.dataNeg || 'alguns dias';
            msg = `Olá, ${firstName}. Como vai?\n\nPreciso da sua ajuda com um retorno rápido.\n\nVocê estava em negociação com ${patientName} desde ${dataNeg}:\n\n• Conseguiram conversar novamente?\n• O paciente iniciou a terapia?\n\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\nPara responder, acesse sua conta na Yelo e vá até a opção *Evolução > Histórico de Contatos* e mude o status "⏳ Em negociação".\n\nObrigado! 🌿`;
        }

            // Formata e sanitiza para o parser nativo do WhatsApp não perder a formatação
            msg = formatForWhatsApp(msg);

            // Se o psicólogo não possui telefone cadastrado e o admin não informou manualmente:
            if (!cleanPhone) {
                if (popupWindow) popupWindow.close();
                try {
                    await navigator.clipboard.writeText(msg);
                    if (window.showToast) window.showToast('Mensagem gerada e copiada para a área de transferência! (Profissional sem telefone)', 'success');
                    else alert('Mensagem gerada e copiada para a área de transferência!');
                } catch (_) {
                    prompt('Profissional sem telefone cadastrado. Copie o texto gerado abaixo:', msg);
                }
                return;
            }

            // Garante formato 55DDD999999999 sem duplicar o DDI 55
            let fullPhone = cleanPhone;
            if (fullPhone.length === 10 || fullPhone.length === 11) {
                fullPhone = '55' + fullPhone;
            }

            // Universal link oficial: abre direto no app nativo no mobile (iOS/Android) sem perder quebras de linha e formatação
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(msg)}`;

            // Marcar como enviado no banco ANTES de redirecionar para o WhatsApp (evita que a requisição seja cancelada pelo descarregamento no mobile)
            try {
                const tokenAdmin = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? (localStorage.getItem('Yelo_token') || 'cookie_auth_active') : (localStorage.getItem('Yelo_token') || localStorage.getItem('Yelo_token_admin') || '');
                const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}/action-sent`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${tokenAdmin}`,
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ actionType, messageContent: msg })
                });
                if (res.ok) {
                    if (window.showToast) window.showToast('Ação registrada com sucesso!', 'success');
                    const statusInput = document.getElementById('crm-status-psi');
                    if (statusInput && statusInput.value === 'pending_actions') {
                        setTimeout(() => fetchAndRenderPsis(window.currentCrmPage || 1), 600);
                    }
                }
            } catch (e) {
                console.error('Erro ao marcar ação como enviada:', e);
            }

            if (popupWindow && !popupWindow.closed) {
                popupWindow.location.href = whatsappUrl;
            } else if (isMobile) {
                window.location.href = whatsappUrl;
            } else {
                const win = window.open(whatsappUrl, '_blank');
                if (!win) {
                    window.location.href = whatsappUrl;
                }
            }
        } catch (err) {
            console.error('Erro em sendWhatsAppAction:', err);
            if (popupWindow) popupWindow.close();
            if (window.showToast) window.showToast('Erro ao processar mensagem: ' + (err.message || err), 'error');
        } finally {
            if (btnElement) {
                btnElement.disabled = false;
                btnElement.innerHTML = originalHtml;
            }
        }
    };

    function renderTable(psis) {
        updateTableHeaders('standard');
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
            
            const hasPlaybookSent = psy.msg_analysis_sent_at || psy.msg_incomplete_profile_sent_at || psy.msg_churn_followup_sent_at || psy.msg_paid_churn_sent_at || psy.admin_billing_sent_at || (psy.aiOptimizationHistory && psy.aiOptimizationHistory.length > 0);
            const pendingBadge = (hasPlaybookSent || pendingReminders.includes(String(psy.id))) ? '<span class="badge-pending" title="Playbook/Mensagem Enviada (Salvo no Banco de Dados)" style="margin-left: 5px; font-size: 0.8rem;">✉️</span>' : '';
            const dataInscricao = new Date(psy.createdAt).toLocaleDateString('pt-BR');

            let statusLabel = psy.status || 'inativo';
            let statusClass = `status-${psy.status || 'inactive'}`;

            if (isDeleted) {
                statusLabel = 'excluído';
                statusClass = 'status-cancelada';
            } else if (psy.status === 'active') {
                if (isVip) {
                    statusLabel = 'VIP';
                } else if (psy.planExpiresAt && new Date(psy.planExpiresAt) <= new Date()) {
                    // Força status "Expirado" no front caso a data já tenha passado (Lazy Evaluation Fallback)
                    statusLabel = 'Expirado';
                    statusClass = 'status-inactive';
                } else if (!psy.subscriptionId && !(psy.subscription_payments_count && psy.subscription_payments_count > 0)) {
                    statusLabel = 'Trial';
                    statusClass = 'status-pending'; // Trial usa cor amarela/pendente
                } else {
                    statusLabel = 'Ativo';
                    // statusClass já é status-active
                }
            } else if (psy.status === 'pending') {
                statusLabel = 'Incompleto';
            } else if (psy.status === 'inactive') {
                statusLabel = 'Expirado';
            }

            const planoName = psy.plano ? (psy.plano.charAt(0).toUpperCase() + psy.plano.slice(1).toLowerCase()) : 'Nenhum';
            const { score } = calculateProfileHealth(psy);

            let scoreColor = '#ef4444';
            if (score >= 75) scoreColor = '#10b981';
            else if (score >= 50) scoreColor = '#f59e0b';

            // Gamificação Level
            const levelMap = { 'nivel_iniciante': 'Iniciante', 'nivel_verificado': 'Verificado', 'nivel_ativo': 'Ativo', 'nivel_especialista': 'Especialista', 'nivel_mentor': 'Mentor' };
            const xpStr = psy.xp ? `${psy.xp} XP` : '0 XP';
            const levelStr = levelMap[psy.authority_level] || 'Iniciante';

            // UTM Source
            let utmBadge = `<span style="color: #94a3b8; font-size: 0.8rem;">Orgânico/Direto</span>`;
            if (psy.utm_source) {
                let badgeColor = '#64748b'; let bgBadge = '#f1f5f9';
                if (psy.utm_source === 'whatsapp') { badgeColor = '#10b981'; bgBadge = '#d1fae5'; }
                else if (psy.utm_source === 'meta_ads' || psy.utm_source === 'facebook' || psy.utm_source === 'instagram') { badgeColor = '#3b82f6'; bgBadge = '#dbeafe'; }
                else if (psy.utm_source === 'instagram_bio') { badgeColor = '#ec4899'; bgBadge = '#fce7f3'; }
                else if (psy.utm_source === 'google') { badgeColor = '#f59e0b'; bgBadge = '#fef3c7'; }
                
                utmBadge = `<span class="utm-pill-tag" style="background: ${bgBadge}; color: ${badgeColor};">${psy.utm_source}</span>`;
                if (psy.utm_medium) utmBadge += `<br><span style="font-size: 0.72rem; color: #64748b; margin-top: 3px; display: inline-block;">${psy.utm_medium}</span>`;
                if (psy.utm_content) utmBadge += `<br><span style="font-size: 0.72rem; color: #94a3b8; font-style: italic; display: inline-block;">${psy.utm_content}</span>`;
            }

            const safeTitleName = (psy.nome || '').replace(/"/g, '&quot;');
            const safeDeleteName = (psy.nome || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Profissional">
                    <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                        ${psy.fotoUrl ? `<img src="${psy.fotoUrl}" class="avatar-img" style="width:38px; height:38px; border-radius:50%; object-fit:cover; flex-shrink:0; border: 1px solid #e2e8f0;">` : `<div class="avatar-placeholder" style="width: 38px; height: 38px; border-radius: 50%; background-color: #f0fdf4; color: #166534; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.88rem; flex-shrink:0; border: 1px solid #bbf7d0;">${psy.nome.charAt(0).toUpperCase()}</div>`}
                        <div style="display: flex; flex-direction: column; max-width: calc(100% - 50px); min-width: 0;">
                            <strong style="color: var(--verde-escuro); cursor: pointer; white-space: normal; word-break: break-word; line-height: 1.3;" onclick="window.openCSDrawer('${psy.id}')" id="name-psy-${psy.id}" title="${safeTitleName}">${psy.nome}${copyBadge}${pendingBadge}</strong>
                            <span style="font-size: 0.75rem; color: #64748b; white-space: normal; word-break: break-word; margin-top: 2px;" title="${psy.email}">${psy.email}</span>
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
                <td data-label="Origem (UTM)">
                    ${utmBadge}
                </td>
                <td data-label="Data de Inscrição">
                    <span style="color: #64748b; font-size: 0.88rem; font-weight: 500;">${dataInscricao}</span>
                </td>
                <td data-label="Ações CS" style="white-space: nowrap; text-align: right;">
                    <button class="btn-tabela" onclick="window.openCSDrawer('${psy.id}')" title="Visão 360 do Profissional">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path></svg>
                        <span>Visão 360</span>
                    </button>
                    ${isDeleted ? '' : `<button class="btn-tabela btn-tabela-perigo" onclick="window.forceDeletePsy('${psy.id}', '${safeDeleteName}')" style="margin-left: 6px;" title="Excluir Profissional"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> <span>Excluir</span></button>`}
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    window.forceDeletePsy = function (id, name) {
        if (window.openConfirmationModal) {
            window.openConfirmationModal('Excluir Profissional', `Tem certeza que deseja excluir o psicólogo <strong>${name}</strong> permanentemente?`, async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                    if (res.ok) { window.showToast('Excluído com sucesso.', 'success'); fetchAndRenderPsis(1); }
                    else throw new Error('Erro ao excluir');
                } catch (e) { window.showToast(e.message, 'error'); }
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
    window.loadCrmPsisPage = function (p) { fetchAndRenderPsis(p); };

    // Ouvinte para quando um VIP for atualizado pelo modal global
    window.addEventListener('vipStatusUpdated', () => { fetchAndRenderPsis(1); closeDrawer(); });

    window.cleanupPage = function () {
        window.removeEventListener('vipStatusUpdated', fetchAndRenderPsis);
    };

    // ==============================================
    // LÓGICA DE APROVAÇÃO DE PERGUNTAS IA (Q&A)
    // ==============================================
    async function loadPendingQuestions() {
        const tbody = document.getElementById('crm-qna-pending-body');
        if (!tbody) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/qna/pending`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Falha ao buscar perguntas.');
            
            const questions = await res.json();
            tbody.innerHTML = '';
            
            if (questions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma pergunta pendente no momento.</td></tr>`;
                return;
            }
            
            questions.forEach(q => {
                const tr = document.createElement('tr');
                const dateStr = new Date(q.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                tr.innerHTML = `
                    <td data-label="Data">
                        <div style="text-align: left; color: #64748b; font-size: 0.85rem; padding: 10px 0;">${dateStr}</div>
                    </td>
                    <td data-label="Conteúdo">
                        <textarea id="edit-content-${q.id}" style="width: 100%; min-height: 80px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; color: #334155; resize: vertical; margin: 10px 0; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#1B4332'" onblur="this.style.borderColor='#cbd5e1'">${q.content}</textarea>
                    </td>
                    <td data-label="Título SEO">
                        <textarea id="edit-title-${q.id}" style="width: 100%; min-height: 60px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 0.9rem; font-weight: 500; color: #1e293b; resize: vertical; margin: 10px 0; outline: none; transition: border-color 0.2s;" onfocus="this.style.borderColor='#1B4332'" onblur="this.style.borderColor='#cbd5e1'">${q.title || ''}</textarea>
                    </td>
                    <td data-label="Ações">
                        <div style="text-align: right; padding: 10px 0; display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                            <button onclick="window.moderateQuestion(${q.id}, 'approve')" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; width: 100px;">Aprovar</button>
                            <button onclick="window.moderateQuestion(${q.id}, 'reject')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; width: 100px;">Rejeitar</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px; color: #ef4444;">Erro ao carregar perguntas: ${e.message}</td></tr>`;
        }
    }

    window.moderateQuestion = async function(id, action) {
        let title = undefined;
        let content = undefined;
        
        if (action === 'approve') {
            const titleEl = document.getElementById(`edit-title-${id}`);
            const contentEl = document.getElementById(`edit-content-${id}`);
            if (titleEl) title = titleEl.value.trim();
            if (contentEl) content = contentEl.value.trim();
            
            if (!content) {
                if (window.showToast) window.showToast("O conteúdo da pergunta não pode estar vazio.", "error");
                else alert("O conteúdo da pergunta não pode estar vazio.");
                return;
            }
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/qna/${id}/moderate`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, title, content })
            });
            
            const data = await res.json();
            if (res.ok) {
                if (window.showToast) window.showToast(data.message, 'success');
                loadPendingQuestions();
            } else {
                throw new Error(data.error || 'Erro na moderação');
            }
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
            else alert(e.message);
        }
    };
    
    loadPendingQuestions();
    // ==============================================

    // ==============================================
    // MODERAÇÃO DE IA (MOTOR EDITORIAL)
    // ==============================================
    
    window.toggleAiDrawer = function() {
        const drawer = document.getElementById('ai-drawer');
        if (drawer) {
            drawer.classList.toggle('active');
            if (drawer.classList.contains('active')) {
                loadAiDrafts();
            }
        }
    };

    async function loadAiDrafts() {
        const listContainer = document.getElementById('ai-drafts-list');
        if (!listContainer) return;
        
        listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; margin-top: 40px;">Carregando rascunhos...</div>';
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/qna/ai-drafts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const drafts = await res.json();
            
            if (!res.ok) throw new Error(drafts.error || 'Erro ao carregar rascunhos da IA');
            
            listContainer.innerHTML = '';
            
            if (!drafts || drafts.length === 0) {
                listContainer.innerHTML = '<div style="text-align: center; color: #94a3b8; margin-top: 40px; padding: 20px;">Nenhum rascunho de IA pendente no momento.</div>';
                return;
            }
            
            drafts.forEach(draft => {
                const card = document.createElement('div');
                card.style.cssText = "background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: flex; flex-direction: column; gap: 10px;";
                
                const dateStr = new Date(draft.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                
                card.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 3px 8px; border-radius: 12px; font-weight: 600;">🤖 IA Gerador</span>
                        <span style="font-size: 0.75rem; color: #94a3b8;">${dateStr}</span>
                    </div>
                    <!-- O título será gerado pela Inteligência SEO no backend ao aprovar -->
                    <div style="position: relative; margin-top: 5px;">
                        <textarea id="ai-content-${draft.id}" style="width: 100%; border: 1px dashed transparent; font-size: 0.9rem; color: #475569; outline: none; resize: vertical; min-height: 80px; background: #f8fafc; border-radius: 8px; padding: 10px; padding-right: 30px; transition: all 0.2s;" onfocus="this.style.border='1px solid #1B4332'; this.style.background='white';" onblur="this.style.border='1px dashed transparent'; this.style.background='#f8fafc';" placeholder="Conteúdo da pergunta">${draft.content}</textarea>
                        <svg onclick="document.getElementById('ai-content-${draft.id}').focus()" style="position: absolute; right: 10px; top: 10px; cursor: pointer; color: #94a3b8;" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        <button onclick="window.moderateAiDraft(${draft.id}, 'reject')" style="flex: 1; padding: 8px; border: 1px solid #ef4444; background: white; color: #ef4444; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">❌ Rejeitar</button>
                        <button onclick="window.moderateAiDraft(${draft.id}, 'approve')" style="flex: 1; padding: 8px; border: none; background: #1B4332; color: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">✅ Aprovar (Gera SEO)</button>
                    </div>
                `;
                
                listContainer.appendChild(card);
            });
            
        } catch (error) {
            listContainer.innerHTML = `<div style="text-align: center; color: #ef4444; margin-top: 40px; padding: 20px;">Erro: ${error.message}</div>`;
        }
    }

    window.moderateAiDraft = async function(id, action) {
        let content = '';
        
        if (action === 'approve') {
            const contentEl = document.getElementById(`ai-content-${id}`);
            if (contentEl) content = contentEl.value.trim();
            
            if (!content) {
                if (window.showToast) window.showToast("O conteúdo não pode estar vazio.", "error");
                else alert("O conteúdo não pode estar vazio.");
                return;
            }
        }

        try {
            const method = action === 'approve' ? 'PUT' : 'DELETE';
            const url = action === 'approve' ? `${API_BASE_URL}/api/admin/qna/ai-drafts/${id}/approve` : `${API_BASE_URL}/api/admin/qna/ai-drafts/${id}`;
            
            const res = await fetch(url, {
                method,
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: action === 'approve' ? JSON.stringify({ content }) : undefined
            });
            
            const data = await res.json();
            if (res.ok) {
                if (window.showToast) window.showToast(data.message, 'success');
                loadAiDrafts();
            } else {
                throw new Error(data.error || 'Erro na moderação do rascunho');
            }
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
            else alert(e.message);
        }
    };

    window.forceAiGeneration = async function() {
        const btn = document.getElementById('btn-force-ai');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner-sm" style="margin-right: 5px;"></span> Solicitando...';
        }
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/qna/ai-drafts/generate-now`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            if (res.ok) {
                if (window.showToast) window.showToast(data.message, 'success');
                // Recarrega a lista para mostrar a nova pergunta
                loadAiDrafts();
            } else {
                throw new Error(data.error || 'Erro ao forçar geração.');
            }
        } catch (e) {
            if (window.showToast) window.showToast(e.message, 'error');
            else alert(e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> Forçar Geração Agora';
            }
        }
    };

    async function fetchPendingCounts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/pending-actions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const pendingData = await response.json();
                const actionsArray = pendingData.pendingActions || pendingData || [];
                
                const countExpiring = actionsArray.filter(a => a.actionType === 'expiring_trial').length;
                const countPaidChurn = actionsArray.filter(a => ['paid_churn', 'billing_feedback', 'churn'].includes(a.actionType)).length;
                const countIncomplete = actionsArray.filter(a => a.actionType === 'incomplete').length;

                const elExp = document.getElementById('kpi-alerta-expiring');
                const elChurn = document.getElementById('kpi-alerta-paid-churn');
                const elInc = document.getElementById('kpi-alerta-pendentes');

                if(elExp) elExp.textContent = countExpiring;
                if(elChurn) elChurn.textContent = countPaidChurn;
                if(elInc) elInc.textContent = countIncomplete;
            }
        } catch(e) {
            console.error('Erro ao buscar badges de pendencias', e);
        }
    }

    fetchPendingCounts();
    fetchAndRenderPsis(1);
};