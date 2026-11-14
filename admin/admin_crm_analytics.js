window.initializePage = function() {
    const API_BASE_URL = window.API_BASE_URL || '';
    const token = localStorage.getItem('Yelo_token');
    let chartInstances = {};

    const startInput = document.getElementById('crm-analytics-start');
    const endInput = document.getElementById('crm-analytics-end');
    const customWrap = document.getElementById('custom-date-wrap');

    let comparisonPeriodHint = '';
    const formatDateLocal = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    function setDateRange(days) {
        const end = new Date();
        const offset = days > 0 ? days - 1 : 0;
        const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - offset);
        startInput.value = formatDateLocal(start);
        endInput.value = formatDateLocal(end);
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
                        const formatBRL = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                        const formatPerc = (v) => `${v.toFixed(1)}%`;
                        const formatNum = (v) => `${v} usuários`;
                        
                        // Update KPIs with variations
                        updateKpiCard('mrr', dataFin.kpis.mrr.current, dataFin.kpis.mrr.previous, formatBRL);
                        updateKpiCard('paid-churn', dataFin.kpis.paidChurnRate.current, dataFin.kpis.paidChurnRate.previous, formatPerc, true, { isRate: true }); // inverted: lower is better
                        updateKpiCard('trial-churn', dataFin.kpis.trialChurnCount.current, dataFin.kpis.trialChurnCount.previous, formatNum, true); // inverted: lower is better
                        
                        if (dataFin.kpis.inadimplentesCount) {
                            updateKpiCard('inadimplentes', dataFin.kpis.inadimplentesCount.current, dataFin.kpis.inadimplentesCount.previous, formatNum, true);
                        }

                        const ltvPrevComparable = dataFin.kpis.ltv.projectedPrevious ?? dataFin.kpis.ltv.previous;
                        if (dataFin.kpis.ltv.projected > 0) {
                            updateKpiCard('ltv', dataFin.kpis.ltv.projected, ltvPrevComparable, formatBRL);
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

                        const pDays = dataFin.kpis.periodDays;
                        comparisonPeriodHint = '';
                        if (dataFin.kpis.comparisonPeriod) {
                            const fmtBr = (iso) => {
                                const dt = new Date(iso);
                                return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
                            };
                            comparisonPeriodHint = `${fmtBr(dataFin.kpis.comparisonPeriod.prevStart)}–${fmtBr(dataFin.kpis.comparisonPeriod.prevEnd)}${pDays ? ` · ${pDays}d` : ''}`;
                        }
                        if (pDays) {
                            document.querySelectorAll('.kpi-compare').forEach(el => {
                                el.textContent = `vs ${pDays}d anteriores`;
                            });
                        }
                        
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

    function updateKpiCard(id, current, previous, formatter, lowerIsBetter = false, opts = {}) {
        const valEl = document.getElementById(`kpi-${id}`);
        if (!valEl) return;
        valEl.innerText = formatter(current);
        const trendEl = document.getElementById(`trend-${id}`);
        if (!trendEl) return;
        if(previous === 0 && current === 0) {
            trendEl.innerText = '-';
            trendEl.className = 'kpi-trend trend-neutral';
            trendEl.title = 'Sem variação no período anterior';
            return;
        }
        const diff = current - previous;
        const prevPrefix = comparisonPeriodHint ? `Período anterior (${comparisonPeriodHint}):` : 'Período anterior:';
        trendEl.title = `${prevPrefix} ${formatter(previous)}`;

        if (opts.isRate) {
            if (Math.abs(diff) < 0.05) {
                trendEl.innerText = '▬ 0.0 p.p.';
                trendEl.className = 'kpi-trend trend-neutral';
                return;
            }
            const arrow = diff > 0 ? '↑' : '↓';
            const sign = diff > 0 ? '+' : '-';
            trendEl.innerText = `${arrow} ${sign}${Math.abs(diff).toFixed(1)} p.p.`;
            if (diff > 0) {
                trendEl.className = lowerIsBetter ? 'kpi-trend trend-down' : 'kpi-trend trend-up';
            } else {
                trendEl.className = lowerIsBetter ? 'kpi-trend trend-up' : 'kpi-trend trend-down';
            }
            return;
        }

        let percent = previous > 0 ? (diff / previous) * 100 : (current > 0 ? 100 : 0);
        if (Math.abs(percent) < 0.05) {
            trendEl.innerText = '▬ 0.0%';
            trendEl.className = 'kpi-trend trend-neutral';
            return;
        }
        
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
            tbody.innerHTML = '<tr><td colspan="5" class="empty-state-cell" style="text-align: center; color:var(--saas-muted); padding: 24px;">Nenhuma fatura recente.</td></tr>';
            return;
        }
        invoices.forEach(inv => {
            let badgeClass = 'badge-cancelled';
            if (inv.status === 'Paga') badgeClass = 'badge-paid';
            if (inv.status === 'Atrasada') badgeClass = 'badge-overdue';
            if (inv.status === 'Pendente') badgeClass = 'badge-pending';
            
            tbody.innerHTML += `<tr class="saas-invoice-row">
                <td data-label="Cliente" class="inv-col-cliente"><div class="user-cell"><div class="avatar">${getInitials(inv.psychologistName)}</div> <span class="client-name">${inv.psychologistName}</span></div></td>
                <td data-label="Data" class="inv-col-data"><span class="inv-date">${new Date(inv.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span></td>
                <td data-label="Valor" class="inv-col-valor" style="font-weight: 600;">R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td data-label="Status" class="inv-col-status"><span class="status-badge ${badgeClass}">${inv.status}</span></td>
                <td data-label="Ação" class="inv-col-acao"><button class="btn-detail" onclick="if('${inv.psiId}' && '${inv.psiId}' !== 'null') { window.openCSDrawer('${inv.psiId}') } else { alert('Cliente externo sem ID vinculado.'); }">Detalhes &rarr;</button></td>
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
        
        // Filtra para remover os que estao vencidos a mais de 2 dias
        const activePlans = (plans || []).filter(plan => {
            if (!plan.nextBilling) return true;
            const d = new Date(plan.nextBilling);
            const today = new Date();
            today.setHours(0,0,0,0);
            d.setHours(0,0,0,0);
            const diffDays = Math.round((d - today) / 86400000);
            return diffDays >= -2;
        });

        if (activePlans.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="empty-state-cell" style="text-align: center; color:var(--saas-muted); padding: 24px;">Nenhum próximo pagamento mapeado.</td></tr>';
            return;
        }
        activePlans.forEach(plan => {
            tbody.innerHTML += `<tr class="saas-plan-row">
                <td data-label="Cliente" class="plan-col-cliente"><div class="user-cell" onclick="window.openCSDrawer('${plan.psychologistId}')" style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--saas-blue)'" onmouseout="this.style.color='inherit'"><div class="avatar">${getInitials(plan.psychologistName)}</div> <span class="client-name">${plan.psychologistName}</span></div></td>
                <td data-label="Plano" class="plan-col-plano"><span class="plan-badge">${plan.planName}</span></td>
                <td data-label="Vencimento" class="plan-col-vencimento">${getRelativeDateLabel(plan.nextBilling)}</td>
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
                tr.className = 'cash-flow-row';
                const brutoStr = item.grossValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const liquidoStr = item.netValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                
                tr.innerHTML = `
                    <td data-label="Mês/Ano" class="cf-col-mes">${dataFormatada}</td>
                    <td data-label="Transações" class="cf-col-transacoes">
                        <span class="cf-badge-transacoes">${item.count} pagamentos</span>
                    </td>
                    <td data-label="Valor Bruto" class="cf-col-bruto">${brutoStr}</td>
                    <td data-label="Valor Líquido (Recebido)" class="cf-col-liquido">${liquidoStr}</td>
                `;
                tbody.appendChild(tr);
            });
            
            // Plotar Gráfico Semanal (Mês atual vs Mês anterior)
            const weeklyCtx = document.getElementById('weeklyPaymentsChart');
            if (weeklyCtx && data.weeklyCashFlow) {
                // Obter os 2 meses mais recentes (lembrando que cashFlow está ordenado do mais recente pro mais antigo)
                if (cashFlow.length >= 2) {
                    const currentMonthStr = cashFlow[0].monthYear; // ex: "2026-11"
                    const previousMonthStr = cashFlow[1].monthYear; // ex: "2026-10"
                    
                    const currentData = data.weeklyCashFlow[currentMonthStr] || { 1:0, 2:0, 3:0, 4:0, 5:0 };
                    const previousData = data.weeklyCashFlow[previousMonthStr] || { 1:0, 2:0, 3:0, 4:0, 5:0 };
                    
                    const [cYear, cMonth] = currentMonthStr.split('-');
                    const [pYear, pMonth] = previousMonthStr.split('-');

                    const currentTotal = cashFlow[0].count;
                    const previousTotal = cashFlow[1].count;

                    // Badges com totais consolidados no cabeçalho
                    const badgesContainer = document.getElementById('weekly-chart-summary-badges');
                    if (badgesContainer) {
                        badgesContainer.innerHTML = `
                            <span style="background: #f5f3ff; color: #6d28d9; border: 1px solid #ddd6fe; padding: 5px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: #8b5cf6;"></span>
                                ${cMonth}/${cYear}: ${currentTotal} pagamentos total
                            </span>
                            <span style="background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; padding: 5px 12px; border-radius: 20px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;">
                                <span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>
                                ${pMonth}/${pYear}: ${previousTotal} pagamentos total
                            </span>
                        `;
                    }
                    
                    if (window.weeklyPaymentsChartInstance) {
                        window.weeklyPaymentsChartInstance.destroy();
                    }
                    
                    const gradient = weeklyCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
                    gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');
                    
                    window.weeklyPaymentsChartInstance = new Chart(weeklyCtx, {
                        type: 'line',
                        data: {
                            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
                            datasets: [
                                {
                                    label: `Mês Atual (${cMonth}/${cYear}) — ${currentTotal} total`,
                                    data: [currentData[1], currentData[2], currentData[3], currentData[4], currentData[5]],
                                    borderColor: '#8b5cf6',
                                    backgroundColor: gradient,
                                    borderWidth: 3,
                                    pointBackgroundColor: '#ffffff',
                                    pointBorderColor: '#8b5cf6',
                                    pointBorderWidth: 2,
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    fill: true,
                                    tension: 0.4
                                },
                                {
                                    label: `Mês Anterior (${pMonth}/${pYear}) — ${previousTotal} total`,
                                    data: [previousData[1], previousData[2], previousData[3], previousData[4], previousData[5]],
                                    borderColor: '#94a3b8',
                                    backgroundColor: 'transparent',
                                    borderWidth: 2,
                                    borderDash: [5, 5],
                                    pointBackgroundColor: '#ffffff',
                                    pointBorderColor: '#94a3b8',
                                    pointBorderWidth: 2,
                                    pointRadius: 4,
                                    pointHoverRadius: 6,
                                    fill: false,
                                    tension: 0.4
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            layout: { padding: { left: 12, right: 12 } },
                            plugins: {
                                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 12 } } },
                                tooltip: { 
                                    backgroundColor: '#1f2937',
                                    padding: 12,
                                    titleFont: { size: 13, family: 'Inter' },
                                    bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
                                    callbacks: {
                                        label: function(context) {
                                            const label = context.dataset.label ? context.dataset.label.split(' — ')[0] : '';
                                            return ` ${label}: ${context.parsed.y} pagamentos nesta semana`;
                                        }
                                    }
                                }
                            },
                            scales: {
                                x: { grid: { display: false } },
                                y: { grid: { color: '#f1f5f9' }, border: { display: false }, beginAtZero: true, ticks: { stepSize: 1 } }
                            }
                        }
                    });
                }
            }
            
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #ef4444;">Erro ao carregar os dados do Asaas.</td></tr>';
        }
    };

    // Execução Inicial
    loadConsolidatedData();
    if(window.carregarFluxoCaixa) window.carregarFluxoCaixa();
};
