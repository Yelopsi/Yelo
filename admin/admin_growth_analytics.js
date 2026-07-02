let chartCumulativoInstance = null;
let chartPeriodoInstance = null;
let currentStartDate = '';
let currentEndDate = '';

document.addEventListener('DOMContentLoaded', () => {
    // Define os valores padrão para o mês atual
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    currentStartDate = trintaDiasAtras.toISOString().split('T')[0];
    currentEndDate = hoje.toISOString().split('T')[0];
    
    document.getElementById('filter-start-date').value = currentStartDate;
    document.getElementById('filter-end-date').value = currentEndDate;

    carregarDados();
});

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

    chartCumulativoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: graficos.labels,
            datasets: [
                {
                    label: 'Pagantes (Acumulado)',
                    data: graficos.cumulativo.pagantes,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Trials (Acumulado)',
                    data: graficos.cumulativo.trials,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3
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
