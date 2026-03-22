function initializeAnalyticsPage() {
    console.log("Página de Métricas & Mercado inicializada.");

    // Mock de dados, pois não temos os endpoints do backend.
    // Em um cenário real, estes dados viriam de chamadas fetch().
    const mockData = {
        priceComparison: {
            myPrice: 150,
            cityAverage: 135,
            platformAverage: 145,
        },
        topTopics: [
            { topic: 'Ansiedade', count: 120 },
            { topic: 'Relacionamentos', count: 95 },
            { topic: 'Autoconhecimento', count: 80 },
            { topic: 'Depressão', count: 75 },
            { topic: 'Carreira', count: 60 },
        ],
        visibility: {
            labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'Ontem', 'Hoje'],
            appearances: [25, 30, 22, 40, 35, 50, 48],
        },
        profileStrength: {
            myScores: [8, 9, 7, 8, 9], // Completude, Avaliações, Engajamento, Publicações, Tempo de Resposta
            averageScores: [7, 6, 6, 5, 7],
        }
    };

    // Renderiza todos os gráficos com os dados mockados
    renderPriceChart(mockData.priceComparison);
    renderTopTopicsChart(mockData.topTopics);
    renderVisibilityChart(mockData.visibility);
    renderProfileStrengthChart(mockData.profileStrength);
}

function renderPriceChart(data) {
    const ctx = document.getElementById('priceComparisonChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Seu Valor', 'Média (Cidade)', 'Média (Plataforma)'],
            datasets: [{
                label: 'Valor da Sessão (R$)',
                data: [data.myPrice, data.cityAverage, data.platformAverage],
                backgroundColor: [
                    '#1B4332', // Verde Yelo
                    '#FFEE8C', // Amarelo Yelo
                    '#adb5bd'  // Cinza
                ],
                borderRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Comparativo de Preços' }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: value => `R$ ${value}` } }
            }
        }
    });

    const analysisText = document.getElementById('price-analysis-text');
    if (analysisText) {
        if (data.myPrice < data.cityAverage) {
            analysisText.innerHTML = `💡 Seu valor está <strong>abaixo da média</strong> da sua cidade, o que pode atrair mais pacientes em busca de um custo acessível.`;
        } else if (data.myPrice > data.platformAverage * 1.2) {
            analysisText.innerHTML = `⚠️ Seu valor está <strong>acima da média</strong> da plataforma. Considere justificar seu preço com especializações e experiência em seu perfil.`;
        } else {
            analysisText.innerHTML = `✅ Seu valor está <strong>competitivo</strong> em relação à média da plataforma e da sua cidade.`;
        }
    }
}

function renderTopTopicsChart(data) {
    const ctx = document.getElementById('topTopicsChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.topic),
            datasets: [{
                label: 'Buscas',
                data: data.map(d => d.count),
                backgroundColor: ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            }
        }
    });
}

function renderVisibilityChart(data) {
    const ctx = document.getElementById('visibilityChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Aparições em Buscas',
                data: data.appearances,
                borderColor: '#1B4332',
                backgroundColor: 'rgba(27, 67, 50, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function renderProfileStrengthChart(data) {
    const ctx = document.getElementById('profileStrengthChart')?.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Completude', 'Avaliações', 'Engajamento', 'Publicações', 'Resposta'],
            datasets: [
                {
                    label: 'Sua Pontuação',
                    data: data.myScores,
                    backgroundColor: 'rgba(27, 67, 50, 0.2)',
                    borderColor: '#1B4332',
                    pointBackgroundColor: '#1B4332',
                },
                {
                    label: 'Média da Plataforma',
                    data: data.averageScores,
                    backgroundColor: 'rgba(255, 238, 140, 0.2)',
                    borderColor: '#FFEE8C',
                    pointBackgroundColor: '#FFEE8C',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: '#ddd' },
                    grid: { color: '#eee' },
                    pointLabels: { font: { size: 12 } },
                    ticks: { display: false, beginAtZero: true, max: 10 }
                }
            }
        }
    });
}

// A função de inicialização é chamada pelo psi_dashboard.js
window.initializePage = initializeAnalyticsPage;