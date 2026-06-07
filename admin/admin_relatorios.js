// admin/admin_relatorios.js

(function() {
    let chartInstances = {}; // Guarda as referências para poder destruir e recriar

    window.loadReports = async function() {
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');
        
        // Configura datas padrão se vazio
        if (!startInput.value) {
            const today = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
            endInput.value = today.toISOString().split('T')[0];
        }

        // --- MOSTRA SKELETONS E ESCONDE CONTEÚDO ---
        document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
            const skeleton = card.querySelector('.kpi-skeleton');
            const content = card.querySelector('.kpi-content');
            if(skeleton) skeleton.style.display = 'block';
            if(content) content.style.display = 'none';
        });

        try {
            const token = localStorage.getItem('Yelo_token');
            const headers = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const query = `?startDate=${startInput.value}&endDate=${endInput.value}`;
            
            const response = await fetch(`${API_BASE_URL}/api/admin/reports/charts${query}`, {
                headers: headers
            });
            const data = await response.json();

            console.log("Dados recebidos do Relatório:", data);

            // --- NOVOS KPIs: Questionários ---
            let totalConcluidos = 0;
            let totalAbandonados = 0;
            if (data.demand && Array.isArray(data.demand)) {
                totalConcluidos = data.demand.reduce((acc, curr) => acc + (parseInt(curr.concluidos, 10) || 0), 0);
                totalAbandonados = data.demand.reduce((acc, curr) => acc + (parseInt(curr.desistencias, 10) || 0), 0);
            }
            
            const questConcluidosEl = document.getElementById('kpi-quest-concluidos');
            if (questConcluidosEl) questConcluidosEl.innerText = totalConcluidos.toLocaleString('pt-BR');
            
            const questAbandonadosEl = document.getElementById('kpi-quest-abandonados');
            if (questAbandonadosEl) questAbandonadosEl.innerText = totalAbandonados.toLocaleString('pt-BR');

            // Renderiza Gráficos
            if (typeof renderUsersChart === "function") renderUsersChart(data.users, data.visits || []);
            if (typeof renderDemandChart === "function") renderDemandChart(data.demand);
            if (typeof renderPlansChart === "function") renderPlansChart(data.plans);
            if (typeof renderTimeChart === "function") renderTimeChart(data.timeOfDay);

            // --- DADOS DO FUNIL E DROP-OFFS ---
            try {
                const resFunnel = await fetch(`${API_BASE_URL}/api/admin/analytics/funnel${query}`, { headers });
                if (resFunnel.ok) {
                    const funnelData = await resFunnel.json();
                    
                    const dropoffList = document.getElementById('funnel-dropoff-list');
                    if (dropoffList) {
                        if (funnelData.abandonos && funnelData.abandonos.length > 0) {
                            dropoffList.innerHTML = funnelData.abandonos.map(item => `
                                <tr>
                                    <td style="padding: 12px 15px;"><strong>${item.step}</strong></td>
                                    <td style="text-align: right; padding: 12px 15px; color: #E63946; font-weight: bold;">${item.count}</td>
                                </tr>
                            `).join('');
                        } else {
                            dropoffList.innerHTML = '<tr><td colspan="2" style="text-align:center; padding: 20px; color: #666;">Nenhum abandono registrado neste período.</td></tr>';
                        }
                    }

                    const utmList = document.getElementById('funnel-utm-list');
                    if (utmList) {
                        if (funnelData.origens && funnelData.origens.length > 0) {
                            const totalOrigens = funnelData.origens.reduce((acc, curr) => acc + parseInt(curr.count), 0);
                            utmList.innerHTML = funnelData.origens.map(item => {
                                const perc = Math.round((parseInt(item.count) / totalOrigens) * 100);
                                return `
                                    <li class="feature-usage-item">
                                        <div class="feature-header">
                                            <span>${item.source}</span>
                                            <span>${item.count} (${perc}%)</span>
                                        </div>
                                        <div class="feature-bar-bg">
                                            <div class="feature-bar-fill" style="width: ${perc}%; background-color: var(--verde-escuro);"></div>
                                        </div>
                                    </li>
                                `;
                            }).join('');
                        } else {
                            utmList.innerHTML = '<p style="color: #666; font-size: 0.9rem; font-style: italic;">Nenhuma origem rastreada.</p>';
                        }
                    }
                }
            } catch (errFunnel) {
                console.error("Erro ao carregar dados do funil:", errFunnel);
            }

            // --- CORREÇÃO DO KPI DE VISITAS ---
            const visitsArray = data.visits || [];
            const totalVisits = visitsArray.reduce((acc, curr) => {
                const val = parseInt(curr.total, 10);
                return acc + (isNaN(val) ? 0 : val);
            }, 0);

            const visitsEl = document.getElementById('kpi-visits');
            if (visitsEl) visitsEl.innerText = totalVisits.toLocaleString('pt-BR');
            
            const visits24hEl = document.getElementById('kpi-visits-24h');
            if (visits24hEl) visits24hEl.innerText = (data.visits24h || 0).toLocaleString('pt-BR');

            // Outros KPIs
            if (data.community) {
                const updateKpi = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.innerText = (parseInt(val, 10) || 0).toLocaleString('pt-BR');
                };
                
                updateKpi('kpi-questions', data.community.questionsTotal);
                updateKpi('kpi-answered', data.community.questionsAnswered);
                updateKpi('kpi-answers-total', data.community.answersTotal);
                updateKpi('kpi-blog', data.community.blogPosts);
            }

            // --- NOVOS KPIs FINANCEIROS ---
            if (data.financials) {
                const formatCurrency = (value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                const mrrEl = document.getElementById('kpi-mrr');
                if (mrrEl) mrrEl.innerText = formatCurrency(data.financials.mrr || 0);

                const churnEl = document.getElementById('kpi-churn');
                if (churnEl) churnEl.innerText = `${(data.financials.churnRate || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

                const ltvEl = document.getElementById('kpi-ltv');
                if (ltvEl) ltvEl.innerText = formatCurrency(data.financials.ltv || 0);

                const arpuEl = document.getElementById('kpi-arpu');
                if (arpuEl) arpuEl.innerText = formatCurrency(data.financials.arpu || 0);
            }

            // --- DADOS PWA (NOVO) ---
            try {
                const pwaResponse = await fetch(`${API_BASE_URL}/api/admin/stats/pwa`, { headers });
                if (pwaResponse.ok) {
                    const pwaData = await pwaResponse.json();
                    
                    const pwaTotalEl = document.getElementById('kpi-pwa');
                    if (pwaTotalEl) pwaTotalEl.innerText = pwaData.total || 0;

                    let android = 0, ios = 0;
                    if (pwaData.byPlatform) {
                        pwaData.byPlatform.forEach(p => {
                            if (p.platform === 'android') android = parseInt(p.count);
                            if (p.platform === 'ios') ios = parseInt(p.count);
                        });
                    }
                    const androidEl = document.getElementById('kpi-pwa-android');
                    const iosEl = document.getElementById('kpi-pwa-ios');
                    if (androidEl) androidEl.innerText = android;
                    if (iosEl) iosEl.innerText = ios;
                }
            } catch (errPwa) {
                console.error("Erro ao carregar dados PWA", errPwa);
            }

            // --- CLIQUES WHATSAPP ---
            const clicksEl = document.getElementById('kpi-whatsapp-clicks');
            if (clicksEl) {
                clicksEl.textContent = (data.whatsappClicks || 0).toLocaleString('pt-BR');
            }

            // --- RENDERIZA O SHADOW TRACKING ---
            if (typeof renderShadowTracking === "function") renderShadowTracking(data.shadowTracking);

            // --- ESCONDE SKELETONS E MOSTRA CONTEÚDO ---
            document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
                const skeleton = card.querySelector('.kpi-skeleton');
                const content = card.querySelector('.kpi-content');
                if(skeleton) skeleton.style.display = 'none';
                if(content) content.style.display = 'block';
            });

        } catch (error) {
            console.error("Erro ao carregar relatórios:", error);
            document.querySelectorAll('#relatorios .kpi-card').forEach(card => {
                const skeleton = card.querySelector('.kpi-skeleton');
                const content = card.querySelector('.kpi-content');
                if(skeleton) skeleton.style.display = 'none';
                if(content) content.style.display = 'block';
            });
        }
    };

    window.renderEmailStatusCard = function(emailHealth, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const oldCard = document.getElementById('kpi-email-card');
        if (oldCard) oldCard.remove();
        const status = emailHealth ? emailHealth.status : 'unknown';
        const errors = emailHealth ? (emailHealth.errors || 0) : 0;
        let colorClass = 'success', icon = 'check_circle', text = 'Operacional';
        if (status === 'warning') { colorClass = 'warning'; icon = 'warning'; text = `${errors} falhas (24h)`; } 
        else if (status === 'critical') { colorClass = 'danger'; icon = 'error'; text = `${errors} erros críticos`; }
        const cardHtml = `
            <div id="kpi-email-card" class="kpi-card">
                <div class="kpi-icon ${colorClass}"><span class="material-icons">email</span></div>
                <div class="kpi-info"><h3>Disparo de E-mails</h3><p class="kpi-value ${colorClass}"><span class="material-icons tiny-icon">${icon}</span>${text}</p><span class="kpi-label">Notificações Yelo</span></div>
            </div>`;
        container.insertAdjacentHTML('beforeend', cardHtml);
    };
    
    window.renderShadowTracking = function(stData) {
        const usageList = document.getElementById('st-usage-list');
        const plansList = document.getElementById('st-plans-list');
        if (!usageList || !plansList) return;
        if (!stData || !stData.usage || stData.usage.length === 0) {
            usageList.innerHTML = '<p style="color: #999; font-size: 0.9rem; font-style: italic;">Aguardando dados.</p>';
            plansList.innerHTML = '<p style="color: #166534; font-size: 0.9rem; font-style: italic;">Aguardando interações...</p>';
            return;
        }
        usageList.innerHTML = stData.usage.map(item => {
            let colorClass = item.status || (item.percentage >= 70 ? 'high' : (item.percentage < 40 ? 'low' : 'medium'));
            return `<li class="feature-usage-item"><div class="feature-header"><span>${item.name}</span><span>${item.percentage}%</span></div><div class="feature-bar-bg"><div class="feature-bar-fill ${colorClass}" style="width: 0%; transition: width 1.2s cubic-bezier(0.22, 1, 0.36, 1);"></div></div></li>`;
        }).join('');
        setTimeout(() => {
            const bars = usageList.querySelectorAll('.feature-bar-fill');
            stData.usage.forEach((item, index) => { if(bars[index]) bars[index].style.width = item.percentage + '%'; });
        }, 100);
        if (stData.plans && stData.plans.length > 0) {
            plansList.innerHTML = stData.plans.map(plan => `<div class="upsell-tier"><div class="upsell-tier-name"><span class="status ${plan.cssClass || 'status-active'}">${plan.name}</span></div><ul class="upsell-tier-features">${plan.features.map(f => `<li>${f}</li>`).join('')}</ul></div>`).join('');
        }
    };

    window.renderUsersChart = function(data, visitsData) { 
        const ctx = document.getElementById('chartUsers').getContext('2d');
        if (chartInstances.users) chartInstances.users.destroy();
        const allDates = [...new Set([...(data || []).map(d => d.data), ...(visitsData || []).map(v => v.data)])].sort();
        const labels = allDates.map(d => formatDateBR(d));
        const patients = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.pacientes, 10) : 0; });
        const psis = allDates.map(d => { const f = (data || []).find(x => x.data === d); return f ? parseInt(f.psis, 10) : 0; });
        const visits = allDates.map(d => { const f = (visitsData || []).find(x => x.data === d); return f ? parseInt(f.total, 10) : 0; });
        chartInstances.users = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Acessos (Pageviews)', data: visits, borderColor: '#2980b9', backgroundColor: 'rgba(41, 128, 185, 0.1)', tension: 0.4, fill: true }, { label: 'Novos Pacientes', data: patients, borderColor: '#2E7D32', tension: 0.3 }, { label: 'Novos Psicólogos', data: psis, borderColor: '#F9A825', tension: 0.3 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    };

    window.renderDemandChart = function(data) {
        const ctx = document.getElementById('chartDemand').getContext('2d');
        if (chartInstances.demand) chartInstances.demand.destroy();
        const labels = data.map(item => formatDateBR(item.data));
        const done = data.map(item => item.concluidos);
        const drop = data.map(item => item.desistencias);
        chartInstances.demand = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [ { label: 'Concluídos', data: done, borderColor: '#2E7D32', backgroundColor: 'rgba(46, 125, 50, 0.1)', tension: 0.3, fill: true }, { label: 'Desistências', data: drop, borderColor: '#e74c3c', backgroundColor: 'rgba(231, 76, 60, 0.1)', tension: 0.3, fill: true } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { stacked: false } }, plugins: { legend: { position: 'bottom' } } } });
    };

    window.renderPlansChart = function(data) {
        const ctx = document.getElementById('chartPlans').getContext('2d');
        if (chartInstances.plans) chartInstances.plans.destroy();
        const labels = data.map(item => item.plano);
        const values = data.map(item => item.total);
        const colors = labels.map(p => { if(p === 'Essencial') return '#81C784'; if(p === 'Clínico') return '#FFD54F'; if(p === 'Sol') return '#FF8A65'; return '#ccc'; });
        chartInstances.plans = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: values, backgroundColor: colors }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    };

    window.updateCommunityKPIs = function(stats) {
        if (!stats) return;
        document.getElementById('kpi-questions').innerText = stats.questionsTotal || 0;
        document.getElementById('kpi-answered').innerText = stats.questionsAnswered || 0;
        document.getElementById('kpi-answers-total').innerText = stats.answersTotal || 0;
        document.getElementById('kpi-blog').innerText = stats.blogPosts || 0;
    };

    window.renderTimeChart = function(data) {
        const ctx = document.getElementById('chartTime').getContext('2d');
        if (chartInstances.time) chartInstances.time.destroy();
        const periods = ['Manhã', 'Tarde', 'Noite', 'Madrugada'];
        const values = periods.map(p => { const found = data ? data.find(item => item.periodo === p) : null; return found ? parseInt(found.total) : 0; });
        chartInstances.time = new Chart(ctx, { type: 'polarArea', data: { labels: periods, datasets: [{ data: values, backgroundColor: [ 'rgba(255, 206, 86, 0.7)', 'rgba(255, 159, 64, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(153, 102, 255, 0.7)' ] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } } });
    };

    function formatDateBR(dateString) {
        const [y, m, d] = dateString.split('-');
        return `${d}/${m}`;
    }
})();