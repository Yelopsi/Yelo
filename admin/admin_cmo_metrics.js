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
    // 1. Atualizar KPIs Consolidados
    if (document.getElementById('cmo-total-spend')) document.getElementById('cmo-total-spend').textContent = `R$ ${(data.ads?.totalSpend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (document.getElementById('cmo-total-paying')) document.getElementById('cmo-total-paying').textContent = data.platform?.pagantes || 0;
    if (document.getElementById('cmo-cac')) document.getElementById('cmo-cac').textContent = `R$ ${(data.platform?.cac || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (document.getElementById('cmo-churn')) document.getElementById('cmo-churn').textContent = data.platform?.churned || 0;

    // 2. Atualizar Motor de Decisão
    const actionEl = document.getElementById('ai-decision-action');
    if (actionEl && data.decisionEngine) {
        actionEl.textContent = data.decisionEngine.action;
        if (data.decisionEngine.action.includes('AUMENTAR')) {
            actionEl.style.color = '#10b981'; // Verde
        } else if (data.decisionEngine.action.includes('PAUSAR') || data.decisionEngine.action.includes('DIMINUIR')) {
            actionEl.style.color = '#ef4444'; // Vermelho
        } else {
            actionEl.style.color = '#f59e0b'; // Laranja
        }
    }
    
    if (document.getElementById('ai-decision-reason') && data.decisionEngine) {
        document.getElementById('ai-decision-reason').textContent = data.decisionEngine.reason;
    }

    // 3. Atualizar Tabela Meta
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
function saveGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    if (!dateStart || !dateEnd) return;
    
    const data = {
        name: document.getElementById('google-manual-name')?.value || '',
        spend: document.getElementById('google-manual-spend')?.value || '',
        impressions: document.getElementById('google-manual-impressions')?.value || '',
        clicks: document.getElementById('google-manual-clicks')?.value || '',
        conversions: document.getElementById('google-manual-conversions')?.value || ''
    };
    
    const key = `cmo_google_manual_${dateStart}_${dateEnd}`;
    localStorage.setItem(key, JSON.stringify(data));
}

function loadGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    
    const nameEl = document.getElementById('google-manual-name');
    const spendEl = document.getElementById('google-manual-spend');
    const impEl = document.getElementById('google-manual-impressions');
    const clicksEl = document.getElementById('google-manual-clicks');
    const convEl = document.getElementById('google-manual-conversions');
    
    if (!nameEl) return;
    
    if (dateStart && dateEnd) {
        const key = `cmo_google_manual_${dateStart}_${dateEnd}`;
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                nameEl.value = data.name || '';
                spendEl.value = data.spend || '';
                impEl.value = data.impressions || '';
                clicksEl.value = data.clicks || '';
                convEl.value = data.conversions || '';
            } catch (e) {
                nameEl.value = ''; spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
            }
        } else {
            nameEl.value = ''; spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
        }
    }
}

// Iniciar imediatamente para arquitetura SPA
loadCMOMetrics();
