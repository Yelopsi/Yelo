// c:\Users\Anderson\Desktop\Yelo\admin\admin_analytics_funil.js

window.initializePage = function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';

    async function carregarDadosFunil() {
        const loadingEl = document.getElementById('loading-funil');
        const contentEl = document.getElementById('content-funil');
        const btnAtualizar = document.getElementById('btn-atualizar-funil');

        if(loadingEl) loadingEl.style.display = 'block';
        if(contentEl) contentEl.style.display = 'none';
        
        if(btnAtualizar) {
            btnAtualizar.disabled = true;
            btnAtualizar.innerHTML = '<span class="loading-spinner-sm"></span> Atualizando...';
        }

        try {
            const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
            
            const res = await fetch(`${API_BASE_URL}/api/admin/analytics/funnel`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error("Falha ao buscar dados de funil");
            const data = await res.json();

            // 1. Popula KPIs Superiores
            document.getElementById('kpi-visitas').textContent = data.visitas.toLocaleString();
            
            const min = Math.floor(data.tempoMedio / 60);
            const sec = Math.floor(data.tempoMedio % 60); // Math.floor adicionado para remover casas decimais
            document.getElementById('kpi-tempo').textContent = `${min}m ${sec}s`;

            document.getElementById('kpi-iniciaram').textContent = data.iniciaram.toLocaleString();
            document.getElementById('kpi-completaram').textContent = data.completaram.toLocaleString();

            // Taxas de conversão
            const taxaInicio = data.visitas > 0 ? ((data.iniciaram / data.visitas) * 100).toFixed(1) : 0;
            document.getElementById('taxa-inicio').textContent = `${taxaInicio}% dos acessos`;

            const taxaFim = data.iniciaram > 0 ? ((data.completaram / data.iniciaram) * 100).toFixed(1) : 0;
            document.getElementById('taxa-conclusao').textContent = `${taxaFim}% de conclusão`;
            document.getElementById('taxa-conclusao').style.color = taxaFim > 50 ? '#10b981' : '#f59e0b';

            // 2. Popula Conversão Pós-Questionário
            document.getElementById('kpi-perfis').textContent = data.profileViews.toLocaleString();
            document.getElementById('kpi-whatsapp').textContent = data.whatsappClicks.toLocaleString();

            // 3. Popula Barras de Desistência (Ranking)
            const containerAbandonos = document.getElementById('lista-abandonos');
            if(containerAbandonos) {
                containerAbandonos.innerHTML = '';
                if (data.abandonos && data.abandonos.length > 0) {
                    const maxAbandono = Math.max(...data.abandonos.map(a => parseInt(a.count)));
                    data.abandonos.forEach(item => {
                        const pct = ((item.count / maxAbandono) * 100).toFixed(0);
                        const labelName = item.step ? (item.step.charAt(0).toUpperCase() + item.step.slice(1)).replace(/_/g, ' ') : 'Sessão Perdida';
                        
                        containerAbandonos.innerHTML += `
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 5px; color: #444;">
                                    <span>${labelName}</span>
                                    <span style="color: #E63946;">${item.count} saídas</span>
                                </div>
                                <div style="width: 100%; background-color: #f1f3f5; border-radius: 10px; height: 12px; overflow: hidden;">
                                    <div style="width: ${pct}%; background-color: #E63946; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    containerAbandonos.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Nenhum dado de desistência mapeado ainda.</p>';
                }
            }

            // 4. Popula Origens UTM
            const containerOrigens = document.getElementById('lista-origens');
            if(containerOrigens) {
                containerOrigens.innerHTML = '';
                if (data.origens && data.origens.length > 0) {
                    data.origens.forEach((o, index) => {
                        containerOrigens.innerHTML += `<li><span class="acao-numero" style="background:#e0e0e0; color:#333;">${index+1}</span><span class="acao-texto" style="text-transform: capitalize;">${o.source}</span><span style="font-weight:bold; color:var(--verde-escuro);">${o.count}</span></li>`;
                    });
                } else {
                    containerOrigens.innerHTML = '<li style="justify-content:center; color:#888;">Sem rastreamento UTM capturado.</li>';
                }
            }

            if(loadingEl) loadingEl.style.display = 'none';
            if(contentEl) contentEl.style.display = 'block';
            
        } catch(e) { 
            console.error(e); 
            if(loadingEl) loadingEl.innerHTML = `<p style="color: #E63946;">Falha ao carregar os dados. Tente novamente.</p>`;
        } finally {
            if(btnAtualizar) {
                btnAtualizar.disabled = false;
                btnAtualizar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.09l5.67-5.67"/></svg> Atualizar Dados`;
            }
        }
    }

    // Acopla o botão
    const btnAtualizar = document.getElementById('btn-atualizar-funil');
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', carregarDadosFunil);
    }

    // Executa assim que a view injetada carregar
    carregarDadosFunil();
};