if (typeof window.cmoWeeklyChartInstance === 'undefined') {
    window.cmoWeeklyChartInstance = null;
}

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

function setKpiValueAndTrend(id, currentValue, historicalValue, inverseGood = false, formatType = 'number') {
    const el = document.getElementById(id);
    if (!el) return;

    let formattedCurrent = currentValue;
    if (typeof currentValue === 'number') {
        if (formatType === 'currency') formattedCurrent = `R$ ${(currentValue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        else if (formatType === 'percent') formattedCurrent = (currentValue * 100).toFixed(1) + '%';
        else if (formatType === 'decimal') formattedCurrent = currentValue.toFixed(1);
        else if (formatType === 'days') formattedCurrent = currentValue.toFixed(1) + ' d';
        else formattedCurrent = currentValue.toLocaleString('pt-BR');
    }
    el.textContent = formattedCurrent;

    let trendEl = document.getElementById(`trend-${id}`);
    if (!trendEl) {
        if (el.parentElement.style.display !== 'flex') {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.alignItems = 'baseline';
            wrapper.style.gap = '8px';
            el.parentNode.insertBefore(wrapper, el);
            wrapper.appendChild(el);
        }
        trendEl = document.createElement('span');
        trendEl.id = `trend-${id}`;
        trendEl.style.fontSize = '0.85rem';
        trendEl.style.fontWeight = 'bold';
        trendEl.style.padding = '2px 6px';
        trendEl.style.borderRadius = '4px';
        el.parentElement.appendChild(trendEl);
    }

    let comparisonType = '';
    let pct = 0;
    
    if (historicalValue === null || historicalValue === undefined || historicalValue === 'N/A' || isNaN(historicalValue) || isNaN(currentValue)) {
        comparisonType = 'INCOMPLETE';
    } else if (historicalValue === 0 && currentValue > 0) {
        comparisonType = 'NEW_FROM_ZERO';
    } else if (historicalValue === 0 && currentValue === 0) {
        comparisonType = 'NO_CHANGE';
    } else {
        comparisonType = 'CALCULATE';
        pct = ((currentValue - historicalValue) / historicalValue) * 100;
        if (pct === 0) comparisonType = 'NO_CHANGE';
    }

    let color = '#64748b';
    let bgColor = '#f1f5f9';
    let text = '';

    if (comparisonType === 'INCOMPLETE') {
        text = '—';
    } else if (comparisonType === 'NEW_FROM_ZERO') {
        text = 'Novo';
        color = inverseGood ? '#ef4444' : '#10b981';
        bgColor = color + '1a';
    } else if (comparisonType === 'NO_CHANGE') {
        text = '0%';
    } else {
        let arrow = pct > 0 ? '↑' : '↓';
        color = (pct > 0) ? (inverseGood ? '#ef4444' : '#10b981') : (inverseGood ? '#10b981' : '#ef4444');
        bgColor = color + '1a';
        text = `${arrow} ${Math.abs(pct).toFixed(1)}%`;
    }

    trendEl.textContent = text;
    trendEl.style.color = color;
    trendEl.style.backgroundColor = bgColor;
}

function renderCMOMetrics(data) {
    const formatCurrency = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // 1. Atualizar KPIs (B2B e B2C)
    
    // Popula Cards da Inteligência Algorítmica (Funil B2B)
    if (data.platform) {
        // B2B (Meta) KPIs
        setKpiValueAndTrend('cmo-meta-spend', data.ads?.meta?.spend || 0, data.prevAds?.meta?.spend || 0, true, 'currency');
        setKpiValueAndTrend('cmo-meta-trials', data.platform.b2b?.trials || 0, data.prevPlatform?.b2b?.trials || 0, false, 'number');
        setKpiValueAndTrend('cmo-meta-pagantes', data.platform.b2b?.active || 0, data.prevPlatform?.b2b?.active || 0, false, 'number');
        setKpiValueAndTrend('cmo-meta-cac', data.ads?.meta?.cac || 0, data.prevAds?.meta?.cac || 0, true, 'currency');

        // B2C (Google) KPIs
        setKpiValueAndTrend('cmo-google-spend', data.ads?.google?.spend || 0, data.prevAds?.google?.spend || 0, true, 'currency');
        setKpiValueAndTrend('cmo-google-clicks', data.platform.b2c?.wpp_clicks || 0, data.prevPlatform?.b2c?.wpp_clicks || 0, false, 'number');
        setKpiValueAndTrend('cmo-google-deals', data.platform.b2c?.total_deals || 0, data.prevPlatform?.b2c?.total_deals || 0, false, 'number');
        setKpiValueAndTrend('cmo-google-cpl', data.ads?.google?.cpl || 0, data.prevAds?.google?.cpl || 0, true, 'currency');

        // Eficiência Comercial B2C KPIs
        if (data.efficiency) {
            const parseFloatOrNA = (val) => val === 'N/A' || !val ? 'N/A' : parseFloat(val);
            
            const currGlobal = parseFloatOrNA(data.efficiency.globalEffort);
            const prevGlobal = parseFloatOrNA(data.prevEfficiency?.globalEffort);
            setKpiValueAndTrend('cmo-global-effort', currGlobal, prevGlobal, true, 'decimal');

            const topTicketStr = data.efficiency.topTicket === 'N/A' || !data.efficiency.topTicket ? 'N/A' : `R$ ${data.efficiency.topTicket}`;
            const prevTopTicketStr = data.prevEfficiency?.topTicket === 'N/A' || !data.prevEfficiency?.topTicket ? 'N/A' : `R$ ${data.prevEfficiency?.topTicket}`;
            // For top ticket, it's currency and higher is better.
            const currTopTicket = data.efficiency.topTicket === 'N/A' || !data.efficiency.topTicket ? 'N/A' : parseFloat(data.efficiency.topTicket);
            const prevTopTicket = data.prevEfficiency?.topTicket === 'N/A' || !data.prevEfficiency?.topTicket ? 'N/A' : parseFloat(data.prevEfficiency.topTicket);
            setKpiValueAndTrend('cmo-top-ticket', currTopTicket, prevTopTicket, false, 'currency');

            if (data.efficiency.ttfcData) {
                const currTtfc = parseFloatOrNA(data.efficiency.ttfcData.median);
                const prevTtfc = parseFloatOrNA(data.prevEfficiency?.ttfcData?.median);
                setKpiValueAndTrend('cmo-ttfc-median', currTtfc, prevTtfc, true, 'days');
                document.getElementById('cmo-ttfc-sub').textContent = `Média: ${data.efficiency.ttfcData.mean} dias · amostra: ${data.efficiency.ttfcData.sample} profissionais`;
            }
            if (data.efficiency.ttvData) {
                const currTtv = parseFloatOrNA(data.efficiency.ttvData.median);
                const prevTtv = parseFloatOrNA(data.prevEfficiency?.ttvData?.median);
                setKpiValueAndTrend('cmo-ttv-median', currTtv, prevTtv, true, 'days');
                document.getElementById('cmo-ttv-sub').textContent = `Média: ${data.efficiency.ttvData.mean} dias · amostra: ${data.efficiency.ttvData.sample} profissionais (PROXY)`;
            }
            
            // Channel Efficiency (Ads / Org)
            const elCh = document.getElementById('cmo-channel-efficiency');
            if (elCh) {
                const currAds = parseFloatOrNA(data.efficiency.adsEffort);
                const prevAds = parseFloatOrNA(data.prevEfficiency?.adsEffort);
                const currOrg = parseFloatOrNA(data.efficiency.orgEffort);
                const prevOrg = parseFloatOrNA(data.prevEfficiency?.orgEffort);
                
                const calcPct = (c, p) => {
                    if (typeof c === 'number' && typeof p === 'number') {
                        if (p > 0) return ((c - p) / p) * 100;
                        if (c > 0) return 100;
                    }
                    return null;
                };
                
                const getArrow = (pct) => {
                    if (pct === null) return '';
                    if (pct > 0) return ` <span style="color:#ef4444;font-size:0.85rem">↑${Math.abs(pct).toFixed(1)}%</span>`;
                    if (pct < 0) return ` <span style="color:#10b981;font-size:0.85rem">↓${Math.abs(pct).toFixed(1)}%</span>`;
                    return ` <span style="color:#64748b;font-size:0.85rem">−0%</span>`;
                };

                const strAds = currAds !== 'N/A' ? currAds.toFixed(1) : 'N/A';
                const strOrg = currOrg !== 'N/A' ? currOrg.toFixed(1) : 'N/A';
                elCh.innerHTML = `Ads: ${strAds}${getArrow(calcPct(currAds, prevAds))} | Org: ${strOrg}${getArrow(calcPct(currOrg, prevOrg))}`;
            }
        }

        // Cards de Transparência (seção inferior)
        const setDbgHist = (id, rawHist, rawMonth, formatType, inverseGood = false) => { 
            const el = document.getElementById(id); 
            if (!el) return;

            let histVal = rawHist;
            let monthVal = rawMonth;

            if (formatType === 'currency') {
                histVal = formatCurrency(rawHist);
                monthVal = formatCurrency(rawMonth);
            } else if (formatType === 'percent') {
                histVal = `${(rawHist * 100).toFixed(1)}%`;
                monthVal = `${(rawMonth * 100).toFixed(1)}%`;
            } else if (formatType === 'number') {
                histVal = (rawHist || 0).toLocaleString('pt-BR');
                monthVal = (rawMonth || 0).toLocaleString('pt-BR');
            } else if (formatType === 'months') {
                histVal = (rawHist || 0).toFixed(1).replace('.', ',') + ' Meses';
                monthVal = (rawMonth || 0).toFixed(1).replace('.', ',') + ' Meses';
            }

            let pct = 0;
            if (rawHist > 0) {
                pct = ((rawMonth - rawHist) / rawHist) * 100;
            } else if (rawMonth > 0) {
                pct = 100;
            }

            let color = '#64748b';
            let arrow = '';
            
            if (pct > 0) {
                arrow = '↑';
                color = inverseGood ? '#ef4444' : '#10b981';
            } else if (pct < 0) {
                arrow = '↓';
                color = inverseGood ? '#10b981' : '#ef4444';
            } else {
                arrow = '−';
            }

            let trendHtml = '';
            if (pct !== 0) {
                trendHtml = `<span style="font-size: 0.85rem; font-weight: bold; color: ${color}; background-color: ${color}1a; padding: 2px 6px; border-radius: 4px; display: inline-block; align-self: flex-start; margin-left: auto;">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
            } else {
                trendHtml = `<span style="font-size: 0.85rem; font-weight: bold; color: #64748b; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; display: inline-block; align-self: flex-start; margin-left: auto;">${arrow} 0%</span>`;
            }

            el.style.fontSize = '1.05rem';
            el.style.display = 'flex';
            el.style.flexDirection = 'column';
            el.style.gap = '2px';
            el.style.marginTop = '4px';
            el.innerHTML = `
                <span style="color: #64748b; font-size: 0.75rem;">Período Anterior: <strong style="color: #1e293b; font-size: 1.05rem;">${histVal}</strong></span>
                <span style="color: #64748b; font-size: 0.75rem; display: flex; align-items: center;">
                    <span>No Período: <strong style="color: #1e293b; font-size: 1.05rem;">${monthVal}</strong></span>
                    ${trendHtml}
                </span>
            `;
        };

        setDbgHist('dbg-meta-spend',    data.prevAds?.meta?.spend || 0, data.ads?.meta?.spend || 0, 'currency', true);
        setDbgHist('dbg-meta-trials',   data.prevPlatform?.b2b?.trials || 0, data.platform.b2b?.trials || 0, 'number', false);
        setDbgHist('dbg-meta-pagantes', data.prevPlatform?.b2b?.active || 0, data.platform.b2b?.active || 0, 'number', false);
        setDbgHist('dbg-meta-cac',      data.prevAds?.meta?.cac || 0, data.ads?.meta?.cac || 0, 'currency', true);
        setDbgHist('dbg-meta-payback',  data.prevDecisionEngineMeta?.paybackMonths || 0, data.decisionEngineMeta?.paybackMonths || 0, 'months', true);
        
        setDbgHist('dbg-meta-churn',    data.prevPlatform?.b2b?.meta_churn_rate || 0, data.platform.b2b?.meta_churn_rate || 0, 'percent', true);
        setDbgHist('dbg-global-churn',  data.prevPlatform?.b2b?.global_churn_rate || 0, data.platform.b2b?.global_churn_rate || 0, 'percent', true);
        
        setDbgHist('dbg-google-spend',  data.prevAds?.google?.spend || 0, data.ads?.google?.spend || 0, 'currency', true);
        setDbgHist('dbg-google-clicks', data.prevPlatform?.b2c?.wpp_clicks || 0, data.platform.b2c?.wpp_clicks || 0, 'number', false);
        setDbgHist('dbg-google-deals',  data.prevPlatform?.b2c?.total_deals || 0, data.platform.b2c?.total_deals || 0, 'number', false);
        setDbgHist('dbg-google-cpl',    data.prevAds?.google?.cpl || 0, data.ads?.google?.cpl || 0, 'currency', true);
    }


    // 4. Preencher cards individuais de campanhas Meta (Detalhada)
    if (data.campaigns?.meta && data.campaigns.meta.length > 0) {
        const targetId = '120251213168140531';
        const c = data.campaigns.meta.find(camp => (camp.campaign_id || camp.id) === targetId);
        const prevC = data.prevCampaigns?.meta?.find(camp => (camp.campaign_id || camp.id) === targetId) || {};
        if (c) {
            const spend = c.spend || 0;
            const clicks = c.clicks || 0;
            const conversions = c.conversions || 0;
            const cpc = clicks > 0 ? (spend / clicks) : 0;
            const costPerConv = conversions > 0 ? (spend / conversions) : 0;

            const prevSpend = prevC.spend || 0;
            const prevClicks = prevC.clicks || 0;
            const prevConversions = prevC.conversions || 0;
            const prevCpc = prevClicks > 0 ? (prevSpend / prevClicks) : 0;
            const prevCostPerConv = prevConversions > 0 ? (prevSpend / prevConversions) : 0;
            
            setKpiValueAndTrend('cmo-meta-impressions-metric', c.impressions || 0, prevC.impressions || 0, false, 'number');
            setKpiValueAndTrend('cmo-meta-clicks-metric', clicks, prevClicks, false, 'number');
            setKpiValueAndTrend('cmo-meta-conversions-metric', conversions, prevConversions, false, 'number');
            setKpiValueAndTrend('cmo-meta-cpc-metric', cpc, prevCpc, true, 'currency');
            setKpiValueAndTrend('cmo-meta-cpa-metric', costPerConv, prevCostPerConv, true, 'currency');
        }
    }

    // 5. Preencher cards individuais de campanhas Google
    if (data.campaigns?.google && data.campaigns.google.length > 0) {
        const c = data.campaigns.google.find(camp => camp.campaign_name === 'Yelo MVP - Busca SP');
        const prevC = data.prevCampaigns?.google?.find(camp => camp.campaign_name === 'Yelo MVP - Busca SP') || {};
        if (c) {
            const spend = c.spend || 0;
            const clicks = c.clicks || 0;
            const conversions = c.conversions || 0;
            const cpc = clicks > 0 ? (spend / clicks) : 0;
            const costPerConv = conversions > 0 ? (spend / conversions) : 0;

            const prevSpend = prevC.spend || 0;
            const prevClicks = prevC.clicks || 0;
            const prevConversions = prevC.conversions || 0;
            const prevCpc = prevClicks > 0 ? (prevSpend / prevClicks) : 0;
            const prevCostPerConv = prevConversions > 0 ? (prevSpend / prevConversions) : 0;
            
            setKpiValueAndTrend('cmo-google-impressions-metric', c.impressions || 0, prevC.impressions || 0, false, 'number');
            setKpiValueAndTrend('cmo-google-clicks-metric', clicks, prevClicks, false, 'number');
            setKpiValueAndTrend('cmo-google-conversions-metric', conversions, prevConversions, false, 'number');
            setKpiValueAndTrend('cmo-google-cpc-metric', cpc, prevCpc, true, 'currency');
            setKpiValueAndTrend('cmo-google-cpa-metric', costPerConv, prevCostPerConv, true, 'currency');
        }
    }

    if (typeof initGrowthSimulator === 'function') {
        initGrowthSimulator(data);
    }
}

