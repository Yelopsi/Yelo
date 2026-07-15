window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    
    const tableBody = document.getElementById('crm-patients-body');
    const searchInput = document.getElementById('crm-search-paciente');
    const statusInput = document.getElementById('crm-status-paciente');
    
    const drawerOverlay = document.getElementById('drawer-360-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    
    let searchTimeout;
    let patientsDataCache = []; // Guarda a lista para exibição rápida no drawer

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
    
    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', (e) => {
            if (e.target === drawerOverlay) closeDrawer();
        });
    }

    // --- FILTROS PILL E KPI ---
    window.filterByKpi = function (filterVal) {
        document.querySelectorAll('.crm-pill').forEach(b => b.classList.remove('active'));
        const pill = document.querySelector(`.crm-pill[data-filter="${filterVal}"]`);
        if (pill) pill.classList.add('active');

        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
        const card = document.querySelector(`.kpi-card[data-kpi="${filterVal}"]`);
        if (card) card.classList.add('active');

        if (statusInput) statusInput.value = filterVal;
        fetchAndRenderPatients(1);
    };

    document.querySelectorAll('.crm-pill').forEach(btn => {
        btn.addEventListener('click', (e) => {
            window.filterByKpi(e.target.dataset.filter);
        });
    });

    // Lógica de Swipe Down APENAS NO CABEÇALHO
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

    window.open360Drawer = async function(idStr) {
        const patient = patientsDataCache.find(p => String(p.id) === String(idStr));
        if (!patient) return;

        // Parseia nome legado se vier "[ID: xxx] Nome"
        const nameMatch = patient.nome.match(/\[ID: (\d+)\] (.*)/);
        const cleanName = nameMatch ? nameMatch[2].trim() : patient.nome;

        document.getElementById('drawer-avatar').textContent = cleanName.charAt(0).toUpperCase();
        document.getElementById('drawer-name').textContent = cleanName;
        document.getElementById('drawer-email').textContent = patient.email || 'E-mail não fornecido';
        document.getElementById('drawer-id').textContent = `ID CRM: ${patient.id}`;
        document.getElementById('drawer-date').textContent = `Membro desde: ${new Date(patient.createdAt).toLocaleDateString('pt-BR')}`;
        
        document.getElementById('drawer-utm-source').textContent = patient.utm_source || '-';
        document.getElementById('drawer-utm-medium').textContent = patient.utm_medium || '-';
        document.getElementById('drawer-utm-campaign').textContent = patient.utm_campaign || '-';
        document.getElementById('drawer-utm-content').textContent = patient.utm_content || '-';
        
        drawerOverlay.classList.add('active');

        // NOVA LÓGICA DE FETCH DO ENDPOINT 360
        const loadingEl = document.getElementById('drawer-360-loading');
        const contentEl = document.getElementById('drawer-360-content');
        const timelineList = document.getElementById('drawer-timeline-list');

        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/patients/${patient.id}/360`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao carregar dossiê');
            
            const data = await response.json();
            
            if (data.timeline && data.timeline.length > 0) {
                timelineList.innerHTML = data.timeline.map(event => {
                    let eventClass = 'event-system';
                    let icon = '📌';
                    
                    if (event.type === 'match') { eventClass = 'event-warning'; icon = '🔍'; }
                    else if (event.type === 'whatsapp') { eventClass = ''; icon = '💬'; }
                    else if (event.type === 'created') { eventClass = 'event-system'; icon = '✨'; }

                    return `
                        <div class="timeline-event ${eventClass}">
                            <div style="font-size: 0.85rem; color: #64748b; font-weight: bold; margin-bottom: 4px;">
                                ${new Date(event.date).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
                            </div>
                            <div style="background: white; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                                <strong style="color: #1e293b; display: flex; align-items: center; gap: 5px; font-size: 0.95rem;">${icon} ${event.title}</strong>
                                <p style="margin: 5px 0 0 0; color: #475569; font-size: 0.9rem;">${event.description}</p>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                timelineList.innerHTML = '<p style="color: #64748b; font-size: 0.9rem; font-style: italic;">Nenhum evento de jornada registrado.</p>';
            }

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';

        } catch (error) {
            if (loadingEl) {
                loadingEl.innerHTML = `<p style="color: #e63946; font-size: 0.9rem;">Erro ao carregar o histórico de atividades. O endpoint no servidor foi criado?</p>`;
            }
        }
    };

    // --- BUSCA DE DADOS ---
    async function fetchAndRenderPatients(page = 1) {
        if (!tableBody) return;
        tableBody.innerHTML = `<tr><td colspan="4" class="loading-row" style="text-align: center; padding: 40px; color: var(--cinza-texto);"><span class="loading-spinner-sm"></span> Carregando CRM...</td></tr>`;

        const searchTerm = searchInput.value;
        const status = statusInput ? statusInput.value : '';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/patients?page=${page}&search=${searchTerm}&status=${status}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Falha ao buscar pacientes.');

            const { data, totalPages, currentPage, kpis } = await response.json();
            patientsDataCache = data; // Atualiza cache
            
            if (kpis) {
                const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
                setText('kpi-whatsapp-pacientes', kpis.utm_whatsapp || 0);
                setText('kpi-meta-pacientes', kpis.utm_meta || 0);
                setText('kpi-google-pacientes', kpis.utm_google || 0);
                setText('kpi-outros-pacientes', kpis.utm_outros || 0);
            }

            renderTable(data);
            renderPagination(totalPages, currentPage);
        } catch (error) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--coral-quente);">Erro ao carregar dados.</td></tr>`;
        }
    }

    function renderTable(patients) {
        tableBody.innerHTML = '';
        if (patients.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 40px; color: var(--cinza-texto);">Nenhum paciente encontrado neste filtro.</td></tr>`;
            return;
        }

        patients.forEach(patient => {
            const isDeleted = patient.deletedAt !== null && patient.deletedAt !== undefined;
            const dataCadastro = new Date(patient.createdAt).toLocaleDateString('pt-BR');
            
            const nameMatch = patient.nome.match(/\[ID: (\d+)\] (.*)/);
            const patientName = nameMatch ? nameMatch[2].trim() : patient.nome;

            const statusClass = isDeleted ? 'status-inativo' : 'status-ativo';
            const statusLabel = isDeleted ? 'Na Lixeira' : 'Ativo';

            // UTM Badge
            let utmBadge = `<span style="color: #94a3b8; font-size: 0.8rem;">Orgânico/Direto</span>`;
            if (patient.utm_source) {
                let badgeColor = '#64748b'; let bgBadge = '#f1f5f9';
                if (patient.utm_source === 'whatsapp') { badgeColor = '#10b981'; bgBadge = '#d1fae5'; }
                else if (patient.utm_source === 'meta_ads' || patient.utm_source === 'facebook' || patient.utm_source === 'instagram') { badgeColor = '#3b82f6'; bgBadge = '#dbeafe'; }
                else if (patient.utm_source === 'google') { badgeColor = '#f59e0b'; bgBadge = '#fef3c7'; }
                
                utmBadge = `<span style="background: ${bgBadge}; color: ${badgeColor}; padding: 3px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${patient.utm_source}</span>`;
                if (patient.utm_medium) utmBadge += `<br><span style="font-size: 0.7rem; color: #64748b; margin-top: 2px; display: inline-block;">${patient.utm_medium}</span>`;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Identificação">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #ecfdf5; color: #10b981; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                            ${patientName.charAt(0).toUpperCase()}
                        </div>
                        <div style="display: flex; flex-direction: column;">
                            <strong style="color: var(--verde-escuro);">${patientName}</strong>
                            <span style="font-size: 0.75rem; color: #666;">${patient.email || 'Sem e-mail'}</span>
                        </div>
                    </div>
                </td>
                <td data-label="Status Clínico"><span class="status ${statusClass}">${statusLabel}</span></td>
                <td data-label="Origem (UTM)">${utmBadge}</td>
                <td data-label="Data de Cadastro" style="color: #666;">${dataCadastro}</td>
                <td data-label="Ações" style="white-space: nowrap;">
                    <button class="btn-tabela" onclick="window.open360Drawer('${patient.id}')" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        Visão 360
                    </button>
                    ${isDeleted 
                        ? `<button class="btn-tabela btn-restore" onclick="window.restoreCrmPatient('${patient.id}')" style="margin-left: 5px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;" title="Restaurar Paciente"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg> Restaurar</button>
                           <button class="btn-tabela btn-tabela-perigo" onclick="window.forceDeleteCrmPatient('${patient.id}', '${patientName}')" style="margin-left: 5px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;" title="Excluir Permanente"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg> Excluir Perm.</button>` 
                        : `<button class="btn-tabela btn-tabela-perigo" onclick="window.softDeleteCrmPatient('${patient.id}', '${patientName}')" style="margin-left: 5px; display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 50px; font-weight: 600;" title="Mover para Lixeira"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Excluir</button>`
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    // --- OPERAÇÕES DE DELEÇÃO HERDADAS DA ESTRUTURA ANTIGA ---
    window.softDeleteCrmPatient = function(id, name) {
        window.openConfirmationModal('Mover para Lixeira', `Tem certeza que deseja mover o paciente <strong>${name}</strong> para a lixeira?`, async () => {
            try { const res = await fetch(`${API_BASE_URL}/api/admin/patients/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if(res.ok) fetchAndRenderPatients(); else throw new Error(); } catch(e) { window.showToast('Erro ao remover.', 'error'); }
        });
    };
    window.forceDeleteCrmPatient = function(id, name) {
        window.openConfirmationModal('Excluir PERMANENTEMENTE', `Esta ação é irreversível. Tem certeza que deseja apagar todos os dados do paciente <strong>${name}</strong>?`, async () => {
            try { const res = await fetch(`${API_BASE_URL}/api/admin/patients/${id}/force`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if(res.ok) fetchAndRenderPatients(); else throw new Error(); } catch(e) { window.showToast('Erro ao excluir.', 'error'); }
        });
    };
    window.restoreCrmPatient = async function(id) {
        try { const res = await fetch(`${API_BASE_URL}/api/admin/patients/${id}/status`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) }); if(res.ok) fetchAndRenderPatients(); else throw new Error(); } catch(e) { window.showToast('Erro ao restaurar.', 'error'); }
    };

    // --- PAGINAÇÃO E FILTROS ---
    function renderPagination(totalPages, currentPage) {
        const container = document.getElementById('crm-pagination-patients');
        if (!container || totalPages <= 1) { if(container) container.innerHTML = ''; return; }
        
        let html = `<button class="pagination-btn" onclick="window.loadCrmPatientsPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>&laquo;</button>`;
        for (let i = 1; i <= totalPages; i++) html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="window.loadCrmPatientsPage(${i})">${i}</button>`;
        html += `<button class="pagination-btn" onclick="window.loadCrmPatientsPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>&raquo;</button>`;
        container.innerHTML = html;
    }
    
    window.loadCrmPatientsPage = function(p) { fetchAndRenderPatients(p); };

    searchInput.addEventListener('keyup', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => fetchAndRenderPatients(1), 500); });

    fetchAndRenderPatients(1);
};