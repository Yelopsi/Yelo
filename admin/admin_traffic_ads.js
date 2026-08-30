window.currentPageB2B = 1;
window.currentPageB2C = 1;

window.initializePage = function() {
    // Set default dates: Last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    
    document.getElementById('date-start').value = start.toISOString().split('T')[0];
    document.getElementById('date-end').value = end.toISOString().split('T')[0];

    loadEfficiencyData();
    loadB2BLeads();
    loadB2CLeads();
};

window.applyDateFilter = function() {
    currentPageB2B = 1;
    currentPageB2C = 1;
    loadB2BLeads();
    loadB2CLeads();
};

var API_BASE = window.API_BASE_URL || '';

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/D';
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function getQueryDates() {
    const s = document.getElementById('date-start').value;
    const e = document.getElementById('date-end').value;
    return `&startDate=${s}&endDate=${e}`;
}

// 1. EFICIÊNCIA GLOBAL, DECISÃO E GRÁFICOS
window.loadEfficiencyData = async function() {
    try {
        // Fetch efficiency data and growth data concurrently
        const [effRes, growthRes] = await Promise.all([
            fetch(`${API_BASE}/api/admin/efficiency`),
            fetch(`${API_BASE}/api/admin/growth/overview?days=30`)
        ]);
        
        const data = await effRes.json();
        const growthData = growthRes.ok ? await growthRes.json() : null;
        
        const ltvProjetado = (growthData && growthData.data && growthData.data.ltvProjetado) ? growthData.data.ltvProjetado : 0;

        if (data.weeklyHistory && data.weeklyHistory.length > 0) {
            const hist = data.weeklyHistory;
            
            // Se o mês atual tem R$ 0,00 de gastos lançados, volta a avaliação para o mês passado (fallback dinâmico)
            let currIdx = hist.length - 1;
            const currentSpend = parseFloat(hist[currIdx].meta_ads || 0) + parseFloat(hist[currIdx].google_ads || 0);
            if (currentSpend === 0 && currIdx > 0) {
                currIdx = currIdx - 1;
            }

            const curr = hist[currIdx];
            const prev = currIdx > 0 ? hist[currIdx - 1] : null;

            // Ajusta o nome do mês nas etiquetas dinâmicas
            const monthDate = new Date(curr.week_start + 'T00:00:00'); // Evita timezone bug
            const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'long' });
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            
            const cplLabel = document.getElementById('label-cpl-month');
            if (cplLabel) cplLabel.innerText = `CPL Global (${capitalizedMonth})`;
            const cacLabel = document.getElementById('label-cac-month');
            if (cacLabel) cacLabel.innerText = `CAC Global (${capitalizedMonth})`;
            
            // Render Trend KPIs
            renderTrendKPI('kpi-cpl', 'kpi-cpl-trend', curr.cpl, prev ? prev.cpl : null, true);
            renderTrendKPI('kpi-cac', 'kpi-cac-trend', curr.cac, prev ? prev.cac : null, true);
            
            const totalSpend = parseFloat(curr.meta_ads || 0) + parseFloat(curr.google_ads || 0);
            document.getElementById('kpi-spend').innerText = formatBRL(totalSpend);
            
            // Custo Estimado por Assinante (Por Canal)
            const metaSpend = parseFloat(curr.meta_ads || 0);
            const googleSpend = parseFloat(curr.google_ads || 0);
            const metaPagantes = parseInt(curr.meta_pagantes || 0, 10);
            const googlePagantes = parseInt(curr.google_pagantes || 0, 10);
            
            const metaCac = metaPagantes > 0 ? (metaSpend / metaPagantes) : 0;
            const googleCac = googlePagantes > 0 ? (googleSpend / googlePagantes) : 0;
            
            const prevMetaCac = (prev && prev.meta_pagantes > 0) ? (parseFloat(prev.meta_ads||0) / parseInt(prev.meta_pagantes||0, 10)) : 0;
            const prevGoogleCac = (prev && prev.google_pagantes > 0) ? (parseFloat(prev.google_ads||0) / parseInt(prev.google_pagantes||0, 10)) : 0;

            renderTrendKPI('kpi-meta-cac', 'kpi-meta-trend', metaCac, prevMetaCac, true, metaPagantes === 0);
            renderTrendKPI('kpi-google-cac', 'kpi-google-trend', googleCac, prevGoogleCac, true, googlePagantes === 0);
            
            renderCharts(hist);
            
            // Motor de Decisão
            generateDecisionEngine(hist, ltvProjetado, metaCac, googleCac, currIdx);
        }
    } catch (e) {
        console.error("Erro ao carregar dados de eficiência:", e);
    }
}

