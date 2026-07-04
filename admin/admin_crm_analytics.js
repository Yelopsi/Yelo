window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    let chartInstances = {};

    // Inicialização das Datas (Últimos 30 dias)
    const startInput = document.getElementById('crm-analytics-start');
    const endInput = document.getElementById('crm-analytics-end');
    if (!startInput.value) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
        endInput.value = today.toISOString().split('T')[0];
    }

    // Lógica das Abas (Tabs)
    document.querySelectorAll('.content-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.content-tab-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            document.querySelectorAll('.analytics-tab-content').forEach(tab => tab.style.display = 'none');
            document.getElementById(btn.getAttribute('data-target')).style.display = 'block';
        });
    });

    // Botão Filtrar
    const btnUpdate = document.getElementById('btn-update-analytics');
    btnUpdate.addEventListener('click', loadConsolidatedData);

    async function loadConsolidatedData() {
        btnUpdate.textContent = 'Carregando...';
        btnUpdate.disabled = true;
        const query = `?startDate=${startInput.value}&endDate=${endInput.value}`;

        try {
            // Fetch Charts Data
            fetch(`${API_BASE_URL}/api/admin/reports/charts${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataCharts => {
                    let totalConcluidos = 0, totalAbandonados = 0;
                    if (dataCharts.demand && Array.isArray(dataCharts.demand)) {
                        totalConcluidos = dataCharts.demand.reduce((acc, curr) => acc + (parseInt(curr.concluidos) || 0), 0);
                        totalAbandonados = dataCharts.demand.reduce((acc, curr) => acc + (parseInt(curr.desistencias) || 0), 0);
                    }
                    document.getElementById('kpi-quest-concluidos').innerText = totalConcluidos.toLocaleString();
                    document.getElementById('kpi-quest-abandonados').innerText = totalAbandonados.toLocaleString();
                    
                    const totalVisits = (dataCharts.visits || []).reduce((acc, curr) => acc + (parseInt(curr.total) || 0), 0);
                    document.getElementById('kpi-visits').innerText = totalVisits.toLocaleString();
                    document.getElementById('kpi-questions').innerText = dataCharts.community?.questionsTotal || 0;
                    document.getElementById('kpi-whatsapp-clicks').innerText = dataCharts.whatsappClicks || 0;

                    renderUsersChart(dataCharts.users, dataCharts.visits);
                    renderDemandChart(dataCharts.demand);
                    renderPlansChart(dataCharts.plans);
                    renderShadowTracking(dataCharts.shadowTracking);
                }).catch(err => console.error(err));

            // Fetch Funnel Data
            fetch(`${API_BASE_URL}/api/admin/analytics/funnel${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataFunnel => {
                    renderDropoffs(dataFunnel.abandonos);
                    renderUTMs(dataFunnel.origens);
                }).catch(err => console.error(err));

            // Fetch PWA Data
            fetch(`${API_BASE_URL}/api/admin/stats/pwa${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataPwa => {
                    document.getElementById('kpi-pwa').innerText = dataPwa.total || 0;
                }).catch(err => console.error(err));

            // Fetch Financial Data
            fetch(`${API_BASE_URL}/api/admin/financials${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataFin => {
                    if (dataFin.kpis) {
                        const formatBRL = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                        const formatNum = (v) => `${Math.round(v).toLocaleString('pt-BR')}`;
                        document.getElementById('kpi-mrr').innerText = formatBRL(dataFin.kpis.mrr || 0);
                        document.getElementById('kpi-churn').innerText = `${(dataFin.kpis.churnRate || 0)}%`;
                        document.getElementById('kpi-ltv').innerText = formatBRL(dataFin.kpis.ltv || 0);
                        document.getElementById('kpi-arpu').innerText = formatBRL(dataFin.kpis.arpu || 0);
                        
                        if (document.getElementById('kpi-proj-30')) {
                            document.getElementById('kpi-proj-30').innerText = formatBRL(dataFin.kpis.proj30 || 0);
                            document.getElementById('kpi-proj-60').innerText = formatBRL(dataFin.kpis.proj60 || 0);
                            document.getElementById('kpi-proj-90').innerText = formatBRL(dataFin.kpis.proj90 || 0);
                        }
                    }
                    renderFaturas(dataFin.recentInvoices);
                    renderPlanosAtivos(dataFin.activePlans);
                }).catch(err => console.error(err));

        } finally {
            setTimeout(() => {
                btnUpdate.textContent = 'Filtrar';
                btnUpdate.disabled = false;
            }, 1000);
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO SECUNDÁRIAS ---
    
    function renderFaturas(invoices) {
        const tbody = document.getElementById('faturas-recentes-body');
        tbody.innerHTML = '';
        if (!invoices || invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhuma fatura recente.</td></tr>';
            return;
        }
        invoices.forEach(inv => {
            const statusClass = inv.status === 'Paga' ? 'status-ativo' : (inv.status === 'Atrasada' ? 'status-pendente' : 'status-inativo');
            tbody.innerHTML += `<tr>
                <td><div style="font-weight: 600; color: var(--verde-escuro);">${inv.psychologistName}</div></td>
                <td>${new Date(inv.date).toLocaleDateString('pt-BR')}</td>
                <td>R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td><span class="status ${statusClass}">${inv.status}</span></td>
                <td><button class="btn-tabela">Ver Detalhes</button></td>
            </tr>`;
        });
    }

    function renderPlanosAtivos(plans) {
        const tbody = document.getElementById('planos-ativos-body');
        tbody.innerHTML = '';
        if (!plans || plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum plano ativo.</td></tr>';
            return;
        }
        plans.forEach(plan => {
            tbody.innerHTML += `<tr>
                <td><div style="font-weight: 600;">${plan.psychologistName}</div></td>
                <td><span style="background: var(--cor-Yelo); color: var(--verde-escuro); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">${plan.planName}</span></td>
                <td>R$ ${plan.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td>${plan.nextBilling ? new Date(plan.nextBilling).toLocaleDateString('pt-BR') : 'Isento'}</td>
            </tr>`;
        });
    }

    function renderDropoffs(abandonos) {
        const list = document.getElementById('funnel-dropoff-list');
        if (abandonos && abandonos.length > 0) {
            list.innerHTML = abandonos.map(i => `<tr><td><strong>${i.step}</strong></td><td style="text-align:right; color:#E63946; font-weight:bold;">${i.count}</td></tr>`).join('');
        } else {
            list.innerHTML = '<tr><td colspan="2" style="text-align:center;">Nenhum dado de abandono.</td></tr>';
        }
    }

    function renderUTMs(origens) {
        const list = document.getElementById('funnel-utm-list');
        if (origens && origens.length > 0) {
            const total = origens.reduce((acc, c) => acc + parseInt(c.count), 0);
            list.innerHTML = origens.map(i => {
                const perc = Math.round((parseInt(i.count) / total) * 100);
                return `<li class="feature-usage-item"><div class="feature-header"><span>${i.source}</span><span>${i.count} (${perc}%)</span></div><div class="feature-bar-bg"><div class="feature-bar-fill" style="width: ${perc}%; background-color: var(--verde-escuro);"></div></div></li>`;
            }).join('');
        } else {
            list.innerHTML = '<p>Nenhuma origem mapeada.</p>';
        }
    }

    function renderShadowTracking(stData) {
        const list = document.getElementById('st-usage-list');
        if (!stData || !stData.usage || stData.usage.length === 0) {
            list.innerHTML = '<p>Aguardando dados de uso.</p>';
            return;
        }
        list.innerHTML = stData.usage.map(i => `<li class="feature-usage-item"><div class="feature-header"><span>${i.name}</span><span>${i.percentage}%</span></div><div class="feature-bar-bg"><div class="feature-bar-fill ${i.status || 'medium'}" style="width: ${i.percentage}%;"></div></div></li>`).join('');
    }

    function formatDateBR(dateString) { const [y, m, d] = dateString.split('-'); return `${d}/${m}`; }

    function renderUsersChart(data, visitsData) { 
        const ctx = document.getElementById('chartUsers').getContext('2d');
        if (chartInstances.users) chartInstances.users.destroy();
        const allDates = [...new Set([...(data || []).map(d => d.data), ...(visitsData || []).map(v => v.data)])].sort();
        const labels = allDates.map(d => formatDateBR(d));
        const patients = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.pacientes, 10) : 0; });
        const psis = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.psis, 10) : 0; });
        const visits = allDates.map(d => { const f = (visitsData || []).find(x => x.data === d); return f ? parseInt(f.total, 10) : 0; });
        
        // Cria um gradiente suave para a área de visitas
        const gradientVisits = ctx.createLinearGradient(0, 0, 0, 300);
        gradientVisits.addColorStop(0, 'rgba(41, 128, 185, 0.2)');
        gradientVisits.addColorStop(1, 'rgba(41, 128, 185, 0)');

        chartInstances.users = new Chart(ctx, { 
            type: 'line', 
            data: { 
                labels: labels, 
                datasets: [ 
                    { label: 'Acessos (Pageviews)', data: visits, borderColor: '#2980b9', backgroundColor: gradientVisits, tension: 0.4, fill: true, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 }, 
                    { label: 'Novos Pacientes', data: patients, borderColor: '#10b981', tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 }, 
                    { label: 'Novos Psicólogos', data: psis, borderColor: '#f59e0b', tension: 0.4, borderWidth: 2, pointRadius: 0, pointHoverRadius: 6 } 
                ] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 } } } },
                scales: { 
                    x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }, 
                    y: { grid: { color: '#f1f5f9' }, border: { display: false } } 
                } 
            } 
        });
    }

    function renderDemandChart(data) {
        const ctx = document.getElementById('chartDemand').getContext('2d');
        if (chartInstances.demand) chartInstances.demand.destroy();
        const labels = (data || []).map(item => formatDateBR(item.data));
        const done = (data || []).map(item => item.concluidos);
        const drop = (data || []).map(item => item.desistencias);
        
        chartInstances.demand = new Chart(ctx, { 
            type: 'bar', 
            data: { 
                labels: labels, 
                datasets: [ 
                    { label: 'Concluídos', data: done, backgroundColor: '#10b981', borderRadius: 4, barPercentage: 0.6 }, 
                    { label: 'Desistências', data: drop, backgroundColor: '#fca5a5', borderRadius: 4, barPercentage: 0.6 } 
                ] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 } } } },
                scales: { 
                    x: { grid: { display: false }, stacked: true }, 
                    y: { grid: { color: '#f1f5f9' }, border: { display: false }, stacked: true } 
                } 
            } 
        });
    }

    function renderPlansChart(data) {
        const ctx = document.getElementById('chartPlans').getContext('2d');
        if (chartInstances.plans) chartInstances.plans.destroy();
        const labels = (data || []).map(item => item.plano);
        const values = (data || []).map(item => item.total);
        const colors = labels.map(p => { if(p === 'Essencial') return '#34d399'; if(p === 'Clínico') return '#fbbf24'; if(p === 'Sol' || p === 'Referência') return '#8b5cf6'; return '#cbd5e1'; });
        
        chartInstances.plans = new Chart(ctx, { 
            type: 'doughnut', 
            data: { 
                labels: labels, 
                datasets: [{ 
                    data: values, 
                    backgroundColor: colors,
                    borderWidth: 0,
                    hoverOffset: 4
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                cutout: '75%',
                plugins: { 
                    legend: { position: 'right', labels: { usePointStyle: true, padding: 20, font: { family: 'Inter', size: 13 } } } 
                } 
            } 
        });
    }

    // Execução Inicial
    loadConsolidatedData();
};