function initGrowthSimulator(data) {
    const btnSave = document.getElementById('btn-save-simulator');
    if (!btnSave) return;

    const inputReinvestRate = document.getElementById('sim-reinvest-rate');
    const inputExtraCash = document.getElementById('sim-extra-cash');
    const inputCuriosityGoal = document.getElementById('sim-curiosity-goal');

    const newBtnSave = btnSave.cloneNode(true);
    btnSave.parentNode.replaceChild(newBtnSave, btnSave);

    const modal = document.getElementById('sim-new-target-modal');
    const btnCancelModal = document.getElementById('btn-cancel-new-target');
    const btnConfirmModal = document.getElementById('btn-confirm-new-target');

    let simTrackingStartDate = null;
    let simTrackingStartSubs = null;

    const blockSimulatorInputs = () => {
        if (inputReinvestRate) inputReinvestRate.disabled = true;
        if (inputExtraCash) inputExtraCash.disabled = true;
        if (inputCuriosityGoal) inputCuriosityGoal.disabled = true;
        newBtnSave.textContent = 'Alterar Parâmetros';
        newBtnSave.style.background = '#f59e0b';
    };

    const unblockSimulatorInputs = () => {
        if (inputReinvestRate) inputReinvestRate.disabled = false;
        if (inputExtraCash) inputExtraCash.disabled = false;
        if (inputCuriosityGoal) inputCuriosityGoal.disabled = false;
        newBtnSave.textContent = 'Salvar Parâmetros';
        newBtnSave.style.background = '#10b981';
    };

    if (btnCancelModal) {
        btnCancelModal.addEventListener('click', () => {
            modal.style.opacity = '0';
            setTimeout(() => modal.style.display = 'none', 200);
        });
    }

    if (btnConfirmModal) {
        btnConfirmModal.addEventListener('click', () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                modal.style.display = 'none';
                unblockSimulatorInputs();
            }, 200);
        });
    }

    // Carrega as configurações salvas do banco de dados
    const token = localStorage.getItem('adminToken');
    const loadSimSettings = async () => {
        try {
            const resp = await fetch('/api/cmo/simulator-settings', { headers: { 'Authorization': `Bearer ${token}` } });
            if (resp.ok) {
                const saved = await resp.json();
                if (saved.success) {
                    if (inputReinvestRate && saved.reinvestRate !== undefined) {
                        inputReinvestRate.value = saved.reinvestRate;
                        inputReinvestRate.setAttribute('value', saved.reinvestRate);
                    }
                    if (inputExtraCash && saved.extraCash !== undefined) {
                        let v = (parseFloat(saved.extraCash) || 0).toFixed(2);
                        v = v.replace(".", ",");
                        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
                        inputExtraCash.value = v;
                        inputExtraCash.setAttribute('value', v);
                    }
                    if (inputCuriosityGoal && saved.curiosityGoal !== undefined && saved.curiosityGoal !== null) {
                        inputCuriosityGoal.value = saved.curiosityGoal;
                        inputCuriosityGoal.setAttribute('value', saved.curiosityGoal);
                    }
                    simTrackingStartDate = saved.startDate;
                    simTrackingStartSubs = saved.startSubs;
                    
                    // Só bloqueia se já tivermos um setup rodando
                    if (simTrackingStartDate) {
                        blockSimulatorInputs();
                    }
                }
            }
        } catch (e) { /* silencioso */ }

        runSimulation(data);
    };
    // Listeners
    if (inputReinvestRate) inputReinvestRate.addEventListener('input', () => runSimulation(data));
    if (inputCuriosityGoal) inputCuriosityGoal.addEventListener('input', () => runSimulation(data));
    if (inputExtraCash) {
        inputExtraCash.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, "");
            v = (v / 100).toFixed(2) + "";
            v = v.replace(".", ",");
            v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
            e.target.value = v;
            runSimulation(data);
        });
    }

    newBtnSave.addEventListener('click', () => {
        if (newBtnSave.textContent === 'Alterar Parâmetros') {
            if (modal) {
                modal.style.display = 'flex';
                void modal.offsetWidth; // trigger reflow
                modal.style.opacity = '1';
            } else {
                unblockSimulatorInputs();
            }
            return;
        }

        newBtnSave.textContent = 'Salvando...';
        newBtnSave.style.opacity = '0.7';
        
        const reinvestRate = parseFloat(inputReinvestRate?.value) || 100;
        const extraCashStr = inputExtraCash?.value || '0';
        const extraCash = parseFloat(extraCashStr.replace(/\./g, '').replace(',', '.')) || 0;
        const curiosityGoal = parseInt(inputCuriosityGoal?.value) || null;
        
        // Sempre que salva os parâmetros, reseta o tracker para a base de hoje
        const resetTracking = true;
        const startSubs = data.platform.b2b.total_active || 0;

        fetch('/api/cmo/simulator-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                reinvestRate, 
                extraCash,
                curiosityGoal,
                resetTracking,
                startSubs
            })
        }).then(() => {
            newBtnSave.textContent = 'Salvo com Sucesso!';
            newBtnSave.style.background = '#059669';
            setTimeout(() => {
                blockSimulatorInputs();
                newBtnSave.style.opacity = '1';
            }, 2000);
        }).catch(() => {
            newBtnSave.textContent = 'Erro ao Salvar';
            newBtnSave.style.background = '#ef4444';
            setTimeout(() => {
                newBtnSave.textContent = 'Salvar Meta';
                newBtnSave.style.background = '#10b981';
                newBtnSave.style.opacity = '1';
            }, 2000);
        });
    });

    const runSimulation = (data) => {
        const inputReinvestRate = document.getElementById('sim-reinvest-rate');
        const inputExtraCash = document.getElementById('sim-extra-cash');
        const inputCuriosityGoal = document.getElementById('sim-curiosity-goal');
        
        let reinvestRate = parseFloat(inputReinvestRate?.value) || 50;
        let extraCashStr = inputExtraCash?.value || '0';
        let extraCash = parseFloat(extraCashStr.replace(/\./g, '').replace(',', '.')) || 0;
        let curiosityGoal = parseInt(inputCuriosityGoal?.value) || null;
        
        // 1. BASE INICIAL VEM DA PRODUÇÃO ATUAL (Motor Final)
        // Ignora simTrackingStartSubs (25) e usa activePaidAccessBase (29)
        const activePaidAccessBase = data.platform.b2b.total_active || 0;
        const renewableSubscriberBase = data.simulator?.renewableSubscriberBase || activePaidAccessBase;
        const knownScheduledChurn = data.simulator?.knownScheduledChurn || 0;
        
        function getSimValue(obj) {
            if (!obj) return null;
            if (typeof obj !== 'object') return null;
            if (obj.type === 'MISSING_INPUT') return null;
            const v = obj.value;
            if (v === undefined || Number.isNaN(v) || v === null || !isFinite(v)) return null;
            return v;
        }

        const trialConversionRate = getSimValue(data.simulator?.trialConv);
        const cacMeta = getSimValue(data.simulator?.cac);
        const cplGoogle = getSimValue(data.simulator?.cpl);
        const monthlyChurn = getSimValue(data.simulator?.churn);
        
        const arpu = data.platform?.b2b?.arpu || 99;
        const contactsPerPaidPsiMonth = data.simulator?.contactsPerPaidPsiMonth?.value;
        const contactsThresholdSource = data.simulator?.contactsPerPaidPsiMonth?.type || 'ASSUMED';
        
        let isSimulationPossible = cacMeta !== null && trialConversionRate !== null && monthlyChurn !== null && cplGoogle !== null;
        
        const histMetaMonthlySpendAvg = data.historical?.meta?.monthly_spend_avg || 3000;
        
        const verifiedOrganicContacts = 0; 
        const newOrganicActive = 0; 

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Snowball Projection (Motor Final validado)
        const targetMonths = 12;
        const labels = [];
        const dataRevenue = [];
        const dataCosts = [];
        const dataCashflow = [];
        const dataExpectedBase = [];
        
        let currentBase = renewableSubscriberBase;
        let rolloverCash = 0;
        
        let mrrAt12 = 0;
        let baseAt12 = 0;
        let metaBudgetAt12 = 0;
        let googleBudgetAt12 = 0;
        
        // M1 values for Action Plan
        let actionMetaSpend = 0;
        let actionGoogleMaintenance = 0;
        let actionTrialGoogleSpend = 0;
        let actionUnspentCash = 0;
        let actionCACPenalized = 0;
        
        // PROJECTION PREMISES:
        let demandEligibilityRate = data.simulator?.demandEligibilityRate;
        if (demandEligibilityRate === 'MISSING_INPUT' || demandEligibilityRate === undefined || demandEligibilityRate === null) {
            isSimulationPossible = false;
            demandEligibilityRate = 0;
        }
        
        if (!isSimulationPossible) {
            const warningEl = document.getElementById('sim-res-warning');
            if (warningEl) {
                warningEl.style.display = 'block';
                warningEl.style.backgroundColor = '#fef2f2';
                warningEl.style.color = '#991b1b';
                warningEl.innerHTML = `⚠️ <b>Atenção:</b> O simulador requer dados reais de CAC, Trial e Churn para projetar. Os dados históricos atuais não são qualificados matematicamente (PROXY/UNKNOWN). O Motor está pausado até termos dados observados da coorte.`;
            }
            
            // Zerar os resultados do card
            if (document.getElementById('sim-res-mrr-12m')) {
                document.getElementById('sim-res-mrr-12m').textContent = formatBRL(0);
                document.getElementById('sim-res-subs-12m').textContent = '0';
                document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(0);
                document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(0);
            }
            return;
        }

        const simResult = runGrowthSimulationMath({
            targetMonths, currentBase, arpu, demandEligibilityRate, contactsPerPaidPsiMonth, verifiedOrganicContacts, cplGoogle,
            reinvestRate, extraCash, rolloverCash, histMetaMonthlySpendAvg, cacMeta, trialConversionRate, monthlyChurn, newOrganicActive,
            renewableSubscriberBase, knownScheduledChurn
        });

        labels.push(...simResult.labels);
        dataExpectedBase.push(...simResult.dataExpectedBase);
        dataRevenue.push(...simResult.dataRevenue);
        dataCosts.push(...simResult.dataCosts);
        dataCashflow.push(...simResult.dataCashflow);
        
        mrrAt12 = simResult.mrrAt12;
        baseAt12 = simResult.baseAt12;
        metaBudgetAt12 = simResult.metaBudgetAt12;
        googleBudgetAt12 = simResult.googleBudgetAt12;
        actionMetaSpend = simResult.actionMetaSpend;
        actionGoogleMaintenance = simResult.actionGoogleMaintenance;
        actionTrialGoogleSpend = simResult.actionTrialGoogleSpend;
        actionUnspentCash = simResult.actionUnspentCash;
        actionCACPenalized = simResult.actionCACPenalized;

        // Update Cards com textos contextuais        // Update Cards com textos contextuais
        const currentMrr = currentBase * arpu;
        const mrrMultiple = (mrrAt12 / (currentMrr || 1)).toFixed(1);
        const mrrGainMonthly = mrrAt12 - currentMrr;
        document.getElementById('sim-res-mrr-12m').textContent = formatBRL(mrrAt12);
        document.getElementById('sim-res-mrr-feedback').textContent =
            `${mrrMultiple}x maior que hoje (${formatBRL(currentMrr)}/mês)`;
        
        const newSubs = Math.floor(baseAt12) - currentBase;
        const avgPatientsPerPsi = contactsPerPaidPsiMonth || 2;
        const totalPatientsServed = Math.floor(baseAt12) * avgPatientsPerPsi;
        const subsEl = document.getElementById('sim-res-subs-12m');
        subsEl.textContent = Math.floor(baseAt12);
        // Subtitle do card-2 (parágrafo filho)
        const card2Sub = document.querySelector('#sim-card-2 p:last-child');
        if (card2Sub) card2Sub.textContent =
            `+${newSubs} assinantes líquidos na base em 12 meses. Juntos receberão ~${totalPatientsServed.toLocaleString('pt-BR')} contatos de pacientes/mês.`;
        
        const metaDailyM1 = actionMetaSpend / 30;
        document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(actionMetaSpend);
        const card3Sub = document.querySelector('#sim-card-3 p:last-child');
        if (card3Sub) card3Sub.textContent =
            `≈ ${formatBRL(metaDailyM1)}/dia recomendados para Mês 1.`;
        
        const googlePctOfRevenue = mrrAt12 > 0 ? ((googleBudgetAt12 / mrrAt12) * 100).toFixed(0) : 0;
        const googleDailyAt12 = googleBudgetAt12 / 30;
        document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(googleBudgetAt12);
        const card4Sub = document.querySelector('#sim-card-4 p:last-child');
        if (card4Sub) card4Sub.textContent =
            `Custo mensal projetado p/ Mês 12 (≈ ${formatBRL(googleDailyAt12)}/dia).`;
        
        const warningEl = document.getElementById('sim-res-warning');
        warningEl.style.display = 'block';

        if (metaBudgetAt12 <= 0) {
            warningEl.style.backgroundColor = '#fef2f2';
            warningEl.style.color = '#991b1b';
            warningEl.innerHTML = `⚠️ <b>Atenção:</b> A sua taxa de reinvestimento (${reinvestRate}%) não é suficiente nem para pagar a Retenção no Google Ads. O Motor de Crescimento travou. Aumente a taxa ou o Aporte Adicional!`;
        } else {
            warningEl.style.backgroundColor = '#f0fdfa';
            warningEl.style.color = '#0f766e';
            if (extraCash > 0) {
                const totalOwnerContribution = extraCash * 12;
                warningEl.innerHTML = `✅ <b>Motor Girando:</b> Em 12 meses, a projeção leva a base de ${currentBase} para ${Math.floor(baseAt12)} assinantes, considerando reinvestimento de ${reinvestRate}% da Sobra Operacional e aporte adicional de ${formatBRL(extraCash)} por mês. Isso representa ${formatBRL(totalOwnerContribution)} de aporte externo ao longo dos 12 meses.`;
            } else {
                warningEl.innerHTML = `✅ <b>Motor Girando:</b> Em 12 meses, você poderá sair de ${currentBase} para ${Math.floor(baseAt12)} assinantes reinvestindo ${reinvestRate}% da receita gerada pela operação.`;
            }
        }

        // Action Plan
        const actionPlanContainer = document.getElementById('sim-action-plan');
        const actionList = document.getElementById('sim-action-list');
        if (actionPlanContainer && actionList) {
            actionPlanContainer.style.display = 'block';
            
            // Check if title needs a button
            const h5 = actionPlanContainer.querySelector('h5');
            if (h5 && !document.getElementById('btn-generate-ai')) {
                h5.innerHTML += ` <button id="btn-generate-ai" style="margin-left:auto; background:#7e22ce; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; font-weight:bold;">Gerar Novo Diagnóstico com IA ✨</button>`;
            }
            
            const btnAi = document.getElementById('btn-generate-ai');
            const token = localStorage.getItem('token');

            // Load last plan on render
            if (actionList.innerHTML.trim() === '') {
                actionList.innerHTML = `<li>⏳ Carregando último diagnóstico...</li>`;
                fetch('/api/cmo/action-plan', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.html) {
                        actionList.innerHTML = data.html;
                    } else {
                        actionList.innerHTML = `<li>Nenhum diagnóstico salvo. Clique no botão acima para gerar.</li>`;
                    }
                }).catch(() => actionList.innerHTML = `<li>Erro ao carregar o plano.</li>`);
            }

            if (btnAi) {
                btnAi.onclick = () => {
                    btnAi.disabled = true;
                    btnAi.innerText = 'Processando...';
                    actionList.innerHTML = `<li>⏳ <strong>A IA está analisando os dados do motor...</strong> Isso pode levar alguns segundos.</li>`;
                    
                    const currentMetaDailyBudget = data.ads?.meta?.configuredDailyBudget || 0;
                    const currentDailyGoogle = data.ads?.google?.configuredDailyBudget || 0;
                    const unspentCash = actionUnspentCash;
                    const targetMetaDaily = actionMetaSpend / 30;
                    const googleBudgetM1 = actionGoogleMaintenance + actionTrialGoogleSpend;
                    const targetGoogleDaily = googleBudgetM1 / 30;
                    const baseDaily = actionGoogleMaintenance / 30;
                    const trialsDaily = actionTrialGoogleSpend / 30;
                    const availableForAcquisition1 = actionMetaSpend + actionTrialGoogleSpend + actionUnspentCash;

                    // MARGEM DISTRIBUÍVEL SEGURA
                    const pnl = data.platform?.pnl;
                    let safeMarginStatus = 'OK';
                    let safeDistributableMargin = null;
                    let safeDistributableAmount = null;
                    let target30PercentStatus = 'MISSING_INPUT';
                    let gapTo30Percent = null;
                    
                    const taxStatus = pnl?.managerial?.RevenueTaxes !== undefined ? 'OK' : 'MISSING_INPUT';
                    const opexStatus = pnl?.PROFIT_CERTIFICATION_BLOCKED ? 'MISSING_INPUT' : 'OK';
                    const cashBalanceStatus = pnl?.cashflow?.currentCashBalance === 'MISSING_INPUT' ? 'MISSING_INPUT' : 'OK';
                    
                    // Cash reserve is currently a missing concept in the input, thus it is missing.
                    const requiredCashReserveContribution = 'MISSING_INPUT';
                    
                    if (!pnl || taxStatus === 'MISSING_INPUT' || opexStatus === 'MISSING_INPUT' || cashBalanceStatus === 'MISSING_INPUT' || requiredCashReserveContribution === 'MISSING_INPUT') {
                        safeMarginStatus = 'MISSING_INPUT';
                    } else {
                        const netRevenue = pnl.managerial?.NetRevenue;
                        const fixedOPEX = pnl.managerial?.FixedOPEX;
                        const otherVarCosts = pnl.managerial?.OtherVariableOperatingCosts;
                        
                        if (netRevenue === undefined || netRevenue === null || fixedOPEX === undefined || fixedOPEX === null || otherVarCosts === undefined || otherVarCosts === null) {
                            safeMarginStatus = 'MISSING_INPUT';
                        } else {
                            // Google Maintenance from M1
                            const googleMaint = actionGoogleMaintenance;
                            
                            // Minimum growth budget to sustain churn (MODELLED)
                            const minimumGrowthBudget = simResult.requiredReplacementPaidM1 * simResult.blendedAcquisitionCostM1;
                            
                            const safeDistributableProfit = Math.max(0, netRevenue - fixedOPEX - otherVarCosts - googleMaint - minimumGrowthBudget - requiredCashReserveContribution);
                            
                            if (netRevenue > 0) {
                                safeDistributableMargin = safeDistributableProfit / netRevenue;
                                safeDistributableAmount = safeDistributableProfit;
                                
                                const maxCostEnvelopeFor30 = netRevenue * 0.70;
                                const currentTotalSustainingCosts = fixedOPEX + otherVarCosts + googleMaint + minimumGrowthBudget + requiredCashReserveContribution;
                                
                                if (currentTotalSustainingCosts <= maxCostEnvelopeFor30) {
                                    target30PercentStatus = 'FEASIBLE';
                                } else {
                                    target30PercentStatus = 'NOT_YET_FEASIBLE';
                                    gapTo30Percent = currentTotalSustainingCosts - maxCostEnvelopeFor30;
                                }
                            } else {
                                safeMarginStatus = 'MISSING_INPUT';
                            }
                        }
                    }

                    fetch('/api/cmo/generate-action-plan', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({
                            mrrAtual: formatBRL(currentBase * arpu),
                            mrr12M: formatBRL(mrrAt12),
                            reinvestRate: reinvestRate,
                            extraCash: extraCash,
                            cacAtual: formatBRL(cacMeta),
                            cacPenalizado: formatBRL(actionCACPenalized),
                            unspentCash: formatBRL(unspentCash),
                            targetMetaDaily: formatBRL(targetMetaDaily),
                            currentMetaDailyBudget: formatBRL(currentMetaDailyBudget),
                            availableForAcquisition1: formatBRL(availableForAcquisition1),
                            targetGoogleDaily: formatBRL(targetGoogleDaily),
                            currentDailyGoogle: formatBRL(currentDailyGoogle),
                            baseDaily: formatBRL(baseDaily),
                            trialsDaily: formatBRL(trialsDaily),
                            safeMarginStatus: safeMarginStatus,
                            safeDistributableMargin: safeDistributableMargin !== null ? (safeDistributableMargin * 100).toFixed(1) : null,
                            safeDistributableAmount: safeDistributableAmount !== null ? formatBRL(safeDistributableAmount) : null,
                            target30PercentStatus: target30PercentStatus,
                            gapTo30Percent: gapTo30Percent !== null ? formatBRL(gapTo30Percent) : null
                        })
                    })
                    .then(res => res.json())
                    .then(aiData => {
                        if (aiData.success && aiData.html) {
                            actionList.innerHTML = aiData.html;
                        } else {
                            actionList.innerHTML = `<li>❌ Falha ao gerar diagnóstico com IA.</li>`;
                        }
                    })
                    .catch(err => {
                        console.error('[CMO] Erro ao analisar ROI com IA:', err);
                        actionList.innerHTML = `<li>❌ Falha de conexão ao gerar diagnóstico.</li>`;
                    })
                    .finally(() => {
                        btnAi.disabled = false;
                        btnAi.innerText = 'Gerar Novo Diagnóstico com IA ✨';
                    });
                };
            }
        }

        // Real Data tracking (If a start date is set)
        // Real Data tracking (If a start date is set)
        const dataRealBase = [];
        if (simTrackingStartDate) {
            // Ideally we would query the database for historical progress month by month.
            // Since we only have 'basePagantes' right now, we will plot it at the exact months passed.
            const startDate = new Date(simTrackingStartDate);
            const now = new Date();
            let monthsPassed = (now.getFullYear() - startDate.getFullYear()) * 12;
            monthsPassed -= startDate.getMonth();
            monthsPassed += now.getMonth();
            
            if (monthsPassed < 0) monthsPassed = 0;
            if (monthsPassed > 11) monthsPassed = 11;
            
            // Preenche de null até o mês atual
            for (let i = 0; i <= monthsPassed; i++) {
                if (i === 0) {
                    dataRealBase.push(simTrackingStartSubs);
                } else if (i === monthsPassed) {
                    dataRealBase.push(data.platform.b2b.total_active);
                } else {
                    // Nós não temos o dado do meio ainda, faz interpolação linear
                    const start = simTrackingStartSubs;
                    const end = data.platform.b2b.total_active;
                    const step = (end - start) / monthsPassed;
                    dataRealBase.push(Math.round(start + (step * i)));
                }
            }
        } else {
            // Se ainda não salvou, o Mês 1 (hoje) tem a base atual
            dataRealBase.push(data.platform.b2b.total_active);
        }

        // Update Chart
        const timelineContainer = document.getElementById('sim-timeline-container');
        const ctxChart = document.getElementById('simTimelineChart');
        if (timelineContainer && ctxChart) {
            timelineContainer.style.display = 'block';
            
            const datasets = [
                {
                    label: 'Base Projetada (Esperada)',
                    type: 'line',
                    data: dataExpectedBase,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#10b981',
                    pointRadius: 3,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Base Realizada',
                    type: 'line',
                    data: dataRealBase,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 4,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#3b82f6',
                    pointRadius: 5,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                }
            ];
            
            if (curiosityGoal) {
                const goalData = Array(12).fill(curiosityGoal);
                datasets.push({
                    label: 'Meta Curiosidade',
                    type: 'line',
                    data: goalData,
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y'
                });
            }

            if (window.simTimelineChartInstance) {
                window.simTimelineChartInstance.destroy();
            }
            
            window.simTimelineChartInstance = new Chart(ctxChart, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    events: [],
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: { 
                            beginAtZero: true, 
                            grid: { borderDash: [2, 4], color: '#f1f5f9' }
                        }
                    },
                    plugins: {
                        legend: { position: 'top' },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: '#1f2937',
                            padding: 12,
                            titleFont: { size: 13, family: 'Inter' },
                            bodyFont: { size: 14, family: 'Inter', weight: 'bold' }
                        }
                    }
                }
            });

            // ==========================================
            // LISTENER DE MOUSE MANUAL (CÁLCULO ESCALADO)
            // ==========================================
            if (ctxChart._mouseMoveHandler) {
                ctxChart.removeEventListener('mousemove', ctxChart._mouseMoveHandler);
                ctxChart.removeEventListener('mouseout', ctxChart._mouseOutHandler);
            }

            const chart = window.simTimelineChartInstance;

            ctxChart._mouseMoveHandler = function(e) {
                if (!chart || !chart.chartArea || !chart.scales.x) return;

                const rect = ctxChart.getBoundingClientRect();
                
                // FATOR DE ESCALA
                const scaleX = chart.canvas.clientWidth / rect.width;
                const scaleY = chart.canvas.clientHeight / rect.height;

                const mouseX = (e.clientX - rect.left) * scaleX;
                const mouseY = (e.clientY - rect.top) * scaleY;

                const { left, right, top, bottom } = chart.chartArea;

                if (mouseX < left || mouseX > right || mouseY < top || mouseY > bottom) {
                    chart.tooltip.setActiveElements([], {});
                    chart.setActiveElements([]);
                    chart.update();
                    return;
                }

                const xScale = chart.scales.x;
                const labelsCount = chart.data.labels.length;
                
                const positions = [];
                for (let i = 0; i < labelsCount; i++) {
                    positions.push(xScale.getPixelForValue(i));
                }

                const boundaries = [];
                if (labelsCount > 1) {
                    boundaries.push(positions[0] - (positions[1] - positions[0]) / 2);
                    for (let i = 0; i < labelsCount - 1; i++) {
                        boundaries.push((positions[i] + positions[i + 1]) / 2);
                    }
                    boundaries.push(positions[labelsCount - 1] + (positions[labelsCount - 1] - positions[labelsCount - 2]) / 2);
                } else {
                    boundaries.push(left, right);
                }

                let targetIndex = 0;
                for (let i = 0; i < labelsCount; i++) {
                    if (mouseX >= boundaries[i] && mouseX <= boundaries[i + 1]) {
                        targetIndex = i;
                        break;
                    }
                }

                if (mouseX > boundaries[boundaries.length - 1]) targetIndex = labelsCount - 1;
                if (mouseX < boundaries[0]) targetIndex = 0;

                const meta = chart.getDatasetMeta(0);
                const point = meta.data[targetIndex];

                chart.tooltip.setActiveElements(
                    [{ datasetIndex: 0, index: targetIndex }],
                    { x: point ? point.x : mouseX, y: point ? point.y : mouseY }
                );
                chart.setActiveElements(
                    [{ datasetIndex: 0, index: targetIndex }]
                );
                chart.update();
            };

            ctxChart._mouseOutHandler = function() {
                if (!chart) return;
                chart.tooltip.setActiveElements([], {});
                chart.setActiveElements([]);
                chart.update();
            };

            ctxChart.addEventListener('mousemove', ctxChart._mouseMoveHandler);
            ctxChart.addEventListener('mouseout', ctxChart._mouseOutHandler);
        }
    };

    // Carrega as configurações do banco e roda automaticamente
    loadSimSettings();
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
if (typeof module === 'undefined') {
    initCMOMonthSelector();
    loadCMOMetrics();
}

