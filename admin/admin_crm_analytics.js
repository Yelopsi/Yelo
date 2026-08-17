window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    let chartInstances = {};

    const startInput = document.getElementById('crm-analytics-start');
    const endInput = document.getElementById('crm-analytics-end');
    const customWrap = document.getElementById('custom-date-wrap');

    function setDateRange(days) {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        startInput.value = start.toISOString().split('T')[0];
        endInput.value = end.toISOString().split('T')[0];
    }

    // Initialize with 30 days
    if (!startInput.value) setDateRange(30);

    // Toolbar Logic
    document.querySelectorAll('.toolbar-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(e.target.id === 'btn-apply-custom') return;
            document.querySelectorAll('.toolbar-chip').forEach(b => b.classList.remove('active'));
            if(e.target.id === 'btn-custom-date') {
                e.target.classList.add('active');
                customWrap.style.display = 'flex';
            } else {
                e.target.classList.add('active');
                customWrap.style.display = 'none';
                if(e.target.dataset.days) {
                    setDateRange(parseInt(e.target.dataset.days));
                    loadConsolidatedData();
                }
            }
        });
    });

    document.getElementById('btn-apply-custom').addEventListener('click', loadConsolidatedData);
    document.getElementById('btn-update-analytics').addEventListener('click', loadConsolidatedData);

    // Lógica das Abas
    document.querySelectorAll('.content-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.content-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.analytics-tab-content').forEach(tab => tab.style.display = 'none');
            document.getElementById(btn.getAttribute('data-target')).style.display = 'block';
        });
    });

    async function loadConsolidatedData() {
        const btnUpdate = document.getElementById('btn-update-analytics');
        btnUpdate.textContent = 'Carregando...';
        btnUpdate.disabled = true;
        const query = `?startDate=${startInput.value}&endDate=${endInput.value}`;
        document.getElementById('last-updated-text').innerText = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;

        try {
            // Fetch Charts Data (Desempenho)
            fetch(`${API_BASE_URL}/api/admin/reports/charts${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataCharts => {
                    let totalConcluidos = 0, totalAbandonados = 0;
                    if (dataCharts.demand && Array.isArray(dataCharts.demand)) {
                        totalConcluidos = dataCharts.demand.reduce((acc, curr) => acc + (parseInt(curr.concluidos) || 0), 0);
                        totalAbandonados = dataCharts.demand.reduce((acc, curr) => acc + (parseInt(curr.desistencias) || 0), 0);
                    }
                    if(document.getElementById('kpi-quest-concluidos')) {
                        document.getElementById('kpi-quest-concluidos').innerText = totalConcluidos.toLocaleString();
                        document.getElementById('kpi-quest-abandonados').innerText = totalAbandonados.toLocaleString();
                        
                        const totalVisits = (dataCharts.visits || []).reduce((acc, curr) => acc + (parseInt(curr.total) || 0), 0);
                        document.getElementById('kpi-visits').innerText = totalVisits.toLocaleString();
                        document.getElementById('kpi-questions').innerText = dataCharts.community?.questionsTotal || 0;
                        document.getElementById('kpi-whatsapp-clicks').innerText = dataCharts.whatsappClicks || 0;

                        renderUsersChart(dataCharts.users, dataCharts.visits);
                        renderDemandChart(dataCharts.demand);
                        renderShadowTracking(dataCharts.shadowTracking);
                    }
                }).catch(err => console.error(err));

            // Fetch Funnel Data (Desempenho)
            fetch(`${API_BASE_URL}/api/admin/analytics/funnel${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataFunnel => {
                    if(document.getElementById('funnel-dropoff-list')) {
                        renderDropoffs(dataFunnel.abandonos);
                        renderUTMs(dataFunnel.origens);
                    }
                }).catch(err => console.error(err));

            // Fetch PWA Data
            fetch(`${API_BASE_URL}/api/admin/stats/pwa${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataPwa => {
                    if(document.getElementById('kpi-pwa')) document.getElementById('kpi-pwa').innerText = dataPwa.total || 0;
                }).catch(err => console.error(err));

            // Fetch Financial Data (PREMIUM)
            fetch(`${API_BASE_URL}/api/admin/financials${query}`, { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : {})
                .then(dataFin => {
                    if (dataFin.kpis) {
                        const formatBRL = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
                        const formatPerc = (v) => `${v.toFixed(1)}%`;
                        const formatNum = (v) => `${v} usuários`;
                        
                        // Update KPIs with variations
                        updateKpiCard('mrr', dataFin.kpis.mrr.current, dataFin.kpis.mrr.previous, formatBRL);
                        updateKpiCard('paid-churn', dataFin.kpis.paidChurnRate.current, dataFin.kpis.paidChurnRate.previous, formatPerc, true); // inverted: lower is better
                        updateKpiCard('trial-churn', dataFin.kpis.trialChurnCount.current, dataFin.kpis.trialChurnCount.previous, formatNum, true); // inverted: lower is better
                        
                        if (dataFin.kpis.inadimplentesCount) {
                            updateKpiCard('inadimplentes', dataFin.kpis.inadimplentesCount.current, dataFin.kpis.inadimplentesCount.previous, formatNum, true);
                        }

                        if (dataFin.kpis.ltv.projected > 0) {
                            updateKpiCard('ltv', dataFin.kpis.ltv.projected, dataFin.kpis.ltv.previous, formatBRL);
                        } else {
                            document.getElementById('kpi-ltv').innerText = 'N/D';
                            document.getElementById('kpi-ltv').title = 'Dados insuficientes';
                            const trendEl = document.getElementById('trend-ltv');
                            if(trendEl) {
                                trendEl.innerText = '-';
                                trendEl.className = 'kpi-trend trend-neutral';
                            }
                        }
                        
                        const obsEl = document.getElementById('kpi-ltv-observado');
                        if (obsEl) {
                            obsEl.innerText = dataFin.kpis.ltv.current > 0 ? formatBRL(dataFin.kpis.ltv.current) : 'R$ 0';
                        }
                        const sampleEl = document.getElementById('kpi-sample-info');
                        if (sampleEl) {
                            sampleEl.innerText = dataFin.kpis.cacPayback?.current ? `Payback: ${dataFin.kpis.cacPayback.current.toFixed(1)} meses` : '';
                        }
                        
                        updateKpiCard('arpu', dataFin.kpis.arpu.current, dataFin.kpis.arpu.previous, formatBRL);
                        
                        document.getElementById('kpi-proj-30').innerText = formatBRL(dataFin.kpis.proj30 || 0);
                        document.getElementById('kpi-proj-60').innerText = formatBRL(dataFin.kpis.proj60 || 0);
                        document.getElementById('kpi-proj-90').innerText = formatBRL(dataFin.kpis.proj90 || 0);
                        
                        // Sparklines
                        renderSparkline('spark-paid-churn', dataFin.sparklines?.paidChurns || []);
                        renderSparkline('spark-trial-churn', dataFin.sparklines?.trialChurns || []);
                        renderSparkline('spark-mrr', dataFin.sparklines?.mrr || []);
                        // Proxy ARPU to MRR trend as placeholder since ARPU is mostly constant
                        renderSparkline('spark-arpu', dataFin.sparklines?.mrr || []); 
                    }
                    
                    if (dataFin.insights) renderInsights(dataFin.insights);
                    if (dataFin.planDistribution) renderPlanDistribution(dataFin.planDistribution);
                    if (dataFin.recentInvoices) renderFaturas(dataFin.recentInvoices);
                    if (dataFin.activePlans) renderPlanosAtivos(dataFin.activePlans);
                }).catch(err => console.error(err));

        } finally {
            setTimeout(() => {
                btnUpdate.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.05l5.67-5.67"/></svg> Atualizar`;
                btnUpdate.disabled = false;
            }, 1000);
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO FINANCEIRO (PREMIUM) ---

    function updateKpiCard(id, current, previous, formatter, lowerIsBetter = false) {
        document.getElementById(`kpi-${id}`).innerText = formatter(current);
        const trendEl = document.getElementById(`trend-${id}`);
        if(previous === 0 && current === 0) {
            trendEl.innerText = '-';
            trendEl.className = 'kpi-trend trend-neutral';
            return;
        }
        let diff = current - previous;
        let percent = previous > 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0);
        
        let arrow = percent > 0 ? '↑' : (percent < 0 ? '↓' : '');
        trendEl.innerText = `${arrow} ${Math.abs(percent).toFixed(1)}%`;
        
        if (percent > 0) {
            trendEl.className = lowerIsBetter ? 'kpi-trend trend-down' : 'kpi-trend trend-up';
        } else if (percent < 0) {
            trendEl.className = lowerIsBetter ? 'kpi-trend trend-up' : 'kpi-trend trend-down';
        } else {
            trendEl.className = 'kpi-trend trend-neutral';
        }
    }

    function renderSparkline(elementId, dataArray) {
        const container = document.getElementById(elementId);
        if(!container || !dataArray.length) return;
        const max = Math.max(...dataArray, 1); // prevent division by zero
        container.innerHTML = dataArray.map((val, i) => {
            const h = Math.max((val / max) * 100, 5); // min 5% height to be visible
            return `<div class="sparkline-bar" style="height: ${h}%" title="Valor: ${val}"></div>`;
        }).join('');
    }

    function renderInsights(insights) {
        const container = document.getElementById('insights-container');
        if (!insights || !insights.length) {
            container.innerHTML = '<p style="color:var(--saas-muted);">Nenhum insight no momento.</p>';
            return;
        }
        container.innerHTML = insights.map(i => {
            const dotClass = i.type === 'positive' ? 'dot-positive' : (i.type === 'negative' ? 'dot-negative' : 'dot-warning');
            return `<div class="insight-card"><div class="insight-dot ${dotClass}"></div><div>${i.text}</div></div>`;
        }).join('');
    }

    function renderPlanDistribution(dist) {
        const container = document.getElementById('plans-bar-container');
        const total = Object.values(dist).reduce((a, b) => a + b, 0);
        if (total === 0) {
            container.innerHTML = '<p style="color:var(--saas-muted);">Nenhum plano ativo.</p>';
            return;
        }
        
        // Sort by count descending
        const sorted = Object.entries(dist).sort((a,b) => b[1] - a[1]);
        container.innerHTML = sorted.map(([name, count]) => {
            const perc = Math.round((count / total) * 100);
            return `<div class="plan-row">
                <div class="plan-name">${name}</div>
                <div class="plan-bar-wrapper"><div class="plan-bar-fill" style="width: ${perc}%; background-color: var(--saas-blue);"></div></div>
                <div class="plan-stats">${count}</div>
            </div>`;
        }).join('');
    }

    function getInitials(name) {
        if(!name) return '?';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    function renderFaturas(invoices) {
        const tbody = document.getElementById('faturas-recentes-body');
        tbody.innerHTML = '';
        if (!invoices || invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color:var(--saas-muted);">Nenhuma fatura recente.</td></tr>';
            return;
        }
        invoices.forEach(inv => {
            let badgeClass = 'badge-cancelled';
            if (inv.status === 'Paga') badgeClass = 'badge-paid';
            if (inv.status === 'Atrasada') badgeClass = 'badge-overdue';
            if (inv.status === 'Pendente') badgeClass = 'badge-pending';
            
            tbody.innerHTML += `<tr>
                <td data-label="Cliente"><div class="user-cell"><div class="avatar">${getInitials(inv.psychologistName)}</div> ${inv.psychologistName}</div></td>
                <td data-label="Data"><span style="color:var(--saas-muted);">${new Date(inv.date).toLocaleDateString('pt-BR')}</span></td>
                <td data-label="Valor" style="font-weight: 500;">R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td data-label="Status"><span class="status-badge ${badgeClass}">${inv.status}</span></td>
                <td data-label="Ação"><button class="btn-detail" onclick="if('${inv.psiId}' && '${inv.psiId}' !== 'null') { window.openCSDrawer('${inv.psiId}') } else { alert('Cliente externo sem ID vinculado.'); }">Detalhes &rarr;</button></td>
            </tr>`;
        });
    }

    function getRelativeDateLabel(dateString) {
        if (!dateString) return 'Isento';
        const d = new Date(dateString);
        const today = new Date();
        today.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        const diffMs = d - today;
        const diffDays = Math.round(diffMs / 86400000);
        
        let label = '';
        let dotColor = 'transparent';
        if (diffDays < 0) { label = 'Vencido'; dotColor = 'var(--saas-red)'; }
        else if (diffDays === 0) { label = 'Hoje'; dotColor = 'var(--saas-orange)'; }
        else if (diffDays === 1) { label = 'Amanhã'; dotColor = 'var(--saas-orange)'; }
        else if (diffDays <= 7) { label = `Em ${diffDays} dias`; dotColor = 'var(--saas-blue)'; }
        else { label = d.toLocaleDateString('pt-BR'); dotColor = 'var(--saas-green)'; }
        
        return `<span class="urgency-dot" style="background: ${dotColor};"></span> ${label}`;
    }

    function renderPlanosAtivos(plans) {
        const tbody = document.getElementById('planos-ativos-body');
        tbody.innerHTML = '';
        if (!plans || plans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color:var(--saas-muted);">Nenhum próximo pagamento mapeado.</td></tr>';
            return;
        }
        plans.forEach(plan => {
            tbody.innerHTML += `<tr>
                <td data-label="Cliente"><div class="user-cell"><div class="avatar">${getInitials(plan.psychologistName)}</div> ${plan.psychologistName}</div></td>
                <td data-label="Plano"><span style="background: var(--saas-bg); border: 1px solid var(--saas-border); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: var(--saas-text);">${plan.planName}</span></td>
                <td data-label="Vencimento">${getRelativeDateLabel(plan.nextBilling)}</td>
            </tr>`;
        });
    }

    // --- FUNÇÕES MANTIDAS DO DESEMPENHO E USO ---
    function renderDropoffs(abandonos) {
        const list = document.getElementById('funnel-dropoff-list');
        if(!list) return;
        if (abandonos && abandonos.length > 0) {
            list.innerHTML = abandonos.map(i => `<tr><td><strong>${i.step}</strong></td><td style="text-align:right; color:#E63946; font-weight:bold;">${i.count}</td></tr>`).join('');
        } else {
            list.innerHTML = '<tr><td colspan="2" style="text-align:center;">Nenhum dado de abandono.</td></tr>';
        }
    }

    function renderUTMs(origens) {
        const list = document.getElementById('funnel-utm-list');
        if(!list) return;
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
        if(!list) return;
        if (!stData || !stData.usage || stData.usage.length === 0) {
            list.innerHTML = '<p>Aguardando dados de uso.</p>';
            return;
        }
        list.innerHTML = stData.usage.map(i => `<li class="feature-usage-item"><div class="feature-header"><span>${i.name}</span><span>${i.percentage}%</span></div><div class="feature-bar-bg"><div class="feature-bar-fill ${i.status || 'medium'}" style="width: ${i.percentage}%;"></div></div></li>`).join('');
    }

    function formatDateBR(dateString) { const [y, m, d] = dateString.split('-'); return `${d}/${m}`; }

    function renderUsersChart(data, visitsData) { 
        const canvas = document.getElementById('chartUsers');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (chartInstances.users) chartInstances.users.destroy();
        const allDates = [...new Set([...(data || []).map(d => d.data), ...(visitsData || []).map(v => v.data)])].sort();
        const labels = allDates.map(d => formatDateBR(d));
        const patients = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.pacientes, 10) : 0; });
        const psis = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.psis, 10) : 0; });
        const visits = allDates.map(d => { const f = (visitsData || []).find(x => x.data === d); return f ? parseInt(f.total, 10) : 0; });
        
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
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 } } } }, scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter' } } }, y: { grid: { color: '#f1f5f9' }, border: { display: false } } } } 
        });
    }

    function renderDemandChart(data) {
        const canvas = document.getElementById('chartDemand');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        if (chartInstances.demand) chartInstances.demand.destroy();
        const labels = (data || []).map(item => formatDateBR(item.data));
        const done = (data || []).map(item => item.concluidos);
        const drop = (data || []).map(item => item.desistencias);
        
        chartInstances.demand = new Chart(ctx, { 
            type: 'bar', 
            data: { labels: labels, datasets: [ { label: 'Concluídos', data: done, backgroundColor: '#10b981', borderRadius: 4, barPercentage: 0.6 }, { label: 'Desistências', data: drop, backgroundColor: '#fca5a5', borderRadius: 4, barPercentage: 0.6 } ] }, 
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 } } } }, scales: { x: { grid: { display: false }, stacked: true }, y: { grid: { color: '#f1f5f9' }, border: { display: false }, stacked: true } } } 
        });
    }

    window.carregarFluxoCaixa = async function() {
        const tbody = document.getElementById('cash-flow-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #94a3b8;">Buscando dados no Asaas...</td></tr>';
        
        try {
            const response = await fetch('/api/admin/cash-flow');
            if (!response.ok) throw new Error("Erro ao buscar fluxo de caixa");
            
            const data = await response.json();
            const cashFlow = data.cashFlow || [];
            
            tbody.innerHTML = '';
            
            if (cashFlow.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #94a3b8;">Nenhum pagamento encontrado.</td></tr>';
                return;
            }
            
            cashFlow.forEach(item => {
                const [ano, mes] = item.monthYear.split('-');
                const dataFormatada = `${mes}/${ano}`;
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                const brutoStr = item.grossValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const liquidoStr = item.netValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                tr.innerHTML = `
                    <td data-label="Mês/Ano" style="padding: 12px; font-weight: 500; color: #1e293b;">${dataFormatada}</td>
                    <td data-label="Transações" style="padding: 12px; text-align: center;">
                        <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 50px; font-size: 12px; color: #475569;">${item.count} pagamentos</span>
                    </td>
                    <td data-label="Valor Bruto" style="padding: 12px; text-align: right; color: var(--cinza-texto);">${brutoStr}</td>
                    <td data-label="Valor Líquido (Recebido)" style="padding: 12px; text-align: right; color: #10b981; font-weight: bold;">${liquidoStr}</td>
                `;
                tbody.appendChild(tr);
            });
            
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #ef4444;">Erro ao carregar os dados do Asaas.</td></tr>';
        }
    };

    // Execução Inicial
    loadConsolidatedData();
    if(window.carregarFluxoCaixa) window.carregarFluxoCaixa();
};