function renderTrendKPI(valId, trendId, current, previous, inverseGood = false, isND = false) {
    const valEl = document.getElementById(valId);
    const trendEl = document.getElementById(trendId);
    
    if (isND || current === 0) {
        valEl.innerText = 'N/D';
        if (trendEl) trendEl.innerText = '';
        return;
    }
    
    valEl.innerText = formatBRL(current);
    
    if (!trendEl || previous === null || previous === 0) {
        if (trendEl) trendEl.innerText = '';
        return;
    }
    
    const pct = ((current - previous) / previous) * 100;
    const isGood = inverseGood ? pct < 0 : pct > 0;
    
    if (Math.abs(pct) < 1) {
        trendEl.innerText = 'Estável';
        trendEl.style.color = '#64748b';
        return;
    }
    
    trendEl.innerHTML = `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs ant.`;
    trendEl.style.color = isGood ? '#16a34a' : '#dc2626';
}

function generateDecisionEngine(hist, ltv, metaCac, googleCac, currIdx) {
    const curr = hist[currIdx];
    const prev = currIdx > 0 ? hist[currIdx - 1] : null;
    const prevPrev = currIdx > 1 ? hist[currIdx - 2] : null;

    const totalPagantes = parseInt(curr.meta_pagantes || 0, 10) + parseInt(curr.google_pagantes || 0, 10);
    const totalSpend = parseFloat(curr.meta_ads || 0) + parseFloat(curr.google_ads || 0);
    const globalCac = curr.cac || 0;
    
    // Cálculo da Tendência agregada dos 3 meses ANTERIORES (exclui o mês em avaliação)
    let sumSpend3mPrev = 0;
    let sumPagantes3mPrev = 0;
    for(let i = Math.max(0, currIdx - 3); i < currIdx; i++) {
        sumSpend3mPrev += (parseFloat(hist[i].meta_ads||0) + parseFloat(hist[i].google_ads||0));
        sumPagantes3mPrev += (parseInt(hist[i].meta_pagantes||0, 10) + parseInt(hist[i].google_pagantes||0, 10));
    }
    const avgCac3mPrev = sumPagantes3mPrev > 0 ? (sumSpend3mPrev / sumPagantes3mPrev) : (sumSpend3mPrev > 0 ? sumSpend3mPrev : 0);
    const cacTrendPct = avgCac3mPrev > 0 ? ((globalCac - avgCac3mPrev) / avgCac3mPrev) * 100 : 0;

    // 1. Matriz Estatística
    let statStatus = 'BAIXA';
    let statDesc = `Apenas ${totalPagantes} assinante(s) via tráfego pago no mês.`;
    let statColor = '#ca8a04';
    
    if (totalPagantes >= 10 && totalSpend >= 100) {
        statStatus = 'ALTA';
        statDesc = `Volume excelente (${totalPagantes} assinantes via anúncios).`;
        statColor = '#16a34a';
    } else if (totalPagantes >= 5 && totalSpend >= 50) {
        statStatus = 'MÉDIA';
        statDesc = `Volume razoável (${totalPagantes} assinantes via anúncios).`;
        statColor = '#ea580c';
    }

    // 2. Matriz Econômica
    const ratio = (ltv > 0 && globalCac > 0) ? (ltv / globalCac) : 0;
    let econStatus = 'DESCONHECIDA';
    let econDesc = 'LTV não disponível para cálculo.';
    let econColor = '#64748b';
    
    if (ltv > 0 && globalCac > 0) {
        if (ratio >= 3) {
            econStatus = 'FAVORÁVEL';
            econDesc = `LTV (${formatBRL(ltv)}) é >= 3x o CAC.`;
            econColor = '#16a34a';
        } else if (ratio >= 1.5) {
            econStatus = 'ACEITÁVEL';
            econDesc = `LTV cobre CAC com margem.`;
            econColor = '#ea580c';
        } else {
            econStatus = 'PERIGOSA';
            econDesc = `CAC muito alto para o LTV atual.`;
            econColor = '#dc2626';
        }
    }

    // 3. Matriz Tendência (Persistência)
    let trendStatus = 'ESTÁVEL';
    let trendDesc = 'Custo consistente com a média anterior.';
    let trendColor = '#64748b';
    
    let isPioraPersistente = false;
    let isPioraRecente = false;

    if (sumPagantes3mPrev >= 2) {
        if (cacTrendPct <= -10) {
            trendStatus = 'MELHORANDO';
            trendDesc = `CAC atual está ${Math.abs(cacTrendPct).toFixed(0)}% menor que a média anterior.`;
            trendColor = '#16a34a';
        } else if (cacTrendPct >= 10 || (prev && curr.cac > prev.cac * 1.15)) {
            if (prev && prevPrev && curr.cac > prev.cac && prev.cac > prevPrev.cac) {
                trendStatus = 'PIORA PERSISTENTE';
                trendDesc = `Deterioração contínua: CAC piorou por múltiplos meses consecutivos.`;
                trendColor = '#dc2626';
                isPioraPersistente = true;
            } else {
                trendStatus = 'PIORA RECENTE';
                trendDesc = `CAC atual sofreu piora isolada recente.`;
                trendColor = '#ca8a04';
                isPioraRecente = true;
            }
        }
    }

    let globalStatus = '';
    let globalReason = '';
    let bgColor = '';
    const signals = [];

    // O CAC tolerado ideal é LTV / 3. A regra para pausar é gastar 3x o CAC tolerado sem NENHUMA conversão.
    const cacTolerado = ltv > 0 ? (ltv / 3) : (globalCac > 0 ? globalCac : 200 / 3);
    const maxSpendTolerated = cacTolerado * 3;

    // DECISÃO GLOBAL (Tabela Definitiva)
    if (totalSpend > 0 && totalPagantes === 0) {
        if (totalSpend > maxSpendTolerated) {
            globalStatus = '⛔ PAUSAR';
            globalReason = `Desperdício grave: Gasto > limite tolerável sem nenhuma conversão.`;
            bgColor = '#fef2f2';
        } else {
            globalStatus = '⚪ AGUARDAR MAIS DADOS';
            globalReason = `Gasto inicial sem conversões, mas dentro do limite tolerável.`;
            bgColor = '#f8fafc';
        }
    } else {
        if (econStatus === 'FAVORÁVEL') {
            if (statStatus === 'ALTA' || statStatus === 'MÉDIA') {
                if (isPioraPersistente) {
                    globalStatus = '🟠 REDUZIR PRESSÃO';
                    globalReason = `A economia geral suportaria crescimento, mas a deterioração persistente do custo exige controle orçamentário.`;
                    bgColor = '#ffedd5';
                } else if (isPioraRecente) {
                    globalStatus = '🟡 OTIMIZAR';
                    globalReason = `Custo piorou recentemente. Corrija campanhas antes de voltar a escalar.`;
                    bgColor = '#fefce8';
                } else {
                    globalStatus = '🟢 AUMENTAR';
                    globalReason = `Economia altamente favorável com amostra segura e tendência positiva. Escalar.`;
                    bgColor = '#f0fdf4';
                }
            } else {
                globalStatus = '⚪ MANTER / NÃO ESCALAR';
                globalReason = `A economia aponta retorno alto, mas a falta de volume de dados inibe segurança para escalar.`;
                bgColor = '#f8fafc';
            }
        } else if (econStatus === 'ACEITÁVEL') {
            if (statStatus === 'ALTA' || statStatus === 'MÉDIA') {
                if (isPioraPersistente) {
                    globalStatus = '🟠 REDUZIR PRESSÃO';
                    globalReason = `Margem de lucro estreita + piora persistente de custos = pare de pressionar o orçamento.`;
                    bgColor = '#ffedd5';
                } else if (isPioraRecente) {
                    globalStatus = '🟡 OTIMIZAR';
                    globalReason = `Sinal amarelo no custo recente. Otimizar criativos/público.`;
                    bgColor = '#fefce8';
                } else {
                    globalStatus = '🔵 MANTER';
                    globalReason = `As campanhas se pagam e têm volume. Manter para constância de receita.`;
                    bgColor = '#f0f9ff';
                }
            } else {
                globalStatus = '⚪ MANTER / AGUARDAR';
                globalReason = `Economia tolerável e baixo volume. Não realize mudanças bruscas ainda.`;
                bgColor = '#f8fafc';
            }
        } else { // PERIGOSA
            if (statStatus === 'ALTA' || statStatus === 'MÉDIA') {
                globalStatus = '🔴 REDUZIR';
                globalReason = `O custo de aquisição atual destrói o valor projetado (LTV/CAC < 1.5). Urgente redução onde houver ineficiência.`;
                bgColor = '#fef2f2';
            } else {
                globalStatus = '🟠 PRESERVAR CAPITAL / NÃO ESCALAR';
                globalReason = `Sinais de perigo, mas amostra baixa. Congele orçamento e preserve caixa até o volume de conversões ou o custo (CAC) melhorar.`;
                bgColor = '#ffedd5';
            }
        }
    }
    
    document.getElementById('decision-global-status').innerText = globalStatus;
    document.getElementById('decision-global-status').style.color = (globalStatus.includes('AUMENTAR') ? '#166534' : globalStatus.includes('RED') || globalStatus.includes('PAUSAR') ? '#991b1b' : globalStatus.includes('MANTER / NÃO') || globalStatus.includes('PRESERVAR') || globalStatus.includes('REDUZIR PRESSÃO') ? '#c2410c' : globalStatus.includes('OTIMIZAR') ? '#854d0e' : globalStatus.includes('MANTER') ? '#0369a1' : '#475569');
    document.getElementById('decision-global-status').style.backgroundColor = bgColor === '#f8fafc' ? '#e2e8f0' : (globalStatus.includes('AUMENTAR') ? '#bbf7d0' : globalStatus.includes('RED') || globalStatus.includes('PAUSAR') ? '#fecaca' : globalStatus.includes('OTIMIZAR') ? '#fef08a' : globalStatus.includes('PRESERVAR') || globalStatus.includes('REDUZIR PRESSÃO') ? '#ffedd5' : globalStatus.includes('🔵 MANTER') ? '#bae6fd' : '#e2e8f0');
    document.getElementById('decision-global').style.backgroundColor = bgColor;
    
    // Matriz DOM
    document.getElementById('matrix-stat-status').innerText = statStatus;
    document.getElementById('matrix-stat-status').style.color = statColor;
    document.getElementById('matrix-stat-desc').innerText = statDesc;

    document.getElementById('matrix-econ-status').innerText = econStatus;
    document.getElementById('matrix-econ-status').style.color = econColor;
    document.getElementById('matrix-econ-desc').innerText = econDesc;

    document.getElementById('matrix-trend-status').innerText = trendStatus;
    document.getElementById('matrix-trend-status').style.color = trendColor;
    document.getElementById('matrix-trend-desc').innerText = trendDesc;

    const microDecisions = compareChannels(curr, metaCac, googleCac, ltv, globalCac, signals);
    
    // Resolve Conflito Operacional (Macro manda investir/manter, mas um micro manda pausar)
    if ((globalStatus.includes('MANTER') || globalStatus.includes('AUMENTAR')) && 
        (microDecisions.mDec.includes('PAUSAR') || microDecisions.gDec.includes('PAUSAR'))) {
        let pausedChannel = microDecisions.mDec.includes('PAUSAR') ? 'Meta Ads' : 'Google Ads';
        if (microDecisions.mDec.includes('PAUSAR') && microDecisions.gDec.includes('PAUSAR')) pausedChannel = 'Ambos os canais';
        
        globalReason += ` AVISO: ${pausedChannel} deve ser pausado por desperdício extremo. Redistribua a verba para o canal elegível.`;
    }
    
    document.getElementById('decision-global-reason').innerText = globalReason;
    
    // Render Sinais
    const sigContainer = document.getElementById('decision-signals');
    if (signals.length === 0) sigContainer.innerHTML = '<div style="color:#64748b; font-size:0.9rem;">As justificativas principais estão explicadas na Matriz.</div>';
    else sigContainer.innerHTML = signals.map(s => `<div style="font-size:0.95rem; font-weight:500; background:white; padding:10px 15px; border-radius:8px; border:1px solid #e2e8f0;">${s}</div>`).join('');
}

