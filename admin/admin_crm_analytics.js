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
                        const formatBRL = (v) => {
                            const n = Number(v || 0);
                            const isInt = Math.abs(n - Math.round(n)) < 0.005;
                            return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: isInt ? 0 : 2, maximumFractionDigits: 2 })}`;
                        };
                        const formatPerc = (v) => `${v.toFixed(1)}%`;
                        const formatNum = (v) => `${v} usuários`;
                        
                        // Update KPIs with variations
                        updateKpiCard('mrr', dataFin.kpis.mrr.current, dataFin.kpis.mrr.previous, formatBRL);
                        const cardMrrMeta = document.querySelector('#card-mrr .kpi-meta');
                        if (cardMrrMeta) {
                            let promoNoteEl = document.getElementById('kpi-mrr-promo-note');
                            if (dataFin.kpis.mrr.promoCount > 0 && dataFin.kpis.mrr.multiMonthDiscount >= 1) {
                                if (!promoNoteEl) {
                                    promoNoteEl = document.createElement('div');
                                    promoNoteEl.id = 'kpi-mrr-promo-note';
                                    promoNoteEl.style.cssText = 'font-size: 0.72rem; color: #0369a1; font-weight: 600; margin-top: 6px;';
                                    cardMrrMeta.insertAdjacentElement('afterend', promoNoteEl);
                                }
                                promoNoteEl.textContent = `Pós-promo: ${formatBRL(dataFin.kpis.mrr.contracted)} (${dataFin.kpis.mrr.promoCount} em promo/multi-mês)`;
                            } else if (promoNoteEl) {
                                promoNoteEl.remove();
                            }
                        }
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
                if (item.summaryHint) {
                    const transCell = tr.querySelector('.cf-col-transacoes');
                    if (transCell) {
                        const hintDiv = document.createElement('div');
                        hintDiv.style.cssText = 'font-size: 0.72rem; color: #0369a1; font-weight: 600; margin-top: 4px;';
                        hintDiv.textContent = item.summaryHint;
                        transCell.appendChild(hintDiv);
                    }
                }
                tbody.appendChild(tr);
            });
            
            // Plotar Gráfico Semanal (Últimos 6 meses comparativos com toggle de mostrar/ocultar)
            const weeklyCtx = document.getElementById('weeklyPaymentsChart');
            if (weeklyCtx && data.weeklyCashFlow) {
                const cashFlowMap = new Map();
                cashFlow.forEach(item => {
                    if (item && item.monthYear) cashFlowMap.set(item.monthYear, item);
                });

                // Gera os últimos 6 meses sequenciais em horário de Brasília (ou a partir do mês mais recente retornado)
                const nowParts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit'
                }).format(new Date()).split('-').map(Number);
                let anchorYear = nowParts[0];
                let anchorMonth = nowParts[1];
                if (cashFlow[0]?.monthYear) {
                    const [topY, topM] = cashFlow[0].monthYear.split('-').map(Number);
                    if (topY > anchorYear || (topY === anchorYear && topM > anchorMonth)) {
                        anchorYear = topY;
                        anchorMonth = topM;
                    }
                }

                const lastSixMonths = [];
                for (let offset = 0; offset < 6; offset++) {
                    const d = new Date(anchorYear, (anchorMonth - 1) - offset, 1);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const monthKey = `${y}-${m}`;
                    const weeklyObj = data.weeklyCashFlow[monthKey] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
                    const summaryObj = cashFlowMap.get(monthKey);
                    const total = summaryObj
                        ? Number(summaryObj.count || 0)
                        : [1, 2, 3, 4, 5].reduce((acc, w) => acc + Number(weeklyObj[w] || 0), 0);
                    lastSixMonths.push({
                        monthKey,
                        labelShort: `${m}/${y}`,
                        total,
                        weekly: [
                            Number(weeklyObj[1] || 0),
                            Number(weeklyObj[2] || 0),
                            Number(weeklyObj[3] || 0),
                            Number(weeklyObj[4] || 0),
                            Number(weeklyObj[5] || 0)
                        ]
                    });
                }

                if (window.weeklyPaymentsChartInstance) {
                    window.weeklyPaymentsChartInstance.destroy();
                }

                const gradient = weeklyCtx.getContext('2d').createLinearGradient(0, 0, 0, 300);
                gradient.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
                gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

                const MONTH_PALETTE = [
                    { border: '#8b5cf6', bg: '#f5f3ff', text: '#6d28d9', borderPill: '#ddd6fe', dash: [], width: 3, fill: true },
                    { border: '#2563eb', bg: '#eff6ff', text: '#1d4ed8', borderPill: '#bfdbfe', dash: [6, 4], width: 2.2, fill: false },
                    { border: '#10b981', bg: '#ecfdf5', text: '#047857', borderPill: '#a7f3d0', dash: [], width: 2.2, fill: false },
                    { border: '#f59e0b', bg: '#fffbeb', text: '#b45309', borderPill: '#fde68a', dash: [4, 4], width: 2, fill: false },
                    { border: '#ec4899', bg: '#fdf2f8', text: '#be185d', borderPill: '#fbcfe8', dash: [], width: 2, fill: false },
                    { border: '#64748b', bg: '#f8fafc', text: '#475569', borderPill: '#cbd5e1', dash: [3, 3], width: 2, fill: false }
                ];

                const datasets = lastSixMonths.map((item, idx) => {
                    const style = MONTH_PALETTE[idx % MONTH_PALETTE.length];
                    const prefix = idx === 0 ? 'Mês Atual' : (idx === 1 ? 'Mês Anterior' : item.labelShort);
                    const datasetLabel = idx <= 1
                        ? `${prefix} (${item.labelShort}) — ${item.total} total`
                        : `${item.labelShort} — ${item.total} total`;
                    return {
                        label: datasetLabel,
                        data: item.weekly,
                        borderColor: style.border,
                        backgroundColor: style.fill ? gradient : 'transparent',
                        borderWidth: style.width,
                        borderDash: style.dash,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: style.border,
                        pointBorderWidth: 2,
                        pointRadius: idx === 0 ? 4.5 : 3.5,
                        pointHoverRadius: 6,
                        fill: style.fill,
                        tension: 0.38
                    };
                });

                const badgesContainer = document.getElementById('weekly-chart-summary-badges');
                const syncBadgeButtonsState = () => {
                    const chart = window.weeklyPaymentsChartInstance;
                    if (!badgesContainer || !chart) return;
                    badgesContainer.querySelectorAll('button[data-dataset-index]').forEach((btn) => {
                        const idx = parseInt(btn.getAttribute('data-dataset-index'), 10);
                        const style = MONTH_PALETTE[idx % MONTH_PALETTE.length];
                        const isVisible = chart.isDatasetVisible(idx);
                        btn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
                        btn.style.opacity = isVisible ? '1' : '0.45';
                        btn.style.background = isVisible ? style.bg : '#f1f5f9';
                        btn.style.color = isVisible ? style.text : '#64748b';
                        btn.style.borderColor = isVisible ? style.borderPill : '#cbd5e1';
                        btn.style.textDecoration = isVisible ? 'none' : 'line-through';
                    });
                };

                window.weeklyPaymentsChartInstance = new Chart(weeklyCtx, {
                    type: 'line',
                    data: {
                        labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'],
                        datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        layout: { padding: { left: 12, right: 12 } },
                        plugins: {
                            legend: {
                                position: 'bottom',
                                onClick: function(e, legendItem, legend) {
                                    const index = legendItem.datasetIndex;
                                    const ci = legend.chart;
                                    ci.setDatasetVisibility(index, !ci.isDatasetVisible(index));
                                    ci.update();
                                    syncBadgeButtonsState();
                                },
                                labels: { usePointStyle: true, boxWidth: 8, padding: 14, font: { family: 'Inter', size: 12 } }
                            },
                            tooltip: {
                                backgroundColor: '#1f2937',
                                padding: 12,
                                titleFont: { size: 13, family: 'Inter' },
                                bodyFont: { size: 13, family: 'Inter', weight: 'bold' },
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

                if (badgesContainer) {
                    while (badgesContainer.firstChild) badgesContainer.removeChild(badgesContainer.firstChild);
                    lastSixMonths.forEach((item, idx) => {
                        const style = MONTH_PALETTE[idx % MONTH_PALETTE.length];
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.setAttribute('data-dataset-index', String(idx));
                        btn.setAttribute('aria-pressed', 'true');
                        btn.title = `Clique para ocultar ou mostrar ${item.labelShort}`;
                        btn.style.cssText = `background: ${style.bg}; color: ${style.text}; border: 1px solid ${style.borderPill}; padding: 5px 11px; border-radius: 999px; font-size: 0.78rem; font-weight: ${idx === 0 ? '700' : '600'}; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.15s ease;`;

                        const dot = document.createElement('span');
                        dot.style.cssText = `width: 8px; height: 8px; border-radius: 50%; background: ${style.border}; flex-shrink: 0;`;

                        const txt = document.createElement('span');
                        txt.textContent = `${item.labelShort}: ${item.total} pag.`;

                        btn.appendChild(dot);
                        btn.appendChild(txt);
                        btn.addEventListener('click', () => {
                            const chart = window.weeklyPaymentsChartInstance;
                            if (!chart) return;
                            chart.setDatasetVisibility(idx, !chart.isDatasetVisible(idx));
                            chart.update();
                            syncBadgeButtonsState();
                        });
                        badgesContainer.appendChild(btn);
                    });
                    syncBadgeButtonsState();
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
