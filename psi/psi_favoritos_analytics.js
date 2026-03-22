async function initializeFavoritosAnalyticsPage() {
    console.log("Página de Análise de Favoritos inicializada.");

    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    const grid = document.getElementById('favoritos-grid');

    if (!grid) return;

    // Helper para criar um card de gráfico
    const createChartCard = (title, chartId, data, type = 'doughnut') => {
        const card = document.createElement('div');
        card.className = 'widget';
        card.innerHTML = `
            <h3>${title}</h3>
            <div class="chart-container" style="height: 300px;">
                <canvas id="${chartId}"></canvas>
            </div>
        `;

        setTimeout(() => {
            const ctx = document.getElementById(chartId)?.getContext('2d');
            if (!ctx) return;

            new Chart(ctx, {
                type: type,
                data: {
                    labels: Object.keys(data),
                    datasets: [{
                        data: Object.values(data),
                        backgroundColor: ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        }
                    }
                }
            });
        }, 100); // Pequeno delay para garantir que o DOM foi atualizado

        return card;
    };

    try {
        const response = await fetch(`${API_BASE_URL}/api/psychologists/me/favorites-profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error('Não foi possível carregar os dados.');
        }

        const data = await response.json();
        grid.innerHTML = ''; // Limpa o "Carregando..."

        if (data.total === 0) {
            grid.innerHTML = '<div class="widget" style="text-align: center; grid-column: 1 / -1;"><p>Você ainda não foi favoritado por nenhum paciente.</p></div>';
            return;
        }

        // Adiciona os cards de gráficos
        if (Object.keys(data.temas).length > 0) {
            grid.appendChild(createChartCard('Principais Temas Buscados', 'temas-chart', data.temas));
        }
        if (Object.keys(data.faixaValor).length > 0) {
            grid.appendChild(createChartCard('Faixa de Valor da Sessão', 'valor-chart', data.faixaValor));
        }
        if (Object.keys(data.genero).length > 0) {
            grid.appendChild(createChartCard('Identidade de Gênero', 'genero-chart', data.genero));
        }

    } catch (error) {
        console.error("Erro ao buscar análise de favoritos:", error);
        grid.innerHTML = `<div class="widget" style="text-align: center; color: red; grid-column: 1 / -1;"><p>${error.message}</p></div>`;
    }
}

initializeFavoritosAnalyticsPage();