function compareChannels(curr, metaCac, googleCac, ltv, globalCac, signals) {
    const THRESHOLD_EMPATE = 20; // %
    const THRESHOLD_REDUZIR = 40; // %
    
    const mSpend = parseFloat(curr.meta_ads||0);
    const mPag = parseInt(curr.meta_pagantes||0, 10);
    const gSpend = parseFloat(curr.google_ads||0);
    const gPag = parseInt(curr.google_pagantes||0, 10);
    
    // O CAC tolerado ideal é LTV / 3. A regra extrema avalia se gastamos > 3x o tolerado.
    const cacTolerado = ltv > 0 ? (ltv / 3) : (globalCac > 0 ? globalCac : 200 / 3);
    const tolerado = cacTolerado * 3;

    // Fallback inicial
    let mDec = '⚪ AVALIANDO', mRes = 'Sem dados no período.', mCol = 'background:#f1f5f9; color:#475569;';
    let gDec = '⚪ AVALIANDO', gRes = 'Sem dados no período.', gCol = 'background:#f1f5f9; color:#475569;';

    // Regra extrema (Pausar)
    if (mSpend > tolerado && mPag === 0) { mDec = '🔴 PAUSAR'; mRes = 'Gasto excessivo sem conversão.'; mCol = 'background:#fecaca; color:#991b1b;'; signals.push(`🔴 Meta Ads sem gerar valor persistente.`); }
    else if (mPag === 0 && mSpend > 0) { mDec = '⚪ AGUARDAR'; mRes = 'Coletando dados.'; mCol = 'background:#f1f5f9; color:#475569;'; }

    if (gSpend > tolerado && gPag === 0) { gDec = '🔴 PAUSAR'; gRes = 'Gasto excessivo sem conversão.'; gCol = 'background:#fecaca; color:#991b1b;'; signals.push(`🔴 Google Ads sem gerar valor persistente.`); }
    else if (gPag === 0 && gSpend > 0) { gDec = '⚪ AGUARDAR'; gRes = 'Coletando dados.'; gCol = 'background:#f1f5f9; color:#475569;'; }

    // Comparação Relativa
    if (mPag > 0 && gPag > 0) {
        // Quem é mais barato?
        let diffPct = 0;
        
        if (metaCac < googleCac) {
            diffPct = ((googleCac - metaCac) / googleCac) * 100;
            if (diffPct < THRESHOLD_EMPATE) {
                // Empate técnico
                mDec = '🟡 MANTER'; mRes = 'Empate técnico de eficiência.'; mCol = 'background:#fef08a; color:#854d0e;';
                gDec = '🟡 MANTER'; gRes = 'Empate técnico de eficiência.'; gCol = 'background:#fef08a; color:#854d0e;';
            } else if (diffPct <= THRESHOLD_REDUZIR) {
                // Meta vencedor moderado
                mDec = '🟢 PRIORIZAR'; mRes = `Custa ${diffPct.toFixed(0)}% a menos que o Google.`; mCol = 'background:#bbf7d0; color:#166534;';
                gDec = '🟡 INVESTIGAR'; gRes = `Custa ${diffPct.toFixed(0)}% a mais que o Meta.`; gCol = 'background:#ffedd5; color:#9a3412;';
            } else {
                // Meta vencedor extremo
                mDec = '🟢 PRIORIZAR'; mRes = `Custa ${diffPct.toFixed(0)}% a menos que o Google.`; mCol = 'background:#bbf7d0; color:#166534;';
                gDec = '🔴 REDUZIR'; gRes = `Custa ${diffPct.toFixed(0)}% a mais que o Meta. Reduza distribuição.`; gCol = 'background:#fecaca; color:#991b1b;';
                signals.push(`🔴 Google Ads está custando exageradamente mais caro que o Meta Ads.`);
            }
        } else {
            diffPct = ((metaCac - googleCac) / metaCac) * 100;
            if (diffPct < THRESHOLD_EMPATE) {
                // Empate técnico
                mDec = '🟡 MANTER'; mRes = 'Empate técnico de eficiência.'; mCol = 'background:#fef08a; color:#854d0e;';
                gDec = '🟡 MANTER'; gRes = 'Empate técnico de eficiência.'; gCol = 'background:#fef08a; color:#854d0e;';
            } else if (diffPct <= THRESHOLD_REDUZIR) {
                // Google vencedor moderado
                gDec = '🟢 PRIORIZAR'; gRes = `Custa ${diffPct.toFixed(0)}% a menos que o Meta.`; gCol = 'background:#bbf7d0; color:#166534;';
                mDec = '🟡 INVESTIGAR'; mRes = `Custa ${diffPct.toFixed(0)}% a mais que o Google.`; mCol = 'background:#ffedd5; color:#9a3412;';
            } else {
                // Google vencedor extremo
                gDec = '🟢 PRIORIZAR'; gRes = `Custa ${diffPct.toFixed(0)}% a menos que o Meta.`; gCol = 'background:#bbf7d0; color:#166534;';
                mDec = '🔴 REDUZIR'; mRes = `Custa ${diffPct.toFixed(0)}% a mais que o Google. Reduza distribuição.`; mCol = 'background:#fecaca; color:#991b1b;';
                signals.push(`🔴 Meta Ads está custando exageradamente mais caro que o Google Ads.`);
            }
        }
    } else {
        // Se um não tem pagantes, avalia individual contra Global se possível (fallback)
        if (mPag > 0 && globalCac > 0) {
            mDec = '🟡 MANTER'; mRes = 'Único canal convertendo.'; mCol = 'background:#fef08a; color:#854d0e;';
        }
        if (gPag > 0 && globalCac > 0) {
            gDec = '🟡 MANTER'; gRes = 'Único canal convertendo.'; gCol = 'background:#fef08a; color:#854d0e;';
        }
    }
    
    const mBadgeEl = document.getElementById('decision-meta-badge');
    const mReasonEl = document.getElementById('decision-meta-reason');
    if (mBadgeEl) { mBadgeEl.innerText = mDec; mBadgeEl.style.cssText = mCol; mReasonEl.innerText = mRes; }

    const gBadgeEl = document.getElementById('decision-google-badge');
    const gReasonEl = document.getElementById('decision-google-reason');
    if (gBadgeEl) { gBadgeEl.innerText = gDec; gBadgeEl.style.cssText = gCol; gReasonEl.innerText = gRes; }
    
    return { mDec, gDec };
}

