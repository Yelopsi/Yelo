const token = localStorage.getItem('Yelo_token');
if (!token) {
    window.location.href = '/login';
}

async function loadCMOMetrics() {
    const month = document.getElementById('cmo-month-selector').value;
    
    // Calcula datas simplificadas
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
            console.error('Falha ao buscar dados do CMO.');
            return;
        }

        const data = await response.json();
        if (data.success) {
            renderCMOMetrics(data);
        }
    } catch (e) {
        console.error('Erro na requisição CMO:', e);
    }
}

function renderCMOMetrics(data) {
    // 1. Atualizar KPIs Consolidados
    document.getElementById('cmo-total-spend').textContent = `R$ ${data.ads.totalSpend.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('cmo-total-paying').textContent = data.platform.pagantes;
    document.getElementById('cmo-cac').textContent = `R$ ${data.platform.cac.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('cmo-churn').textContent = data.platform.churned;

    // 2. Atualizar Motor de Decisão
    const actionEl = document.getElementById('ai-decision-action');
    actionEl.textContent = data.decisionEngine.action;
    
    if (data.decisionEngine.action.includes('AUMENTAR')) {
        actionEl.style.color = '#10b981'; // Verde
    } else if (data.decisionEngine.action.includes('PAUSAR') || data.decisionEngine.action.includes('DIMINUIR')) {
        actionEl.style.color = '#ef4444'; // Vermelho
    } else {
        actionEl.style.color = '#f59e0b'; // Laranja
    }
    
    document.getElementById('ai-decision-reason').textContent = data.decisionEngine.reason;

    // 3. Atualizar Tabela Meta
    const metaTable = document.querySelector('#cmo-meta-table tbody');
    metaTable.innerHTML = '';
    if (data.campaigns.meta && data.campaigns.meta.length > 0) {
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

    // 4. Atualizar Tabela Google
    const googleTable = document.querySelector('#cmo-google-table tbody');
    googleTable.innerHTML = '';
    if (data.campaigns.google && data.campaigns.google.length > 0) {
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

// Iniciar
document.addEventListener('DOMContentLoaded', () => {
    loadCMOMetrics();
});
