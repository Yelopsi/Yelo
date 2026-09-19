let cmoWeeklyChartInstance = null;
async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    let dateStart = document.getElementById('cmo-date-start')?.value;
    let dateEnd = document.getElementById('cmo-date-end')?.value;

    if (!dateStart || !dateEnd) {
        // Fallback rápido se ainda não inicializou o selector
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const endDay = new Date(year, now.getMonth() + 1, 0).getDate();
        dateStart = `${year}-${month}-01`;
        dateEnd = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
    }
    
    

    const btn = document.querySelector('button[onclick="loadCMOMetrics()"]');
    const originalBtnHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Atualizando...';
        if (!document.getElementById('cmo-spin-style')) {
            const style = document.createElement('style');
            style.id = 'cmo-spin-style';
            style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    try {
        const response = await fetch(`/api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            let errorDetails = '';
            try {
                const errorJson = await response.json();
                errorDetails = errorJson.details || errorJson.error || JSON.stringify(errorJson);
            } catch(err) {
                errorDetails = await response.text();
            }
            alert(`Falha na API CMO (Erro ${response.status}):\n${errorDetails.substring(0, 200)}`);
            if(document.getElementById('ai-decision-action')) document.getElementById('ai-decision-action').textContent = 'Erro de Conexão';
            if(document.getElementById('ai-decision-reason')) document.getElementById('ai-decision-reason').textContent = 'Não foi possível carregar os dados. Veja o console (F12).';
            return;
        }

        const data = await response.json();
        
        if (data.success) {
            renderCMOMetrics(data);
            loadTrafficMetrics(dateStart, dateEnd, token);
        } else {
            alert('A API respondeu com falha. Verifique o console.');
        }
    } catch (e) {
        console.error('💥 ERRO FATAL NO CMO DASHBOARD');
        console.error('Mensagem:', e.message);
        console.error('Stack:', e.stack);
        console.error('Erro completo:', e);
        alert(`Erro Crítico: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
        }
    }
}