var costChartInstance = null;
var channelChartInstance = null;

function renderCharts(history) {
    const recentHistory = history.slice(-6);
    const labels = recentHistory.map(h => {
        const d = new Date(h.week_start);
        d.setDate(d.getDate() + 1);
        return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    });

    const cplData = recentHistory.map(h => h.cpl);
    const cacData = recentHistory.map(h => h.cac);

    const ctxCost = document.getElementById('costChart').getContext('2d');
    if (costChartInstance) {
        costChartInstance.destroy();
    }
    costChartInstance = new Chart(ctxCost, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'CPL (Custo por Trial)', data: cplData, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'CAC (Custo por Pagante)', data: cacData, borderColor: '#ef4444', tension: 0.3, fill: false }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    const metaTrials = recentHistory.map(h => h.meta_trials || 0);
    const googleTrials = recentHistory.map(h => h.google_trials || 0);

    const ctxChannel = document.getElementById('channelChart').getContext('2d');
    if (channelChartInstance) {
        channelChartInstance.destroy();
    }
    channelChartInstance = new Chart(ctxChannel, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Trials Meta Ads', data: metaTrials, backgroundColor: '#1d4ed8' },
                { label: 'Trials Google Ads', data: googleTrials, backgroundColor: '#dc2626' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });
}

