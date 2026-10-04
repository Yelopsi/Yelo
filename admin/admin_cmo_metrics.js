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
        if (data.simulator?.churn && data.simulator.churn.type === 'ASSUMED') {
            const el = document.getElementById('dbg-global-churn');
            if (el) {
                el.innerHTML = `${(data.simulator.churn.value * 100).toFixed(2)}% <span style="font-size:0.75rem; color:#64748b; font-weight:normal; margin-left:8px;">· Hipótese conservadora</span>`;
            }
        } else {
            setDbgHist('dbg-global-churn',  data.prevPlatform?.b2b?.global_churn_rate || 0, data.platform.b2b?.global_churn_rate || 0, 'percent', true);
        }

        setDbgHist('dbg-google-spend',  data.prevAds?.google?.spend || 0, data.ads?.google?.spend || 0, 'currency', true);
        setDbgHist('dbg-google-clicks', data.prevPlatform?.b2c?.wpp_clicks || 0, data.platform.b2c?.wpp_clicks || 0, 'number', false);
        setDbgHist('dbg-google-deals',  data.prevPlatform?.b2c?.total_deals || 0, data.platform.b2c?.total_deals || 0, 'number', false);
        setDbgHist('dbg-google-cpl',    (data.prevAds?.google?.cpl?.value || data.prevAds?.google?.cpl || 0), (data.ads?.google?.cpl?.value || data.ads?.google?.cpl || 0), 'currency', true);
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

    const inputFixedOpex = document.getElementById('sim-fixed-opex');
    const inputTaxRate = document.getElementById('sim-tax-rate');
    const inputGatewayRate = document.getElementById('sim-gateway-rate');
    const inputVarCostRate = document.getElementById('sim-var-cost-rate');


    const formatBRLCurrency = (value) => {
        if (value === null || value === undefined || value === '') return '';
        let v = String(value).replace(/\D/g, "");
        if (!v) return "R$ 0,00";
        v = (parseInt(v, 10) / 100).toFixed(2);
        v = v.replace(".", ",");
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        return "R$ " + v;
    };
    const parseBRLCurrency = (value) => {
        if (value === null || value === undefined || value === '') return NaN;
        let v = String(value).replace(/\D/g, "");
        if (!v) return 0;
        return parseInt(v, 10) / 100;
    };

    const formatBRPercent = (value) => {
        if (value === null || value === undefined || value === '') return '';
        let v = String(value).replace(/\D/g, "");
        if (!v) return "0,00%";
        v = (parseInt(v, 10) / 100).toFixed(2);
        v = v.replace(".", ",");
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        return v + "%";
    };
    const parseBRPercent = (value) => {
        if (value === null || value === undefined || value === '') return NaN;
        let v = String(value).replace(/\D/g, "");
        if (!v) return 0;
        return parseInt(v, 10) / 100;
    };

    const formatBRInteger = (value) => {
        if (value === null || value === undefined || value === '') return '';
        let v = String(value).replace(/\D/g, "");
        if (!v) return "";
        v = parseInt(v, 10).toString();
        v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");
        return v;
    };
    const parseBRInteger = (value) => {
        if (value === null || value === undefined || value === '') return NaN;
        let v = String(value).replace(/\D/g, "");
        if (!v) return 0;
        return parseInt(v, 10);
    };

    const applyMask = (el, formatter) => {
        if (!el) return;
        el.type = 'text';
        el.addEventListener('input', (e) => {
            let cursorPosition = e.target.selectionStart;
            let oldLength = e.target.value.length;
            e.target.value = formatter(e.target.value);
            let diff = e.target.value.length - oldLength;
            cursorPosition += diff;
            try { e.target.setSelectionRange(cursorPosition, cursorPosition); } catch(err) {}
            if (typeof runSimulation === 'function' && typeof data !== 'undefined') runSimulation(data);
        });
        if (el.value && !el.hasAttribute('data-mask-init')) {
            el.setAttribute('data-mask-init', 'true');
            let initVal = parseFloat(el.value);
            if (!isNaN(initVal)) {
                if (formatter === formatBRPercent || formatter === formatBRLCurrency) {
                    el.value = formatter((initVal * 100).toFixed(0));
                } else {
                    el.value = formatter(initVal.toFixed(0));
                }
            }
        }
    };


    const inputCacDegradation = document.getElementById('sim-cac-degradation');
    const inputCplDegradation = document.getElementById('sim-cpl-degradation');
    const inputMetaScalePenalty = document.getElementById('sim-meta-scale-penalty');
    const inputSimManualCacMeta = document.getElementById('sim-manual-cac-meta');
    const inputSimManualMetaHistSpend = document.getElementById('sim-manual-meta-hist-spend');
    const inputSimMetaManualMode = document.getElementById('sim-meta-manual-mode');

    applyMask(inputReinvestRate, formatBRPercent);
    applyMask(inputExtraCash, formatBRLCurrency);
    applyMask(inputCuriosityGoal, formatBRInteger);
    applyMask(inputFixedOpex, formatBRLCurrency);
    applyMask(inputTaxRate, formatBRPercent);
    applyMask(inputGatewayRate, formatBRPercent);
    applyMask(inputVarCostRate, formatBRPercent);
    applyMask(inputCacDegradation, formatBRPercent);
    applyMask(inputCplDegradation, formatBRPercent);
    applyMask(inputMetaScalePenalty, formatBRPercent);
    applyMask(inputSimManualCacMeta, formatBRLCurrency);
    applyMask(inputSimManualMetaHistSpend, formatBRLCurrency);


    // Etapa 2B: Preenchimento automático apenas na carga inicial (Soberania do Usuário)
    if (inputGatewayRate && !inputGatewayRate.hasAttribute('data-initialized')) {
        inputGatewayRate.setAttribute('data-initialized', 'true');

        const m = data.platform?.pnl?.managerial;
        if (m) {
            if (m.projectedGatewayRate && typeof m.projectedGatewayRate.value === 'number' && m.projectedGatewayRate.value !== 'MISSING_INPUT' && !Number.isNaN(m.projectedGatewayRate.value)) {
                inputGatewayRate.value = formatBRPercent((m.projectedGatewayRate.value * 10000).toFixed(0));
            }
        }
        const inputManualCacMeta = document.getElementById('sim-manual-cac-meta');
        const inputManualMetaHistSpend = document.getElementById('sim-manual-meta-hist-spend');

        if (inputManualCacMeta && !inputManualCacMeta.hasAttribute('data-initialized')) {
            inputManualCacMeta.setAttribute('data-initialized', 'true');
            if (data.historical?.meta?.cac) {
                inputManualCacMeta.value = formatBRLCurrency((data.historical.meta.cac * 100).toFixed(0));
            }
        }
        if (inputManualMetaHistSpend && !inputManualMetaHistSpend.hasAttribute('data-initialized')) {
            inputManualMetaHistSpend.setAttribute('data-initialized', 'true');
            if (data.historical?.meta?.monthly_spend_avg?.value) {
                inputManualMetaHistSpend.value = formatBRLCurrency((data.historical.meta.monthly_spend_avg.value * 100).toFixed(0));
            }
        }
    }

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
        if (inputCacDegradation) inputCacDegradation.disabled = true;
        if (inputCplDegradation) inputCplDegradation.disabled = true;
        if (inputMetaScalePenalty) inputMetaScalePenalty.disabled = true;
        if (inputSimMetaManualMode) inputSimMetaManualMode.disabled = true;
        if (inputSimManualCacMeta) inputSimManualCacMeta.disabled = true;
        if (inputSimManualMetaHistSpend) inputSimManualMetaHistSpend.disabled = true;
        const simIncludeOrganic = document.getElementById('sim-include-organic');
        if (simIncludeOrganic) simIncludeOrganic.disabled = true;

        if (inputFixedOpex) inputFixedOpex.disabled = true;
        if (inputTaxRate) inputTaxRate.disabled = true;
        if (inputGatewayRate) inputGatewayRate.disabled = true;
        if (inputVarCostRate) inputVarCostRate.disabled = true;

        newBtnSave.textContent = 'Alterar Parâmetros';
        newBtnSave.style.background = '#f59e0b';
    };

    const unblockSimulatorInputs = () => {
        if (inputReinvestRate) inputReinvestRate.disabled = false;
        if (inputExtraCash) inputExtraCash.disabled = false;
        if (inputCuriosityGoal) inputCuriosityGoal.disabled = false;
        if (inputCacDegradation) inputCacDegradation.disabled = false;
        if (inputCplDegradation) inputCplDegradation.disabled = false;
        if (inputMetaScalePenalty) inputMetaScalePenalty.disabled = false;
        if (inputSimMetaManualMode) inputSimMetaManualMode.disabled = false;
        const simIncludeOrganic = document.getElementById('sim-include-organic');
        if (simIncludeOrganic) simIncludeOrganic.disabled = false;

        if (inputFixedOpex) inputFixedOpex.disabled = false;
        if (inputTaxRate) inputTaxRate.disabled = false;
        if (inputGatewayRate) inputGatewayRate.disabled = true; // Gateway remains automatic
        if (inputVarCostRate) inputVarCostRate.disabled = false;

        if (inputSimMetaManualMode && inputSimMetaManualMode.checked) {
            if (inputSimManualCacMeta) inputSimManualCacMeta.disabled = false;
            if (inputSimManualMetaHistSpend) inputSimManualMetaHistSpend.disabled = false;
        } else {
            if (inputSimManualCacMeta) inputSimManualCacMeta.disabled = true;
            if (inputSimManualMetaHistSpend) inputSimManualMetaHistSpend.disabled = true;
        }

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
                        inputReinvestRate.value = formatBRPercent((saved.reinvestRate * 100).toFixed(0)); inputReinvestRate.setAttribute('value', inputReinvestRate.value);
                    }
                    if (inputExtraCash && saved.extraCash !== undefined) {
                        inputExtraCash.value = formatBRLCurrency(((parseFloat(saved.extraCash) || 0) * 100).toFixed(0));
                        inputExtraCash.setAttribute('value', inputExtraCash.value);
                    }
                    if (inputCuriosityGoal && saved.curiosityGoal !== undefined && saved.curiosityGoal !== null) {
                        inputCuriosityGoal.value = formatBRInteger(saved.curiosityGoal); inputCuriosityGoal.setAttribute('value', inputCuriosityGoal.value);
                    }
                    if (inputFixedOpex && saved.fixedOpex !== undefined) {
                        inputFixedOpex.value = formatBRLCurrency(((parseFloat(saved.fixedOpex) || 0) * 100).toFixed(0)); inputFixedOpex.setAttribute('value', inputFixedOpex.value);
                    }
                    if (inputTaxRate && saved.taxRate !== undefined) {
                        inputTaxRate.value = formatBRPercent(((parseFloat(saved.taxRate) || 0) * 100).toFixed(0)); inputTaxRate.setAttribute('value', inputTaxRate.value);
                    }
                    if (inputVarCostRate && saved.otherVarRate !== undefined) {
                        inputVarCostRate.value = formatBRPercent(((parseFloat(saved.otherVarRate) || 0) * 100).toFixed(0)); inputVarCostRate.setAttribute('value', inputVarCostRate.value);
                    }
                    simTrackingStartDate = saved.startDate;
                    simTrackingStartSubs = saved.startSubs;
                }
            }
        } catch (e) { /* silencioso */ }

        // Estado inicial = SAVED (todos bloqueados)
        blockSimulatorInputs();

        runSimulation(data);
    };
    // Listeners





    if (inputSimMetaManualMode) {
        inputSimMetaManualMode.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            if (newBtnSave.textContent === 'Salvar Parâmetros') {
                if (inputSimManualCacMeta) inputSimManualCacMeta.disabled = !isChecked;
                if (inputSimManualMetaHistSpend) inputSimManualMetaHistSpend.disabled = !isChecked;
            }
            runSimulation(data);
        });
    }


    newBtnSave.addEventListener('click', () => {
        if (newBtnSave.textContent === 'Alterar Parâmetros') {
            unblockSimulatorInputs();
            return;
        }

        newBtnSave.textContent = 'Salvando...';
        newBtnSave.style.opacity = '0.7';

        const reinvestParsed = parseBRPercent(inputReinvestRate?.value);
        const reinvestRate = Number.isFinite(reinvestParsed) ? reinvestParsed : 100;

        const extraCashParsed = parseBRLCurrency(inputExtraCash?.value);
        const extraCash = Number.isFinite(extraCashParsed) ? extraCashParsed : 0;

        const curiosityParsed = parseBRInteger(inputCuriosityGoal?.value);
        const curiosityGoal = Number.isFinite(curiosityParsed) ? curiosityParsed : null;

        const fixedOpexParsed = parseBRLCurrency(inputFixedOpex?.value);
        const fixedOpex = Number.isFinite(fixedOpexParsed) ? fixedOpexParsed : 0;
        
        const taxRateParsed = parseBRPercent(inputTaxRate?.value);
        const taxRate = Number.isFinite(taxRateParsed) ? (taxRateParsed / 100) : 0;
        
        const varCostRateParsed = parseBRPercent(inputVarCostRate?.value);
        const otherVarRate = Number.isFinite(varCostRateParsed) ? (varCostRateParsed / 100) : 0;

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
                fixedOpex,
                taxRate,
                otherVarRate,
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

    const inputIncludeOrganic = document.getElementById('sim-include-organic');
    if (inputIncludeOrganic) {
        // Remove old listeners by cloning
        const newIncludeOrganic = inputIncludeOrganic.cloneNode(true);
        inputIncludeOrganic.parentNode.replaceChild(newIncludeOrganic, inputIncludeOrganic);
        newIncludeOrganic.addEventListener('change', () => {
            runSimulation(data);
        });
    }

    const runSimulation = (data) => {
        const inputReinvestRate = document.getElementById('sim-reinvest-rate');
        const inputExtraCash = document.getElementById('sim-extra-cash');
        const inputCuriosityGoal = document.getElementById('sim-curiosity-goal');



        const inputFixedOpex = document.getElementById('sim-fixed-opex');
        const inputTaxRate = document.getElementById('sim-tax-rate');
        const inputGatewayRate = document.getElementById('sim-gateway-rate');
        const inputVarCostRate = document.getElementById('sim-var-cost-rate');

        const reinvestParsed = parseBRPercent(inputReinvestRate?.value);
        let reinvestRate = Number.isFinite(reinvestParsed) ? reinvestParsed : 50;

        const extraCashParsed = parseBRLCurrency(inputExtraCash?.value);
        let extraCash = Number.isFinite(extraCashParsed) ? extraCashParsed : 0;

        const curiosityParsed = parseBRInteger(inputCuriosityGoal?.value);
        let curiosityGoal = Number.isFinite(curiosityParsed) ? curiosityParsed : null;
        let cacDegradation = (parseBRPercent(inputCacDegradation?.value) || 0) / 100;
        let cplDegradation = (parseBRPercent(inputCplDegradation?.value) || 0) / 100;


        const metaScalePenalty = parseBRPercent(inputMetaScalePenalty?.value) >= 0 ? parseBRPercent(inputMetaScalePenalty?.value) / 100 : null;

        const getNumericSimInput = (el, isPercentage) => {
            if (!el || el.value.trim() === '') return null;
            let val;
            if (isPercentage) {
                val = parseBRPercent(el.value);
            } else {
                val = parseBRLCurrency(el.value);
            }
            if (Number.isNaN(val)) return null;
            return isPercentage ? val / 100 : val;
        };

        const fixedOPEX = getNumericSimInput(inputFixedOpex, false);
        const taxRate = getNumericSimInput(inputTaxRate, true);
        const gatewayRate = getNumericSimInput(inputGatewayRate, true);
        const varCostRate = getNumericSimInput(inputVarCostRate, true);

        // 1. BASE INICIAL VEM DA PRODUÇÃO ATUAL (Motor Final)
        const currentPaidAccessBase = data.simulator?.currentPaidAccessBase || data.platform.b2b.total_active || 0;
        const operationalForwardBase = data.simulator?.operationalForwardBase || Math.max(0, currentPaidAccessBase - (data.simulator?.knownScheduledChurn || 0));
        const mechanicallyRenewableBase = data.simulator?.mechanicallyRenewableBase?.value || operationalForwardBase;
        const manualLegacyBase = data.simulator?.manualLegacyBase?.value || 0;

        const demandEligiblePaidBase = data.simulator?.demandEligiblePaidBase || 0;
        const futureDemandEligibilityRate = data.simulator?.futureDemandEligibilityRate?.value || 0;

        const knownScheduledChurn = data.simulator?.knownScheduledChurn || 0;
        const baseEligibleForProjection = operationalForwardBase;

        function getSimValue(obj) {
            if (!obj) return null;
            if (typeof obj !== 'object') return null;
            if (obj.type === 'MISSING_INPUT') return null;
            const v = obj.value;
            if (v === undefined || Number.isNaN(v) || v === null || !isFinite(v)) return null;
            return v;
        }

        const trialConversionObj = data.simulator?.trialConv;
        const trialConversionRate = getSimValue(trialConversionObj);
        const apiCacMeta = getSimValue(data.simulator?.cac);
        const cplGoogle = getSimValue(data.simulator?.cpl);
        const monthlyChurn = getSimValue(data.simulator?.churn);
        const apiHistMetaMonthlySpend = getSimValue(data.historical?.meta?.monthly_spend_avg);

        const isManualMode = document.getElementById('sim-meta-manual-mode')?.checked || false;

        const manualCacMetaRaw = document.getElementById('sim-manual-cac-meta')?.value; const manualCacMeta = manualCacMetaRaw ? parseBRLCurrency(manualCacMetaRaw) : null; const manualHistMetaSpendRaw = document.getElementById('sim-manual-meta-hist-spend')?.value; const manualHistMetaSpend = manualHistMetaSpendRaw ? parseBRLCurrency(manualHistMetaSpendRaw) : null;

        let effectiveCacMeta = apiCacMeta;
        let effectiveHistMetaSpend = apiHistMetaMonthlySpend;
        let metaDataSource = 'API';

        if (isManualMode) {
            effectiveCacMeta = manualCacMeta;
            effectiveHistMetaSpend = manualHistMetaSpend;
            metaDataSource = 'MANUAL_SCENARIO';
        }

        const activePaidAccessBase = data.platform?.b2b?.total_active || 0;
        const arpu = data.platform?.b2b?.arpu || 99;
        const contactsPerPaidPsiMonth = data.simulator?.contactsPerPaidPsiMonth?.value;
        const contactsThresholdSource = data.simulator?.contactsPerPaidPsiMonth?.type || 'ASSUMED';

        let demandEligibilityRate = data.simulator?.demandEligibilityRate; // Backward compat
        if (demandEligibilityRate === 'MISSING_INPUT' || demandEligibilityRate === undefined || demandEligibilityRate === null) {
            demandEligibilityRate = 0;
        }

        const hasMissingFinancials = gatewayRate === null;

        let simBlockReason = null;
        if (hasMissingFinancials) {
            simBlockReason = 'MISSING_FINANCIALS';
        } else if (metaScalePenalty === null) {
            simBlockReason = 'INVALID_SCALE_PENALTY';
        } else if (monthlyChurn !== null && (monthlyChurn < 0 || monthlyChurn >= 1)) {
            simBlockReason = 'INVALID_INPUT';
        } else if (contactsPerPaidPsiMonth !== null && (contactsPerPaidPsiMonth <= 0 || !isFinite(contactsPerPaidPsiMonth))) {
            simBlockReason = 'INVALID_INPUT';
        } else {
            if (metaDataSource === 'MANUAL_SCENARIO') {
                if (effectiveCacMeta === null || effectiveHistMetaSpend === null || effectiveCacMeta <= 0 || effectiveHistMetaSpend <= 0) {
                    simBlockReason = 'INVALID_MANUAL_META';
                } else if (trialConversionRate === null || monthlyChurn === null || cplGoogle === null || data.simulator?.demandEligibilityRate === 'MISSING_INPUT' || contactsPerPaidPsiMonth === null) {
                    simBlockReason = 'MISSING_API';
                }
            } else {
                if (effectiveCacMeta === null || trialConversionRate === null || monthlyChurn === null || cplGoogle === null || effectiveHistMetaSpend === null || data.simulator?.demandEligibilityRate === 'MISSING_INPUT' || contactsPerPaidPsiMonth === null) {
                    simBlockReason = 'MISSING_API';
                } else if (effectiveCacMeta === 0 || effectiveHistMetaSpend === 0) {
                    simBlockReason = 'INSUFFICIENT_BASELINE';
                }
            }
        }

        let isSimulationPossible = simBlockReason === null;

        const includeOrganic = document.getElementById('sim-include-organic')?.checked || false;
        const verifiedOrganicContacts = (includeOrganic && data.simulator?.organicContacts?.value) ? data.simulator.organicContacts.value : 0;
        const newOrganicActive = (includeOrganic && data.platform?.b2b?.organic_active) ? data.platform.b2b.organic_active : 0;

        window.formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Snowball Projection (Motor Final validado)
        const targetMonths = 12;
        const labels = [];
        const dataRevenue = [];
        const dataCosts = [];
        const dataCashflow = [];
        const dataExpectedBase = [];

        let currentBase = baseEligibleForProjection;
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

        if (!isSimulationPossible) {
            const warningEl = document.getElementById('sim-res-warning');
            const actionPlanContainer = document.getElementById('sim-action-plan');
            const founderDecisionContainer = document.getElementById('founder-decision-container');

            if (founderDecisionContainer) founderDecisionContainer.style.display = 'none';

            if (warningEl) {
                warningEl.style.display = 'block';
                warningEl.style.backgroundColor = '#fef2f2';
                warningEl.style.color = '#991b1b';

                if (simBlockReason === 'MISSING_FINANCIALS') {
                    warningEl.innerHTML = `⚠️ <b>Atenção:</b> O simulador requer que todos os campos financeiros estejam preenchidos. Faltam dados financeiros necessários para calcular a distribuição de caixa.`;
                } else if (simBlockReason === 'INSUFFICIENT_BASELINE') {
                    warningEl.innerHTML = `⚠️ <b>Atenção:</b> Não há histórico de gastos ou aquisição (CAC) na Meta suficiente para projetar escala. O Motor precisa de um baseline maior que zero para calcular a curva de crescimento.`;
                } else if (simBlockReason === 'INVALID_MANUAL_META') {
                    warningEl.innerHTML = `⚠️ <b>Atenção:</b> Preencha CAC Meta e Gasto Histórico Meta com valores maiores que zero para executar o cenário manual.`;
                } else if (simBlockReason === 'INVALID_SCALE_PENALTY') {
                    warningEl.innerHTML = `⚠️ <b>Atenção:</b> Preencha a Penalidade de Escala Meta com um valor numérico válido maior ou igual a zero.`;
                } else {
                    warningEl.innerHTML = `⚠️ <b>Atenção:</b> O simulador requer dados reais de CAC, Trial e Churn para projetar. Os dados históricos atuais não são qualificados matematicamente (PROXY/UNKNOWN). O Motor está pausado até termos dados observados da coorte.`;
                }
            }

            // Zerar os resultados do card
            if (document.getElementById('sim-res-mrr-12m')) {
                document.getElementById('sim-res-mrr-12m').textContent = formatBRL(0);
                document.getElementById('sim-res-subs-12m').textContent = '0';
                document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(0);
                document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(0);
                if (document.getElementById('sim-res-extrapolation')) {
                    document.getElementById('sim-res-extrapolation').textContent = '--';
                    document.getElementById('sim-res-extrapolation-desc').textContent = 'Indisponível';
                }
            }
            return;
        }

        const pastHistory = data.historical?.platform?.b2b?.past_base_history || [];
        const retroMonths = pastHistory.length;

        let startingRetroBase = currentBase;
        if (retroMonths > 0) {
            startingRetroBase = pastHistory[0];
        }

        const simResult = runGrowthSimulationMath({
            targetMonths, currentBase: startingRetroBase, arpu, demandEligibilityRate, futureDemandEligibilityRate, demandEligiblePaidBase, contactsPerPaidPsiMonth, verifiedOrganicContacts, cplGoogle,
            reinvestRate, extraCash, rolloverCash, histMetaMonthlySpendAvg: effectiveHistMetaSpend, cacMeta: effectiveCacMeta, trialConversionRate, monthlyChurn, newOrganicActive,
            mechanicallyRenewableBase, manualLegacyBase, knownScheduledChurn, retroMonths,
            realCurrentBase: currentPaidAccessBase, operationalForwardBase,
            pnl: data.platform?.pnl, cacDegradation, cplDegradation,
            fixedOPEX, taxRate, gatewayRate, varCostRate, metaScalePenalty
        });

        labels.push(...simResult.labels);
        dataExpectedBase.push(...simResult.dataExpectedBase);
        dataRevenue.push(...simResult.dataRevenue);
        dataCosts.push(...simResult.dataCosts);
        dataCashflow.push(...simResult.dataCashflow);

        // Gráfico é renderizado na parte inferior do arquivo (onde inclui o Real Base)

        mrrAt12 = simResult.mrrAt12;
        baseAt12 = simResult.baseAt12;
        metaBudgetAt12 = simResult.metaBudgetAt12;
        googleBudgetAt12 = simResult.googleBudgetAt12;
        actionMetaSpend = simResult.actionMetaSpend;
        actionGoogleMaintenance = simResult.actionGoogleMaintenance;
        actionTrialGoogleSpend = simResult.actionTrialGoogleSpend;
        actionUnspentCash = simResult.actionUnspentCash;
        actionCACPenalized = simResult.actionCACPenalized;

        // Inject Slider se não existir
        const cardsGrid = document.querySelector('.sim-cards-grid');
        if (cardsGrid && !document.getElementById('sim-month-slider-container')) {
            const sliderHTML = `
                <div id="sim-month-slider-container" style="width: 100%; margin-bottom: 25px; display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <label style="font-size: 0.95rem; font-weight: 700; color: #475569;">Visualizando projeção do: <span id="sim-month-label" style="color: #7e22ce; font-weight: 900; background: #f3e8ff; padding: 4px 10px; border-radius: 12px; margin-left: 5px;">Mês 12</span></label>
                    </div>
                    <input type="range" id="sim-month-slider" min="1" max="12" value="12" style="width: 100%; accent-color: #7e22ce; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; font-weight: 600;">
                        <span>Mês 1</span>
                        <span>Mês 12</span>
                    </div>
                </div>
            `;
            cardsGrid.insertAdjacentHTML('beforebegin', sliderHTML);
        }

        function updateCardsForMonth(m) {
            const index = retroMonths + m;
            const projectedMRR = simResult.dataRevenue[index];
            const projectedBase = simResult.dataExpectedBase[index];
            const projectedMeta = simResult.dataMetaBudget[index];
            const projectedGoogle = simResult.dataGoogleBudget[index];
            const LTV = simResult.dataLTV[index];
            const payback = simResult.dataPayback[index];

            const currentMrr = currentBase * arpu;
            const mrrMultiple = (projectedMRR / (currentMrr || 1)).toFixed(1);

            document.getElementById('sim-month-label').textContent = `Mês ${m}`;

            // Card 1: MRR
            document.querySelector('#sim-card-1 p:first-of-type').textContent = `MRR Projetado (${m}M)`;
            document.getElementById('sim-res-mrr-12m').textContent = formatBRL(projectedMRR);
            document.getElementById('sim-res-mrr-feedback').textContent =
                `${mrrMultiple}x maior que hoje (${formatBRL(currentMrr)}/mês)`;

            // Card 2: Base
            const newSubs = Math.floor(projectedBase) - currentBase;
            const avgPatientsPerPsi = contactsPerPaidPsiMonth || 2;
            const totalPatientsServed = Math.floor(projectedBase) * avgPatientsPerPsi;
            document.getElementById('sim-res-subs-12m').textContent = Math.floor(projectedBase);
            const card2Sub = document.querySelector('#sim-card-2 p:last-child');
            if (card2Sub) card2Sub.textContent =
                `+${newSubs} assinantes líquidos na base em ${m} meses. Meta agregada de demanda: ~${totalPatientsServed.toLocaleString('pt-BR')} cliques no WhatsApp/mês.`;

            // Card 3: Meta
            const metaDaily = projectedMeta / 30;
            document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(projectedMeta);
            const card3Sub = document.querySelector('#sim-card-3 p:last-child');
            if (card3Sub) card3Sub.textContent =
                `≈ ${formatBRL(metaDaily)}/dia recomendados para Mês ${m}.`;

            // Card 4: Google
            const googleDaily = projectedGoogle / 30;
            document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(projectedGoogle);
            const card4Sub = document.querySelector('#sim-card-4 p:last-child');
            if (card4Sub) card4Sub.textContent =
                `Custo mensal projetado p/ Mês ${m} (≈ ${formatBRL(googleDaily)}/dia).`;

            // Card 5 & 6: LTV e Payback
            const projectedLTV = simResult.dataLTV[index] || 0;
            const projectedPayback = simResult.dataPayback[index] || 0;

            const elLTV = document.getElementById('sim-res-ltv');
            const elPayback = document.getElementById('sim-res-payback');

            if (elLTV) elLTV.textContent = projectedLTV > 0 ? formatBRL(projectedLTV) : '--';
            if (elPayback) elPayback.textContent = projectedPayback > 0 ? projectedPayback.toFixed(1) : '--';

            // Card 7: Extrapolação Meta
            const projectedExtrapolation = simResult.dataMetaExtrapolationMultiple[index];
            const elExtrap = document.getElementById('sim-res-extrapolation');
            const elExtrapDesc = document.getElementById('sim-res-extrapolation-desc');

            if (elExtrap && elExtrapDesc) {
                if (effectiveHistMetaSpend > 0 && projectedExtrapolation !== undefined && projectedExtrapolation !== null) {
                    elExtrap.textContent = `${projectedExtrapolation.toFixed(2).replace('.', ',')}× histórico`;
                    const histSourceLabel = metaDataSource === 'MANUAL_SCENARIO' ? 'Histórico do cenário manual' : 'Histórico';
                    elExtrapDesc.textContent = `Projetado: ${formatBRL(projectedMeta)} / mês · ${histSourceLabel}: ${formatBRL(effectiveHistMetaSpend)} / mês`;
                } else {
                    elExtrap.textContent = 'Indisponível';
                    elExtrapDesc.textContent = 'Sem baseline histórico válido para comparação.';
                }
            }
        }

        const slider = document.getElementById('sim-month-slider');
        if (slider) {
            slider.oninput = (e) => {
                updateCardsForMonth(parseInt(e.target.value, 10));
            };
            // Initial call based on current slider value (preserves user selection across re-renders)
            updateCardsForMonth(parseInt(slider.value, 10));
        }

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
                warningEl.innerHTML = `✅ <b>Motor Girando:</b> Hoje há ${activePaidAccessBase} profissionais com acesso pago, dos quais ${baseEligibleForProjection} fazem parte da base elegível para projeção de recorrência (exclui apenas cancelamentos agendados). Em 12 meses, o Motor projeta essa base de ${currentBase} para ${Math.floor(baseAt12)} assinantes, considerando reinvestimento de ${reinvestRate}% da Sobra Operacional e aporte adicional de ${formatBRL(extraCash)} por mês.`;
            } else {
                warningEl.innerHTML = `✅ <b>Motor Girando:</b> Hoje há ${activePaidAccessBase} profissionais com acesso pago, dos quais ${baseEligibleForProjection} fazem parte da base elegível para projeção de recorrência (exclui apenas cancelamentos agendados). Em 12 meses, o Motor projeta essa base de ${currentBase} para ${Math.floor(baseAt12)} assinantes, considerando reinvestimento de ${reinvestRate}% da Sobra Operacional.`;
            }
        }

        // FOUNDER DECISION UI INJECTION
        const p = { retroMonths, extraCash };
        console.group('[CMO DEBUG] Founder call site');

        console.log('runSimulation context:', {
            dataType: typeof data,
            simResultExists: !!simResult,
            pExists: !!p,
            activePaidAccessBase
        });

        console.log(
            'data top-level keys:',
            typeof data !== 'undefined' && data
                ? Object.keys(data)
                : null
        );

        console.groupEnd();

        buildFounderDecisionModel(simResult, p, activePaidAccessBase);

        // LLM Action Plan removido a pedido do usuário, Founder Decision é a única fonte executiva.

        // Real Data tracking (If a start date is set)
        const dataRealBase = [];

        pastHistory.forEach(val => dataRealBase.push(val));
        dataRealBase.push(data.platform.b2b.total_active);

        // Pad the rest of the array with nulls to match the length of projection
        const totalSimulatedLength = targetMonths + 1 + retroMonths;
        while (dataRealBase.length < totalSimulatedLength) {
            dataRealBase.push(null);
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

                const activeElements = [];
                for (let j = 0; j < chart.data.datasets.length; j++) {
                    const val = chart.data.datasets[j].data[targetIndex];
                    if (val !== null && val !== undefined) {
                        activeElements.push({ datasetIndex: j, index: targetIndex });
                    }
                }

                chart.tooltip.setActiveElements(
                    activeElements,
                    { x: point ? point.x : mouseX, y: point ? point.y : mouseY }
                );
                chart.setActiveElements(activeElements);
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
    function calculatePaidAcquisition(availableGrowthFund, organicTrialCost, currentCacMeta, trialGoogleCostPerPaid, effectiveHistSpend, metaScalePenalty, trialConversionRate) {
        const cashAvailableForPaidAcquisition = Math.max(0, availableGrowthFund - organicTrialCost);

        let newPaidActive = 0, actualMetaSpend = 0, paidTrialGoogleSpend = 0;
        let metaCACPenalized = currentCacMeta;
        let blendedAcquisitionCost = currentCacMeta + trialGoogleCostPerPaid;
        let metaExtrapolationMultiple = 0;
        let scaleFactor = 1;
        let isConverged = true;

        if (currentCacMeta > 0 && effectiveHistSpend > 0 && trialConversionRate > 0) {
            let iteratedMetaCAC = currentCacMeta;

            for (let i = 1; i <= 50; i++) {
                const iteratedBlendedCAC = iteratedMetaCAC + trialGoogleCostPerPaid;
                const candidatePaidByCash = cashAvailableForPaidAcquisition / iteratedBlendedCAC;
                const candidateMetaSpend = candidatePaidByCash * iteratedMetaCAC;

                scaleFactor = Math.max(1, candidateMetaSpend / effectiveHistSpend);
                const newMetaCAC = currentCacMeta * (1 + (Math.max(0, scaleFactor - 1) * metaScalePenalty));

                if (Math.abs(newMetaCAC - iteratedMetaCAC) < 0.01) {
                    iteratedMetaCAC = newMetaCAC;
                    break;
                }
                iteratedMetaCAC = newMetaCAC;

                if (i === 50) {
                    isConverged = false;
                    iteratedMetaCAC = NaN;
                }
            }

            if (isNaN(iteratedMetaCAC)) {
                newPaidActive = 0;
                actualMetaSpend = 0;
                paidTrialGoogleSpend = 0;
            } else {
                metaCACPenalized = iteratedMetaCAC;
                blendedAcquisitionCost = metaCACPenalized + trialGoogleCostPerPaid;

                const maxPaidByCash = cashAvailableForPaidAcquisition / blendedAcquisitionCost;

                newPaidActive = maxPaidByCash;
                actualMetaSpend = newPaidActive * metaCACPenalized;
                paidTrialGoogleSpend = newPaidActive * trialGoogleCostPerPaid;

                if (effectiveHistSpend > 0) {
                    metaExtrapolationMultiple = actualMetaSpend / effectiveHistSpend;
                }
            }
        }

        return {
            newPaidActive,
            metaCACPenalized,
            blendedAcquisitionCost,
            actualMetaSpend,
            paidTrialGoogleSpend,
            scaleFactor,
            metaExtrapolationMultiple,
            isConverged
        };
    }

    const labels = [];
    const dataExpectedBase = [];
    const dataRevenue = [];
    const dataCosts = [];
    const dataCashflow = [];
    const dataMetaBudget = [];
    const dataGoogleBudget = [];
    const dataLTV = [];
    const dataPayback = [];
    const dataOperatingCashAvailable = [];
    const dataCurrentMonthGrowthAllocation = [];
    const dataRetainedOperatingCash = [];
    const dataGrowthFund = [];
    const dataRolloverCash = [];
    const dataMetaExtrapolationMultiple = [];
    const dataOrganicTrialCost = [];
    const dataOrganicCostCoveredByGrowth = [];
    const dataOrganicCostCoveredByRetained = [];
    const dataUnfundedOrganicCost = [];
    const dataProjectedOrganicPaidAdditions = [];
    const dataOrganicFundingRatio = [];
    const dataFundedOrganicPaidAdditions = [];
    const dataFundedOrganicCost = [];
    const dataReplacementGap = [];
    const dataPaidReplacementShortfall = [];
    const dataStabilityFundingRequired = [];
    const dataStabilityFundingUsed = [];
    const dataStabilityFundingDeficit = [];
    const dataSafeProfit = [];
    const dataReservedCash = [];
    const auditDiagnostics = [null]; // 0-indexed matches months

    let currentBase = p.currentBase;
    const retroMonths = p.retroMonths || 0;
    const totalPoints = retroMonths + 1 + p.targetMonths;

    // Ponto 0 (Início da simulação)
    labels.push(retroMonths > 0 ? `-${retroMonths}M` : `Hoje`);
    dataExpectedBase.push(Math.round(p.realCurrentBase ?? currentBase)); // Display "Hoje" usa realCurrentBase (30)
    dataRevenue.push(p.mechanicallyRenewableBase * p.arpu || currentBase * p.arpu); // Conservative M0 Revenue
    dataCosts.push(null);
    dataCashflow.push(null);
    dataMetaBudget.push(null);
    dataGoogleBudget.push(null);
    dataLTV.push(null);
    dataPayback.push(null);
    dataOperatingCashAvailable.push(null);
    dataCurrentMonthGrowthAllocation.push(null);
    dataRetainedOperatingCash.push(null);
    dataGrowthFund.push(null);
    dataRolloverCash.push(null);
    dataMetaExtrapolationMultiple.push(null);
    dataOrganicTrialCost.push(null);
    dataOrganicCostCoveredByGrowth.push(null);
    dataOrganicCostCoveredByRetained.push(null);
    dataUnfundedOrganicCost.push(null);
    dataProjectedOrganicPaidAdditions.push(null);
    dataOrganicFundingRatio.push(null);
    dataFundedOrganicPaidAdditions.push(null);
    dataFundedOrganicCost.push(null);
    dataReplacementGap.push(null);
    dataPaidReplacementShortfall.push(null);
    dataStabilityFundingRequired.push(null);
    dataStabilityFundingUsed.push(null);
    dataStabilityFundingDeficit.push(null);
    dataSafeProfit.push(null);
    dataReservedCash.push(null);

    let rolloverCash = p.rolloverCash;
    let actionMetaSpend = 0, actionGoogleMaintenance = 0, actionTrialGoogleSpend = 0;
    let actionUnspentCash = 0, actionCACPenalized = 0;
    let mrrAt12 = 0, baseAt12 = 0, metaBudgetAt12 = 0, googleBudgetAt12 = 0;
    let blendedAcquisitionCostM1 = 0, churnLossBaseM1 = 0, requiredReplacementPaidM1 = 0;
    let metaExtrapolationMultipleM1 = 0;
    let organicTrialCostM1 = 0, organicCostCoveredByGrowthM1 = 0;
    let organicCostCoveredByRetainedM1 = 0, unfundedOrganicCostM1 = 0;
    let projectedOrganicPaidAdditionsM1 = 0, organicFundingRatioM1 = 0;
    let fundedOrganicPaidAdditionsM1 = 0, fundedOrganicCostM1 = 0;
    let replacementGapM1 = 0, paidReplacementShortfallM1 = 0, stabilityFundingRequiredM1 = 0;
    let stabilityFundingUsedM1 = 0, stabilityFundingDeficitM1 = 0, safeProfitM1 = 0;
    let reservedCashM1 = 0;
    let initialRolloverCashM1 = 0;
    let finalRolloverCashM1 = 0;
    let exactBaseEndM1 = 0;
    let reservedCash = 0;

    for (let step = 1; step < totalPoints; step++) {
        let isHoje = (retroMonths > 0) && (step === retroMonths);
        let isM1 = (step === retroMonths + 1);

        let baseStart = currentBase;

        if (isM1) {
            initialRolloverCashM1 = rolloverCash;
        }

        let revenueBase = baseStart;
        if (isM1) {
            revenueBase = p.mechanicallyRenewableBase ?? baseStart;
        }
        const startingMrr = revenueBase * p.arpu;

        let degradationStep = Math.max(0, step - (retroMonths + 1));

        // MEDIA INFLATION
        const currentCplGoogle = p.cplGoogle * Math.pow(1 + (p.cplDegradation || 0), degradationStep);
        const currentCacMeta = p.cacMeta * Math.pow(1 + (p.cacDegradation || 0), degradationStep);

        let projectedDemandEligibleBase = 0;
        if (isM1) {
            projectedDemandEligibleBase = p.demandEligiblePaidBase ?? baseStart;
        } else {
            projectedDemandEligibleBase = baseStart * (p.futureDemandEligibilityRate || p.demandEligibilityRate || 0);
        }

        const totalContactDemand = projectedDemandEligibleBase * p.contactsPerPaidPsiMonth;
        const requiredGoogleContacts = Math.max(0, totalContactDemand - p.verifiedOrganicContacts);
        const googleMaintenanceCost = requiredGoogleContacts * currentCplGoogle;

        // PNL AND GROWTH FUND CALCULATION
        // CUSTOS VÊM DIRETAMENTE DA UI/FRONTEND (SOBERANIA DO USUÁRIO)
        const taxes = startingMrr * p.taxRate;
        const gatewayFees = startingMrr * p.gatewayRate;
        const varOPEX = startingMrr * p.varCostRate;

        const operatingCashAvailable = Math.max(0, startingMrr - taxes - gatewayFees - varOPEX - p.fixedOPEX - googleMaintenanceCost);
        const contributionMarginPerPsi = (startingMrr - taxes - gatewayFees - varOPEX - googleMaintenanceCost) / (baseStart || 1);

        const currentMonthGrowthAllocation = operatingCashAvailable * (p.reinvestRate / 100);
        let retainedOperatingCash = operatingCashAvailable - currentMonthGrowthAllocation;
        const growthFund = currentMonthGrowthAllocation + p.extraCash + rolloverCash;

        const effectiveHistSpend = p.histMetaMonthlySpendAvg || 0;

        const trialsPerPaid = 1 / p.trialConversionRate;
        const trialDurationFraction = 7 / 30;
        const trialContactDemand = p.contactsPerPaidPsiMonth * trialDurationFraction;
        const avgGoogleCostPerTrial = trialContactDemand * currentCplGoogle;

        const trialGoogleCostPerPaid = trialsPerPaid * avgGoogleCostPerTrial;

        // Custo de trial dos orgânicos
        let projectedOrganicPaidAdditions = p.newOrganicActive || 0;
        const organicTrialsCount = projectedOrganicPaidAdditions * trialsPerPaid;
        const organicTrialCost = organicTrialsCount * avgGoogleCostPerTrial;

        const organicCostCoveredByGrowth = Math.min(growthFund, organicTrialCost);
        const organicCostDeficit = Math.max(0, organicTrialCost - growthFund);

        const organicCostCoveredByRetained = Math.min(Math.max(0, retainedOperatingCash), organicCostDeficit);
        let retainedOperatingCashAfterMandatoryOrganic = retainedOperatingCash - organicCostCoveredByRetained;

        const unfundedOrganicCost = organicTrialCost - organicCostCoveredByGrowth - organicCostCoveredByRetained;
        const fundedOrganicCost = organicCostCoveredByGrowth + organicCostCoveredByRetained;

        let organicFundingRatio = organicTrialCost > 0 ? Math.min(1, Math.max(0, fundedOrganicCost / organicTrialCost)) : 1;
        let fundedOrganicPaidAdditions = projectedOrganicPaidAdditions * organicFundingRatio;

        let genericChurnBase = baseStart;
        if (isM1) {
            genericChurnBase = p.mechanicallyRenewableBase ?? baseStart;
        }
        let expectedGenericChurn = genericChurnBase * p.monthlyChurn;

        let manualLegacyRunoff = 0;
        if (isM1) {
            manualLegacyRunoff = p.manualLegacyBase || 0;
        }

        let grossReplacementNeed = expectedGenericChurn + manualLegacyRunoff;
        let replacementGap = Math.max(0, grossReplacementNeed - fundedOrganicPaidAdditions);

        let initialAcq = calculatePaidAcquisition(growthFund, organicTrialCost, currentCacMeta, trialGoogleCostPerPaid, effectiveHistSpend, p.metaScalePenalty, p.trialConversionRate);

        let paidReplacementShortfall = Math.max(0, replacementGap - initialAcq.newPaidActive);

        let additionalStabilityFundingRequired = 0;
        let stabilityFundingDeficit = 0;
        let stabilityFundingUsed = 0;
        let finalAcq = initialAcq;
        let safeProfit = 0;

        if (paidReplacementShortfall > 0) {
            let upperBound = Math.max(1, growthFund, retainedOperatingCashAfterMandatoryOrganic);
            let lowerBound = 0;
            let expansionConverged = false;

            // Etapa de expansão
            for (let iter = 0; iter < 50; iter++) {
                let testAcq = calculatePaidAcquisition(growthFund + upperBound, organicTrialCost, currentCacMeta, trialGoogleCostPerPaid, effectiveHistSpend, p.metaScalePenalty, p.trialConversionRate);

                if (!testAcq.isConverged || !Number.isFinite(testAcq.actualMetaSpend) || !Number.isFinite(testAcq.metaCACPenalized)) {
                    break;
                }

                if (testAcq.newPaidActive >= replacementGap) {
                    expansionConverged = true;
                    break;
                }

                lowerBound = upperBound;
                upperBound *= 2;
            }

            if (!expansionConverged) {
                additionalStabilityFundingRequired = null; // UNRESOLVED
            } else {
                let low = lowerBound;
                let high = upperBound;
                let best = null;

                for (let iter = 0; iter < 100; iter++) {
                    let mid = (low + high) / 2;
                    let testAcq = calculatePaidAcquisition(growthFund + mid, organicTrialCost, currentCacMeta, trialGoogleCostPerPaid, effectiveHistSpend, p.metaScalePenalty, p.trialConversionRate);

                    if (!testAcq.isConverged) {
                        break;
                    }

                    if (testAcq.newPaidActive >= replacementGap) {
                        best = mid;
                        high = mid;
                    } else {
                        low = mid;
                    }
                    if (high - low < 0.01) break;
                }

                if (best !== null) {
                    additionalStabilityFundingRequired = best;
                } else {
                    additionalStabilityFundingRequired = null; // UNRESOLVED
                }
            }
        }

        let newReserved = 0;
        if (additionalStabilityFundingRequired === null && paidReplacementShortfall > 0) {
            // UNRESOLVED status
            stabilityFundingUsed = null;
            safeProfit = 0;
            stabilityFundingDeficit = null;
            newReserved = Math.max(0, retainedOperatingCashAfterMandatoryOrganic);
            reservedCash += newReserved;
            // finalAcq permanece como initialAcq
        } else {
            stabilityFundingUsed = Math.min(additionalStabilityFundingRequired, Math.max(0, retainedOperatingCashAfterMandatoryOrganic));

            if (additionalStabilityFundingRequired > 0) {
                finalAcq = calculatePaidAcquisition(growthFund + stabilityFundingUsed, organicTrialCost, currentCacMeta, trialGoogleCostPerPaid, effectiveHistSpend, p.metaScalePenalty, p.trialConversionRate);
                if (additionalStabilityFundingRequired > retainedOperatingCashAfterMandatoryOrganic) {
                    stabilityFundingDeficit = Math.max(0, additionalStabilityFundingRequired - Math.max(0, retainedOperatingCashAfterMandatoryOrganic));
                }
            }

            safeProfit = Math.max(0, retainedOperatingCashAfterMandatoryOrganic - stabilityFundingUsed);
            if (stabilityFundingDeficit > 0) {
                safeProfit = 0;
            }
        }

        let newPaidActive = finalAcq.newPaidActive;
        let actualMetaSpend = finalAcq.actualMetaSpend;
        let paidTrialGoogleSpend = finalAcq.paidTrialGoogleSpend;
        let metaCACPenalized = finalAcq.metaCACPenalized;
        let blendedAcquisitionCost = finalAcq.blendedAcquisitionCost;
        let metaExtrapolationMultiple = finalAcq.metaExtrapolationMultiple;

        const actualGrowthSpendFromGrowthFund = actualMetaSpend + paidTrialGoogleSpend + organicCostCoveredByGrowth;
        const finalGrowthFund = growthFund + stabilityFundingUsed;

        rolloverCash = Math.max(0, finalGrowthFund - actualGrowthSpendFromGrowthFund);

        const actualTrialGoogleSpend = paidTrialGoogleSpend + organicTrialCost;

        // Required replacement to maintain base stable
        let requiredReplacementPaid = Math.max(0, grossReplacementNeed - fundedOrganicPaidAdditions);
        let churnLoss = grossReplacementNeed; // Total projected base erosion

        currentBase = baseStart + newPaidActive + fundedOrganicPaidAdditions - churnLoss;
        const endOfMonthMRR = currentBase * p.arpu;

        const totalGoogleBudget = googleMaintenanceCost + actualTrialGoogleSpend;

        let labelStr = '';
        if (retroMonths > 0) {
            if (step < retroMonths) {
                labelStr = `-${retroMonths - step}M`;
            } else if (step === retroMonths) {
                labelStr = `Hoje`;
            } else {
                labelStr = `Mês ${step - retroMonths}`;
            }
        } else {
            labelStr = `Mês ${step}`;
        }
        labels.push(labelStr);

        auditDiagnostics.push({
            month: step,
            baseStart,
            revenueBase,
            startingMrr,
            genericChurnBase,
            expectedGenericChurn,
            manualLegacyRunoff,
            grossReplacementNeed,
            projectedDemandEligibleBase,
            totalContactDemand,
            googleMaintenanceCost,
            taxes,
            gatewayFees,
            varOPEX,
            operatingCashAvailable,
            actualPaidAcquisitions: newPaidActive
        });

        dataExpectedBase.push(Math.round(currentBase));
        dataRevenue.push(endOfMonthMRR);

        const totalCosts = actualMetaSpend + totalGoogleBudget;
        dataCosts.push(totalCosts);
        dataCashflow.push(retainedOperatingCashAfterMandatoryOrganic);
        dataMetaBudget.push(actualMetaSpend);
        dataGoogleBudget.push(totalGoogleBudget);

        dataOperatingCashAvailable.push(operatingCashAvailable);
        dataCurrentMonthGrowthAllocation.push(currentMonthGrowthAllocation);
        dataRetainedOperatingCash.push(retainedOperatingCashAfterMandatoryOrganic);
        dataGrowthFund.push(growthFund);
        dataRolloverCash.push(rolloverCash);
        dataMetaExtrapolationMultiple.push(metaExtrapolationMultiple);
        dataOrganicTrialCost.push(organicTrialCost);
        dataOrganicCostCoveredByGrowth.push(organicCostCoveredByGrowth);
        dataOrganicCostCoveredByRetained.push(organicCostCoveredByRetained);
        dataUnfundedOrganicCost.push(unfundedOrganicCost);
        dataProjectedOrganicPaidAdditions.push(projectedOrganicPaidAdditions);
        dataOrganicFundingRatio.push(organicFundingRatio);
        dataFundedOrganicPaidAdditions.push(fundedOrganicPaidAdditions);
        dataFundedOrganicCost.push(fundedOrganicCost);
        dataReplacementGap.push(replacementGap);
        dataPaidReplacementShortfall.push(paidReplacementShortfall);
        dataStabilityFundingRequired.push(additionalStabilityFundingRequired);
        dataStabilityFundingUsed.push(stabilityFundingUsed);
        dataStabilityFundingDeficit.push(stabilityFundingDeficit);
        dataSafeProfit.push(safeProfit);
        dataReservedCash.push(reservedCash);

        // LTV e Payback
        const LTV = contributionMarginPerPsi > 0 ? contributionMarginPerPsi * (1 / p.monthlyChurn) : 0;
        const payback = contributionMarginPerPsi > 0 ? blendedAcquisitionCost / contributionMarginPerPsi : 0;
        dataLTV.push(LTV);
        dataPayback.push(payback);

        if (isM1) {
            actionMetaSpend = actualMetaSpend;
            actionGoogleMaintenance = googleMaintenanceCost;
            actionTrialGoogleSpend = actualTrialGoogleSpend;
            actionUnspentCash = rolloverCash;
            actionCACPenalized = metaCACPenalized;
            blendedAcquisitionCostM1 = blendedAcquisitionCost;
            churnLossBaseM1 = churnLoss;
            requiredReplacementPaidM1 = requiredReplacementPaid;
            metaExtrapolationMultipleM1 = metaExtrapolationMultiple;
            organicTrialCostM1 = organicTrialCost;
            organicCostCoveredByGrowthM1 = organicCostCoveredByGrowth;
            organicCostCoveredByRetainedM1 = organicCostCoveredByRetained;
            unfundedOrganicCostM1 = unfundedOrganicCost;
            projectedOrganicPaidAdditionsM1 = projectedOrganicPaidAdditions;
            organicFundingRatioM1 = organicFundingRatio;
            fundedOrganicPaidAdditionsM1 = fundedOrganicPaidAdditions;
            fundedOrganicCostM1 = fundedOrganicCost;
            replacementGapM1 = replacementGap;
            paidReplacementShortfallM1 = paidReplacementShortfall;
            stabilityFundingRequiredM1 = additionalStabilityFundingRequired;
            stabilityFundingUsedM1 = stabilityFundingUsed;
            stabilityFundingDeficitM1 = stabilityFundingDeficit;
            safeProfitM1 = safeProfit;
            reservedCashM1 = reservedCash;
            finalRolloverCashM1 = rolloverCash;
            exactBaseEndM1 = currentBase;
        }
        if (step === totalPoints - 1) { // Mês 12
            mrrAt12 = currentBase * p.arpu;
            baseAt12 = currentBase;
            metaBudgetAt12 = actualMetaSpend;
            googleBudgetAt12 = totalGoogleBudget;
        }

        // Re-ancorar a projeção para a realidade a partir de "Hoje",
        // para que Mês 1 em diante não herde a defasagem projetada do passado.
        if (isHoje && p.operationalForwardBase != null) {
            currentBase = p.operationalForwardBase;
        }
    }

    return {
        labels, dataExpectedBase, dataRevenue, dataCosts, dataCashflow, dataMetaBudget, dataGoogleBudget,
        dataLTV, dataPayback,
        mrrAt12, baseAt12, metaBudgetAt12, googleBudgetAt12,
        actionMetaSpend, actionGoogleMaintenance, actionTrialGoogleSpend, actionUnspentCash, actionCACPenalized,
        blendedAcquisitionCostM1, churnLossBaseM1, requiredReplacementPaidM1, metaExtrapolationMultipleM1,
        organicTrialCostM1, organicCostCoveredByGrowthM1, organicCostCoveredByRetainedM1, unfundedOrganicCostM1,
        projectedOrganicPaidAdditionsM1, organicFundingRatioM1, fundedOrganicPaidAdditionsM1, fundedOrganicCostM1,
        replacementGapM1, paidReplacementShortfallM1, stabilityFundingRequiredM1, stabilityFundingUsedM1, stabilityFundingDeficitM1, safeProfitM1, reservedCashM1, initialRolloverCashM1, finalRolloverCashM1, exactBaseEndM1,
        dataOperatingCashAvailable, dataCurrentMonthGrowthAllocation, dataRetainedOperatingCash, dataGrowthFund, dataRolloverCash,
        dataMetaExtrapolationMultiple, dataOrganicTrialCost, dataOrganicCostCoveredByGrowth, dataOrganicCostCoveredByRetained, dataUnfundedOrganicCost,
        dataProjectedOrganicPaidAdditions, dataOrganicFundingRatio, dataFundedOrganicPaidAdditions, dataFundedOrganicCost,
        dataReplacementGap, dataPaidReplacementShortfall, dataStabilityFundingRequired, dataStabilityFundingUsed, dataStabilityFundingDeficit, dataSafeProfit, dataReservedCash,
        auditDiagnostics: auditDiagnostics
    };
}

if (typeof module !== 'undefined') {
    module.exports = { runGrowthSimulationMath };
}


function buildFounderDecisionModel(simResult, p, activePaidAccessBase) {
    console.group('[CMO DEBUG] buildFounderDecisionModel');

    console.log('arguments received:', {
        simResultDefined: typeof simResult !== 'undefined',
        pDefined: typeof p !== 'undefined',
        activePaidAccessBaseDefined: typeof activePaidAccessBase !== 'undefined',
        dataType: typeof data
    });

    console.log('simResult keys:',
        simResult && typeof simResult === 'object'
            ? Object.keys(simResult)
            : simResult
    );

    console.log('p keys:',
        p && typeof p === 'object'
            ? Object.keys(p)
            : p
    );

    console.log('activePaidAccessBase:', activePaidAccessBase);

    console.groupEnd();

    const retroMonths = p.retroMonths || 0;
    const m1Diag = simResult.auditDiagnostics.find(a => a && a.month === (retroMonths + 1));
    if (!m1Diag) return;

    const opCash = m1Diag.operatingCashAvailable || 0;
    const extraCash = p.extraCash || 0;
    const initRollover = simResult.initialRolloverCashM1 || 0;

    const totalSources = opCash + extraCash + initRollover;

    const organicFunding = (simResult.organicCostCoveredByGrowthM1 || 0) + (simResult.organicCostCoveredByRetainedM1 || 0);
    const metaSpend = simResult.actionMetaSpend || 0;
    const trialSpend = simResult.actionTrialGoogleSpend || 0;
    const acquisitionDestination = organicFunding + metaSpend + trialSpend;

    const finalRollover = simResult.finalRolloverCashM1 || 0;
    const reserved = simResult.reservedCashM1 || 0;
    const retainedDestination = finalRollover + reserved;

    const safeProfit = simResult.safeProfitM1 || 0;

    const totalDestinations = acquisitionDestination + retainedDestination + safeProfit;

    const delta = Math.abs(totalSources - totalDestinations);
    if (!Number.isFinite(totalSources) || !Number.isFinite(totalDestinations)) {
        return;
    }

    let container = document.getElementById('founder-decision-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'founder-decision-container';
        container.style.marginTop = '20px';
        container.style.padding = '20px';
        container.style.backgroundColor = '#fff';
        container.style.border = '1px solid #e2e8f0';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

        const placeholder = document.getElementById('founder-decision-placeholder');
        if (placeholder) {
            placeholder.appendChild(container);
        } else {
            const warningEl = document.getElementById('sim-res-warning');
            if (warningEl) {
                warningEl.parentNode.insertBefore(container, warningEl.nextSibling);
            }
        }
    }

    container.style.display = 'block';

    if (delta > 0.01) {
        container.innerHTML = `<div style="color: #991b1b; background: #fef2f2; padding: 15px; border-radius: 6px;">
            ⚠️ Não foi possível reconciliar a distribuição do caixa deste cenário (Delta: ${formatBRL(delta)}).
        </div>`;
        return;
    }

    const stabilityFundingUsed = simResult.stabilityFundingUsedM1 || 0;
    const stabilityFundingDeficit = simResult.stabilityFundingDeficitM1 || 0;
    const unresolved = simResult.stabilityFundingRequiredM1 === null;

    const exactBaseEnd = simResult.exactBaseEndM1 || 0;
    const stabilityTarget = m1Diag.baseStart;

    let baseStatus = 'AT_TARGET';
    if (unresolved) {
        baseStatus = 'UNRESOLVED';
    } else if (exactBaseEnd < stabilityTarget - 0.001) {
        baseStatus = 'BELOW_TARGET';
    } else if (exactBaseEnd > stabilityTarget + 0.001) {
        baseStatus = 'ABOVE_TARGET';
    }

    let profitStatus = 'NO_SAFE_PROFIT';
    if (unresolved) {
        profitStatus = 'UNRESOLVED';
    } else if (safeProfit > 0) {
        profitStatus = 'SAFE_PROFIT_AVAILABLE';
    }

    let scenarioMsg = "";
    if (unresolved) {
        scenarioMsg = "Não foi possível encontrar uma alocação segura.";
    } else if (baseStatus === 'BELOW_TARGET') {
        scenarioMsg = "A base tende a encolher nas premissas atuais.";
    } else if (baseStatus === 'AT_TARGET') {
        scenarioMsg = "A base tende a permanecer estável.";
    } else {
        scenarioMsg = "A base tende a crescer nas premissas atuais.";
    }

    let actionText = `Neste cenário, você tem <strong>${formatBRL(totalSources)}</strong> disponíveis para alocação neste ciclo.`;
    actionText += `<br><br>Faça o seguinte:<br>`;
    actionText += `<ul style="margin-top: 10px; padding-left: 20px;">`;
    actionText += `<li>mantenha <strong>${formatBRL(acquisitionDestination)}</strong> destinados à aquisição;</li>`;
    if (metaSpend > 0) actionText += `<li>desse valor, <strong>${formatBRL(metaSpend)}</strong> vão para Meta Ads;</li>`;
    if (trialSpend > 0) actionText += `<li><strong>${formatBRL(trialSpend)}</strong> vão para aquisição via Google;</li>`;
    if (organicFunding > 0) actionText += `<li><strong>${formatBRL(organicFunding)}</strong> são cobertos pelo crescimento orgânico;</li>`;
    actionText += `<li>mantenha <strong>${formatBRL(retainedDestination)}</strong> dentro da empresa;</li>`;

    if (safeProfit > 0) {
        actionText += `<li>você pode retirar até <strong>${formatBRL(safeProfit)}</strong> neste ciclo sem comprometer a meta de estabilidade nas premissas atuais do modelo.</li>`;
    } else {
        actionText += `<li>neste cenário, não retire caixa como lucro. O valor disponível está comprometido com aquisição, retenção ou proteção da base.</li>`;
    }
    actionText += `</ul>`;

    actionText += `<br>Com essa distribuição, a base operacional projetada vai de <strong>${Math.floor(stabilityTarget)}</strong> para <strong>${exactBaseEnd.toFixed(2).replace('.', ',')}</strong> profissionais no próximo ciclo.`;

    if (stabilityFundingDeficit > 0) {
        actionText += `<br><br><span style="color: #991b1b; font-weight: 600;">Mesmo usando o caixa disponível dessa forma, o cenário fica ${formatBRL(stabilityFundingDeficit)} abaixo da capacidade de financiamento necessária para preservar a base.</span><br>Antes de aportar dinheiro adicional, avalie reduzir CAC/CPL, churn ou aumentar aquisição orgânica.`;
    }

    let uncertaintyHtml = '';
    const hasProxyTrial = data.simulator?.trialConv?.type === 'PROXY';
    const hasAssumedChurn = data.simulator?.churn?.type === 'ASSUMED';
    const hasProxyCac = data.simulator?.cac?.type === 'PROXY';

    if (hasProxyTrial || hasAssumedChurn || hasProxyCac) {
        const listProxy = [];
        if (hasProxyTrial) listProxy.push("Trial = PROXY");
        if (hasAssumedChurn) listProxy.push("Churn = ASSUMED");
        if (hasProxyCac) listProxy.push("CAC = PROXY");

        uncertaintyHtml = `
            <div style="background: #fffbeb; color: #b45309; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 0.85rem; border-left: 4px solid #f59e0b;">
                <strong>Esta projeção usa algumas premissas estimadas.</strong> Use os valores como orientação de cenário, não como garantia. (${listProxy.join(', ')})
            </div>
        `;
    }

    const preAllocationHtml = `
        <details style="font-size: 0.85rem; color: #64748b; background: #f8fafc; padding: 12px; border-radius: 6px; cursor: pointer; border: 1px solid #e2e8f0; margin-top: 15px;">
            <summary style="font-weight: 600; color: #475569; outline: none;">Antes de distribuir o caixa</summary>
            <div style="margin-top: 10px; cursor: default; display: flex; flex-direction: column; gap: 5px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Receita contratual</span><span>${formatBRL(m1Diag.startingMrr)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>(-) Impostos</span><span>${formatBRL(m1Diag.taxes)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>(-) Gateway</span><span>${formatBRL(m1Diag.gatewayFees)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>(-) Custos Variáveis</span><span>${formatBRL(m1Diag.varOPEX)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>(-) Custos fixos</span><span>${formatBRL(p.fixedOPEX || 0)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>(-) Manutenção da demanda</span><span>${formatBRL(m1Diag.googleMaintenanceCost)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-weight: 700; color: #0f172a; margin-top: 5px; padding-top: 5px; border-top: 1px solid #e2e8f0;">
                    <span>Caixa disponível (Total)</span><span>${formatBRL(totalSources)}</span>
                </div>
            </div>
        </details>
    `;

    container.innerHTML = `
        <h3 style="font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
            <svg width="20" height="20" fill="none" stroke="#7e22ce" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            O que fazer agora
        </h3>

        <div style="margin-bottom: 15px; font-weight: 600; color: #475569; font-size: 1.05rem;">
            ${scenarioMsg}
        </div>

        ${uncertaintyHtml}

        <div style="background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 1rem; color: #334155; line-height: 1.6; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            ${actionText}
            ${preAllocationHtml}
        </div>
    `;
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
