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
        
        let reinvestRate = parseFloat(inputReinvestRate?.value) || 100;
        let extraCashStr = inputExtraCash?.value || '0';
        let extraCash = parseFloat(extraCashStr.replace(/\./g, '').replace(',', '.')) || 0;
        let curiosityGoal = parseInt(inputCuriosityGoal?.value) || null;
        
        const basePagantes = simTrackingStartSubs !== null ? simTrackingStartSubs : (data.platform.b2b.total_active || 0);
        const baseTrials = data.platform.b2b.total_trials || 0;
        
        const trialConversionRate = data.historical?.meta?.trial_conversion_rate || 0.15;
        const cacBase = data.historical?.meta?.cac || 150; 
        const arpu = data.platform?.b2b?.arpu || 99;

        // Discover days in period for organic gain and churn
        const dateStart = document.getElementById('cmo-date-start')?.value || '';
        const dateEnd = document.getElementById('cmo-date-end')?.value || '';
        const d1 = new Date(dateStart);
        const d2 = new Date(dateEnd);
        let daysInPeriodSim = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
        if (isNaN(daysInPeriodSim) || daysInPeriodSim <= 0) daysInPeriodSim = 30;

        let monthlyChurn = 0.05;
        if (data.platform.b2b.global_churn_rate > 0) {
            monthlyChurn = (data.platform.b2b.global_churn_rate / daysInPeriodSim) * 30;
        }

        const organicActive = data.platform.b2b.organic_active || 0;
        const organicActivePerMonth = (organicActive / daysInPeriodSim) * 30;

        const currentB2CCplCalc = data.historical?.google?.cpl > 0 
            ? data.historical?.google?.cpl 
            : (data.ads?.google?.cpl > 0 ? data.ads?.google?.cpl : 14.15);
            
        const organicWppClicks90dCalc = data.platform.b2c.organic_wpp_clicks_90d || 0;
        const orgMonthlyCalc = Math.floor(organicWppClicks90dCalc / 3);
        
        // Usa a correlação churn × cliques para definir o limiar real de engajamento
        // Prioridade: mediana de psis ATIVOS (mais robusto) → média de ativos → média do período → fallback 2
        const clicksVsChurn = data.platform.b2b.clicks_vs_churn || {};
        const activeClickData = clicksVsChurn.active;
        const inactiveClickData = clicksVsChurn.inactive;
        
        let targetContactsPerPsi;
        let contactsThresholdSource;
        
        if (activeClickData && parseFloat(activeClickData.median_clicks) >= 1) {
            // Melhor opção: mediana de psis que ficaram — elimina outliers que inflam a média
            targetContactsPerPsi = Math.round(parseFloat(activeClickData.median_clicks) * 10) / 10;
            contactsThresholdSource = `mediana 90d real (${activeClickData.psi_count} psis ativos)`;
        } else if (activeClickData && parseFloat(activeClickData.avg_clicks) >= 1) {
            // Segunda opção: média de psis que ficaram
            targetContactsPerPsi = Math.round(parseFloat(activeClickData.avg_clicks) * 10) / 10;
            contactsThresholdSource = `média 90d real (${activeClickData.psi_count} psis ativos)`;
        } else {
            // Fallback: média simples do período (wppClicks / psis ativos / meses)
            const totalWppClicks = data.platform.b2c.wpp_clicks || 0;
            const monthsInPeriod = daysInPeriodSim / 30;
            const periodAvg = (basePagantes > 0 && monthsInPeriod > 0)
                ? (totalWppClicks / basePagantes / monthsInPeriod)
                : 0;
            targetContactsPerPsi = periodAvg >= 1 ? Math.round(periodAvg * 10) / 10 : 2;
            contactsThresholdSource = periodAvg >= 1 ? 'média do período (sem correlação churn)' : 'estimativa padrão';
        }
        
        const psiSuggestedPerLead = 1;

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // Snowball Projection
        const targetMonths = 12; // Fixado em 12 meses
        const labels = [];
        const dataRevenue = [];
        const dataCosts = [];
        const dataCashflow = [];
        const dataExpectedBase = [];
        
        let currentBase = basePagantes;
        let currentTrials = baseTrials;
        
        let mrrAt12 = 0;
        let baseAt12 = 0;
        let metaBudgetAt12 = 0;
        let googleBudgetAt12 = 0;
        
        for (let m = 1; m <= targetMonths; m++) {
            // 1. Receita atual
            const monthlyRevenue = currentBase * arpu;
            
            // 2. Orçamento Google (Retenção) para manter a BASE ATUAL
            const baseContactsNeeded = currentBase * targetContactsPerPsi;
            // Assumimos que o orgânico atende primeiro a base atual
            const basePaidContactsNeeded = Math.max(0, baseContactsNeeded - orgMonthlyCalc);
            const baseGoogleBudget = Math.ceil(basePaidContactsNeeded / psiSuggestedPerLead) * currentB2CCplCalc;
            
            // 3. Fundo disponível para reinvestimento
            const reinvestmentFund = (monthlyRevenue * (reinvestRate / 100)) + extraCash;
            const availableForAcquisition = Math.max(0, reinvestmentFund - baseGoogleBudget);
            
            // 4. Cálculo do True CAC (Custo Meta + Custo Google dos Trials associados)
            const trialDurationFraction = 0.25; // Trial dura em média 7 dias
            const actualTrialConversionRate = trialConversionRate > 0 ? trialConversionRate : 0.15;
            const trialsPerPaidUser = 1 / actualTrialConversionRate;
            
            const googleCostPerTrial = trialDurationFraction * targetContactsPerPsi * (currentB2CCplCalc / psiSuggestedPerLead);
            const trueCac = cacBase + (trialsPerPaidUser * googleCostPerTrial);
            
            // 5. Compra de novos clientes
            const newPaidActive = Math.floor(availableForAcquisition / trueCac);
            const newTrialsBought = Math.floor(newPaidActive * trialsPerPaidUser);
            
            const metaBudget = newPaidActive * cacBase;
            const trialsGoogleBudget = newTrialsBought * googleCostPerTrial;
            const totalGoogleBudget = baseGoogleBudget + trialsGoogleBudget;
            
            const newOrganicActive = Math.floor(organicActivePerMonth);
            const churnLoss = Math.floor(currentBase * monthlyChurn);
            
            // 6. Atualização para o mês seguinte
            currentBase = currentBase + newOrganicActive + newPaidActive - churnLoss;
            currentTrials = newTrialsBought;
            
            labels.push(`Mês ${m}`);
            dataExpectedBase.push(currentBase);
            dataRevenue.push(monthlyRevenue);
            
            // O custo é o que de fato gastamos
            const totalCosts = metaBudget + totalGoogleBudget;
            dataCosts.push(totalCosts);
            dataCashflow.push(monthlyRevenue - totalCosts);
            
            if (m === 12) {
                mrrAt12 = monthlyRevenue;
                baseAt12 = currentBase;
                metaBudgetAt12 = metaBudget;
                googleBudgetAt12 = totalGoogleBudget;
            }
        }

        // Update Cards com textos contextuais
        const currentMrr = basePagantes * arpu;
        const mrrMultiple = (mrrAt12 / (currentMrr || 1)).toFixed(1);
        const mrrGainMonthly = mrrAt12 - currentMrr;
        document.getElementById('sim-res-mrr-12m').textContent = formatBRL(mrrAt12);
        document.getElementById('sim-res-mrr-feedback').textContent =
            `${mrrMultiple}x maior que hoje (${formatBRL(currentMrr)}/mês)`;
        
        const newSubs = Math.floor(baseAt12) - basePagantes;
        const avgPatientsPerPsi = targetContactsPerPsi || 2;
        const totalPatientsServed = Math.floor(baseAt12) * avgPatientsPerPsi;
        const subsEl = document.getElementById('sim-res-subs-12m');
        subsEl.textContent = Math.floor(baseAt12);
        // Subtitle do card-2 (parágrafo filho)
        const card2Sub = document.querySelector('#sim-card-2 p:last-child');
        if (card2Sub) card2Sub.textContent =
            `+${newSubs} novos psis. Juntos atenderão ~${totalPatientsServed.toLocaleString('pt-BR')} pacientes/mês.`;
        
        const metaDailyAt12 = metaBudgetAt12 / 30;
        document.getElementById('sim-res-meta-budget-12m').textContent = formatBRL(metaBudgetAt12);
        const card3Sub = document.querySelector('#sim-card-3 p:last-child');
        if (card3Sub) card3Sub.textContent =
            `≈ ${formatBRL(metaDailyAt12)}/dia disponíveis para comprar novos trials.`;
        
        const googlePctOfRevenue = mrrAt12 > 0 ? ((googleBudgetAt12 / mrrAt12) * 100).toFixed(0) : 0;
        const googleDailyAt12 = googleBudgetAt12 / 30;
        document.getElementById('sim-res-google-budget-12m').textContent = formatBRL(googleBudgetAt12);
        const card4Sub = document.querySelector('#sim-card-4 p:last-child');
        if (card4Sub) card4Sub.textContent =
            `≈ ${formatBRL(googleDailyAt12)}/dia · limiar: ${targetContactsPerPsi} cliques/psi (${contactsThresholdSource}).`;
        
        const warningEl = document.getElementById('sim-res-warning');
        warningEl.style.display = 'block';

        if (metaBudgetAt12 <= 0) {
            warningEl.style.backgroundColor = '#fef2f2';
            warningEl.style.color = '#991b1b';
            warningEl.innerHTML = `⚠️ <b>Atenção:</b> A sua taxa de reinvestimento (${reinvestRate}%) não é suficiente nem para pagar a Retenção no Google Ads. O Motor de Crescimento travou. Aumente a taxa ou o Aporte Adicional!`;
        } else {
            warningEl.style.backgroundColor = '#f0fdfa';
            warningEl.style.color = '#0f766e';
            warningEl.innerHTML = `✅ <b>Motor Girando:</b> Em 12 meses, você sairá de ${basePagantes} para ${Math.floor(baseAt12)} assinantes investindo apenas a receita gerada pela própria máquina.`;
        }

        // Action Plan
        const actionPlanContainer = document.getElementById('sim-action-plan');
        const actionList = document.getElementById('sim-action-list');
        if (actionPlanContainer && actionList) {
            actionPlanContainer.style.display = 'block';
            actionList.innerHTML = '';
            
            const currentMetaDailyBudget = data.ads?.meta?.configuredDailyBudget || 0;
            const currentDailyGoogle = data.ads?.google?.configuredDailyBudget || 0;
            
            // Calculate M1 exact budgets using the TrueCAC logic
            const m1Revenue = basePagantes * arpu;
            
            const baseContactsNeeded1 = basePagantes * targetContactsPerPsi;
            const basePaidContactsNeeded1 = Math.max(0, baseContactsNeeded1 - orgMonthlyCalc);
            const baseGoogleBudget1 = Math.ceil(basePaidContactsNeeded1 / psiSuggestedPerLead) * currentB2CCplCalc;
            
            const reinvestmentFundM1 = (m1Revenue * (reinvestRate / 100)) + extraCash;
            const availableForAcquisition1 = Math.max(0, reinvestmentFundM1 - baseGoogleBudget1);
            
            const trialDurationFraction1 = 0.25;
            const actualTrialConversionRate1 = trialConversionRate > 0 ? trialConversionRate : 0.15;
            const trialsPerPaidUser1 = 1 / actualTrialConversionRate1;
            
            const googleCostPerTrial1 = trialDurationFraction1 * targetContactsPerPsi * (currentB2CCplCalc / psiSuggestedPerLead);
            const trueCac1 = cacBase + (trialsPerPaidUser1 * googleCostPerTrial1);
            
            const newPaidActive1 = Math.floor(availableForAcquisition1 / trueCac1);
            const newTrialsBought1 = Math.floor(newPaidActive1 * trialsPerPaidUser1);
            
            const metaBudgetM1 = newPaidActive1 * cacBase;
            const trialsGoogleBudget1 = newTrialsBought1 * googleCostPerTrial1;
            const googleBudgetM1 = baseGoogleBudget1 + trialsGoogleBudget1;
            
            const targetMetaDaily = metaBudgetM1 / 30;
            const targetGoogleDaily = googleBudgetM1 / 30;
            
            let metaAction = '';
            if (targetMetaDaily <= currentMetaDailyBudget) {
                metaAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu orçamento diário configurado no Meta hoje é de <strong>${formatBRL(currentMetaDailyBudget)}</strong>. Pela sua taxa de reinvestimento, o orçamento máximo saudável para este mês é de <strong>${formatBRL(targetMetaDaily)}/dia</strong>.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>DIMINUA</strong> sua configuração diária no Meta agora mesmo para otimizar seus custos e respeitar o motor de crescimento.`;
            } else {
                metaAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu orçamento diário configurado no Meta hoje é de <strong>${formatBRL(currentMetaDailyBudget)}</strong>. Pela sua taxa de reinvestimento, você tem caixa para subir até <strong>${formatBRL(targetMetaDaily)}/dia</strong> este mês.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>AUMENTE</strong> a sua configuração diária no Meta até bater o teto do seu orçamento deste mês.`;
            }

            let googleAction = '';
            if (targetGoogleDaily === 0) {
                googleAction = `<br>🔍 <strong>Diagnóstico:</strong> O tráfego orgânico (SEO) já é mais que suficiente para gerar pacientes para toda a sua base atual.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>DESLIGUE OU DIMINUA AO MÁXIMO</strong> o Google Ads.`;
            } else if (currentDailyGoogle < targetGoogleDaily) {
                googleAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu Google Ads está configurado para <strong>${formatBRL(currentDailyGoogle)}/dia</strong>, mas a sua máquina (base atual + novos trials) exige <strong>${formatBRL(targetGoogleDaily)}/dia</strong>.<br><br>💡 <strong>Ação Recomendada:</strong> <strong>AUMENTE a diária agora</strong> para reter seus psicólogos.`;
            } else {
                googleAction = `<br>🔍 <strong>Diagnóstico:</strong> O seu Google Ads está configurado para <strong>${formatBRL(currentDailyGoogle)}/dia</strong>, porém sua máquina exige apenas <strong>${formatBRL(targetGoogleDaily)}/dia</strong>. Você está superinvestindo!<br><br>💡 <strong>Ação Recomendada:</strong> <strong>DIMINUA IMEDIATAMENTE</strong> a diária para acompanhar a sua demanda real.`;
            }

            let roiAction = '';
            if (extraCash > 0) {
                roiAction = `<br>🔍 <strong>Diagnóstico:</strong> Você configurou um aporte extra de <strong>${formatBRL(extraCash)}/mês</strong> do próprio bolso.<br><br>💡 <strong>Ação Recomendada:</strong> Certifique-se de que esse caixa está provisionado e disponível para cobrir os anúncios.`;
            } else {
                roiAction = `<br>🔍 <strong>Diagnóstico:</strong> Você está operando 100% Bootstrap.<br><br>💡 <strong>Ação Recomendada:</strong> Operação autossustentável. Todo o investimento em anúncios sairá do próprio faturamento gerado.`;
            }

            actionList.innerHTML = `
                <li><strong>Meta Ads (Aquisição):</strong> ${metaAction}</li>
                <br>
                <li><strong>Google Ads (Retenção):</strong> ${googleAction}</li>
                <br>
                <li><strong>Lucratividade (ROI Geral):</strong> ${roiAction}</li>
            `;
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

    const ctx = document.getElementById('cmo-weekly-chart').getContext('2d');
    if (window.cmoWeeklyChartInstance) {
        window.cmoWeeklyChartInstance.destroy();
    }

    const metaCac = data.ads?.meta?.cac || 0;
    const metaTrend = data.decisionEngineMeta?.trend || 0;
    const prevMetaCac = metaCac - metaTrend;

    const googleCpl = data.ads?.google?.cpl || 0;
    const googleTrend = data.decisionEngineGoogle?.trend || 0;
    const prevGoogleCpl = googleCpl - googleTrend;

    window.cmoWeeklyChartInstance = new Chart(ctx, {
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