function renderCMOMetrics(data) {
    const formatCurrency = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // 1. Atualizar KPIs (B2B e B2C)
    
    // Popula Cards da Inteligência Algorítmica (Funil B2B)
    if (data.platform) {
        // B2B (Meta) KPIs
        document.getElementById('cmo-meta-spend').textContent = formatCurrency(data.ads?.meta?.spend || 0);
        document.getElementById('cmo-meta-trials').textContent = (data.platform.b2b?.trials || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-meta-pagantes').textContent = (data.platform.b2b?.active || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-meta-cac').textContent = formatCurrency(data.ads?.meta?.cac || 0);

        // B2C (Google) KPIs
        document.getElementById('cmo-google-spend').textContent = formatCurrency(data.ads?.google?.spend || 0);
        document.getElementById('cmo-google-clicks').textContent = (data.platform.b2c?.wpp_clicks || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-google-deals').textContent = (data.platform.b2c?.total_deals || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-google-cpl').textContent = formatCurrency(data.ads?.google?.cpl || 0);

        // Cards de Transparência (seção inferior)
        const setDbgHist = (id, histVal, monthVal) => { 
            const el = document.getElementById(id); 
            if (el) {
                el.style.fontSize = '1.05rem';
                el.style.display = 'flex';
                el.style.flexDirection = 'column';
                el.style.gap = '2px';
                el.style.marginTop = '4px';
                el.innerHTML = `<span style="color: #64748b; font-size: 0.75rem;">Histórico: <strong style="color: #1e293b; font-size: 1.05rem;">${histVal}</strong></span><span style="color: #64748b; font-size: 0.75rem;">No Período: <strong style="color: #1e293b; font-size: 1.05rem;">${monthVal}</strong></span>`;
            } 
        };

        setDbgHist('dbg-meta-spend',    formatCurrency(data.historical?.meta?.spend || 0), formatCurrency(data.ads?.meta?.spend || 0));
        setDbgHist('dbg-meta-trials',   (data.historical?.platform?.b2b?.trials || 0).toLocaleString('pt-BR'), (data.platform.b2b?.trials || 0).toLocaleString('pt-BR'));
        setDbgHist('dbg-meta-pagantes', (data.historical?.platform?.b2b?.active || 0).toLocaleString('pt-BR'), (data.platform.b2b?.active || 0).toLocaleString('pt-BR'));
        setDbgHist('dbg-meta-cac',      formatCurrency(data.historical?.meta?.cac || 0), formatCurrency(data.ads?.meta?.cac || 0));
        setDbgHist('dbg-meta-payback',  (data.historical?.meta?.paybackMonths || 0).toFixed(1).replace('.', ',') + ' Meses', (data.decisionEngineMeta?.paybackMonths || 0).toFixed(1).replace('.', ',') + ' Meses');
        
        const formatPercent = (val) => `${(val * 100).toFixed(1)}%`;
        setDbgHist('dbg-meta-churn',    formatPercent(data.historical?.meta?.churn_rate || 0), formatPercent(data.platform.b2b?.meta_churn_rate || 0));
        setDbgHist('dbg-global-churn',  formatPercent(data.historical?.platform?.b2b?.global_churn_rate || 0), formatPercent(data.platform.b2b?.global_churn_rate || 0));
        
        setDbgHist('dbg-google-spend',  formatCurrency(data.historical?.google?.spend || 0), formatCurrency(data.ads?.google?.spend || 0));
        setDbgHist('dbg-google-clicks', (data.historical?.platform?.b2c?.wpp_clicks || 0).toLocaleString('pt-BR'), (data.platform.b2c?.wpp_clicks || 0).toLocaleString('pt-BR'));
        setDbgHist('dbg-google-deals',  (data.historical?.platform?.b2c?.total_deals || 0).toLocaleString('pt-BR'), (data.platform.b2c?.total_deals || 0).toLocaleString('pt-BR'));
        setDbgHist('dbg-google-cpl',    formatCurrency(data.historical?.google?.cpl || 0), formatCurrency(data.ads?.google?.cpl || 0));
    }

    // 2. Atualizar Motor de Decisão Meta (B2B)
    if (data.decisionEngineMeta) {
        const actionEl = document.getElementById('ai-meta-action');
        const warningContainer = document.getElementById('ai-meta-warning-container');
        const warningEl = document.getElementById('ai-meta-warning');

        if(actionEl) {
            actionEl.textContent = data.decisionEngineMeta.action;
            if (data.decisionEngineMeta.action.includes('AUMENTAR')) actionEl.style.color = '#10b981';
            else if (data.decisionEngineMeta.action.includes('PAUSAR') || data.decisionEngineMeta.action.includes('TETO') || data.decisionEngineMeta.action.includes('INVESTIGAR')) actionEl.style.color = '#ef4444';
            else actionEl.style.color = '#f59e0b';
        }

        document.getElementById('ai-meta-confidence').textContent = `Confiança: ${data.decisionEngineMeta.confidence || 0}%`;
        document.getElementById('ai-meta-target').textContent = formatCurrency(data.decisionEngineMeta.target);
        document.getElementById('ai-meta-scale').textContent = data.decisionEngineMeta.scaleCapacity || '-';
        document.getElementById('ai-meta-payback').textContent = (data.decisionEngineMeta.paybackMonths || 0).toFixed(1).replace('.', ',') + ' Meses';
        
        const trend = data.decisionEngineMeta.trend || 0;
        const trendEl = document.getElementById('ai-meta-trend');
        if (trendEl) {
            trendEl.textContent = `${trend > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(trend))}`;
            trendEl.style.color = trend > 0 ? '#ef4444' : '#10b981';
        }
        
        document.getElementById('ai-meta-recommendation').textContent = data.decisionEngineMeta.recommendation || '';

        if (data.decisionEngineMeta.warning) {
            if(warningContainer) warningContainer.style.display = 'block';
            if(warningEl) warningEl.textContent = data.decisionEngineMeta.warning;
        } else {
            if(warningContainer) warningContainer.style.display = 'none';
        }
    }

    // 3. Atualizar Motor de Decisão Google (B2C)
    if (data.decisionEngineGoogle) {
        const actionEl = document.getElementById('ai-google-action');
        const warningContainer = document.getElementById('ai-google-warning-container');
        const warningEl = document.getElementById('ai-google-warning');

        if(actionEl) {
            actionEl.textContent = data.decisionEngineGoogle.action;
            if (data.decisionEngineGoogle.action.includes('AUMENTAR')) actionEl.style.color = '#059669'; // Verde mais escuro para Google
            else if (data.decisionEngineGoogle.action.includes('PAUSAR') || data.decisionEngineGoogle.action.includes('TETO') || data.decisionEngineGoogle.action.includes('INVESTIGAR')) actionEl.style.color = '#ef4444';
            else actionEl.style.color = '#f59e0b';
        }

        document.getElementById('ai-google-confidence').textContent = `Confiança: ${data.decisionEngineGoogle.confidence || 0}%`;
        document.getElementById('ai-google-target').textContent = formatCurrency(data.decisionEngineGoogle.target);
        document.getElementById('ai-google-scale').textContent = data.decisionEngineGoogle.scaleCapacity || '-';
        
        const trend = data.decisionEngineGoogle.trend || 0;
        const trendEl = document.getElementById('ai-google-trend');
        if (trendEl) {
            trendEl.textContent = `${trend > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(trend))}`;
            trendEl.style.color = trend > 0 ? '#ef4444' : '#10b981';
        }
        
        document.getElementById('ai-google-recommendation').textContent = data.decisionEngineGoogle.recommendation || '-';

        if (data.decisionEngineGoogle.warning) {
            if(warningContainer) warningContainer.style.display = 'block';
            if(warningEl) warningEl.textContent = data.decisionEngineGoogle.warning;
        } else {
            if(warningContainer) warningContainer.style.display = 'none';
        }
        
        // Global Insight 360
        if (data.globalInsight) {
            const formattedHTML = data.globalInsight
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>');
            document.getElementById('ai-funnel-insight').innerHTML = formattedHTML;
        } else {
            document.getElementById('ai-funnel-insight').textContent = "Nenhuma análise disponível para o período.";
        }
    }
    // 4. Preencher cards individuais de campanhas Meta (Detalhada)
    if (data.campaigns?.meta && data.campaigns.meta.length > 0) {
        const targetId = '120251213168140531';
        const c = data.campaigns.meta.find(camp => (camp.campaign_id || camp.id) === targetId);
        if (c) {
            const spend = c.spend || 0;
            const clicks = c.clicks || 0;
            const conversions = c.conversions || 0;
            const cpc = clicks > 0 ? (spend / clicks) : 0;
            const costPerConv = conversions > 0 ? (spend / conversions) : 0;
            
            document.getElementById('cmo-meta-impressions-metric').textContent = (c.impressions || 0).toLocaleString('pt-BR');
            document.getElementById('cmo-meta-clicks-metric').textContent = clicks.toLocaleString('pt-BR');
            document.getElementById('cmo-meta-conversions-metric').textContent = conversions.toLocaleString('pt-BR');
            document.getElementById('cmo-meta-cpc-metric').textContent = 'R$ ' + cpc.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('cmo-meta-cpa-metric').textContent = 'R$ ' + costPerConv.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    }

    // 5. Preencher cards individuais de campanhas Google
    if (data.campaigns?.google && data.campaigns.google.length > 0) {
        const c = data.campaigns.google.find(camp => camp.campaign_name === 'Yelo MVP - Busca SP');
        if (c) {
            const spend = c.spend || 0;
            const clicks = c.clicks || 0;
            const conversions = c.conversions || 0;
            const cpc = clicks > 0 ? (spend / clicks) : 0;
            const costPerConv = conversions > 0 ? (spend / conversions) : 0;
            
            document.getElementById('cmo-google-impressions-metric').textContent = (c.impressions || 0).toLocaleString('pt-BR');
            document.getElementById('cmo-google-clicks-metric').textContent = clicks.toLocaleString('pt-BR');
            document.getElementById('cmo-google-conversions-metric').textContent = conversions.toLocaleString('pt-BR');
            document.getElementById('cmo-google-cpc-metric').textContent = 'R$ ' + cpc.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            document.getElementById('cmo-google-cpa-metric').textContent = 'R$ ' + costPerConv.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
    }



}

function initCMOMonthSelector() {
    const selector = document.getElementById('cmo-month-selector');
    if (!selector) return;
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();
    
    let html = '';
    for (let i = 0; i < 12; i++) {
        const monthName = months[currentMonth];
        const year = currentYear;
        
        const start = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDay = new Date(year, currentMonth + 1, 0).getDate();
        const end = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        
        html += `<option value="${start}|${end}">${monthName} ${year}</option>`;
        
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    }
    selector.innerHTML = html;
    
    const [start, end] = selector.value.split('|');
    document.getElementById('cmo-date-start').value = start;
    document.getElementById('cmo-date-end').value = end;
}

function updateCMOMonth() {
    const selector = document.getElementById('cmo-month-selector');
    if (!selector) return;
    
    const [start, end] = selector.value.split('|');
    document.getElementById('cmo-date-start').value = start;
    document.getElementById('cmo-date-end').value = end;
    
    loadCMOMetrics();
}

// Iniciar imediatamente para arquitetura SPA
initCMOMonthSelector();
loadCMOMetrics();

async function loadTrafficMetrics(dateStart, dateEnd, token) {
    try {
        const response = await fetch(`/api/cmo/traffic?dateStart=${dateStart}&dateEnd=${dateEnd}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) return;

        const data = await response.json();
        if (data.success && data.data) {
            const { ga4, gsc, prevGa4, prevGsc } = data.data;

            const formatTrend = (current, previous, isReversed = false) => {
                if (!previous || previous === 0) return '';
                const diff = ((current - previous) / previous) * 100;
                if (Math.abs(diff) < 0.1) return '';
                let isPositive = diff > 0;
                if (isReversed) isPositive = !isPositive;
                
                const color = isPositive ? '#10b981' : '#ef4444';
                const icon = diff > 0 ? '▲' : '▼';
                return `<span style="font-size: 0.8rem; font-weight: bold; margin-left: 8px; color: ${color};">${icon} ${Math.abs(diff).toFixed(1).replace('.', ',')}%</span>`;
            };

            // Update GA4
            if (ga4) {
                document.getElementById('cmo-ga4-sessions').innerHTML = ga4.sessions.toLocaleString('pt-BR') + (prevGa4 ? formatTrend(ga4.sessions, prevGa4.sessions) : '');
                document.getElementById('cmo-ga4-users').textContent = ga4.users.toLocaleString('pt-BR');
                document.getElementById('cmo-ga4-pageviews').textContent = ga4.pageviews.toLocaleString('pt-BR');
                
                const engagementRate = ga4.sessions > 0 ? (1 - ga4.bounceRate) * 100 : 0;
                const prevEngagementRate = prevGa4 && prevGa4.sessions > 0 ? (1 - prevGa4.bounceRate) * 100 : 0;
                
                document.getElementById('cmo-ga4-engagement').innerHTML = engagementRate.toFixed(1).replace('.', ',') + '%' + (prevGa4 ? formatTrend(engagementRate, prevEngagementRate) : '');
            }

            // Update GSC
            if (gsc) {
                document.getElementById('cmo-gsc-clicks').innerHTML = gsc.clicks.toLocaleString('pt-BR') + (prevGsc ? formatTrend(gsc.clicks, prevGsc.clicks) : '');
                document.getElementById('cmo-gsc-impressions').textContent = gsc.impressions.toLocaleString('pt-BR');
                document.getElementById('cmo-gsc-position').innerHTML = gsc.position.toFixed(1).replace('.', ',') + 'º' + (prevGsc ? formatTrend(gsc.position, prevGsc.position, true) : ''); // true for reversed logic (lower position is better)
                document.getElementById('cmo-gsc-ctr').textContent = (gsc.ctr * 100).toFixed(2).replace('.', ',') + '%';
            }
        }
    } catch (e) {
        console.error('Erro ao carregar Traffic & SEO:', e);
    }
}


// --- TAB & WEEKLY LOGIC ---
function switchCMOTab(tabName) {
    document.querySelectorAll('.cmo-tab').forEach(t => { t.style.borderBottomColor = 'transparent'; t.style.color = 'rgba(255,255,255,0.6)'; });
    
    
    const activeTab = document.getElementById('tab-' + tabName);
    activeTab.style.borderBottomColor = 'white'; activeTab.style.color = 'white';
    

    const monthSelector = document.getElementById('cmo-month-selector');
    const weeklyBanner = document.getElementById('cmo-weekly-banner');

    if (tabName === 'monthly') {
        monthSelector.style.display = 'inline-block';
        weeklyBanner.style.display = 'none';
        updateCMOMonth();
    } else {
        monthSelector.style.display = 'none';
        weeklyBanner.style.display = 'block';
        loadWeeklyMetrics();
    }
}

function loadWeeklyMetrics() {
    const now = new Date();
    const isSaturday = now.getDay() === 6;
    
    // Calcula ultimo domingo ate hoje
    const today = new Date();
    const lastSunday = new Date();
    lastSunday.setDate(today.getDate() - today.getDay());
    
    const dateStart = lastSunday.toISOString().split('T')[0];
    const dateEnd = today.toISOString().split('T')[0];
    
    document.getElementById('cmo-date-start').value = dateStart;
    document.getElementById('cmo-date-end').value = dateEnd;

    const bannerMsg = document.getElementById('cmo-weekly-msg');
    const bannerContainer = document.getElementById('cmo-weekly-banner');
    
    if (isSaturday) {
        bannerContainer.style.background = 'linear-gradient(135deg, #059669 0%, #064e3b 100%)';
        bannerContainer.style.border = '1px solid #10b981';
        bannerMsg.innerHTML = '<strong>🚨 FECHAMENTO DE SÁBADO.</strong> O ciclo de 7 dias (Dom-Sáb) está completo. Avalie a evolução abaixo (comparada à semana anterior) e faça seus ajustes de campanha hoje.';
    } else {
        bannerContainer.style.background = 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)';
        bannerContainer.style.border = '1px solid #fbbf24';
        bannerMsg.innerHTML = '<strong>⏳ MODO DE OBSERVAÇÃO.</strong> O ciclo semanal termina no Sábado. Acompanhe os resultados parciais, mas evite alterar campanhas hoje para não quebrar a aprendizagem da IA.';
    }

    loadCMOMetrics();
}


function renderCMOWeeklyChart(data) {
    const chartContainer = document.getElementById('cmo-weekly-chart-container');
    
    // Mostra o gráfico apenas se estivermos na aba semanal
    const isWeekly = document.getElementById('tab-weekly').classList.contains('active');
    if (!isWeekly) {
        if(chartContainer) chartContainer.style.display = 'none';
        return;
    }
    
    if(chartContainer) chartContainer.style.display = 'block';

    const ctx = document.getElementById('cmo-weekly-chart');
    if (!ctx) return;

    if (cmoWeeklyChartInstance) {
        cmoWeeklyChartInstance.destroy();
    }

    const metaCac = data.ads?.meta?.cac || 0;
    const metaTrend = data.decisionEngineMeta?.trend || 0;
    const prevMetaCac = metaCac - metaTrend;

    const googleCpl = data.ads?.google?.cpl || 0;
    const googleTrend = data.decisionEngineGoogle?.trend || 0;
    const prevGoogleCpl = googleCpl - googleTrend;

    cmoWeeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['CAC (Meta B2B)', 'CPL (Google B2C)'],
            datasets: [
                {
                    label: 'Semana Anterior',
                    data: [prevMetaCac, prevGoogleCpl],
                    backgroundColor: 'rgba(100, 116, 139, 0.5)',
                    borderColor: 'rgba(100, 116, 139, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Semana Atual',
                    data: [metaCac, googleCpl],
                    backgroundColor: function(context) {
                        const index = context.dataIndex;
                        const current = context.dataset.data[index];
                        const previous = context.chart.data.datasets[0].data[index];
                        // Menor custo é melhor (Verde)
                        return current > previous ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
                    },
                    borderColor: function(context) {
                        const index = context.dataIndex;
                        const current = context.dataset.data[index];
                        const previous = context.chart.data.datasets[0].data[index];
                        return current > previous ? 'rgba(239, 68, 68, 1)' : 'rgba(16, 185, 129, 1)';
                    },
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        }
    });
}
