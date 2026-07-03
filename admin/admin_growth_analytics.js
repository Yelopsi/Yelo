var chartCumulativoInstance = window.chartCumulativoInstance || null;
var chartPeriodoInstance = window.chartPeriodoInstance || null;
var currentStartDate = window.currentStartDate || '';
var currentEndDate = window.currentEndDate || '';

// Define os valores padrão para o mês atual, se ainda não definidos
if (!currentStartDate || !currentEndDate) {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    currentStartDate = trintaDiasAtras.toISOString().split('T')[0];
    currentEndDate = hoje.toISOString().split('T')[0];
}

// Configura os inputs
document.getElementById('filter-start-date').value = currentStartDate;
document.getElementById('filter-end-date').value = currentEndDate;

carregarDados();

function aplicarFiltroData() {
    const start = document.getElementById('filter-start-date').value;
    const end = document.getElementById('filter-end-date').value;
    
    if (start && end) {
        currentStartDate = start;
        currentEndDate = end;
        carregarDados();
    } else {
        alert("Por favor, selecione as duas datas.");
    }
}

async function carregarDados() {
    try {
        const response = await fetch(`/api/admin/analytics/growth?startDate=${currentStartDate}&endDate=${currentEndDate}`);
        if (!response.ok) throw new Error('Erro ao buscar dados de crescimento');
        const data = await response.json();

        atualizarKPIs(data.kpis);
        renderizarGraficoCumulativo(data.graficos);
        renderizarGraficoPeriodo(data.graficos);
        atualizarMacroFinanceiro(data);

    } catch (error) {
        console.error("Erro:", error);
        alert("Não foi possível carregar os dados de crescimento.");
    }
}

function formatarMoeda(valor) {
    return `R$ ${parseFloat(valor || 0).toFixed(2).replace('.', ',')}`;
}

function atualizarMacroFinanceiro(data) {
    if (!data.finance) return;
    
    document.getElementById('macro-mrr').textContent = formatarMoeda(data.finance.mrr);
    document.getElementById('macro-custos').textContent = formatarMoeda(data.finance.expenses);
    
    const kpiLucro = document.getElementById('macro-lucro');
    kpiLucro.textContent = formatarMoeda(data.finance.profit);
    if (data.finance.profit < 0) {
        kpiLucro.style.color = '#ef4444';
    } else {
        kpiLucro.style.color = '#3b82f6';
    }

    // Calcular CAC Estimado
    // Pegamos a quantidade de novos pagantes do período selecionado
    const graficos = data.graficos;
    let totalNovosPagantes = 0;
    if (graficos && graficos.entrantes && graficos.entrantes.pagantes) {
        totalNovosPagantes = graficos.entrantes.pagantes.reduce((a, b) => a + parseInt(b), 0);
    }
    
    if (totalNovosPagantes > 0) {
        const cac = data.finance.expenses / totalNovosPagantes;
        document.getElementById('macro-cac').textContent = formatarMoeda(cac);
    } else {
        document.getElementById('macro-cac').textContent = data.finance.expenses > 0 ? 'Sem Pagantes' : formatarMoeda(0);
    }
}

function atualizarKPIs(kpis) {
    document.getElementById('kpi-trials').textContent = kpis.total_trials || 0;
    document.getElementById('kpi-pagantes').textContent = kpis.total_pagantes || 0;
    document.getElementById('kpi-conversao').textContent = (kpis.conversao_pagantes || 0) + '%';
    document.getElementById('kpi-churn').textContent = kpis.total_churn || 0;
    document.getElementById('kpi-taxa-churn').textContent = `Taxa de Churn: ${kpis.taxa_churn || 0}%`;
}

function renderizarGraficoCumulativo(graficos) {
    const ctx = document.getElementById('chartCumulativo').getContext('2d');
    
    if (chartCumulativoInstance) {
        chartCumulativoInstance.destroy();
    }

    // A função mapDataToDataset() vai lidar com a exibição de acordo com as checkboxes.
    // Usamos 'hidden' no dataset e associamos uma id de checkbox correspondente, e criaremos a função update.
    const isChecked = (id) => {
        const el = document.getElementById(id);
        return el ? el.checked : true;
    };
    
    // Fallback de segurança caso o deploy do backend ainda não tenha finalizado e retorne a estrutura antiga
    const dadosGrafico = graficos.periodo || graficos.cumulativo || {};

    chartCumulativoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graficos.labels,
            datasets: [
                {
                    label: 'Pagantes (Período)',
                    data: dadosGrafico.pagantes || [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    hidden: !isChecked('togglePagantes')
                },
                {
                    label: 'Trials Ativos (Período)',
                    data: dadosGrafico.trialsAtivos || dadosGrafico.trials || [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    hidden: !isChecked('toggleTrialsAtivos')
                },
                {
                    label: 'Trials Expirados (Período)',
                    data: dadosGrafico.trialsExpirados || [],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    hidden: !isChecked('toggleTrialsExpirados')
                },
                {
                    label: 'Churn (Período)',
                    data: dadosGrafico.churn || [],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    hidden: !isChecked('toggleChurn')
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                y: { beginAtZero: true, stacked: false }
            }
        }
    });
}

window.updateCumulativoVisibility = function() {
    if (!chartCumulativoInstance) return;
    
    const pagantes = document.getElementById('togglePagantes').checked;
    const trialsAtivos = document.getElementById('toggleTrialsAtivos').checked;
    const trialsExpirados = document.getElementById('toggleTrialsExpirados').checked;
    const churn = document.getElementById('toggleChurn').checked;
    
    chartCumulativoInstance.data.datasets[0].hidden = !pagantes;
    chartCumulativoInstance.data.datasets[1].hidden = !trialsAtivos;
    chartCumulativoInstance.data.datasets[2].hidden = !trialsExpirados;
    chartCumulativoInstance.data.datasets[3].hidden = !churn;
    
    chartCumulativoInstance.update();
};

function renderizarGraficoPeriodo(graficos) {
    const ctx = document.getElementById('chartPeriodo').getContext('2d');
    
    if (chartPeriodoInstance) {
        chartPeriodoInstance.destroy();
    }

    chartPeriodoInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: graficos.labels,
            datasets: [
                {
                    label: 'Novos Pagantes',
                    data: graficos.entrantes.pagantes,
                    backgroundColor: '#10b981',
                    borderRadius: 4
                },
                {
                    label: 'Novos Trials',
                    data: graficos.entrantes.trials,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                },
                {
                    type: 'line',
                    label: 'Churn (Perda)',
                    data: graficos.entrantes.churn,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: true, stacked: true },
                x: { stacked: true }
            }
        }
    });
}