// 2. LEADS B2B (PSICÓLOGOS)
window.loadB2BLeads = async function() {
    const status = document.getElementById('filter-b2b-status').value;
    const channel = document.getElementById('filter-b2b-channel').value;
    
    document.querySelector('#table-b2b tbody').innerHTML = '<tr><td colspan="4">Carregando psicólogos...</td></tr>';
    
    try {
        let url = `${API_BASE}/api/admin/psychologists?limit=10&page=${currentPageB2B}${getQueryDates()}`;
        if (status !== 'all') url += `&status=${status}`;
        if (channel !== 'all') url += `&utmChannel=${channel}`;

        const res = await fetch(url);
        const json = await res.json();
        
        // Render KPIs
        if (json.kpis) {
            document.getElementById('kpi-meta-trial').innerText = json.kpis.meta_trial || 0;
            document.getElementById('kpi-meta-paying').innerText = json.kpis.meta_paying || 0;
            document.getElementById('kpi-google-trial').innerText = json.kpis.google_trial || 0;
            document.getElementById('kpi-google-paying').innerText = json.kpis.google_paying || 0;
            document.getElementById('kpi-wpp-total').innerText = json.kpis.utm_whatsapp || 0;
        }

        let html = '';
        if (json.kpis && json.kpis.meta_campaigns && json.kpis.meta_campaigns.length > 0) {
            let campHtml = '';
            json.kpis.meta_campaigns.forEach(c => {
                campHtml += `<tr>
                    <td><strong>${c.utm_campaign || 'N/D'}</strong></td>
                    <td>${c.utm_content || 'N/D'}</td>
                    <td style="text-align: right; font-weight: 800; color: #1d4ed8;">${c.count}</td>
                </tr>`;
            });
            document.querySelector('#table-campaigns tbody').innerHTML = campHtml;
        } else {
            document.querySelector('#table-campaigns tbody').innerHTML = '<tr><td colspan="3">Nenhuma campanha registrada no período filtrado.</td></tr>';
        }

        if (json.data && json.data.length > 0) {
            json.data.forEach(psi => {
                const badgeUtm = getUtmBadge(psi.utm_source);
                const badgeStatus = getPsiStatusBadge(psi);
                
                html += `
                    <tr>
                        <td><strong>${psi.nome.replace(/\[.*?\] /, '')}</strong><br><span style="font-size:0.75rem; color:#64748b;">${psi.email}</span></td>
                        <td>${formatDate(psi.createdAt)}</td>
                        <td>${badgeStatus}</td>
                        <td>${badgeUtm}<br><span style="font-size:0.75rem; color:#64748b;">Médium: ${psi.utm_medium || 'N/D'} | Campanha: ${psi.utm_campaign || 'N/D'}</span></td>
                    </tr>
                `;
            });
        } else {
            html = '<tr><td colspan="4">Nenhum psicólogo encontrado para este filtro.</td></tr>';
        }
        document.querySelector('#table-b2b tbody').innerHTML = html;
        
        // Paginação
        renderPagination('b2b', json.totalPages, json.totalCount);
    } catch (e) {
        console.error(e);
        document.querySelector('#table-b2b tbody').innerHTML = '<tr><td colspan="4">Erro ao carregar psicólogos.</td></tr>';
    }
}