async function loadTrafficMetrics(dateStart, dateEnd, token) {
    if (!document.getElementById('cmo-ga4-sessions')) return;
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

function runGrowthSimulationMath(p) {
    const labels = [];
    const dataExpectedBase = [];
    const dataRevenue = [];
    const dataCosts = [];
    const dataCashflow = [];
    let currentBase = p.currentBase;
    let rolloverCash = p.rolloverCash;
    let actionMetaSpend = 0, actionGoogleMaintenance = 0, actionTrialGoogleSpend = 0;
    let actionUnspentCash = 0, actionCACPenalized = 0;
    let mrrAt12 = 0, baseAt12 = 0, metaBudgetAt12 = 0, googleBudgetAt12 = 0;
    let blendedAcquisitionCostM1 = 0, churnLossBaseM1 = 0, requiredReplacementPaidM1 = 0;

    for (let m = 1; m <= p.targetMonths; m++) {
        let baseStart = currentBase;
        const startingMrr = baseStart * p.arpu;
        
        const projectedDemandEligibleBase = baseStart * p.demandEligibilityRate;
        const totalContactDemand = projectedDemandEligibleBase * p.contactsPerPaidPsiMonth;
        const requiredGoogleContacts = Math.max(0, totalContactDemand - p.verifiedOrganicContacts);
        const googleMaintenanceCost = requiredGoogleContacts * p.cplGoogle;
        
        const contributionAfterGoogle = Math.max(0, startingMrr - googleMaintenanceCost);
        const growthFund = (contributionAfterGoogle * (p.reinvestRate / 100)) + p.extraCash + rolloverCash;

        const MINIMUM_SAFE_SPEND = 1000;
        const effectiveHistSpend = Math.max(p.histMetaMonthlySpendAvg || 0, MINIMUM_SAFE_SPEND);

        const metaHardCap = effectiveHistSpend * 3.5;
        let projectedMetaBudget = growthFund * 0.80;
        
        const scaleFactor = Math.min(3.5, Math.max(1, projectedMetaBudget / effectiveHistSpend));
        const metaCACPenalized = p.cacMeta * (1 + (Math.max(0, scaleFactor - 1) * 0.20));
        
        const trialsPerPaid = 1 / p.trialConversionRate;
        const trialDurationFraction = 7 / 30;
        const trialContactDemand = p.contactsPerPaidPsiMonth * trialDurationFraction;
        const avgGoogleCostPerTrial = trialContactDemand * p.cplGoogle;
        
        const trialGoogleCostPerPaid = trialsPerPaid * avgGoogleCostPerTrial;
        const blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

        const maxPaidByCash = Math.floor(growthFund / blendedAcquisitionCost);
        const maxPaidByMeta = Math.floor(metaHardCap / metaCACPenalized);
        const newPaidActive = Math.min(maxPaidByCash, maxPaidByMeta);
        
        const actualMetaSpend = newPaidActive * metaCACPenalized;
        const actualTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;
        const actualGrowthSpend = actualMetaSpend + actualTrialGoogleSpend;
        
        rolloverCash = growthFund - actualGrowthSpend;

        let baseUsedForChurn = (m === 1 && p.renewableSubscriberBase !== undefined) ? p.renewableSubscriberBase : baseStart;
        let expectedChurn = baseUsedForChurn * p.monthlyChurn;
        let appliedKnownChurn = (m === 1) ? (p.knownScheduledChurn || 0) : 0;
        let reliableOrganicPaidAdditions = p.newOrganicActive || 0;
        
        // Required replacement to maintain base stable
        let requiredReplacementPaid = Math.max(0, expectedChurn + appliedKnownChurn - reliableOrganicPaidAdditions);
        let churnLoss = expectedChurn + appliedKnownChurn;

        currentBase = baseStart + newPaidActive + reliableOrganicPaidAdditions - churnLoss;
        const endOfMonthMRR = currentBase * p.arpu;
        
        const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;

        labels.push(`Mês ${m}`);
        dataExpectedBase.push(currentBase);
        dataRevenue.push(endOfMonthMRR);
        
        const totalCosts = actualMetaSpend + totalGoogleBudget;
        dataCosts.push(totalCosts);
        dataCashflow.push(startingMrr - totalCosts);
        
        if (m === 1) {
            actionMetaSpend = actualMetaSpend;
            actionGoogleMaintenance = googleMaintenanceCost;
            actionTrialGoogleSpend = actualTrialGoogleSpend;
            actionUnspentCash = rolloverCash;
            actionCACPenalized = metaCACPenalized;
            blendedAcquisitionCostM1 = blendedAcquisitionCost;
            churnLossBaseM1 = churnLoss;
            requiredReplacementPaidM1 = requiredReplacementPaid;
        }
        if (m === 12) {
            mrrAt12 = currentBase * p.arpu;
            baseAt12 = currentBase;
            metaBudgetAt12 = actualMetaSpend;
            googleBudgetAt12 = totalGoogleBudget;
        }
    }
    
    return {
        labels, dataExpectedBase, dataRevenue, dataCosts, dataCashflow,
        mrrAt12, baseAt12, metaBudgetAt12, googleBudgetAt12,
        actionMetaSpend, actionGoogleMaintenance, actionTrialGoogleSpend, actionUnspentCash, actionCACPenalized,
        blendedAcquisitionCostM1, churnLossBaseM1, requiredReplacementPaidM1
    };
}

if (typeof module !== 'undefined') {
    module.exports = { runGrowthSimulationMath };
}


// --- SNAPSHOT FUNCTIONS ---
async function fetchMonthlyFinance(monthYear, managerialData = {}) {
    try {
        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('adminToken');
        const res = await fetch('/api/cmo/monthly-finance?monthYear=' + monthYear, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        const snap = data.snapshot;
        const def = data.defaults;
        
        document.getElementById('mf-closing-cash').value = snap && snap.closingCashBalance !== null ? snap.closingCashBalance : '';
        document.getElementById('mf-opex-complete').value = snap ? (snap.opexIsComplete ? 'true' : 'false') : 'false';
        document.getElementById('mf-tax-var').value = snap && snap.appliedTaxVariableRate !== null ? snap.appliedTaxVariableRate : (def.tax_variable_rate !== null ? def.tax_variable_rate : '');
        document.getElementById('mf-tax-fix').value = snap && snap.appliedTaxFixedMonthly !== null ? snap.appliedTaxFixedMonthly : (def.tax_fixed_monthly !== null ? def.tax_fixed_monthly : '');
        document.getElementById('mf-reserve').value = snap && snap.appliedRequiredCashReserve !== null ? snap.appliedRequiredCashReserve : (def.required_cash_reserve !== null ? def.required_cash_reserve : '');
        
        const isClosed = snap && snap.isClosed;
        const inputs = ['mf-closing-cash', 'mf-opex-complete', 'mf-tax-var', 'mf-tax-fix', 'mf-reserve'];
        inputs.forEach(id => document.getElementById(id).disabled = isClosed);
        
        document.getElementById('mf-closed-badge').style.display = isClosed ? 'block' : 'none';

        if(managerialData && managerialData.ConfirmedGrossRevenue !== undefined) {
            document.getElementById('mf-gross-rev').innerText = formatBRL(managerialData.ConfirmedGrossRevenue);
            document.getElementById('mf-gate-fee').innerText = formatBRL(managerialData.RealizedGatewayFees);
            document.getElementById('mf-net-rev').innerText = managerialData.NetRevenue !== 'MISSING_INPUT' ? formatBRL(managerialData.NetRevenue) : 'N/A';
            document.getElementById('mf-opex-fix').innerText = formatBRL(managerialData.FixedOPEX);
            document.getElementById('mf-opex-var').innerText = formatBRL(managerialData.OtherVariableOperatingCosts);
            document.getElementById('mf-ggl-main').innerText = managerialData.AllocatedGoogleMaintenanceSpend !== 'MISSING_INPUT' ? formatBRL(managerialData.AllocatedGoogleMaintenanceSpend) : 'N/A';
            document.getElementById('mf-ggl-gro').innerText = managerialData.AllocatedGoogleGrowthSpend !== 'MISSING_INPUT' ? formatBRL(managerialData.AllocatedGoogleGrowthSpend) : 'N/A';
            document.getElementById('mf-meta-gro').innerText = formatBRL(managerialData.MetaGrowthSpend);
        }
    } catch(e) { console.error('Erro mf:', e); }
}

window.saveMonthlyFinance = async function() {
    await submitMonthlyFinance('save');
}

window.closeMonthlyFinance = async function() {
    if(!confirm("Tem certeza? Mês fechado não poderá ser alterado!")) return;
    await submitMonthlyFinance('close');
}

async function submitMonthlyFinance(action) {
    const monthYear = document.getElementById('cmo-date-start').value.substring(0, 7);
    const body = {
        monthYear,
        closingCashBalance: document.getElementById('mf-closing-cash').value,
        opexIsComplete: document.getElementById('mf-opex-complete').value === 'true',
        appliedTaxVariableRate: document.getElementById('mf-tax-var').value,
        appliedTaxFixedMonthly: document.getElementById('mf-tax-fix').value,
        appliedRequiredCashReserve: document.getElementById('mf-reserve').value,
        action
    };
    try {
        const token = localStorage.getItem('Yelo_token') || localStorage.getItem('adminToken');
        await fetch('/api/cmo/monthly-finance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify(body)
        });
        loadCMOMetrics();
    } catch(e) {
        alert("Erro: " + e.message);
    }
}
// --- END SNAPSHOT ---
