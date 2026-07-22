// c:\Users\Anderson\Desktop\Yelo\admin\admin_analytics_funil.js

window.initializePage = function() {
    const API_BASE_URL = (typeof window.API_BASE_URL !== 'undefined') ? window.API_BASE_URL : '';
    let exportData = null; // Guarda os dados do funil
    let globalRankingData = []; // Armazena o ranking para ordenação no front
    window.termometroData = null;
    window.auditoriaData = null;
    let currentRankingSort = { column: 'posicao', direction: 'asc' }; // Estado da ordenação

    // Inicializa as datas de filtro (últimos 30 dias por padrão)
    const startInput = document.getElementById('funil-start');
    const endInput = document.getElementById('funil-end');
    if (startInput && endInput && !startInput.value) {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        const formatDateLocal = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        startInput.value = formatDateLocal(thirtyDaysAgo);
        endInput.value = formatDateLocal(today);
    }

    // Dicionário amigável para traduzir as "chaves" do questionário
    const stepNames = {
        'intro': 'Página Inicial (Introdução)',
        'motivo': 'Motivo da Busca',
        'abordagem': 'Estilo de Terapia',
        'publico': 'Perfil/Público Alvo',
        'valor': 'Faixa de Preço',
        'identidade': 'Preferência de Profissional',
        'nome': 'Preenchimento do Nome',
        'contato': 'Preenchimento do Contato (Fim)'
    };

    // --- CORREÇÃO: TOOLTIPS NO MOBILE ---
    // Dispositivos touch não lidam bem com o pseudo-elemento :hover.
    // Isso garante que ao tocar no ícone "i", o tooltip abra e feche corretamente.
    document.addEventListener('click', function(e) {
        const isTooltip = e.target.closest('.info-tooltip');
        
        // Fecha todos os tooltips ativos quando o usuário clicar fora
        document.querySelectorAll('.info-tooltip.active').forEach(tt => {
            if (tt !== isTooltip) tt.classList.remove('active');
        });

        // Alterna o tooltip clicado (Tocar para abrir, tocar de novo para fechar)
        if (isTooltip) {
            isTooltip.classList.toggle('active');
        }
    });

    // --- TAB SWITCHING ---
    window.switchFunilTab = function(btn) {
        document.querySelectorAll('.content-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.analytics-tab-content').forEach(tab => tab.style.display = 'none');
        
        const targetId = btn.getAttribute('data-target');
        const targetTab = document.getElementById(targetId);
        if (targetTab) {
            targetTab.style.display = 'block';
        }
        
        // IMPORTANTE: Mova as funções carregarRankingPsis() e carregarConversoesPLG() que estavam no admin_crm_analytics.js para cá, para popular as tabelas
    };

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
            
            const queryParams = new URLSearchParams();
            if (startInput && startInput.value) queryParams.append('startDate', startInput.value);
            if (endInput && endInput.value) queryParams.append('endDate', endInput.value);

            const [res, resWpp, resRanking] = await Promise.all([
                fetch(`${API_BASE_URL}/api/admin/analytics/funnel?${queryParams.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/admin/whatsapp-feedbacks?${queryParams.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/admin/analytics/ranking?${queryParams.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null)
            ]);

            if (!res.ok) throw new Error("Falha ao buscar dados de funil");
            const data = await res.json();
            const dataWpp = resWpp.ok ? await resWpp.json() : [];
            const dataRanking = (resRanking && resRanking.ok) ? await resRanking.json() : null;

            exportData = data; // Salva os dados globais para permitir a exportação no CSV
            
            renderWppFeedbacks(dataWpp);
            globalRankingData = dataRanking ? (Array.isArray(dataRanking) ? dataRanking : dataRanking.ranking) : null;
            
            if (globalRankingData) {
                globalRankingData.forEach((item, idx) => {
                    item.originalPos = idx + 1; // Salva a posição oficial do backend
                    const visitasTotais = (item.aparicoesBusca || 0) + (item.visitasDiretas || 0);
                    item.conversaoVal = visitasTotais > 0 ? ((item.cliquesWpp || 0) / visitasTotais) * 100 : 0;
                });
            }
            
            // Reseta a ordenação e renderiza
            currentRankingSort = { column: 'posicao', direction: 'asc' };
            updateSortIndicators('posicao');
            renderRankingPsi(globalRankingData);
            
            // --- POPULA KPIs DO RANKING ---
            if (globalRankingData) {
                const totalPsis = globalRankingData.length;
                const totalBusca = globalRankingData.reduce((acc, curr) => acc + (curr.aparicoesBusca || 0), 0);
                const totalDiretas = globalRankingData.reduce((acc, curr) => acc + (curr.visitasDiretas || 0), 0);
                const totalWpp = globalRankingData.reduce((acc, curr) => acc + (curr.cliquesWpp || 0), 0);

                const elTotal = document.getElementById('kpi-ranking-total');
                const elBusca = document.getElementById('kpi-ranking-busca');
                const elDiretas = document.getElementById('kpi-ranking-diretas');
                const elWpp = document.getElementById('kpi-ranking-wpp');

                if (elTotal) elTotal.textContent = totalPsis.toLocaleString();
                if (elBusca) elBusca.textContent = totalBusca.toLocaleString();
                if (elDiretas) elDiretas.textContent = totalDiretas.toLocaleString();
                if (elWpp) elWpp.textContent = totalWpp.toLocaleString();
            }

            // --- FUNÇÃO AUXILIAR PARA RENDERIZAR AS METAS VISUAIS ---
            const getColorForGoal = (currentPct, goalPct) => {
                const isGood = parseFloat(currentPct) >= goalPct;
                return isGood ? '#10b981' : (parseFloat(currentPct) >= (goalPct * 0.6) ? '#f59e0b' : '#ef4444');
            };

            const renderGoalBar = (currentPct, goalPct, label, barColor) => {
                const pctFill = Math.min(100, (parseFloat(currentPct) / goalPct) * 100);
                return `
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:5px;">
                        <span style="font-weight:600; color:${barColor};">${currentPct}% ${label}</span>
                        <span style="color:#64748b; font-size:0.75rem; font-weight: 600;">Meta: ${goalPct}%</span>
                    </div>
                    <div style="width:100%; background:#e2e8f0; height:6px; border-radius:4px; overflow:hidden;">
                        <div style="width:${pctFill}%; height:100%; background:${barColor}; border-radius:4px; transition:width 0.5s ease-out;"></div>
                    </div>
                `;
            };

            const applyColorToKpi = (kpiId, color) => {
                const el = document.getElementById(kpiId);
                if (el) {
                    el.style.color = color;
                    const card = el.closest('.kpi-card');
                    if (card) card.style.borderTopColor = color;
                }
            };

            // --- 1. POPULA KPIs SUPERIORES ---
            const kpiVisitas = document.getElementById('kpi-visitas');
            if (kpiVisitas) kpiVisitas.textContent = data.visitas.toLocaleString();
            
            const kpiIniciaram = document.getElementById('kpi-iniciaram');
            if(kpiIniciaram) kpiIniciaram.textContent = data.iniciaram.toLocaleString();
            
            const kpiCompletaram = document.getElementById('kpi-completaram');
            if(kpiCompletaram) kpiCompletaram.textContent = data.completaram.toLocaleString();

            const kpiWhatsapp = document.getElementById('kpi-whatsapp');
            if (kpiWhatsapp) kpiWhatsapp.textContent = data.whatsappClicks.toLocaleString();
            
            const kpiDesqualificados = document.getElementById('kpi-desqualificados');
            if(kpiDesqualificados) kpiDesqualificados.textContent = (data.desqualificados || 0).toLocaleString();

            const taxaInicio = data.visitas > 0 ? ((data.iniciaram / data.visitas) * 100).toFixed(1) : 0;
            const corTaxaInicio = getColorForGoal(taxaInicio, 15);
            const elTaxaInicio = document.getElementById('taxa-inicio');
            if (elTaxaInicio) elTaxaInicio.innerHTML = renderGoalBar(taxaInicio, 15, 'das visitas', corTaxaInicio);
            applyColorToKpi('kpi-iniciaram', corTaxaInicio);

            const taxaCompletaram = data.iniciaram > 0 ? ((data.completaram / data.iniciaram) * 100).toFixed(1) : 0;
            const corTaxaCompletaram = getColorForGoal(taxaCompletaram, 65);
            const elTaxaCompletaram = document.getElementById('taxa-completaram');
            if (elTaxaCompletaram) elTaxaCompletaram.innerHTML = renderGoalBar(taxaCompletaram, 65, 'dos iniciados', corTaxaCompletaram);
            applyColorToKpi('kpi-completaram', corTaxaCompletaram);

            const taxaGlobal = data.visitas > 0 ? ((data.whatsappClicks / data.visitas) * 100).toFixed(2) : 0;
            const corTaxaGlobal = getColorForGoal(taxaGlobal, 3);
            const elTaxaGlobal = document.getElementById('taxa-conclusao-final');
            if (elTaxaGlobal) elTaxaGlobal.innerHTML = renderGoalBar(taxaGlobal, 3, 'do tráfego', corTaxaGlobal);
            applyColorToKpi('kpi-whatsapp', corTaxaGlobal);



            // --- 2. RENDERIZA FUNIL VISUAL END-TO-END ---
            const maxFunnel = data.visitas > 0 ? data.visitas : 1; // Previne divisão por zero
            const funilHtml = [
                { id: 'step-1', icon: '👁️', bg: '#e0f2fe', color: '#0284c7', label: '1. Acessaram o Site', value: data.visitas, parent: data.visitas, desc: 'Visualizações no Período' },
                { id: 'step-2', icon: '🚀', bg: '#f3e8ff', color: '#7e22ce', label: '2. Iniciaram o Questionário', value: data.iniciaram, parent: data.visitas, desc: 'Clicaram em Começar' },
                { id: 'step-3', icon: '📋', bg: '#fef3c7', color: '#d97706', label: '3. Finalizaram Questionário (Leads)', value: data.completaram, parent: data.iniciaram, desc: 'Chegaram aos Resultados' },
                { id: 'step-4', icon: '👤', bg: '#e8f5e9', color: '#166534', label: '4. Visualizações de Perfis', value: data.profileViews, parent: data.completaram, desc: 'Acessos detalhados aos resultados' },
                { id: 'step-5', icon: '💬', bg: '#dcfce7', color: '#15803d', label: '5. Clicaram no WhatsApp (Pacientes)', value: data.whatsappClicks, parent: data.profileViews, desc: 'Conversão Final Efetiva' }
            ].map((step, i, arr) => {
                const rateToParentRaw = step.parent > 0 ? (step.value / step.parent) : 0;
                const rateToParentPct = (rateToParentRaw * 100).toFixed(1);
                
                // Limita a largura do background a 100% para evitar quebra de layout quando há mais visualizações do que visitas
                const absoluteFill = Math.min(100, ((step.value / maxFunnel) * 100)).toFixed(1);

                // Trava visualmente a porcentagem em 100% para manter a lógica estrita de funil
                const displayPct = Math.min(100, rateToParentPct).toFixed(1);

                let rateClass = 'rate-good';
                if (displayPct < 40) rateClass = 'rate-bad';
                else if (displayPct < 70) rateClass = 'rate-warn';

                const rateHtml = i === 0 ? '' : `<span class="funnel-rate ${rateClass}">${displayPct}% da etapa anterior</span>`;

                return `
                    <div class="funnel-stage">
                        <div class="funnel-bg-fill" style="width: ${absoluteFill}%;"></div>
                        <div class="funnel-stage-info">
                            <div class="funnel-icon" style="background: ${step.bg}; color: ${step.color};">${step.icon}</div>
                            <div>
                                <h4>${step.label}</h4>
                                <p>${step.desc}</p>
                            </div>
                        </div>
                        <div class="funnel-metrics">
                            <span class="funnel-count">${step.value.toLocaleString()}</span>
                            ${rateHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('funnel-visual-container').innerHTML = funilHtml;

            // --- 3. RANKING DE ABANDONO (DROP-OFFS) ---
            const kpiTxDesistencia = document.getElementById('kpi-tx-desistencia');
            const kpiTxDesistenciaGlobal = document.getElementById('kpi-tx-desistencia-global');
            
            if (data.iniciaram > 0) {
                const abandonosCount = Math.max(0, data.iniciaram - data.completaram);
                const taxaDesistenciaPct = ((abandonosCount / data.iniciaram) * 100).toFixed(1);
                const desistenciaColor = taxaDesistenciaPct <= 30 ? '#10b981' : '#dc2626';
                
                if (kpiTxDesistencia) {
                    kpiTxDesistencia.textContent = `${taxaDesistenciaPct}%`;
                    kpiTxDesistencia.style.color = desistenciaColor; 
                }
                if (kpiTxDesistenciaGlobal) {
                    kpiTxDesistenciaGlobal.textContent = `${taxaDesistenciaPct}%`;
                    applyColorToKpi('kpi-tx-desistencia-global', desistenciaColor);
                }
            } else {
                if (kpiTxDesistencia) {
                    kpiTxDesistencia.textContent = '--%';
                    kpiTxDesistencia.style.color = '#64748b';
                }
                if (kpiTxDesistenciaGlobal) {
                    kpiTxDesistenciaGlobal.textContent = '--%';
                    applyColorToKpi('kpi-tx-desistencia-global', '#64748b');
                }
            }

            const containerAbandonos = document.getElementById('lista-abandonos');
            if(containerAbandonos) {
                containerAbandonos.innerHTML = '';
                if (data.abandonos && data.abandonos.length > 0) {
                    const maxAbandono = Math.max(...data.abandonos.map(a => parseInt(a.count)));
                    data.abandonos.forEach(item => {
                        const pct = ((item.count / maxAbandono) * 100).toFixed(0);
                        const labelName = stepNames[item.step] || (item.step ? (item.step.charAt(0).toUpperCase() + item.step.slice(1)).replace(/_/g, ' ') : 'Saída Imediata');
                        
                        containerAbandonos.innerHTML += `
                            <div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 5px; color: #444;">
                                    <span>${labelName}</span>
                                    <span style="color: #E63946;">${item.count} perdas</span>
                                </div>
                                <div style="width: 100%; background-color: #f1f3f5; border-radius: 10px; height: 12px; overflow: hidden;">
                                    <div style="width: ${pct}%; background-color: #E63946; height: 100%; border-radius: 10px;"></div>
                                </div>
                            </div>
                        `;
                    });
                } else {
                    containerAbandonos.innerHTML = '<p style="color: #888; text-align: center; padding: 20px; font-style: italic;">Dados insuficientes para traçar abandonos.</p>';
                }
            }

            // --- 4. ORIGENS DE TRÁFEGO (CANAIS) ---
            const containerOrigens = document.getElementById('traffic-channels');
            if(containerOrigens) {
                // Agrupa as origens inteligentemente
                let canais = { 'Google Ads': 0, 'Meta/Insta Ads': 0, 'Orgânico/Direto': 0, 'Outros': 0 };
                let totalOrigens = 0;
                
                if (data.origens && data.origens.length > 0) {
                    data.origens.forEach(o => {
                        const src = (o.source || '').toLowerCase();
                        const count = parseInt(o.count);
                        totalOrigens += count;
                        
                        // Mapeamento Estrito para evitar falsos positivos de palavras nas UTMs
                        if (src === 'google' || src === 'google_ads' || src === 'gads' || src === 'google ads') {
                            canais['Google Ads'] += count;
                        } else if (src === 'fb' || src === 'facebook' || src === 'ig' || src === 'instagram' || src === 'meta' || src === 'fb_ads' || src === 'meta_ads') {
                            canais['Meta/Insta Ads'] += count;
                        } else if (src === 'direto' || src === 'organico' || src === 'organic' || src === '') {
                            canais['Orgânico/Direto'] += count;
                        } else {
                            canais['Outros'] += count;
                        }
                    });

                    containerOrigens.innerHTML = Object.entries(canais).sort((a,b) => b[1] - a[1]).map(([nome, count]) => {
                        if (count === 0) return '';
                        const pct = ((count / totalOrigens) * 100).toFixed(1);
                        return `
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: #f8f9fa; border-radius: 8px; border: 1px solid #eee;">
                            <span style="font-weight: 600; color: #333;">${nome}</span>
                            <div style="text-align: right;">
                                <span style="font-size: 1.1rem; font-weight: bold; color: var(--verde-escuro);">${count}</span>
                                <span style="font-size: 0.8rem; color: #888; margin-left: 5px;">(${pct}%)</span>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    containerOrigens.innerHTML = '<p style="color: #888; text-align: center; padding: 20px; font-style: italic;">Sem rastreamento UTM mapeado.</p>';
                }
            }

            // --- 5. INTELIGÊNCIA ARTIFICIAL (INSIGHTS AUTOMÁTICOS) ---
            const insightsList = document.getElementById('ai-insights-list');
            if (insightsList) {
                let insightsHtml = '';
                
                // Top Funnel Insight (Tráfego -> Início)
                const tInicio = data.visitas > 0 ? (data.iniciaram / data.visitas) : 0;
                if (tInicio < 0.15) {
                    insightsHtml += `<div class="insight-item"><div class="insight-icon">⚠️</div><div class="insight-text"><h5>Baixa adesão na Landing Page (${(tInicio * 100).toFixed(1)}%)</h5><p>Sua meta é 15% a 20%. O volume que inicia o questionário está baixo. Continue testando quebras de objeção financeira e chamadas para ação (CTAs) mais evidentes na primeira dobra do site.</p></div></div>`;
                } else {
                    insightsHtml += `<div class="insight-item"><div class="insight-icon">🔥</div><div class="insight-text"><h5>Landing Page Saudável (${(tInicio * 100).toFixed(1)}%)</h5><p>O engajamento inicial atingiu ou superou a meta de 15%. As quebras de objeção estão funcionando!</p></div></div>`;
                }

                // Mid Funnel Insight (Início -> Fim Questionário)
                const tFim = data.iniciaram > 0 ? (data.completaram / data.iniciaram) : 0;
                if (tFim < 0.65) {
                    const worstStep = (data.abandonos && data.abandonos[0]) ? (stepNames[data.abandonos[0].step] || data.abandonos[0].step) : 'no meio do formulário';
                    insightsHtml += `<div class="insight-item"><div class="insight-icon">📉</div><div class="insight-text"><h5>Atrito no Questionário (${(tFim * 100).toFixed(1)}%)</h5><p>Sua meta é manter acima de 65%. Muitas pessoas abandonam em: <strong>${worstStep}</strong>. Avalie se as perguntas estão muito complexas ou se exigem muito esforço.</p></div></div>`;
                }

                // Bottom Funnel Insight (Fim Questionário -> Clique WhatsApp)
                const tWhats = data.completaram > 0 ? (data.whatsappClicks / data.completaram) : 0;
                if (tWhats < 0.35) {
                    insightsHtml += `<div class="insight-item"><div class="insight-icon">👀</div><div class="insight-text"><h5>Falta de Conexão Final (${(tWhats * 100).toFixed(1)}%)</h5><p>Sua meta é 35% a 40%. Os pacientes vêm os matches, mas não clicam. Soluções possíveis: forçar os psicólogos a melhorarem fotos/bios, ou refinar a IA para explicar melhor o porquê daquele match.</p></div></div>`;
                } else if (tWhats >= 0.35) {
                    insightsHtml += `<div class="insight-item"><div class="insight-icon">💸</div><div class="insight-text"><h5>Excelente Conversão Final! (${(tWhats * 100).toFixed(1)}%)</h5><p>Você atingiu a meta de conversão final! O algoritmo de recomendação está fazendo um match perfeito com o público.</p></div></div>`;
                }

                insightsList.innerHTML = insightsHtml || '<p>Sem insights críticos no momento. Tudo operando dentro do esperado.</p>';
            }

            if(loadingEl) loadingEl.style.display = 'none';
            if(contentEl) contentEl.style.display = 'block';
            
        } catch(e) { 
            console.error(e); 
            if(loadingEl) loadingEl.innerHTML = `<p style="color: #E63946;">Falha ao carregar os dados. Tente novamente.</p>`;
        } finally {
            if(btnAtualizar) {
                btnAtualizar.disabled = false;
                btnAtualizar.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-10.09l5.67-5.67"/></svg> Atualizar`;
            }
        }
    }

    function downloadCSV(filename, content) {
        const blob = new Blob(["\uFEFF"+content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- 6. EXPORTAÇÃO CSV DINÂMICA (POR ABA) ---
    function exportarCSV() {
        const activeTabBtn = document.querySelector('.content-tab-btn.active');
        const tabTarget = activeTabBtn ? activeTabBtn.getAttribute('data-target') : 'tab-funil';
        
        const formatToBR = (dateStr) => {
            if (!dateStr) return 'N/A';
            const [y, m, d] = dateStr.split('-');
            return `${d}/${m}/${y}`;
        };
        const safeStr = (str) => (str || '').toString().replace(/;/g, ' - ');

        const dataInicial = formatToBR(startInput ? startInput.value : '');
        const dataFinal = formatToBR(endInput ? endInput.value : '');
        const periodStr = `${dataInicial} a ${dataFinal}`;

        if (tabTarget === 'tab-funil') {
            if (!exportData) return alert("Nenhum dado para exportar. Atualize a página.");
            
            const taxaConversao = exportData.visitas > 0 ? ((exportData.whatsappClicks / exportData.visitas) * 100).toFixed(2) : 0;

            let csvContent = `RELATÓRIO DE BUSINESS INTELLIGENCE E FUNIL DE PACIENTES\n`;
            csvContent += `Período: ${periodStr}\n\n`;
            csvContent += `--- FUNIL DE CONVERSÃO ---\n`;
            csvContent += `Etapa;Quantidade\n`;
            csvContent += `1. Visitantes Totais (Site);${exportData.visitas}\n`;
            csvContent += `2. Iniciaram Questionário;${exportData.iniciaram}\n`;
            csvContent += `3. Completaram Questionário;${exportData.completaram}\n`;
            csvContent += `4. Acessaram Perfis Detalhados;${exportData.profileViews}\n`;
            csvContent += `5. Clicaram WhatsApp (Conversão);${exportData.whatsappClicks}\n`;
            csvContent += `Taxa de Conversão Final;${taxaConversao}%\n\n`;

            csvContent += `--- RETENÇÃO E PERDAS ---\n`;
            csvContent += `Categoria;Quantidade\n`;
            csvContent += `Desqualificados (Menor de Idade / Regras de Negócio);${exportData.desqualificados || 0}\n`;
            
            if (exportData.abandonos && exportData.abandonos.length > 0) {
                exportData.abandonos.forEach(a => {
                    const stepName = stepNames[a.step] || a.step || 'Sessão Perdida';
                    csvContent += `Abandono - ${stepName};${a.count}\n`;
                });
            } else {
                csvContent += `Abandonos no Questionário;0\n`;
            }
            csvContent += `\n`;

            csvContent += `--- ORIGENS DE TRÁFEGO (UTMs) ---\n`;
            csvContent += `Origem / Campanha;Acessos\n`;
            if (exportData.origens && exportData.origens.length > 0) {
                exportData.origens.forEach(o => csvContent += `${safeStr(o.source) || 'Direto/Orgânico'};${o.count}\n`);
            } else {
                csvContent += `Sem dados de UTM mapeados;0\n`;
            }
            csvContent += `\n`;

            if (exportData.inteligencia) {
                csvContent += `--- INTELIGÊNCIA DE DEMANDA (PACIENTES QUE CONCLUÍRAM) ---\n`;
                csvContent += `Top Temas Buscados;Quantidade\n`;
                (exportData.inteligencia.topTemas || []).forEach(t => csvContent += `${safeStr(t.value)};${t.count}\n`);
                csvContent += `\nFaixa de Valor Desejada;Quantidade\n`;
                (exportData.inteligencia.faixaValor || []).forEach(f => csvContent += `${safeStr(f.value)};${f.count}\n`);
                csvContent += `\nModalidade Preferida;Quantidade\n`;
                (exportData.inteligencia.modalidades || []).forEach(m => csvContent += `${safeStr(m.value)};${m.count}\n`);
            }

            downloadCSV(`yelo_funil_export_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
            
        } else if (tabTarget === 'tab-conversoes') {
            const wppData = window.wppDataState ? window.wppDataState.allFeedbacks : [];
            if (!wppData || wppData.length === 0) return alert("Nenhum dado de conversão para exportar.");
            
            let csvContent = `RELATÓRIO DE CONVERSÕES (PLG)\nPeríodo: ${periodStr}\n\n`;
            csvContent += `Data;Origem (UTM);Paciente (Visitante);Psicólogo;Recebeu Contato?;Fechou Negócio?;Status\n`;
            
            wppData.forEach(l => {
                const dataFormatada = new Date(l.createdAt).toLocaleDateString('pt-BR');
                const pName = safeStr(l.guestName);
                const psiName = l.psychologist ? safeStr(l.psychologist.nome) : 'N/A';
                const recContato = l.contactReceived === true ? 'Sim' : (l.contactReceived === false ? 'Não' : 'Pendente');
                const status = l.feedbackGiven ? 'Respondido' : (l.adminWppReminderSentAt ? 'Cobrado' : 'Pendente');
                
                // Mapeia fechou granularmente
                let fechou = 'Pendente';
                if (l.dealClosed === 'yes' || l.dealClosed === 'started') fechou = 'Sim';
                else if (l.dealClosed === 'no' || l.dealClosed === 'not_started' || l.dealClosed === 'ghosted') fechou = 'Não';
                else if (l.dealClosed === 'talking') fechou = 'Em Negociação';
                else if (l.dealClosed) fechou = 'Sem Contato';

                const origemUTM = safeStr(l.utmSource) || 'N/A';
                csvContent += `${dataFormatada};${origemUTM};${pName};${psiName};${recContato};${fechou};${status}\n`;
            });
            downloadCSV(`yelo_conversoes_${new Date().toISOString().split('T')[0]}.csv`, csvContent);

        } else if (tabTarget === 'tab-ranking') {
            if (!globalRankingData || globalRankingData.length === 0) return alert("Nenhum dado de ranking para exportar.");
            
            let csvContent = `RANKING DE PSICÓLOGOS\nPeríodo: ${periodStr}\n\n`;
            csvContent += `Posição;Nome;Acesso Direto;Busca (Filtros);Visitantes Totais;Cliques no WhatsApp;Taxa de Conversão\n`;
            
            globalRankingData.forEach((item, idx) => {
                const pos = idx + 1;
                const visitasTotais = (item.aparicoesBusca || 0) + (item.visitasDiretas || 0);
                const conver = item.conversaoVal ? item.conversaoVal.toFixed(2) : '0.00';
                csvContent += `${pos};${safeStr(item.nome)};${item.visitasDiretas || 0};${item.aparicoesBusca || 0};${visitasTotais};${item.cliquesWpp || 0};${conver}%\n`;
            });
            downloadCSV(`yelo_ranking_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
            
        } else if (tabTarget === 'tab-termometro') {
            if (!window.termometroData) return alert("Nenhum dado do termômetro. Faça a análise primeiro.");
            const data = window.termometroData;
            let csvContent = `ESCALA (ADS) E SAÚDE DO TRÁFEGO\nData da Análise: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
            csvContent += `Métrica;Valor\n`;
            csvContent += `Total de Psicólogos Ativos;${data.totalPsis || 0}\n`;
            csvContent += `Total de Leads Entregues no Período;${data.totalLeads || 0}\n`;
            csvContent += `Média de Leads por Psicólogo;${(data.mediaLeads || 0).toFixed(2)}\n`;
            downloadCSV(`yelo_escala_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
            
        } else if (tabTarget === 'tab-auditoria') {
            if (!window.auditoriaData || window.auditoriaData.length === 0) return alert("Nenhum dado de auditoria. Faça a busca primeiro.");
            let csvContent = `AUDITORIA DE LEADS (PERÍODO)\nPeríodo: ${periodStr}\n\n`;
            csvContent += `Psicólogo;Status da Assinatura;Total de Leads Recebidos\n`;
            window.auditoriaData.forEach(l => {
                const status = l.status === 'active' ? 'Ativo' : (l.status === 'pending' ? 'Pendente' : 'Inativo');
                csvContent += `${safeStr(l.nome)};${status};${l.leads_recentes}\n`;
            });
            downloadCSV(`yelo_auditoria_${new Date().toISOString().split('T')[0]}.csv`, csvContent);
        }
    }

    // --- FUNÇÕES DE RENDERIZAÇÃO SECUNDÁRIAS ---
    
    // Estado Global de Paginação WPP
    window.wppDataState = {
        allFeedbacks: [],
        filteredFeedbacks: [],
        currentPage: 1,
        itemsPerPage: 15,
        currentFilter: 'todos',
        sortColumn: 'data',
        sortDirection: 'desc'
    };

    window.applyWppFilter = function() {
        const select = document.getElementById('filter-wpp-status');
        const searchInput = document.getElementById('search-wpp-name');
        if (!select) return;
        window.wppDataState.currentFilter = select.value;
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        window.wppDataState.currentPage = 1;
        
        const filterVal = window.wppDataState.currentFilter;
        window.wppDataState.filteredFeedbacks = window.wppDataState.allFeedbacks.filter(f => {
            if (searchTerm) {
                const psiName = f.psychologist && f.psychologist.nome ? f.psychologist.nome.toLowerCase() : '';
                const patientName = f.guestName ? f.guestName.toLowerCase() : '';
                if (!psiName.includes(searchTerm) && !patientName.includes(searchTerm)) {
                    return false;
                }
            }
            if (filterVal === 'todos') return true;
            if (filterVal === 'cobrar_agora') {
                if (f.feedbackGiven) return false;
                const ageHours = (Date.now() - new Date(f.createdAt).getTime()) / (1000 * 60 * 60);
                if (ageHours <= 24 || !f.psychologist || !f.psychologist.telefone) return false;
                const sentAtMs = f.adminWppReminderSentAt ? new Date(f.adminWppReminderSentAt).getTime() : 0;
                return sentAtMs === 0 || ((Date.now() - sentAtMs) / (1000 * 60 * 60)) >= 48;
            }
            if (filterVal === 'pendente') return !f.feedbackGiven;
            if (filterVal === 'respondido') return f.feedbackGiven;
            if (filterVal === 'fechou') return f.feedbackGiven && (f.dealClosed === 'yes' || f.dealClosed === 'started');
            if (filterVal === 'nao_recebeu') return f.feedbackGiven && !f.contactReceived;
            return true;
        });
        applyWppSort();
    };

    window.sortWppData = function(column) {
        if (window.wppDataState.sortColumn === column) {
            window.wppDataState.sortDirection = window.wppDataState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            window.wppDataState.sortColumn = column;
            window.wppDataState.sortDirection = 'asc';
        }
        
        ['data', 'origem', 'psi', 'paciente', 'recebeu', 'fechou', 'status'].forEach(col => {
            const icon = document.getElementById(`sort-wpp-${col}`);
            if (icon) {
                if (col === column) {
                    icon.textContent = window.wppDataState.sortDirection === 'asc' ? '↑' : '↓';
                    icon.style.opacity = '1';
                } else {
                    icon.textContent = '↕';
                    icon.style.opacity = '0.5';
                }
            }
        });
        
        applyWppSort();
    };

    function applyWppSort() {
        if (!window.wppDataState.filteredFeedbacks) return;
        const col = window.wppDataState.sortColumn;
        const dir = window.wppDataState.sortDirection === 'asc' ? 1 : -1;
        
        window.wppDataState.filteredFeedbacks.sort((a, b) => {
            let valA, valB;
            
            if (col === 'data') {
                valA = new Date(a.createdAt).getTime();
                valB = new Date(b.createdAt).getTime();
            } else if (col === 'origem') {
                valA = (a.utmSource || '').toLowerCase();
                valB = (b.utmSource || '').toLowerCase();
            } else if (col === 'psi') {
                valA = a.psychologist && a.psychologist.nome ? a.psychologist.nome.toLowerCase() : '';
                valB = b.psychologist && b.psychologist.nome ? b.psychologist.nome.toLowerCase() : '';
            } else if (col === 'paciente') {
                valA = (a.guestName || '').toLowerCase();
                valB = (b.guestName || '').toLowerCase();
            } else if (col === 'recebeu') {
                valA = a.contactReceived === true ? 1 : (a.contactReceived === false ? -1 : 0);
                valB = b.contactReceived === true ? 1 : (b.contactReceived === false ? -1 : 0);
            } else if (col === 'fechou') {
                valA = (a.dealClosed === 'yes' || a.dealClosed === 'started') ? 1 : ((a.dealClosed === 'no' || a.dealClosed === 'not_started' || a.dealClosed === 'ghosted') ? -1 : 0);
                valB = (b.dealClosed === 'yes' || b.dealClosed === 'started') ? 1 : ((b.dealClosed === 'no' || b.dealClosed === 'not_started' || b.dealClosed === 'ghosted') ? -1 : 0);
            } else if (col === 'status') {
                valA = a.feedbackGiven ? 1 : -1;
                valB = b.feedbackGiven ? 1 : -1;
            }
            
            if (valA < valB) return -1 * dir;
            if (valA > valB) return 1 * dir;
            return 0;
        });
        
        renderWppTableOnly();
    }

    window.prevWppPage = function() {
        if (window.wppDataState.currentPage > 1) {
            window.wppDataState.currentPage--;
            renderWppTableOnly();
        }
    };

    window.nextWppPage = function() {
        const totalPages = Math.ceil(window.wppDataState.filteredFeedbacks.length / window.wppDataState.itemsPerPage);
        if (window.wppDataState.currentPage < totalPages) {
            window.wppDataState.currentPage++;
            renderWppTableOnly();
        }
    };

    window.markWppAsSent = async function(psiId, wppLink) {
        // Abre o wpp imediatamente para não ser bloqueado pelo popup blocker
        window.open(wppLink, '_blank');
        
        try {
            const token = localStorage.getItem('Yelo_admin_token') || localStorage.getItem('Yelo_token');
            const response = await fetch(`/api/admin/whatsapp-feedbacks/remind/${psiId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                // Ao dar certo, recarrega a tabela de conversões para pegar os novos dados do banco
                const btnLoad = document.querySelector(`button[onclick="loadWppFeedbacks()"]`);
                if (btnLoad) {
                    btnLoad.click();
                } else if (typeof loadWppFeedbacks === 'function') {
                    loadWppFeedbacks();
                }
            } else {
                console.error('Falha ao registrar cobrança no servidor.');
            }
        } catch (e) {
            console.error('Erro ao marcar reminder:', e);
        }
    };

    function renderWppTableOnly() {
        const tbody = document.getElementById('whatsapp-feedback-tbody');
        const paginationControls = document.getElementById('wpp-pagination-controls');
        const paginationInfo = document.getElementById('wpp-pagination-info');
        const btnPrev = document.getElementById('btn-wpp-prev');
        const btnNext = document.getElementById('btn-wpp-next');
        
        if (!tbody) return;

        const filtered = window.wppDataState.filteredFeedbacks;
        
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">Nenhum contato encontrado para este filtro.</td></tr>';
            if (paginationControls) paginationControls.style.display = 'none';
            return;
        }

        const totalPages = Math.ceil(filtered.length / window.wppDataState.itemsPerPage);
        if (window.wppDataState.currentPage > totalPages) window.wppDataState.currentPage = totalPages;
        
        const startIdx = (window.wppDataState.currentPage - 1) * window.wppDataState.itemsPerPage;
        const endIdx = startIdx + window.wppDataState.itemsPerPage;
        const pageItems = filtered.slice(startIdx, endIdx);

        if (paginationControls) {
            paginationControls.style.display = 'flex';
            paginationInfo.innerText = `Mostrando ${startIdx + 1}-${Math.min(endIdx, filtered.length)} de ${filtered.length}`;
            btnPrev.disabled = window.wppDataState.currentPage === 1;
            btnNext.disabled = window.wppDataState.currentPage === totalPages;
        }

        tbody.innerHTML = pageItems.map(f => {
            const dataClique = new Date(f.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            let contato = '<span style="color:#888;">⏳ Aguardando psi</span>';
            let fechou = '-';
            let status = '<span class="status status-pendente" style="background: #f8f9fa; color: #6c757d; font-size: 0.75rem; border: 1px solid #dee2e6; padding: 4px 10px; border-radius: 20px;">Pendente</span>';
            
            if (!f.feedbackGiven && f.adminWppReminderSentAt) {
                const sentDate = new Date(f.adminWppReminderSentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                status = `<span class="status status-pendente" title="Follow-up enviado pelo CRM" style="background: #fef08a; color: #854d0e; font-size: 0.75rem; border: 1px solid #fde047; padding: 4px 10px; border-radius: 20px;">Cobrado (${sentDate})</span>`;
            }
            
            const safePsiId = f.psychologistId || (f.psychologist ? f.psychologist.id : '');

            if (f.feedbackGiven) {
                status = '<span class="status status-ativo" style="background: #e0f2fe; color: #0369a1; font-size: 0.75rem; border: 1px solid #bae6fd; padding: 4px 10px; border-radius: 20px;">Respondido</span>';
                if (f.contactReceived) {
                    contato = '✅ Sim';
                    if (f.dealClosed === 'yes' || f.dealClosed === 'started') fechou = '✅ <strong style="color:#16a34a">Fechou!</strong>';
                    else if (f.dealClosed === 'talking') fechou = '⏳ <span style="color:#ca8a04">Em negociação</span>';
                    else if (f.dealClosed === 'no' || f.dealClosed === 'not_started' || f.dealClosed === 'ghosted') fechou = '❌ <span style="color:#dc2626">Não</span>';
                    else if (f.dealClosed === 'no_contact' || f.dealClosed === 'wpp_issue' || f.dealClosed === 'unknown') fechou = '👻 <span style="color:#6b7280">Fantasma</span>';
                    else fechou = '❌ Não';
                } else {
                    contato = '❌ Não chegou';
                    fechou = '-';
                }
            } else {
                // Lógica dos botões: Responder Manualmente e Cobrança via WhatsApp
                const baseUrl = window.location.origin.includes('localhost') ? 'http://localhost:3000' : 'https://www.yelopsi.com.br';
                const linkFeedback = f.feedbackToken ? `${baseUrl}/magic-feedback.html?token=${f.feedbackToken}` : `${baseUrl}/psi/dashboard`;
                
                const btnManual = `<a href="${linkFeedback}" target="_blank" style="display:inline-flex; align-items:center; justify-content:center; background:#3b82f6; color:#fff; border-radius:50%; width:26px; height:26px; margin-left:8px; text-decoration:none; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(59,130,246,0.3);" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Responder Manualmente pelo Profissional">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </a>`;
                
                // 1. Não mostrar Wpp se tiver menos de 48h
                const createdAtMs = new Date(f.createdAt).getTime();
                const nowMs = Date.now();
                const ageHours = (nowMs - createdAtMs) / (1000 * 60 * 60);
                
                if (ageHours > 48 && f.psychologist && f.psychologist.telefone) {
                    const sentAtMs = f.adminWppReminderSentAt ? new Date(f.adminWppReminderSentAt).getTime() : 0;
                    const count = f.adminWppReminderCount || 0;
                    
                    if (count >= 2) {
                        // BLOQUEADO - Já foram enviados os 2 lembretes máximos
                        const btnWpp = `<span style="display:inline-flex; align-items:center; justify-content:center; background:#9ca3af; color:#fff; border-radius:50%; width:26px; height:26px; margin-left:8px; cursor:default;" title="Lembretes esgotados (máximo de 2)">
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                        </span>`;
                        status = `<div style="display:flex; align-items:center; justify-content:center;">${status}${btnManual}${btnWpp}</div>`;
                    } else {
                        const hoursSinceLastReminder = sentAtMs ? (nowMs - sentAtMs) / (1000 * 60 * 60) : 9999;
                        
                        if (hoursSinceLastReminder < 48) {
                            // BLOQUEADO - Já cobrado recentemente (menos de 48h)
                            const btnWpp = `<span style="display:inline-flex; align-items:center; justify-content:center; background:#9ca3af; color:#fff; border-radius:50%; width:26px; height:26px; margin-left:8px; cursor:default;" title="Cobrança já enviada nas últimas 48h">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </span>`;
                            status = `<div style="display:flex; align-items:center; justify-content:center;">${status}${btnManual}${btnWpp}</div>`;
                        } else {
                            // LIBERADO - Pode cobrar
                            const phoneRaw = f.psychologist.telefone.replace(/\D/g, '');
                            const phone = phoneRaw.startsWith('55') ? phoneRaw : (phoneRaw.length >= 10 ? `55${phoneRaw}` : phoneRaw);
                            const psiNameFirst = (f.psychologist.nome || 'Psi').split(' ')[0];
                            const patientText = f.guestName ? `o(a) paciente ${f.guestName}` : 'um paciente';
                            
                            let msgWpp = '';
                            if (count === 0) {
                                msgWpp = `Olá, ${psiNameFirst}!\nPrecisamos da sua ajuda com um retorno rápido.\n${patientText} entrou em contato com você pela Yelo. Você pode acessar o link abaixo e informar:\n• A mensagem chegou?\n• O paciente iniciou a terapia?\nLeva menos de 1 minuto e essa informação é essencial para avaliarmos a qualidade dos encaminhamentos.\n\nResponder agora:\n👉 ${linkFeedback}\n\nObrigado! 🌿`;
                            } else {
                                msgWpp = `Olá, ${psiNameFirst}! Tudo bem? 😊\n\nPassando para lembrar sobre ${patientText}.\n\nAinda estamos aguardando seu retorno para saber o que aconteceu com esse encaminhamento. Basta informar se a mensagem chegou e se o atendimento foi iniciado.\n\nEsse retorno leva menos de 1 minuto e nos ajuda a melhorar os próximos encaminhamentos para você e para toda a comunidade da Yelo.\n\nVocê pode atualizar por aqui:\n👉 ${linkFeedback}\n\nObrigado! 🌿`;
                            }
                            
                            const wppLink = `https://wa.me/${phone}?text=${encodeURIComponent(msgWpp)}`;
                            
                            const btnWpp = `<a href="javascript:void(0)" onclick="window.markWppAsSent('${safePsiId}', '${wppLink}')" style="display:inline-flex; align-items:center; justify-content:center; background:#25D366; color:#fff; border-radius:50%; width:26px; height:26px; margin-left:8px; text-decoration:none; transition: transform 0.2s; box-shadow: 0 2px 4px rgba(37,211,102,0.3);" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" title="Cobrar resposta via WhatsApp">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            </a>`;
                            status = `<div style="display:flex; align-items:center; justify-content:center;">${status}${btnManual}${btnWpp}</div>`;
                        }
                    }
                } else {
                    // Se não tiver 48h ainda ou não tiver whatsapp, apenas exibe o btnManual
                    status = `<div style="display:flex; align-items:center; justify-content:center;">${status}${btnManual}</div>`;
                }
            }
            
            return `<tr>
                <td data-label="Data do Clique" style="color: #666; font-size: 0.9rem;">${dataClique}</td>
                <td data-label="Origem (UTM)" style="color: #666; font-size: 0.85rem;">${f.utmSource || '-'}</td>
                <td data-label="Psicólogo"><strong style="color: var(--verde-escuro); cursor: pointer; text-decoration: underline;" onclick="openFunnelPsiDrawer('${safePsiId}')">${f.psychologist ? f.psychologist.nome : 'Psi Removido'}</strong></td>
                <td data-label="Paciente / Lead">${f.guestName || 'Visitante'}</td>
                <td data-label="Recebeu Mensagem?" style="text-align: center;">${contato}</td>
                <td data-label="Fechou Negócio?" style="text-align: center;">${fechou}</td>
                <td data-label="Status da Resposta" style="text-align: center;">${status}</td>
            </tr>`;
        }).join('');
    }

    function renderWppFeedbacks(feedbacks) {
        window.wppDataState.allFeedbacks = feedbacks;
        
        const total = feedbacks.length;
        const respondidos = feedbacks.filter(f => f.feedbackGiven).length;
        const taxaResposta = total > 0 ? ((respondidos / total) * 100).toFixed(1) : 0;
        const taxaNaoResposta = total > 0 ? (100 - parseFloat(taxaResposta)).toFixed(1) : 0;

        const recebidas = feedbacks.filter(f => f.feedbackGiven && f.contactReceived).length;
        const fechados = feedbacks.filter(f => f.feedbackGiven && f.contactReceived && (f.dealClosed === 'yes' || f.dealClosed === 'started')).length;
        const negociacao = feedbacks.filter(f => f.feedbackGiven && f.contactReceived && f.dealClosed === 'talking').length;
        
        const fantasmas = feedbacks.filter(f => f.feedbackGiven && !f.contactReceived).length;
        const taxaFechamento = recebidas > 0 ? ((fechados / recebidas) * 100).toFixed(1) : 0;
        const taxaNaoFechamento = recebidas > 0 ? (100 - parseFloat(taxaFechamento)).toFixed(1) : 0;

        const elWppTotal = document.getElementById('kpi-wpp-total-feedbacks');
        const elWppRec = document.getElementById('kpi-wpp-recebidas');
        const elWppFec = document.getElementById('kpi-wpp-fechados');
        const elWppNeg = document.getElementById('kpi-wpp-negociacao');
        const elWppFant = document.getElementById('kpi-wpp-fantasmas');

        const elWppTx = document.getElementById('kpi-wpp-tx-resposta');
        const elWppTxNaoResp = document.getElementById('kpi-wpp-tx-nao-resposta');
        const elWppTxFec = document.getElementById('kpi-wpp-tx-fechamento');
        const elWppTxNaoFec = document.getElementById('kpi-wpp-tx-nao-fechamento');

        if (elWppTotal) elWppTotal.innerText = total;
        if (elWppRec) elWppRec.innerText = recebidas;
        if (elWppFec) elWppFec.innerText = fechados;
        if (elWppNeg) elWppNeg.innerText = negociacao;
        if (elWppFant) elWppFant.innerText = fantasmas;

        if (elWppTx) elWppTx.innerText = taxaResposta + '%';
        if (elWppTxNaoResp) elWppTxNaoResp.innerText = taxaNaoResposta + '%';
        if (elWppTxFec) elWppTxFec.innerText = taxaFechamento + '%';
        if (elWppTxNaoFec) elWppTxNaoFec.innerText = taxaNaoFechamento + '%';

        window.applyWppFilter(); // Já faz o filtro, paginação e renderização da tabela
    }

    function renderUXFeedbacks(dataUx) {
        const tbody = document.getElementById('ux-feedbacks-tbody');
        const elTotal = document.getElementById('kpi-ux-total');
        const elMedia = document.getElementById('kpi-ux-media');

        if (elTotal) elTotal.innerText = dataUx.stats ? dataUx.stats.total : '0';
        if (elMedia) elMedia.innerText = dataUx.stats ? parseFloat(dataUx.stats.media).toFixed(1) : '0.0';

        if (!tbody) return;

        const reviews = dataUx.reviews || [];
        
        if (reviews.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #666;">Nenhuma avaliação UX registrada até o momento.</td></tr>';
            return;
        }

        tbody.innerHTML = reviews.map(r => {
            const dataRow = r.createdAt ? new Date(r.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const starsHtml = '⭐'.repeat(r.rating || 0) + '<span style="color:#e2e8f0;">' + '⭐'.repeat(5 - (r.rating || 0)) + '</span>';
            const feedbackText = r.feedback ? `"${r.feedback}"` : '<em style="color:#aaa;">Sem comentário</em>';
            
            return `<tr>
                <td data-label="Data" style="color: #666; font-size: 0.9rem; white-space: nowrap;">${dataRow}</td>
                <td data-label="Nota" style="text-align: center; font-size: 1.1rem;" title="Nota ${r.rating}">${starsHtml}</td>
                <td data-label="Comentário" style="max-width: 400px; white-space: normal; overflow-wrap: break-word; color: #333;">${feedbackText}</td>
            </tr>`;
        }).join('');
    }

    // --- ORDENAÇÃO DO RANKING (FRONTEND) ---
    window.sortRanking = function(column) {
        if (!globalRankingData) return;
        
        if (currentRankingSort.column === column) {
            currentRankingSort.direction = currentRankingSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentRankingSort.column = column;
            currentRankingSort.direction = column === 'nome' || column === 'posicao' ? 'asc' : 'desc';
        }
        
        const sortedData = [...globalRankingData].sort((a, b) => {
            let valA = column === 'conversao' ? a.conversaoVal : (column === 'posicao' ? a.originalPos : a[column]);
            let valB = column === 'conversao' ? b.conversaoVal : (column === 'posicao' ? b.originalPos : b[column]);
            
            if (typeof valA === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
            
            if (valA < valB) return currentRankingSort.direction === 'asc' ? -1 : 1;
            if (valA > valB) return currentRankingSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        updateSortIndicators(column);
        renderRankingPsi(sortedData);
    };

    function updateSortIndicators(activeColumn) {
        document.querySelectorAll('.sortable-header').forEach(th => {
            const col = th.getAttribute('data-sort');
            let text = th.innerText.replace(' ⬆️', '').replace(' ⬇️', '').replace(' ↕️', '');
            th.innerText = text + (col === activeColumn ? (currentRankingSort.direction === 'asc' ? ' ⬆️' : ' ⬇️') : ' ↕️');
        });
    }

    function renderRankingPsi(ranking) {
        const tbody = document.getElementById('ranking-psi-tbody');
        if (!tbody) return;

        if (!ranking) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #b45309; background: #fffbeb; font-weight: 500;">O endpoint <code>/api/admin/analytics/ranking</code> está pendente no servidor backend.</td></tr>';
            return;
        }

        if (ranking.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #666;">Nenhum dado de performance encontrado no período.</td></tr>';
            return;
        }

        tbody.innerHTML = ranking.map((item, index) => {
            let badgePos = `<strong>${item.originalPos}º</strong>`;
            if (item.originalPos === 1) badgePos = `<span style="background: #fef08a; color: #b45309; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: bold;">🥇 1º</span>`;
            else if (item.originalPos === 2) badgePos = `<span style="background: #e5e7eb; color: #4b5563; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: bold;">🥈 2º</span>`;
            else if (item.originalPos === 3) badgePos = `<span style="background: #fed7aa; color: #9a3412; padding: 4px 10px; border-radius: 20px; font-size: 0.9rem; font-weight: bold;">🥉 3º</span>`;

            const visitasTotais = (item.aparicoesBusca || 0) + (item.visitasDiretas || 0);
            const conversao = visitasTotais > 0 ? (((item.cliquesWpp || 0) / visitasTotais) * 100).toFixed(1) + '%' : '0%';

            return `<tr>
                <td data-label="Posição" style="text-align: center;">${badgePos}</td>
                <td data-label="Psicólogo"><strong style="color: var(--verde-escuro); cursor: pointer; text-decoration: underline;" onclick="openFunnelPsiDrawer('${item.id}')">${item.nome}</strong></td>
                <td data-label="Cliques WhatsApp" style="text-align: center; font-weight: bold; color: #16a34a;">${item.cliquesWpp || 0}</td>
                <td data-label="Aparições na Busca" style="text-align: center; color: #4b5563;">${item.aparicoesBusca || 0}</td>
                <td data-label="Visitas Diretas" style="text-align: center; color: #4b5563;">${item.visitasDiretas || 0}</td>
                <td data-label="Conversão" style="text-align: center; font-weight: bold; color: #3b82f6;">${conversao}</td>
            </tr>`;
        }).join('');
    }

    window.openFunnelPsiDrawer = async function(psiId) {
        if(!psiId || psiId === 'undefined') return;
        const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
        
        const drawer = document.getElementById('drawer-cs-overlay');
        if(drawer) drawer.classList.add('active');
        
        document.getElementById('cs-name').textContent = "Carregando...";
        document.getElementById('cs-email').textContent = "";
        document.getElementById('cs-phone').textContent = "Tel: ";
        document.getElementById('cs-crp').textContent = "CRP: ";
        document.getElementById('cs-date').textContent = "Desde: ";
        document.getElementById('cs-health-pct').textContent = "0%";
        document.getElementById('cs-health-bar').style.width = "0%";
        document.getElementById('cs-health-checks').innerHTML = '<li>Carregando...</li>';
        document.getElementById('cs-plan').textContent = "-";
        document.getElementById('cs-expire').textContent = "-";
        document.getElementById('cs-actions-container').innerHTML = '';

        try {
            let psi = null;
            
            const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${psiId}/full-details`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if(!res.ok) throw new Error("Falha ao buscar detalhes do profissional");
            const data = await res.json();
            psi = data.psychologist;
            
            if(!psi) throw new Error("Profissional não encontrado nos registros");

            document.getElementById('cs-name').textContent = psi.nome;
            document.getElementById('cs-email').textContent = psi.email || 'Sem e-mail';
            document.getElementById('cs-phone').textContent = `Tel: ${psi.telefone || '-'}`;
            document.getElementById('cs-crp').textContent = `CRP: ${psi.crp || '-'}`;
            document.getElementById('cs-date').textContent = `Desde: ${new Date(psi.createdAt).toLocaleDateString('pt-BR')}`;
            
            const avatarImg = document.getElementById('cs-avatar');
            const avatarFallback = document.getElementById('cs-avatar-fallback');
            if (psi.fotoUrl) {
                avatarImg.src = psi.fotoUrl;
                avatarImg.style.display = 'block';
                avatarFallback.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarFallback.style.display = 'flex';
                avatarFallback.textContent = psi.nome ? psi.nome.charAt(0).toUpperCase() : 'P';
            }
            
            const checks = [
                { text: 'Foto de Perfil', ok: !!psi.fotoUrl },
                { text: 'Número do CRP', ok: !!(psi.crp && String(psi.crp).length > 3) },
                { text: 'Biografia', ok: !!(psi.bio && psi.bio.trim().length >= 10) },
                { text: 'WhatsApp', ok: !!(psi.telefone && String(psi.telefone).length > 8) },
                { text: 'Temas de Atuação', ok: Array.isArray(psi.temas_atuacao) ? psi.temas_atuacao.length > 0 : !!psi.temas_atuacao }
            ];
            
            const okCount = checks.filter(c => c.ok).length;
            const score = Math.round((okCount / checks.length) * 100);
            
            document.getElementById('cs-health-pct').textContent = `${score}%`;
            const bar = document.getElementById('cs-health-bar');
            bar.style.width = `${score}%`;
            bar.style.background = score >= 75 ? '#10b981' : (score >= 50 ? '#f59e0b' : '#ef4444');
            const checksHtml = checks.map(c => `<li style="display:flex; align-items:center; gap:8px;">${c.ok ? '<span style="color:#10b981;">✓</span>' : '<span style="color:#ef4444;">✗</span>'} ${c.text}</li>`).join('');
            document.getElementById('cs-health-checks').innerHTML = checksHtml;
            
            let isVip = psi.is_exempt === true || String(psi.is_exempt) === 'true';
            document.getElementById('cs-plan').textContent = isVip ? 'VIP (Isento)' : (psi.planName || 'Nenhum');
            document.getElementById('cs-expire').textContent = isVip ? 'Vitalício' : (psi.planExpiresAt ? new Date(psi.planExpiresAt).toLocaleDateString('pt-BR') : '-');
            
            let numZap = psi.telefone ? psi.telefone.replace(/\D/g, '') : '';
            let actsHtml = '';
            if(numZap && numZap.length >= 10) {
                if(!numZap.startsWith('55')) numZap = '55' + numZap;
                actsHtml += `<a href="https://wa.me/${numZap}" target="_blank" style="display:flex; justify-content:center; padding: 12px; background: #ecfdf5; color: #10b981; text-decoration: none; border-radius: 50px; font-weight: 600; border: 1px solid #a7f3d0;">Chamar no WhatsApp 📱</a>`;
            }
            actsHtml += `<button onclick="window.navigateToPage('admin_detalhes_psicologo.html?id=${psi.id}')" style="padding: 12px; background: white; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 50px; font-weight: 600; cursor: pointer;">Ver Dossiê Completo 🔗</button>`;
            actsHtml += `<button onclick="window.gerarAnaliseCS('${psi.id}')" id="btn-analise-${psi.id}" style="padding: 12px; background: #fef08a; color: #b45309; border: 1px solid #fde047; border-radius: 50px; font-weight: 600; cursor: pointer;">✨ Análise de Perfil (IA)</button>`;
            
            document.getElementById('cs-actions-container').innerHTML = actsHtml;
            
        } catch(e) {
            document.getElementById('cs-actions-container').innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar dados.</p>`;
        }
    };

    window.gerarAnaliseCS = async function(psiId) {
        const btn = document.getElementById(`btn-analise-${psiId}`);
        if(btn) { btn.disabled = true; btn.innerHTML = '<span class="loading-spinner-sm" style="width:14px; height:14px; margin-right:5px; border-width:2px; display:inline-block;"></span> Gerando...'; }
        
        try {
            const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
            const res = await fetch(`${API_BASE_URL}/api/admin/psychologists/${psiId}/analyze`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if(data.message) {
                const copyToClipboardFallback = (text) => {
                    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
                    return new Promise((resolve, reject) => {
                        const textArea = document.createElement("textarea");
                        textArea.value = text;
                        textArea.style.position = "fixed"; textArea.style.left = "-999999px";
                        document.body.appendChild(textArea);
                        textArea.focus(); textArea.select();
                        document.execCommand('copy') ? resolve() : reject();
                        textArea.remove();
                    });
                };
                
                await copyToClipboardFallback(data.message);
                
                let currentList = JSON.parse(localStorage.getItem('yelo_psi_copied_analysis') || '[]');
                if (!currentList.includes(String(psiId))) {
                    currentList.push(String(psiId));
                    localStorage.setItem('yelo_psi_copied_analysis', JSON.stringify(currentList));
                }

                if(window.showToast) window.showToast("Análise copiada para a área de transferência!", "success");
                else alert("Análise copiada!");
            } else {
                throw new Error("Erro na resposta");
            }
        } catch(e) {
            if(window.showToast) window.showToast("Erro ao gerar análise", "error");
            else alert("Erro ao gerar análise");
        } finally {
            if(btn) { btn.disabled = false; btn.innerHTML = '✨ Copiado!'; setTimeout(() => btn.innerHTML = '✨ Análise de Perfil (IA)', 3000); }
        }
    };

    // Acopla o botão
    const btnAtualizar = document.getElementById('btn-atualizar-funil');
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', carregarDadosFunil);
    }

    const btnExportar = document.getElementById('btn-export-csv');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarCSV);
    }

    // Listener do Drawer Close
    const btnCloseDrawer = document.getElementById('btn-close-cs-drawer');
    const drawerOverlay = document.getElementById('drawer-cs-overlay');
    const drawerContent = drawerOverlay ? drawerOverlay.querySelector('.drawer-content') : null;
    const drawerHeader = drawerOverlay ? drawerOverlay.querySelector('.drawer-header-mobile') : null;

    const closeDrawer = () => {
        if (drawerOverlay) drawerOverlay.classList.remove('active');
        if (drawerContent) {
            setTimeout(() => {
                drawerContent.style.removeProperty('transform');
                drawerContent.style.removeProperty('transition');
            }, 300);
        }
    };

    if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', closeDrawer);
    }

    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', (e) => {
            // Se o alvo exato do clique for o overlay (fundo escuro) e não o conteúdo branco, fecha o painel
            if (e.target === drawerOverlay) closeDrawer();
        });
    }

    // Lógica de Swipe Down APENAS NO CABEÇALHO (Para não travar o scroll do conteúdo)
    let startY = 0;
    let currentY = 0;
    
    if (drawerHeader && drawerContent) {
        drawerHeader.addEventListener('touchstart', (e) => {
            if (window.innerWidth > 768) return;
            startY = e.touches[0].clientY;
            currentY = startY;
            drawerContent.style.setProperty('transition', 'none', 'important');
        }, { passive: true });
        
        drawerHeader.addEventListener('touchmove', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            currentY = e.touches[0].clientY;
            const diffY = currentY - startY;
            if (diffY > 0) { 
                drawerContent.style.setProperty('transform', `translateY(${diffY}px)`, 'important'); 
                e.preventDefault(); 
            }
        }, { passive: false });
        
        drawerHeader.addEventListener('touchend', (e) => {
            if (window.innerWidth > 768 || startY === 0) return;
            const diffY = currentY - startY;
            drawerContent.style.setProperty('transition', 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)', 'important');
            if (diffY > 80) { closeDrawer(); }
            else { drawerContent.style.setProperty('transform', 'translateY(0)', 'important'); setTimeout(() => { drawerContent.style.removeProperty('transform'); drawerContent.style.removeProperty('transition'); }, 300); }
            startY = 0; currentY = 0;
        });
    }

    // --- LÓGICA DO TERMÔMETRO DE ESCALA (ADS) ---
    const btnAnalisarEscala = document.getElementById('btn-analisar-escala');
    if (btnAnalisarEscala) {
        btnAnalisarEscala.addEventListener('click', async () => {
            const cpaStr = document.getElementById('input-cpa').value;
            if (!cpaStr) return alert("Digite o CPA Atual do Google!");
            
            const cpaAtual = parseFloat(cpaStr);
            
            // UI de carregamento
            const originalText = btnAnalisarEscala.innerHTML;
            btnAnalisarEscala.innerHTML = '<span class="loading-spinner-sm" style="width:14px; height:14px; margin-right:5px; border-width:2px; display:inline-block;"></span> Analisando...';
            btnAnalisarEscala.disabled = true;

            try {
                const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
                const res = await fetch(`${API_BASE_URL}/api/admin/termometro`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error("Falha ao buscar dados do termômetro.");
                
                const data = await res.json();
                window.termometroData = data;
                const media = parseFloat(data.mediaLeads || 0);
                
                // Exibe contêiner
                const resultBox = document.getElementById('termometro-result');
                resultBox.style.display = 'block';
                
                const luz = document.getElementById('semaforo-luz');
                const titulo = document.getElementById('semaforo-titulo');
                const msg = document.getElementById('semaforo-msg');
                
                document.getElementById('semaforo-media').textContent = media.toFixed(2);
                document.getElementById('semaforo-totalpsi').textContent = data.totalPsis || 0;

                // LÓGICA DE NEGÓCIO (Sinal)
                if (cpaAtual <= 35 && media < 2) {
                    // SINAL VERDE
                    resultBox.style.backgroundColor = '#ecfdf5';
                    resultBox.style.borderColor = '#a7f3d0';
                    luz.textContent = '🟢';
                    titulo.textContent = 'Sinal Verde: Aumentar Verba';
                    titulo.style.color = '#059669';
                    msg.textContent = 'Acelere o tráfego. Profissionais ociosos e CPA barato.';
                } else if (cpaAtual <= 45 && media >= 2 && media <= 4) {
                    // SINAL AMARELO
                    resultBox.style.backgroundColor = '#fefce8';
                    resultBox.style.borderColor = '#fde047';
                    luz.textContent = '🟡';
                    titulo.textContent = 'Sinal Amarelo: Manter Verba';
                    titulo.style.color = '#ca8a04';
                    msg.textContent = 'Ecossistema equilibrado. Mantenha o orçamento.';
                } else {
                    // SINAL VERMELHO
                    resultBox.style.backgroundColor = '#fef2f2';
                    resultBox.style.borderColor = '#fecaca';
                    luz.textContent = '🔴';
                    titulo.textContent = 'Sinal Vermelho: Congelar / Reduzir';
                    titulo.style.color = '#dc2626';
                    msg.textContent = 'Atenção: Tráfego muito caro ou profissionais lotados de leads.';
                }
                
            } catch(e) {
                console.error(e);
                alert("Erro ao analisar a escala.");
            } finally {
                btnAnalisarEscala.innerHTML = originalText;
                btnAnalisarEscala.disabled = false;
            }
        });
    }

    // --- LÓGICA DA AUDITORIA DE LEADS RECENTES ---
    const btnBuscarLeads = document.getElementById('btn-buscar-leads');
    if (btnBuscarLeads) {
        btnBuscarLeads.addEventListener('click', async () => {
            const tbody = document.getElementById('auditoria-leads-tbody');
            
            // UI de carregamento
            const originalText = btnBuscarLeads.innerHTML;
            btnBuscarLeads.innerHTML = '<span class="loading-spinner-sm" style="width:14px; height:14px; margin-right:5px; border-width:2px; display:inline-block;"></span> Buscando...';
            btnBuscarLeads.disabled = true;
            
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px;"><span class="loading-spinner-sm" style="border-width: 3px; border-top-color: #1B4332;"></span></td></tr>';

            try {
                const startInputEl = document.getElementById('funil-start');
                const endInputEl = document.getElementById('funil-end');
                const queryParams = new URLSearchParams();
                if (startInputEl && startInputEl.value) queryParams.append('startDate', startInputEl.value);
                if (endInputEl && endInputEl.value) queryParams.append('endDate', endInputEl.value);

                const token = localStorage.getItem('Yelo_token_admin') === 'cookie_auth_active' ? 'cookie_auth_active' : localStorage.getItem('Yelo_token');
                const res = await fetch(`${API_BASE_URL}/api/admin/leads-recentes?${queryParams.toString()}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error("Falha ao buscar dados de auditoria.");
                
                const leads = await res.json();
                window.auditoriaData = leads;
                
                if (!leads || leads.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #64748b;">Nenhum lead recebido no período selecionado.</td></tr>';
                    return;
                }
                
                tbody.innerHTML = leads.map(l => {
                    let statusBadge = '<span style="background: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Desconhecido</span>';
                    if (l.status === 'active') {
                        statusBadge = '<span style="background: #ecfdf5; color: #10b981; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Ativo</span>';
                    } else if (l.status === 'pending') {
                        statusBadge = '<span style="background: #fefce8; color: #ca8a04; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Pendente</span>';
                    } else if (l.status === 'inactive') {
                        statusBadge = '<span style="background: #fef2f2; color: #ef4444; padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600;">Inativo</span>';
                    }

                    return `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px; font-weight: 500; color: #1e293b;">${l.nome}</td>
                            <td style="padding: 12px;">${statusBadge}</td>
                            <td style="padding: 12px; text-align: center; font-weight: bold; color: #6366f1;">${l.leads_recentes}</td>
                        </tr>
                    `;
                }).join('');
                
            } catch(e) {
                console.error(e);
                tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: #ef4444;">Erro ao buscar dados. Tente novamente.</td></tr>';
            } finally {
                btnBuscarLeads.innerHTML = originalText;
                btnBuscarLeads.disabled = false;
            }
        });
    }

    // Executa assim que a view injetada carregar
    carregarDadosFunil();
};