// 3. LEADS B2C (PACIENTES)
window.loadB2CLeads = async function() {
    const channel = document.getElementById('filter-b2c-channel').value;
    
    document.querySelector('#table-b2c tbody').innerHTML = '<tr><td colspan="3">Carregando pacientes...</td></tr>';
    
    try {
        let url = `${API_BASE}/api/admin/patients?limit=10&page=${currentPageB2C}${getQueryDates()}`;
        if (channel !== 'all') url += `&utmChannel=${channel}`;

        const res = await fetch(url);
        const json = await res.json();
        
        let html = '';
        if (json.data && json.data.length > 0) {
            json.data.forEach(pat => {
                const badgeUtm = getUtmBadge(pat.utm_source);
                
                html += `
                    <tr>
                        <td><strong>${pat.nome.replace(/\[.*?\] /, '')}</strong><br><span style="font-size:0.75rem; color:#64748b;">${pat.email}</span></td>
                        <td>${formatDate(pat.createdAt)}</td>
                        <td>${badgeUtm}<br><span style="font-size:0.75rem; color:#64748b;">Médium: ${pat.utm_medium || 'N/D'} | Campanha: ${pat.utm_campaign || 'N/D'}</span></td>
                    </tr>
                `;
            });
        } else {
            html = '<tr><td colspan="3">Nenhum paciente encontrado para este filtro.</td></tr>';
        }
        document.querySelector('#table-b2c tbody').innerHTML = html;
        
        // Paginação
        renderPagination('b2c', json.totalPages, json.totalCount);
    } catch (e) {
        console.error(e);
        document.querySelector('#table-b2c tbody').innerHTML = '<tr><td colspan="3">Erro ao carregar pacientes.</td></tr>';
    }
}

