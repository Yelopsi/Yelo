// admin/admin_indicadores.js

window.initializePage = async function() {
    console.log("Inicializando página de Indicadores de Questionários...");
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const patientGrid = document.getElementById('patient-analytics-grid');
    const psiGrid = document.getElementById('psi-analytics-grid');
    const totalPacientesEl = document.getElementById('total-pacientes');
    const totalPsisEl = document.getElementById('total-psis');
    const refreshBtn = document.getElementById('btn-refresh-indicators');

    // Objeto para armazenar instâncias dos gráficos e evitar erro de "Canvas em uso"
    let chartInstances = {};

    // Função de limpeza ao sair da página (Evita erro ao navegar e voltar)
    window.cleanupPage = () => {
        Object.values(chartInstances).forEach(chart => {
            if (chart) chart.destroy();
        });
        chartInstances = {};
    };

    if (!patientGrid || !psiGrid || !token) {
        console.error("Elementos essenciais ou token não encontrados.");
        return;
    }

    // Função para renderizar um card de análise com um gráfico de pizza
    function createAnalyticsCard(title, data) {
        const card = document.createElement('div');
        card.className = 'analytics-card';

        // Ordena os dados do maior para o menor para destacar os mais votados
        const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);
        
        const labels = sortedData.map(item => item[0]);
        const values = sortedData.map(item => item[1]);

        // Paleta de cores Yelo
        const colors = ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC'];

        const chartId = `chart-${title.replace(/[^a-zA-Z0-9]/g, '-')}`;
        card.innerHTML = `
            <h4>${title}</h4>
            <div class="chart-container">
                <canvas id="${chartId}"></canvas>
            </div>
            <ul class="analytics-list">
                ${sortedData.slice(0, 5).map(([label, value], index) => `
                    <li>
                        <span class="list-color-dot" style="background-color: ${colors[index % colors.length]}"></span>
                        <span class="list-label">${label || 'Não informado'}</span>
                        <span class="list-value">${value}</span>
                    </li>
                `).join('')}
            </ul>
        `;

        // Renderiza o gráfico após o card ser adicionado ao DOM
        setTimeout(() => {
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const ctx = canvas.getContext('2d');

                // 1. Verifica se o Chart.js já tem um gráfico registrado neste canvas (Segurança Extra)
                if (typeof Chart !== 'undefined' && Chart.getChart) {
                    const existingChart = Chart.getChart(canvas);
                    if (existingChart) existingChart.destroy();
                }

                // Destrói o gráfico anterior se ele já existir no mesmo canvas
                if (chartInstances[chartId]) {
                    chartInstances[chartId].destroy();
                }

                // Cria e armazena a nova instância do gráfico
                chartInstances[chartId] = new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 2 }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }, 0);

        return card;
    }

    // Função principal para buscar e renderizar os dados
    async function loadAnalytics() {
        patientGrid.innerHTML = '<p>Carregando...</p>';
        psiGrid.innerHTML = '<p>Carregando...</p>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/questionnaire-analytics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Falha ao buscar dados de indicadores.');

            const { patientAnalytics, psiAnalytics, summary30d } = await response.json();

            patientGrid.innerHTML = '';
            psiGrid.innerHTML = '';

            // Renderiza Pacientes
            if (patientAnalytics) {
                totalPacientesEl.textContent = patientAnalytics.total || 0;
                const patientQuestions = { "Faixa Etária": patientAnalytics.idade, "Gênero do Paciente": patientAnalytics.identidade_genero, "Preferência de Gênero (Psi)": patientAnalytics.pref_genero_prof, "Motivação para Terapia": patientAnalytics.motivacao, "Temas Buscados": patientAnalytics.temas, "Experiência Anterior": patientAnalytics.terapia_anterior, "Tipo de Terapia Desejada": patientAnalytics.experiencia_desejada, "Características do Profissional": patientAnalytics.caracteristicas_prof, "Faixa de Valor": patientAnalytics.faixa_valor, "Modalidade de Atendimento": patientAnalytics.modalidade_atendimento };
                for (const [title, data] of Object.entries(patientQuestions)) {
                    if (Object.keys(data).length > 0) {
                        patientGrid.appendChild(createAnalyticsCard(title, data));
                    }
                }
            }

            // Renderiza Psicólogos
            if (psiAnalytics) {
                totalPsisEl.textContent = psiAnalytics.total || 0;
                const psiQuestions = { "Modalidade de Atendimento": psiAnalytics.modalidade, "Gênero do Psicólogo": psiAnalytics.genero_identidade, "Faixa de Valor": psiAnalytics.valor_sessao_faixa, "Temas de Atuação": psiAnalytics.temas_atuacao, "Abordagem Teórica": psiAnalytics.abordagens_tecnicas, "Práticas e Vivências": psiAnalytics.praticas_vivencias };
                for (const [title, data] of Object.entries(psiQuestions)) {
                    if (Object.keys(data).length > 0) {
                        psiGrid.appendChild(createAnalyticsCard(title, data));
                    }
                }
            }

            // Renderiza Resumo 30 Dias
            const summaryContainer = document.getElementById('summary-30d-container');
            if (summaryContainer && summary30d) {
                if (summary30d.total === 0) {
                    summaryContainer.innerHTML = '<p style="color:#666;">Nenhum questionário respondido nos últimos 30 dias.</p>';
                } else {
                    let summaryHTML = `<p class="summary-intro">De <strong>${summary30d.total}</strong> questionários respondidos nos últimos 30 dias:</p><ul class="summary-list">`;
                    
                    const labelsMap = {
                        idade: 'têm a faixa etária',
                        identidade_genero: 'se identificam como',
                        pref_genero_prof: 'preferem profissionais do gênero',
                        motivacao: 'buscam terapia por',
                        temas: 'querem falar sobre',
                        terapia_anterior: 'responderam sobre experiência anterior:',
                        experiencia_desejada: 'buscam uma experiência de',
                        caracteristicas_prof: 'valorizam profissionais',
                        faixa_valor: 'podem investir',
                        modalidade_atendimento: 'preferem atendimento'
                    };

                    for (const [key, stat] of Object.entries(summary30d.stats)) {
                        if (stat) {
                            summaryHTML += `<li><span class="highlight-percent">${stat.percentage}%</span> ${labelsMap[key] || key} <strong>${stat.label}</strong></li>`;
                        }
                    }
                    summaryHTML += '</ul>';
                    summaryContainer.innerHTML = summaryHTML;
                }
            }

        } catch (error) {
            console.error(error);
            patientGrid.innerHTML = `<p class="error-row">${error.message}</p>`;
            psiGrid.innerHTML = `<p class="error-row">${error.message}</p>`;
        }
    }

    // Adiciona o evento de clique ao botão de atualizar
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            const btnSpan = refreshBtn.querySelector('span');
            const originalText = btnSpan ? btnSpan.textContent : 'Atualizar';
            
            refreshBtn.disabled = true;
            if (btnSpan) btnSpan.textContent = 'Atualizando...';

            await loadAnalytics(); // Re-executa a função de carregamento

            refreshBtn.disabled = false;
            if (btnSpan) btnSpan.textContent = originalText;
        });
    }

    loadAnalytics();
};