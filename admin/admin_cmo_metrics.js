async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    let dateStart = document.getElementById('cmo-date-start')?.value;
    let dateEnd = document.getElementById('cmo-date-end')?.value;

    if (!dateStart || !dateEnd) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        dateStart = fmt(start);
        dateEnd = fmt(now);
        
        if (document.getElementById('cmo-date-start')) document.getElementById('cmo-date-start').value = dateStart;
        if (document.getElementById('cmo-date-end')) document.getElementById('cmo-date-end').value = dateEnd;
    }
    
    // Tenta carregar dados manuais gravados no localStorage para a data atual
    if (typeof loadGoogleManualInputs === 'function') {
        loadGoogleManualInputs();
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
        } else {
            alert('A API respondeu com falha. Verifique o console.');
        }
    } catch (e) {
        console.error('💥 ERRO FATAL NO CMO DASHBOARD');
        console.error('Mensagem:', e.message);
        console.error('Stack:', e.stack);
        console.error('Erro completo:', e);
        alert(`Erro Crítico: ${e.message}`);
    }
}

function renderCMOMetrics(data) {
    const formatCurrency = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // 1. Atualizar KPIs Consolidados
    if (document.getElementById('cmo-total-spend')) document.getElementById('cmo-total-spend').textContent = formatCurrency(data.ads?.totalSpend);
    if (document.getElementById('cmo-total-paying')) document.getElementById('cmo-total-paying').textContent = data.platform?.pagantes || 0;
    if (document.getElementById('cmo-cac')) document.getElementById('cmo-cac').textContent = formatCurrency(data.platform.cac);
    if (document.getElementById('cmo-churn')) document.getElementById('cmo-churn').textContent = data.platform?.churned || 0;
    
    // Popula Cards da Inteligência Algorítmica (Funil B2B)
    if(document.getElementById('cmo-whatsapp-clicks')) {
        document.getElementById('cmo-whatsapp-clicks').textContent = data.platform.whatsappClicks || 0;
        document.getElementById('cmo-closed-deals').textContent = data.platform.closedDeals || 0;
        document.getElementById('cmo-trials').textContent = data.platform.trials || 0;
        document.getElementById('cmo-pagantes').textContent = data.platform.pagantes || 0;
        document.getElementById('cmo-churn').textContent = data.platform.churned || 0;
        document.getElementById('cmo-trial-to-paid').textContent = (data.platform.trialToPaid || 0) + '%';
        document.getElementById('cmo-ltv').textContent = formatCurrency(data.platform.ltv || 0);
        document.getElementById('cmo-ltvcac').textContent = (data.platform.ltvCacRatio || 0) + 'x';
    }

    // 2. Atualizar Motor de Decisão
    const actionEl = document.getElementById('ai-decision-action');
    const warningContainer = document.getElementById('ai-decision-warning-container');
    const warningEl = document.getElementById('ai-decision-warning');

    if (data.decisionEngine) {
        if(actionEl) {
            actionEl.textContent = data.decisionEngine.action;
            if (data.decisionEngine.action.includes('AUMENTAR')) {
                actionEl.style.color = '#10b981'; // Verde
            } else if (data.decisionEngine.action.includes('PAUSAR') || data.decisionEngine.action.includes('TETO') || data.decisionEngine.action.includes('INVESTIGAR')) {
                actionEl.style.color = '#ef4444'; // Vermelho
            } else {
                actionEl.style.color = '#f59e0b'; // Laranja
            }
        }

        if(document.getElementById('ai-decision-confidence')) document.getElementById('ai-decision-confidence').textContent = `Confiança: ${data.decisionEngine.confidence || 0}%`;
        if(document.getElementById('ai-target-cac')) document.getElementById('ai-target-cac').textContent = formatCurrency(data.decisionEngine.targetCac);
        if(document.getElementById('ai-scale-capacity')) document.getElementById('ai-scale-capacity').textContent = data.decisionEngine.scaleCapacity || '-';
        
        if(document.getElementById('ai-cac-trend')) {
            const trend = data.decisionEngine.cacTrend || 0;
            const trendEl = document.getElementById('ai-cac-trend');
            trendEl.textContent = `${trend > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(trend))}`;
            trendEl.style.color = trend > 0 ? '#ef4444' : '#10b981'; // Se aumentou o CAC, é ruim (vermelho)
        }

        if(document.getElementById('ai-marginal-cac')) document.getElementById('ai-marginal-cac').textContent = formatCurrency(data.platform?.marginalCac || 0);
        
        if(document.getElementById('ai-decision-recommendation')) {
            document.getElementById('ai-decision-recommendation').textContent = data.decisionEngine.recommendation || '';
        }

        if (data.decisionEngine.warning) {
            if(warningContainer) warningContainer.style.display = 'block';
            if(warningEl) warningEl.textContent = data.decisionEngine.warning;
        } else {
            if(warningContainer) warningContainer.style.display = 'none';
        }
    }

    // 3. Atualizar Tabela Comparativa de Canais
    const channelsTable = document.querySelector('#cmo-channels-table tbody');
    if (channelsTable && data.ads) {
        channelsTable.innerHTML = '';
        const canais = [
            {
                name: 'Google Ads',
                spend: data.ads.google?.spend || 0,
                trials: data.platform.google_trials || 0,
                pagantes: data.platform.google_pagantes || 0,
                cac: data.ads.google?.cac || 0,
                icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="color:#ea4335"><path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/></svg>'
            },
            {
                name: 'Meta Ads (FB/IG)',
                spend: data.ads.meta?.spend || 0,
                trials: data.platform.meta_trials || 0,
                pagantes: data.platform.meta_pagantes || 0,
                cac: data.ads.meta?.cac || 0,
                icon: '<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="color:#1877f2"><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/></svg>'
            }
        ];

        canais.forEach(c => {
            const tr = document.createElement('tr');
            const cpl = c.trials > 0 ? (c.spend / c.trials) : 0;
            tr.innerHTML = `
                <td style="display:flex; align-items:center; gap:8px; font-weight:600; color:#1e293b;">${c.icon} ${c.name}</td>
                <td style="text-align: right;">${formatCurrency(c.spend)}</td>
                <td style="text-align: right;">${c.trials.toLocaleString('pt-BR')}</td>
                <td style="text-align: right;">${c.pagantes.toLocaleString('pt-BR')}</td>
                <td style="text-align: right;">${formatCurrency(cpl)}</td>
                <td style="text-align: right; font-weight:bold; color:${c.cac > 0 ? '#0f172a' : '#94a3b8'};">${formatCurrency(c.cac)}</td>
            `;
            channelsTable.appendChild(tr);
        });
    }

    // 4. Atualizar Tabela de Campanhas Meta (Detalhada)
    const metaTable = document.querySelector('#cmo-meta-table tbody');
    if (metaTable) {
        metaTable.innerHTML = '';
        if (data.campaigns?.meta && data.campaigns.meta.length > 0) {
            data.campaigns.meta.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.campaign_name || c.id}</td>
                    <td style="text-align: right;">R$ ${(c.spend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td style="text-align: right;">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                    <td style="text-align: right;">${(c.conversions || 0).toLocaleString('pt-BR')}</td>
                `;
                metaTable.appendChild(tr);
            });
        } else {
            metaTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma campanha Meta encontrada no período.</td></tr>';
        }
    }

    // 4. Atualizar Tabela Google
    // A tabela do Google está em modo manual temporário (HTML estático).
    // O JS não sobrescreve os inputs do usuário.
}

// Funções para salvar e carregar os inputs manuais da tabela do Google
let saveGoogleTimeout;
async function saveGoogleManualInputs() {
    clearTimeout(saveGoogleTimeout);
    saveGoogleTimeout = setTimeout(async () => {
        const dateStart = document.getElementById('cmo-date-start')?.value;
        const dateEnd = document.getElementById('cmo-date-end')?.value;
        if (!dateStart || !dateEnd) return;
        
        // Formatar o spend para número (remove R$ e converte vírgula para ponto)
        let spendRaw = document.getElementById('google-manual-spend')?.value || '0';
        spendRaw = spendRaw.replace(/[^\d,-]/g, '').replace(',', '.');
        const spend = parseFloat(spendRaw) || 0;

        const payload = {
            dateStart,
            dateEnd,
            platform: 'google',
            campaignName: document.getElementById('google-manual-name')?.value || '',
            spend: spend,
            impressions: parseInt(document.getElementById('google-manual-impressions')?.value) || 0,
            clicks: parseInt(document.getElementById('google-manual-clicks')?.value) || 0,
            conversions: parseInt(document.getElementById('google-manual-conversions')?.value) || 0
        };
        
        try {
            await fetch('/api/cmo/manual-ads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) {
            console.error('Erro ao salvar inputs manuais no DB:', e);
        }
    }, 1000); // Debounce de 1s
}

async function loadGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    
    const nameEl = document.getElementById('google-manual-name');
    const spendEl = document.getElementById('google-manual-spend');
    const impEl = document.getElementById('google-manual-impressions');
    const clicksEl = document.getElementById('google-manual-clicks');
    const convEl = document.getElementById('google-manual-conversions');
    
    if (!nameEl) return;
    
    if (dateStart && dateEnd) {
        try {
            const res = await fetch(`/api/cmo/manual-ads?dateStart=${dateStart}&dateEnd=${dateEnd}&platform=google`);
            const json = await res.json();
            
            if (json.success && json.record) {
                const data = json.record;
                nameEl.value = data.campaignName || '';
                spendEl.value = `R$ ${(parseFloat(data.spend) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                impEl.value = data.impressions || '';
                clicksEl.value = data.clicks || '';
                convEl.value = data.conversions || '';
            } else {
                nameEl.value = ''; spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
            }
        } catch (e) {
            console.error('Erro ao buscar inputs manuais do DB:', e);
            nameEl.value = ''; spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
        }
    }
}

// Iniciar imediatamente para arquitetura SPA
loadCMOMetrics();
