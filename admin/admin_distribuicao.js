let globalPsyData = [];
let currentSort = { column: 'fairnessScore', desc: true };

window.initializePage = function() {
    globalPsyData = [];
    currentSort = { column: 'fairnessScore', desc: true };


    // Definir data padrão (últimos 30 dias)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('filter-end').value = today.toISOString().split('T')[0];
    document.getElementById('filter-start').value = thirtyDaysAgo.toISOString().split('T')[0];

    document.getElementById('btn-update').addEventListener('click', fetchData);

    // Eventos de Sorting
    document.querySelectorAll('#table-visibility th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (currentSort.column === col) {
                currentSort.desc = !currentSort.desc;
            } else {
                currentSort.column = col;
                currentSort.desc = true;
            }
            renderTable();
        });
    });

    // Iniciar carga
    fetchData();
};

async function fetchData() {
    const btn = document.getElementById('btn-update');
    btn.innerHTML = 'Carregando...';
    btn.disabled = true;

    try {
        const start = document.getElementById('filter-start').value;
        const end = document.getElementById('filter-end').value;
        const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
        const url = `${API_BASE_URL}/api/admin/analytics/visibility?startDate=${start}&endDate=${end}`;

        const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Falha ao buscar dados');

        const data = await response.json();
        
        // Atualizar KPIs
        document.getElementById('kpi-demand').textContent = data.metrics.totalDemand;
        document.getElementById('kpi-psys').textContent = data.metrics.activePsyCount;
        document.getElementById('kpi-capacity').textContent = data.metrics.idealCapacity;
        document.getElementById('kpi-velocity').textContent = data.metrics.avgVelocity;

        // Atualizar Suggestion Box
        const suggBox = document.getElementById('suggestion-box');
        suggBox.className = `suggestion-box suggestion-${data.alertLevel}`;
        let emoji = '🤖';
        if(data.alertLevel === 'warning') emoji = '🚨';
        if(data.alertLevel === 'danger') emoji = '🔥';
        if(data.alertLevel === 'success') emoji = '✅';
        
        suggBox.innerHTML = `<span style="font-size: 1.8rem;">${emoji}</span><div>${data.suggestion}</div>`;

        globalPsyData = data.psychologists;
        renderTable();

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar os dados de visibilidade.');
    } finally {
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.09l5.67-5.67"/></svg> Atualizar`;
        btn.disabled = false;
    }
}

function renderTable() {
    const tbody = document.getElementById('tbody-visibility');
    if (!globalPsyData || globalPsyData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;">Nenhum profissional ativo encontrado.</td></tr>';
        return;
    }

    // Sort
    const sorted = [...globalPsyData].sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentSort.desc ? 1 : -1;
        if (valA > valB) return currentSort.desc ? -1 : 1;
        return 0;
    });

    tbody.innerHTML = sorted.map(p => {
        let fairnessBadge = '';
        if (p.fairnessScore > 150) {
            fairnessBadge = `<span class="badge badge-high">Monopolizando (${p.fairnessScore}%)</span>`;
        } else if (p.fairnessScore < 50) {
            fairnessBadge = `<span class="badge badge-low">Baixa (${p.fairnessScore}%)</span>`;
        } else {
            fairnessBadge = `<span class="badge badge-fair">Equilibrado (${p.fairnessScore}%)</span>`;
        }

        return `
            <tr>
                <td style="font-weight: 500;">
                    ${p.nome}<br>
                    <span style="font-size:0.8rem; color:#888;">${p.diasAtivo} dias na Yelo</span>
                </td>
                <td>${p.matches}</td>
                <td>${p.visualizacoes}</td>
                <td>${p.whatsapp_clicks}</td>
                <td>${p.conversando}</td>
                <td><strong style="color: var(--verde-escuro);">${p.conversoes}</strong></td>
                <td>${fairnessBadge}</td>
            </tr>
        `;
    }).join('');
}
