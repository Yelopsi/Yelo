async function initializeAnalyticsPage() {

    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    // Helper para mostrar mensagem de "sem dados"
    const showEmptyState = (containerId, message) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#888; font-style:italic; padding: 20px; text-align: center;">${message}</div>`;
        }
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/psychologists/me/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Não foi possível carregar os dados de análise.');
        }

        const data = await response.json();
        
        // Obtém o valor real cadastrado no perfil do psicólogo logado
        if (typeof window.getPsychologistData === 'function') {
            const psiData = window.getPsychologistData();
            if (psiData && data.priceComparison) {
                const isMensal = psiData.tipo_cobranca === 'mensal';
                data.priceComparison.isMensal = isMensal;
                
                if (isMensal) {
                    const realPrice = parseFloat(psiData.valor_mensal_numero);
                    if (realPrice > 0) {
                        data.priceComparison.myPrice = realPrice;
                        // Ajusta as médias (baseadas em sessão) para um equivalente mensal aproximado (4 sessões)
                        if (data.priceComparison.platformAverage && data.priceComparison.platformAverage < 500) {
                            if (data.priceComparison.cityAverage) data.priceComparison.cityAverage *= 4;
                            data.priceComparison.platformAverage *= 4;
                        }
                    }
                } else {
                    const realPrice = parseFloat(psiData.valor_sessao_numero);
                    if (realPrice > 0) data.priceComparison.myPrice = realPrice;
                }
            }
        }

        // Renderiza todos os gráficos com os dados reais
        renderPriceChart(data.priceComparison);
        renderTopTopicsChart(data.topTopics);
        renderVisibilityChart(data.visibility);
        renderProfileStrengthChart(data.profileStrength);

    } catch (error) {
        showEmptyState('price-chart-container', 'Não há dados de preço suficientes.');
        showEmptyState('topics-chart-container', 'Ainda não há temas em alta.');
        showEmptyState('visibility-chart-container', 'Sem dados de visibilidade.');
        showEmptyState('profile-strength-chart-container', 'Não há dados de comparação.');
    }
}

function renderPriceChart(data) {
    const ctx = document.getElementById('priceComparisonChart')?.getContext('2d');
    if (!ctx || !data || data.myPrice === undefined || !data.platformAverage) {
        showEmptyState('price-chart-container', 'Não há dados de preço suficientes para comparação.');
        return;
    }

    const tipoLabel = data.isMensal ? 'Valor Mensal' : 'Valor da Sessão';

    // Tenta atualizar o título do card HTML para refletir o tipo de cobrança
    const container = document.getElementById('price-chart-container');
    if (container && container.previousElementSibling && container.previousElementSibling.tagName === 'P') {
        const titleHeader = container.previousElementSibling.previousElementSibling;
        if (titleHeader && titleHeader.querySelector('h3')) {
            titleHeader.querySelector('h3').textContent = tipoLabel;
        }
    }

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Seu Valor', 'Média (Cidade)', 'Média (Plataforma)'],
            datasets: [{
                label: `${tipoLabel} (R$)`,
                data: [data.myPrice, data.cityAverage, data.platformAverage],
                backgroundColor: [
                    '#1B4332', // Verde Yelo
                    '#FFEE8C', // Amarelo Yelo
                    '#adb5bd' // Cinza
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
    if (!ctx || !data || data.length === 0) {
        showEmptyState('topics-chart-container', 'Ainda não há temas em alta na plataforma.');
        return;
    }

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
    if (!ctx || !data || !data.labels || data.labels.length === 0) {
        showEmptyState('visibility-chart-container', 'Sem dados de visibilidade do seu perfil nos últimos 7 dias.');
        return;
    }

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
    if (!ctx || !data || !data.myScores || !data.averageScores) {
        showEmptyState('profile-strength-chart-container', 'Não há dados suficientes para comparar a força do seu perfil.');
        return;
    }

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

// Inicializa a página assim que o script é carregado.
initializeAnalyticsPage();