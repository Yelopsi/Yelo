const showEmptyState = (containerId, message) => {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100%; color:#888; font-style:italic; padding: 20px; text-align: center;">${message}</div>`;
    }
};

async function initializeAnalyticsPage() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

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
        console.error("❌ ERRO CRÍTICO NO FRONTEND (Analytics):", error);
        showEmptyState('price-chart-container', 'Não há dados de preço suficientes.');
        showEmptyState('topics-chart-container', 'Ainda não há temas em alta.');
        showEmptyState('visibility-chart-container', 'Sem dados de visibilidade.');
        showEmptyState('profile-strength-chart-container', 'Não há dados de comparação.');
    }
}

function renderPriceChart(data) {
    const container = document.getElementById('price-chart-container');
    if (!container || !data || data.myPrice === undefined || !data.platformAverage) {
        showEmptyState('price-chart-container', 'Não há dados de preço suficientes para comparação.');
        return;
    }

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const tipoLabel = data.isMensal ? 'Valor Mensal' : 'Valor da Sessão';

    // Atualiza título
    if (container.previousElementSibling && container.previousElementSibling.tagName === 'P') {
        const titleHeader = container.previousElementSibling.previousElementSibling;
        if (titleHeader && titleHeader.querySelector('h3')) titleHeader.querySelector('h3').textContent = tipoLabel;
    }

    // Calcula posições no Termômetro (0% a 100%)
    const maxPrice = Math.max(data.platformAverage * 2, data.myPrice * 1.5, 300);
    const calcPercent = (val) => Math.min(Math.max((val / maxPrice) * 100, 5), 95); // mantém dentro de 5-95 para não cortar

    const myPos = calcPercent(data.myPrice);
    const platPos = calcPercent(data.platformAverage);
    const cityPos = data.cityAverage ? calcPercent(data.cityAverage) : platPos;

    // Calcula a cor dinâmica baseada no gradiente da barra (0% = claro, 100% = escuro)
    const getDynamicColor = (percent) => {
        const c1 = [209, 250, 229]; // #d1fae5
        const c2 = [16, 185, 129];  // #10b981
        const c3 = [4, 120, 87];    // #047857
        let rgb;
        if (percent <= 50) {
            const r = percent / 50;
            rgb = c1.map((v, i) => Math.round(v + (c2[i] - v) * r));
        } else {
            const r = (percent - 50) / 50;
            rgb = c2.map((v, i) => Math.round(v + (c3[i] - v) * r));
        }
        return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    };
    const badgeColor = getDynamicColor(myPos);
    const badgeTextColor = myPos < 40 ? '#064e3b' : 'white'; // Usa texto escuro se estiver muito à esquerda

    container.innerHTML = `
        <div style="position: relative; width: 100%; height: 90px; margin-top: 15px;">
            <div style="position: absolute; top: 40px; left: 0; width: 100%; height: 8px; background: linear-gradient(90deg, #d1fae5, #10b981, #047857); border-radius: 4px;"></div>
            
            <!-- Platform Avg -->
            <div style="position: absolute; top: 12px; left: ${platPos}%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                <span style="font-size: 0.7rem; color: #64748b; font-weight: bold; white-space: nowrap;">Média Plataforma</span>
                <div style="width: 2px; height: 16px; background: #64748b; margin-top: 2px;"></div>
            </div>

            <!-- City Avg -->
            <div style="position: absolute; top: 60px; left: ${cityPos}%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center;">
                <div style="width: 2px; height: 16px; background: #f59e0b; margin-bottom: 2px;"></div>
                <span style="font-size: 0.7rem; color: #d97706; font-weight: bold; white-space: nowrap;">Sua Região</span>
            </div>

            <!-- My Price Marker & Tooltip -->
            <div style="position: absolute; top: 50%; left: ${myPos}%; transform: translate(-50%, -50%); z-index: 10; display: flex; flex-direction: column; align-items: center; cursor: pointer;"
                 onmouseover="this.querySelector('.price-tooltip').style.opacity='1'; this.querySelector('.price-tooltip').style.transform='translateY(0)';" 
                 onmouseout="this.querySelector('.price-tooltip').style.opacity='0'; this.querySelector('.price-tooltip').style.transform='translateY(5px)';"
                 onclick="const t = this.querySelector('.price-tooltip'); const isVis = t.style.opacity === '1'; t.style.opacity = isVis ? '0' : '1'; t.style.transform = isVis ? 'translateY(5px)' : 'translateY(0)';">
                
                <!-- Tooltip (Initially hidden) -->
                <div class="price-tooltip" style="position: absolute; bottom: 100%; margin-bottom: 10px; display: flex; flex-direction: column; align-items: center; opacity: 0; transform: translateY(5px); transition: all 0.2s ease; pointer-events: none;">
                    <div style="background: ${badgeColor}; color: ${badgeTextColor}; padding: 4px 10px; border-radius: 8px; font-weight: bold; font-size: 0.95rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); white-space: nowrap;">
                        Você: ${formatCurrency(data.myPrice)}
                    </div>
                    <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid ${badgeColor};"></div>
                </div>

                <!-- Ponto Marcador na Barra -->
                <div style="width: 16px; height: 16px; background: #fff; border: 4px solid ${badgeColor}; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>
            </div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 5px;">
            <span style="display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #f1f5f9;"><span style="font-size: 0.9rem;">🤝</span> Social</span>
            <span style="display: flex; align-items: center; gap: 4px; background: #f8fafc; padding: 4px 8px; border-radius: 6px; border: 1px solid #f1f5f9;">Particular <span style="font-size: 0.9rem;">⭐</span></span>
        </div>
    `;

    const analysisText = document.getElementById('price-analysis-text');
    if (analysisText) {
        const myPriceFmt = formatCurrency(data.myPrice);
        const cityAvgFmt = formatCurrency(data.cityAverage || data.platformAverage);
        const platAvgFmt = formatCurrency(data.platformAverage);

        if (data.myPrice < (data.cityAverage || data.platformAverage) * 0.9) {
            analysisText.innerHTML = `💡 O seu valor (<strong>${myPriceFmt}</strong>) está mais acessível que a média da sua região (<strong>${cityAvgFmt}</strong>). Isso é um ótimo atrativo para novos pacientes!`;
        } else if (data.myPrice > data.platformAverage * 1.2) {
            analysisText.innerHTML = `⚠️ O seu valor (<strong>${myPriceFmt}</strong>) está acima da média geral (<strong>${platAvgFmt}</strong>). Certifique-se de destacar sua experiência, especializações e diferenciais na sua biografia para justificar o investimento.`;
        } else {
            analysisText.innerHTML = `✅ Excelente! O seu valor (<strong>${myPriceFmt}</strong>) está perfeitamente competitivo com a média do mercado (<strong>${platAvgFmt}</strong>).`;
        }
    }
}