function renderPagination(type, totalPages, totalCount) {
    const container = document.getElementById(`${type}-pagination`);
    if (totalPages <= 1) {
        container.innerHTML = `<span style="font-size:0.85rem; color:#64748b;">Total: ${totalCount} registros</span>`;
        return;
    }
    
    const currPage = type === 'b2b' ? currentPageB2B : currentPageB2C;
    const btnStyle = "padding:6px 12px; background:#e2e8f0; border:none; border-radius:6px; cursor:pointer;";
    const btnDisabled = "padding:6px 12px; background:#f1f5f9; color:#94a3b8; border:none; border-radius:6px;";
    
    container.innerHTML = `
        <span style="font-size:0.85rem; color:#64748b;">Página ${currPage} de ${totalPages} (${totalCount} registros)</span>
        <div style="display:flex; gap:10px;">
            <button onclick="changePage('${type}', -1)" style="${currPage === 1 ? btnDisabled : btnStyle}" ${currPage === 1 ? 'disabled' : ''}>Anterior</button>
            <button onclick="changePage('${type}', 1)" style="${currPage === totalPages ? btnDisabled : btnStyle}" ${currPage === totalPages ? 'disabled' : ''}>Próxima</button>
        </div>
    `;
}

window.changePage = function(type, dir) {
    if (type === 'b2b') {
        currentPageB2B += dir;
        loadB2BLeads();
    } else {
        currentPageB2C += dir;
        loadB2CLeads();
    }
}

