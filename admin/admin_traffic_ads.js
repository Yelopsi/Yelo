document.addEventListener('DOMContentLoaded', () => {
    loadEfficiencyData();
    loadB2BLeads();
    loadB2CLeads();
});

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
    };
}

const API_BASE = window.API_BASE_URL || 'https://www.yelopsi.com.br';

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/D';
    return new Date(dateString).toLocaleDateString('pt-BR');
}

// 1. EFICIÊNCIA GLOBAL E GRÁFICOS
async function loadEfficiencyData() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/efficiency`, { headers: getHeaders() });
        const data = await res.json();

        if (data.weeklyHistory && data.weeklyHistory.length > 0) {
            const lastWeek = data.weeklyHistory[data.weeklyHistory.length - 1];
            
            document.getElementById('kpi-cpl').innerText = formatBRL(lastWeek.cpl);
            document.getElementById('kpi-cac').innerText = formatBRL(lastWeek.cac);
            
            const totalSpend = parseFloat(lastWeek.meta_ads || 0) + parseFloat(lastWeek.google_ads || 0);
            document.getElementById('kpi-spend').innerText = formatBRL(totalSpend);
            
            // Renderizar gráficos
            renderCharts(data.weeklyHistory);
            
            // Insight
            const lastInsight = data.insight || 'Nenhum insight gerado recentemente.';
            document.getElementById('ai-insight').innerHTML = `<h3>✨ Analisando eficiência das campanhas...</h3>${lastInsight}`;
        }
    } catch (e) {
        console.error("Erro ao carregar dados de eficiência:", e);
    }
}

function renderCharts(history) {
    // Ultimas 4 a 6 semanas pra nao poluir
    const recentHistory = history.slice(-6);
    
    const labels = recentHistory.map(h => {
        const d = new Date(h.week_start);
        d.setDate(d.getDate() + 1); // fix timezone visual
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    const cplData = recentHistory.map(h => h.cpl);
    const cacData = recentHistory.map(h => h.cac);

    const ctxCost = document.getElementById('costChart').getContext('2d');
    new Chart(ctxCost, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'CPL (Custo por Trial)', data: cplData, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'CAC (Custo por Pagante)', data: cacData, borderColor: '#ef4444', tension: 0.3, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const metaTrials = recentHistory.map(h => h.meta_trials || 0);
    const googleTrials = recentHistory.map(h => h.google_trials || 0);

    const ctxChannel = document.getElementById('channelChart').getContext('2d');
    new Chart(ctxChannel, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Trials Meta Ads', data: metaTrials, backgroundColor: '#1d4ed8' },
                { label: 'Trials Google Ads', data: googleTrials, backgroundColor: '#dc2626' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });
}

// 2. LEADS B2B (PSICÓLOGOS)
async function loadB2BLeads() {
    const status = document.getElementById('filter-b2b-status').value;
    const channel = document.getElementById('filter-b2b-channel').value;
    
    document.querySelector('#table-b2b tbody').innerHTML = '<tr><td colspan="4">Carregando psicólogos...</td></tr>';
    
    try {
        let url = `${API_BASE}/api/admin/psychologists?limit=50`;
        if (status !== 'all') url += `&status=${status}`;
        if (channel !== 'all') url += `&status=${channel}`; // O backend usa status para filtros de UTM tb

        const res = await fetch(url, { headers: getHeaders() });
        const json = await res.json();
        
        let html = '';
        if (json.data && json.data.length > 0) {
            json.data.forEach(psi => {
                const badgeUtm = getUtmBadge(psi.utm_source);
                const badgeStatus = getPsiStatusBadge(psi);
                
                html += `
                    <tr>
                        <td><strong>${psi.nome.replace(/\[.*?\] /, '')}</strong><br><span style="font-size:0.75rem; color:#64748b;">${psi.email}</span></td>
                        <td>${formatDate(psi.createdAt)}</td>
                        <td>${badgeStatus}</td>
                        <td>${badgeUtm}<br><span style="font-size:0.75rem; color:#64748b;">Médium: ${psi.utm_medium || 'N/D'} | Campanha: ${psi.utm_campaign || 'N/D'}</span></td>
                    </tr>
                `;
            });
        } else {
            html = '<tr><td colspan="4">Nenhum psicólogo encontrado para este filtro.</td></tr>';
        }
        document.querySelector('#table-b2b tbody').innerHTML = html;
        
    } catch (e) {
        console.error(e);
        document.querySelector('#table-b2b tbody').innerHTML = '<tr><td colspan="4">Erro ao carregar psicólogos.</td></tr>';
    }
}

// 3. LEADS B2C (PACIENTES)
async function loadB2CLeads() {
    const channel = document.getElementById('filter-b2c-channel').value;
    
    document.querySelector('#table-b2c tbody').innerHTML = '<tr><td colspan="3">Carregando pacientes...</td></tr>';
    
    try {
        let url = `${API_BASE}/api/admin/patients?limit=50`;
        if (channel !== 'all') url += `&status=${channel}`;

        const res = await fetch(url, { headers: getHeaders() });
        const json = await res.json();
        
        let html = '';
        if (json.data && json.data.length > 0) {
            json.data.forEach(pat => {
                const badgeUtm = getUtmBadge(pat.utm_source);
                
                html += `
                    <tr>
                        <td><strong>${pat.nome.replace(/\[.*?\] /, '')}</strong><br><span style="font-size:0.75rem; color:#64748b;">${pat.email}</span></td>
                        <td>${formatDate(pat.createdAt)}</td>
                        <td>${badgeUtm}<br><span style="font-size:0.75rem; color:#64748b;">Médium: ${pat.utm_medium || 'N/D'} | Campanha: ${pat.utm_campaign || 'N/D'}</span></td>
                    </tr>
                `;
            });
        } else {
            html = '<tr><td colspan="3">Nenhum paciente encontrado para este filtro.</td></tr>';
        }
        document.querySelector('#table-b2c tbody').innerHTML = html;
        
    } catch (e) {
        console.error(e);
        document.querySelector('#table-b2c tbody').innerHTML = '<tr><td colspan="3">Erro ao carregar pacientes.</td></tr>';
    }
}

function getUtmBadge(source) {
    if (!source) return '<span class="badge badge-organic">Direto / Orgânico</span>';
    const s = source.toLowerCase();
    if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return '<span class="badge badge-meta">Meta Ads</span>';
    if (s.includes('google')) return '<span class="badge badge-google">Google Ads</span>';
    return `<span class="badge badge-organic">${source}</span>`;
}

function getPsiStatusBadge(psi) {
    // 14 dias de acesso grátis:
    if (psi.status === 'pending' || !psi.isProfileAnalyzed) {
        return '<span class="badge badge-pending">Perfil Incompleto (Pendente)</span>';
    }
    
    const hasSub = !!(psi.subscriptionId);
    if (psi.status === 'active' && hasSub) {
        return `<span class="badge badge-active">Assinante (${psi.plano || '?'})</span>`;
    }
    
    if (psi.status === 'active' && !hasSub && new Date(psi.planExpiresAt) > new Date()) {
        return '<span class="badge badge-trial">Em Trial (14 dias grátis)</span>';
    }
    
    return '<span class="badge badge-inactive">Cancelado / Expirado</span>';
}