function renderTopTopicsChart(data) {
    const container = document.getElementById('topics-chart-container');
    if (!container || !data || data.length === 0) {
        showEmptyState('topics-chart-container', 'Ainda não há temas em alta na plataforma.');
        return;
    }

    let html = '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">';
    const medals = ['🥇', '🥈', '🥉', '🔹', '🔹'];
    
    data.forEach((item, index) => {
        html += `
            <div style="display: flex; align-items: center; background: #fff; border: 1px solid #f1f5f9; padding: 12px 16px; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: transform 0.2s; cursor: default;" onmouseover="this.style.transform='translateX(5px)'" onmouseout="this.style.transform='none'">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 1.3rem;">${medals[index] || '🔹'}</span>
                    <span style="font-weight: 600; color: #334155; font-size: 0.95rem;">${item.topic}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;

    const analysisText = document.getElementById('topics-analysis-text');
    if (analysisText) {
        const topTopic = data[0].topic;
        analysisText.innerHTML = `💡 <strong>${topTopic}</strong> é a demanda número 1 dos pacientes atualmente. Adicionar esta especialidade ao seu perfil (se for sua área) ou publicar artigos sobre o tema atrairá muito tráfego para sua página!`;
    }
}

function renderVisibilityChart(data) {
    const container = document.getElementById('visibility-chart-container');
    if (!container || !data || !data.labels || data.labels.length === 0) {
        showEmptyState('visibility-chart-container', 'Sem dados de visibilidade do seu perfil nos últimos 7 dias.');
        return;
    }

    const totalAppearances = data.appearances.reduce((a, b) => a + b, 0);
    const maxApp = Math.max(...data.appearances, 1);
    
    // Cria um mini-gráfico (sparkline) de barras estilizado
    let sparklineHtml = data.appearances.map((val, idx) => {
        let h = Math.max((val / maxApp) * 100, 10);
        return `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <div style="width: 14px; height: 50px; display: flex; align-items: flex-end; justify-content: center; background: transparent;">
                    <div style="width: 100%; height: ${h}%; background: ${val > 0 ? '#0ea5e9' : '#e2e8f0'}; border-radius: 4px; transition: height 0.5s;"></div>
                </div>
                <span style="font-size: 0.65rem; color: #94a3b8;">${data.labels[idx].split('/')[0]}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div style="text-align: center; padding: 10px 0; width: 100%;">
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Últimos 7 dias</div>
            <div style="font-size: 4.5rem; font-weight: 900; color: #0f172a; line-height: 1;">${totalAppearances}</div>
            <div style="font-size: 1rem; color: #64748b; margin-top: 5px; font-weight: 500;">aparições nas buscas</div>
            
            <div style="display: flex; align-items: flex-end; justify-content: center; gap: 8px; margin-top: 30px;">
                ${sparklineHtml}
            </div>
        </div>
    `;

    const analysisText = document.getElementById('visibility-analysis-text');
    if (analysisText) {
        if (totalAppearances === 0) {
            analysisText.innerHTML = `⚠️ Seu perfil não apareceu nos resultados nesta semana. Ter um perfil 100% completo com especialidades bem definidas é a melhor forma de reverter isso.`;
        } else if (totalAppearances < 10) {
            analysisText.innerHTML = `💡 Seu perfil apareceu <strong>${totalAppearances} vezes</strong> na última semana. Para impulsionar esse número, experimente interagir mais respondendo dúvidas na Comunidade!`;
        } else {
            analysisText.innerHTML = `🔥 Excelente! Seu perfil foi visto <strong>${totalAppearances} vezes</strong> nas buscas recentes. Sua visibilidade está em alta!`;
        }
    }
}

function renderProfileStrengthChart(data) {
    const container = document.getElementById('profile-strength-chart-container');
    if (!container || !data || !data.myScores || !data.averageScores) {
        showEmptyState('profile-strength-chart-container', 'Não há dados suficientes para comparar a força do seu perfil.');
        return;
    }

    const categories = ['Completude do Perfil', 'Avaliações de Pacientes', 'Engajamento no Fórum', 'Publicação de Artigos', 'Tempo de Resposta'];
    const totalMax = categories.length * 10;
    const myTotal = data.myScores.reduce((a, b) => a + b, 0);
    const percentage = Math.round((myTotal / totalMax) * 100);
    
    let color = percentage >= 80 ? '#10b981' : percentage >= 50 ? '#f59e0b' : '#ef4444';

    let html = `
        <div style="margin-top: 10px; width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 12px;">
                <span style="font-weight: 700; color: #334155; font-size: 1.1rem;">Índice de Força</span>
                <span style="font-weight: 900; color: ${color}; font-size: 1.8rem;">${percentage}%</span>
            </div>
            
            <div style="width: 100%; height: 16px; background: #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 25px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                <div style="height: 100%; width: ${percentage}%; background: ${color}; border-radius: 12px; transition: width 1s ease;"></div>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
    `;

    categories.forEach((cat, idx) => {
        const score = data.myScores[idx];
        const avg = data.averageScores[idx];
        // Determina se a nota do usuário está boa (acima/igual à média da plataforma ou acima de 7)
        const isGood = score >= avg || score >= 7;
        const icon = isGood ? '✅' : '⚠️';
        const colorText = isGood ? '#475569' : '#ef4444';
        
        html += `
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem; color: ${colorText}; background: #f8fafc; padding: 8px 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span>${icon}</span>
                        <span style="${!isGood ? 'font-weight: 600;' : 'font-weight: 500;'}">${cat}</span>
                    </div>
                    <span style="font-size: 0.8rem; font-weight: 700; opacity: 0.7;">${score}/10</span>
                </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;

    const analysisText = document.getElementById('profile-analysis-text');
    if (analysisText) {
        const avgTotal = data.averageScores.reduce((a, b) => a + b, 0);
        if (myTotal > avgTotal) {
            analysisText.innerHTML = `✅ <strong>Parabéns!</strong> A força do seu perfil está <strong>acima da média</strong> da plataforma. Mantenha as boas avaliações e publicações para continuar no topo!`;
        } else {
            analysisText.innerHTML = `💪 Seu perfil tem bastante <strong>espaço para crescer</strong> em relação à concorrência. Foque nos itens marcados com alerta acima para melhorar seu posicionamento nas buscas.`;
        }
    }
}

// Inicializa a página assim que o script é carregado.
initializeAnalyticsPage();