function getUtmBadge(source) {
    if (!source) return '<span class="badge badge-organic">Direto / Orgânico</span>';
    const s = source.toLowerCase();
    if (s.includes('meta') || s.includes('facebook') || s.includes('instagram')) return '<span class="badge badge-meta">Meta Ads</span>';
    if (s.includes('google')) return '<span class="badge badge-google">Google Ads</span>';
    if (s.includes('whatsapp')) return '<span class="badge" style="background:#dcfce3; color:#166534;">WhatsApp</span>';
    return `<span class="badge badge-organic">${source}</span>`;
}

function getPsiStatusBadge(psi) {
    if (psi.status === 'pending' || !psi.isProfileAnalyzed) {
        return '<span class="badge badge-pending">Perfil Incompleto (Pendente)</span>';
    }
    
    const hasSub = !!(psi.subscriptionId);
    if (psi.status === 'active' && hasSub) {
        return `<span class="badge badge-active">Assinante (${psi.plano || '?'})</span>`;
    }
    
    if (psi.status === 'active' && !hasSub && new Date(psi.planExpiresAt) > new Date()) {
        return '<span class="badge badge-trial">Em Trial (14 dias grátis)</span>';
    }
    
    return '<span class="badge badge-inactive">Cancelado / Expirado</span>';
}
