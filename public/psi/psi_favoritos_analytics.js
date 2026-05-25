async function initializeFavoritosAnalyticsPage() {

    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';
    const grid = document.getElementById('favoritos-grid');

    if (!grid) return;

    // Helper para criar um card de gráfico
    const createChartCard = (title, chartId, data, type = 'doughnut', icon, iconBg, iconColor, subtitle) => {
        const card = document.createElement('div');
        card.className = 'widget fade-in-up';
        card.style.cssText = 'padding: 25px; border-radius: 20px;';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 5px;">
                <div style="width: 45px; height: 45px; background: ${iconBg}; color: ${iconColor}; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">${icon}</div>
                <h3 style="margin: 0; border: none; padding: 0; color: #1B4332;">${title}</h3>
            </div>
            <p style="color: #666; font-size: 0.95rem; margin-bottom: 25px; line-height: 1.5;">${subtitle}</p>
            <div class="chart-container" style="height: 260px;">
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
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%', // Donut moderno mais fino
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                usePointStyle: true,
                                padding: 20,
                                font: { family: "'Inter', sans-serif" }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(27, 67, 50, 0.9)',
                            padding: 12,
                            cornerRadius: 8,
                            titleFont: { size: 13, family: "'Inter', sans-serif" },
                            bodyFont: { size: 14, weight: 'bold', family: "'Inter', sans-serif" },
                            displayColors: false
                        }
                    }
                }
            });
        }, 100);

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
            grid.innerHTML = `
                <div class="widget" style="grid-column: 1 / -1; padding: 40px; border-radius: 20px; text-align: center; background: #fff;">
                    <div style="font-size: 3.5rem; margin-bottom: 15px; color: #ccc;">🕵️‍♀️</div>
                    <h3 style="color: #1B4332; font-family: var(--font-titulos); margin: 0 0 10px 0;">Nenhum favorito ainda</h3>
                    <p style="color: #666; font-size: 1rem; max-width: 500px; margin: 0 auto;">Assim que os pacientes começarem a salvar seu perfil, os dados sobre o perfil demográfico e os interesses deles aparecerão aqui.</p>
                </div>`;
            return;
        }

        // Adiciona os cards de gráficos
        if (Object.keys(data.temas).length > 0) {
            grid.appendChild(createChartCard('Principais Temas', 'temas-chart', data.temas, 'doughnut', '🎯', '#e8f5e9', '#1B4332', 'Os assuntos que mais motivam os pacientes que favoritaram seu perfil a buscar terapia.'));
        }
        if (Object.keys(data.faixaValor).length > 0) {
            grid.appendChild(createChartCard('Orçamento Médio', 'valor-chart', data.faixaValor, 'doughnut', '💰', '#fff3e0', '#f59e0b', 'A faixa de valor que esses pacientes estão dispostos a investir por sessão.'));
        }
        if (Object.keys(data.genero).length > 0) {
            grid.appendChild(createChartCard('Perfil Demográfico', 'genero-chart', data.genero, 'doughnut', '👤', '#e0f2fe', '#0284c7', 'A identidade de gênero dos pacientes que demonstraram interesse no seu trabalho.'));
        }

    } catch (error) {
        grid.innerHTML = `<div class="widget" style="text-align: center; color: red; grid-column: 1 / -1;"><p>${error.message}</p></div>`;
    }
}

initializeFavoritosAnalyticsPage();