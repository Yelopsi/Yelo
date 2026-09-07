async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
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
        console.log(`[CMO Debug] Iniciando busca de dados. Período: ${dateStart} até ${dateEnd}`);
        console.log(`[CMO Debug] Disparando requisição para: /api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`);
        
        const response = await fetch(`/api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`[CMO Debug] Resposta HTTP status: ${response.status}`);

        if (!response.ok) {
            let errorDetails = '';
            try {
                const errorJson = await response.json();
                errorDetails = errorJson.details || errorJson.error || JSON.stringify(errorJson);
                console.error('[CMO Debug] Erro do Servidor:', errorJson);
            } catch(err) {
                errorDetails = await response.text();
            }
            console.error('[CMO Debug] Falha ao buscar dados do CMO. Detalhes:', errorDetails);
            alert(`Falha na API CMO (Erro ${response.status}):\n${errorDetails.substring(0, 200)}`);
            document.getElementById('ai-decision-action').textContent = 'Erro de Conexão';
            document.getElementById('ai-decision-reason').textContent = 'Não foi possível carregar os dados. Veja o console (F12).';
            return;
        }

        const data = await response.json();
        console.log('[CMO Debug] Dados recebidos com sucesso:', data);
        
        if (data.success) {
            renderCMOMetrics(data);
        } else {
            console.error('[CMO Debug] Backend retornou success=false:', data);
            alert('A API respondeu com falha. Verifique o console.');
        }
    } catch (e) {
        console.error('[CMO Debug] Erro catastrófico na requisição CMO:', e);
        alert(`Erro Crítico: ${e.message}`);
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
