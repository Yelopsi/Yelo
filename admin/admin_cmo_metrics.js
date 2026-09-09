async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    const month = document.getElementById('cmo-month-selector')?.value || 'current';
    
    const now = new Date();
    let dateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    let dateEnd = new Date().toISOString().split('T')[0];

    if (month === 'last') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        dateStart = firstDayLastMonth.toISOString().split('T')[0];
        dateEnd = lastDayLastMonth.toISOString().split('T')[0];
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
                `;
                metaTable.appendChild(tr);
            });
        } else {
            metaTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma campanha Meta encontrada no período.</td></tr>';
        }
    }

    // 4. Atualizar Tabela Google
    const googleTable = document.querySelector('#cmo-google-table tbody');
    if (googleTable) {
        googleTable.innerHTML = '';
        if (data.campaigns?.google && data.campaigns.google.length > 0) {
            data.campaigns.google.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.campaign_name || c.id}</td>
                    <td style="text-align: right;">R$ ${(c.spend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td style="text-align: right;">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                `;
                googleTable.appendChild(tr);
            });
        } else {
            googleTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma campanha Google encontrada no período.</td></tr>';
        }
    }
}

// Iniciar imediatamente para arquitetura SPA
loadCMOMetrics();
