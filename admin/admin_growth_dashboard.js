window.growthLastUpdate = new Date();

window.initializePage = function() {
    loadGrowthData();
};

window.loadGrowthData = async function() {
    const periodDays = document.getElementById('growth-period').value;
    
    document.getElementById('growth-content').style.display = 'none';
    document.getElementById('growth-loading').style.display = 'block';

    window.growthDataState = {
        overview: null,
        acquisition: null,
        demand: null,
        marketing: null,
        cohorts: null
    };

    try {
        const [overviewRes, acqRes, demRes, mktRes, cohortRes, pmfRes, trialsRes] = await Promise.all([
            fetch(`/api/admin/growth/overview?days=${periodDays}`),
            fetch(`/api/admin/growth/acquisition?days=${periodDays}`),
            fetch(`/api/admin/growth/demand?days=${periodDays}`),
            fetch(`/api/admin/growth/marketing?days=${periodDays}`),
            fetch(`/api/admin/growth/cohorts`),
            fetch(`/api/admin/growth/pmf`),
            fetch(`/api/admin/growth/upcoming-trials`)
        ]);

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // 1. OVERVIEW (Primeira Viewport)
        if (overviewRes.ok) {
            const result = await overviewRes.json();
            const data = result.data;
            window.growthDataState.overview = data;
            
            // 1. CRESCIMENTO
            document.getElementById('g-mrr-total').innerText = formatBRL(data.mrrTotal);
            
            const netNew = data.netNewMrr || 0;
            const netNewColor = netNew > 0 ? '#10b981' : (netNew < 0 ? '#ef4444' : '#64748b');
            const netNewSignal = netNew > 0 ? '+' : '';
            document.getElementById('g-net-new-mrr').innerHTML = `<span style="color:${netNewColor};">${netNewSignal}${formatBRL(netNew)} Net New MRR</span>`;
            
            const mrrAnt = data.mrrAnterior || 0;
            let varPct = 0;
            if (mrrAnt > 0) varPct = ((data.mrrTotal - mrrAnt) / mrrAnt) * 100;
            const varColor = varPct > 0 ? '#10b981' : (varPct < 0 ? '#ef4444' : '#64748b');
            document.getElementById('g-mrr-anterior').innerHTML = `vs ${formatBRL(mrrAnt)} (<span style="color:${varColor};">${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%</span>)`;

            // 2. VENDAS
            document.getElementById('g-novos-pagantes-main').innerText = data.novosPagantes;
            document.getElementById('g-trial-conv').innerText = data.trialConversionRate ? data.trialConversionRate.toFixed(1) + '%' : '0%';
            document.getElementById('g-trials-ativos').innerText = data.trialsAtivos;

            // 3. VALOR (HEALTH RATE)
            document.getElementById('g-health-rate').innerText = data.pctDemanda ? data.pctDemanda.toFixed(1) + '%' : '0%';
            document.getElementById('g-health-fraction').innerText = `${data.pagantesComDemandaCount} de ${data.totalAtivos}`;
            
            // 4. AÇÃO (SEM DEMANDA)
            const semDemandaCount = data.totalAtivos - data.pagantesComDemandaCount;
            document.getElementById('g-sem-demanda-count').innerText = semDemandaCount;
            document.getElementById('g-mrr-sem-demanda').innerText = formatBRL(data.mrrSemDemanda);

            // 5. RETENÇÃO
            document.getElementById('g-churn-pagantes-main').innerText = data.churnPagantes;
            document.getElementById('g-churn-rate').innerText = data.taxaChurnPagantes ? data.taxaChurnPagantes.toFixed(1) + '%' : '0%';
            document.getElementById('g-mrr-perdido').innerText = `- ${formatBRL(data.mrrPerdido || 0)} MRR perdido`;
        }

        // 2. ACQUISITION FUNNEL (E TEMPO ATÉ PRIMEIRO CONTATO)
        if (acqRes.ok) {
            const result = await acqRes.json();
            const d = result.data;
            window.growthDataState.acquisition = d;
            
            document.getElementById('f-acq-leads').innerText = d.leadsIdentificados;
            document.getElementById('f-acq-contact').innerText = d.primeiroContato;
            document.getElementById('f-acq-trial').innerText = d.trialsIniciados;
            document.getElementById('f-acq-paid').innerText = d.viraramPagantes;

            const c1 = d.leadsIdentificados > 0 ? (d.primeiroContato/d.leadsIdentificados*100) : 0;
            const c3 = d.primeiroContato > 0 ? (d.trialsIniciados/d.primeiroContato*100) : 0;
            const c4 = d.trialsIniciados > 0 ? (d.viraramPagantes/d.trialsIniciados*100) : 0;

            document.getElementById('f-acq-conv-1').innerText = c1.toFixed(1)+'%';
            document.getElementById('f-acq-conv-3').innerText = c3.toFixed(1)+'%';
            document.getElementById('f-acq-conv-4').innerText = c4.toFixed(1)+'%';

            if (d.timeToFirstContact) {
                if (d.timeToFirstContact.medianDays !== null) {
                    let text = d.timeToFirstContact.medianDays + ' dias';
                    if (d.timeToFirstContact.sampleSize < 5) text += ' (baixa conf.)';
                    document.getElementById('g-time-contact').innerText = text;
                } else {
                    document.getElementById('g-time-contact').innerText = 'N/D';
                }
            }
        }

        // 3. DEMAND FUNNEL & MARKETPLACE
        if (demRes.ok) {
            const result = await demRes.json();
            const { funnel, health } = result.data;
            window.growthDataState.demand = result.data;
            
            // FUNIL 1: PACIENTES
            document.getElementById('f-dem-visits').innerText = funnel.visitas;
            document.getElementById('f-dem-searches').innerText = funnel.questionariosIniciados;
            document.getElementById('f-dem-concluidos').innerText = funnel.questionariosConcluidos;
            
            const d1 = funnel.visitas > 0 ? (funnel.questionariosIniciados/funnel.visitas*100) : 0;
            const d2 = funnel.questionariosIniciados > 0 ? (funnel.questionariosConcluidos/funnel.questionariosIniciados*100) : 0;
            document.getElementById('f-dem-c1').innerText = d1.toFixed(1)+'%';
            document.getElementById('f-dem-c2').innerText = d2.toFixed(1)+'%';

            if (funnel.questionariosIniciados > funnel.visitas || funnel.questionariosConcluidos > funnel.questionariosIniciados) {
                document.getElementById('alert-demanda-1').style.display = 'block';
            } else {
                document.getElementById('alert-demanda-1').style.display = 'none';
            }

            // FUNIL 2: (Agora integrado no funil de aquisição)
            if (funnel.matches === null) {
                document.getElementById('f-dem-matches').innerHTML = '<span style="font-size:0.8rem; color:#f59e0b;">Dados insuficientes</span>';
                document.getElementById('f-dem-c3').innerText = '';
            } else {
                document.getElementById('f-dem-matches').innerText = funnel.matches;
                // Exibe a média de indicações por questionário concluído
                const d3 = funnel.questionariosConcluidos > 0 ? (funnel.matches/funnel.questionariosConcluidos) : 0;
                document.getElementById('f-dem-c3').innerText = d3.toFixed(1)+' psis/busca';
            }

            document.getElementById('f-dem-wpp').innerText = funnel.contatos;
            // Se matches é nulo, converte direto de concluidos, senao de matches
            const baseWpp = funnel.matches !== null ? funnel.matches : funnel.questionariosConcluidos;
            const d4 = baseWpp > 0 ? (funnel.contatos / baseWpp * 100) : 0;
            document.getElementById('f-dem-c4').innerText = d4.toFixed(1)+'%';

        }

        // 4. MARKETING
        if (mktRes.ok) {
            const result = await mktRes.json();
            const d = result.data;
            window.growthDataState.marketing = d;
            
            // Política: CAC é N/D por falta de atribuição
            document.getElementById('g-cac-b2b').innerText = 'N/D';
            document.getElementById('g-cac-b2c').innerText = 'N/D';
            document.getElementById('g-marketing-na').innerText = formatBRL(d.marketingNaoAtribuido || d.totalMarketingSpend);
            
            document.getElementById('g-payback').innerText = 'N/D';
            
            if (d.amostraSuficienteLTV && d.ltv > 0) {
                document.getElementById('g-ltv').innerText = formatBRL(d.ltv);
                document.getElementById('g-ltv').style.color = '#8b5cf6';
                document.getElementById('g-ltv-warn').innerText = '';
            } else {
                document.getElementById('g-ltv').innerText = d.ltv > 0 ? formatBRL(d.ltv) : 'N/D';
                document.getElementById('g-ltv').style.color = '#94a3b8';
                document.getElementById('g-ltv-warn').innerText = 'LTV estimado — baixa confiança';
            }
        }

        // 5. COHORTS
        if (cohortRes.ok) {
            const result = await cohortRes.json();
            const tbody = document.getElementById('cohorts-tbody');
            tbody.innerHTML = '';
            result.data.forEach(c => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f1f5f9';
                
                const getTd = (val, label) => {
                    if (val === null) return `<td data-label="${label}" style="padding:15px; color:#cbd5e1;">-</td>`;
                    const alpha = val / 100;
                    return `<td data-label="${label}" style="padding:15px; background:rgba(16,185,129,${alpha}); font-weight:600;">${val}%</td>`;
                };

                tr.innerHTML = `
                    <td data-label="Mês Safra" style="padding:15px; text-align:left; font-weight:700;">${c.month}</td>
                    <td data-label="Trials" style="padding:15px; font-weight:600; border-right:2px solid #e2e8f0; background:#f8fafc;" title="${c.acquisition.converted} pagantes convertidos de ${c.acquisition.size} trials">${c.acquisition.size} <span style="font-size:0.75rem; color:#10b981;">(${c.acquisition.conversionRate}%)</span></td>
                    <td data-label="Pagantes" style="padding:15px; font-weight:600;">${c.retention.size}</td>
                    ${getTd(c.retention.M0, 'M0')}
                    ${getTd(c.retention.M1, 'M1')}
                    ${getTd(c.retention.M2, 'M2')}
                    ${getTd(c.retention.M3, 'M3')}
                    ${getTd(c.retention.M4, 'M4')}
                    ${getTd(c.retention.M5, 'M5')}
                `;
                tbody.appendChild(tr);
            });
        }

        // 6. PMF V3 (Demanda x Retenção)
        if (pmfRes && pmfRes.ok) {
            const result = await pmfRes.json();
            const tbody = document.getElementById('pmf-tbody');
            tbody.innerHTML = '';
            
            result.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f1f5f9';
                tr.style.cursor = 'pointer';
                tr.title = "Clique para detalhar";
                tr.onclick = () => window.openPmfDrilldown(row.contact_group);
                
                tr.innerHTML = `
                    <td data-label="Grupo" style="padding:15px; font-weight:700; color:#0f172a;">${row.contact_group}</td>
                    <td data-label="Base" style="padding:15px;">${row.total_psis}</td>
                    <td data-label="Ativos" style="padding:15px; font-weight:600; color:#10b981;">${row.active_psis}</td>
                    <td data-label="Inativos" style="padding:15px; color:#ef4444;">${row.churned_psis}</td>
                    <td data-label="Taxa Churn" style="padding:15px; font-weight:600;">${row.churn_rate}%</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // PRÓXIMOS FINS DE TRIAL
        if (trialsRes && trialsRes.ok) {
            const result = await trialsRes.json();
            const tbody = document.getElementById('upcoming-trials-tbody');
            tbody.innerHTML = '';
            
            if (!result.data || result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="padding:20px; text-align: center; color:#94a3b8;">Nenhum trial finalizando nos próximos 7 dias.</td></tr>';
            } else {
                result.data.forEach(psi => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #f1f5f9';
                    
                    const expires = new Date(psi.planExpiresAt);
                    const diffDays = Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24));
                    const daysColor = diffDays <= 2 ? '#ef4444' : '#f59e0b';
                    
                    let actionHtml = '-';
                    if (psi.admin_billing_sent_at) {
                        actionHtml = `<span style="background:#e0e7ff; color:#4338ca; padding:5px 10px; border-radius:6px; font-size:0.8rem; font-weight:600;">✅ Contatado</span>`;
                    } else if (psi.telefone) {
                        actionHtml = `<a href="https://wa.me/${psi.telefone.replace(/\D/g, '')}" target="_blank" style="background:#25D366; color:white; padding:5px 10px; border-radius:6px; text-decoration:none; font-size:0.8rem; font-weight:600;">Chamar</a>`;
                    }
                    
                    const probColor = psi.probability >= 70 ? '#10b981' : (psi.probability >= 40 ? '#f59e0b' : '#ef4444');
                    const aiSparkle = psi.ai_powered ? `<span style="font-size: 0.8rem; margin-left: 4px;">✨</span>` : '';
                    const tooltipText = psi.reason ? psi.reason.replace(/"/g, '&quot;') : 'Calculado por inteligência algorítmica.';
                    
                    tr.innerHTML = `
                        <td data-label="Psicólogo" style="padding:15px; font-weight:600; color:#0f172a;">${psi.nome || 'Sem Nome'}</td>
                        <td data-label="WhatsApp" style="padding:15px; color:#64748b;">${psi.telefone || 'N/D'}</td>
                        <td data-label="Expira em" style="padding:15px; font-weight:700; color:${daysColor};">${diffDays} dias</td>
                        <td data-label="Chance" style="padding:15px; font-weight:700; color:${probColor};">
                            <span class="yelo-tooltip" style="cursor:help; border-bottom:1px dashed ${probColor};">${psi.probability}%${aiSparkle}<span class="yelo-tooltip-content" style="font-weight:400;">${tooltipText}</span></span>
                        </td>
                        <td data-label="Ação" style="padding:15px; text-align: right;">${actionHtml}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // 7. DIAGNÓSTICO
        generateDiagnostics();

        // 8. CHART PAGAMENTOS
        loadPaymentsEvolutionChart();

        document.getElementById('growth-loading').style.display = 'none';
        document.getElementById('growth-content').style.display = 'block';
        window.growthLastUpdate = new Date();
        window.updateTimeAgo();

    } catch (err) {
        console.error(err);
        alert('Erro ao carregar dados do Growth Dashboard');
    }
}

window.generateDiagnostics = function() {
    const list = document.getElementById('diagnostic-list');
    list.innerHTML = '';
    const state = window.growthDataState;
    if (!state || !state.overview) {
        list.innerHTML = '<li>Não foi possível gerar diagnóstico.</li>';
        return;
    }

    const o = state.overview;
    const bullets = [];

    // 1. MRR Growth
    const netNew = o.netNewMrr || 0;
    const mrrAnt = o.mrrAnterior || 0;
    if (mrrAnt > 0) {
        const pct = (netNew / mrrAnt) * 100;
        if (pct > 0) {
            bullets.push(`🟢 <strong>MRR cresceu ${pct.toFixed(1)}%</strong> vs período anterior, puxado por ${o.novosPagantes} novos pagantes.`);
        } else if (pct < 0) {
            bullets.push(`🔴 <strong>MRR retraiu ${Math.abs(pct).toFixed(1)}%</strong> vs período anterior (Perdemos ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(o.mrrPerdido)} em cancelamentos).`);
        } else {
            bullets.push(`🟡 <strong>MRR estagnado</strong> vs período anterior.`);
        }
    } else {
        if (netNew > 0) bullets.push(`🟢 <strong>MRR cresceu</strong> (Adicionamos ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(netNew)}).`);
    }

    // 2. Health Rate
    const semDem = o.totalAtivos - o.pagantesComDemandaCount;
    if (o.pctDemanda >= 80) {
        bullets.push(`🟢 <strong>${o.pctDemanda.toFixed(1)}%</strong> dos psicólogos ativos receberam demanda (Excelente engajamento).`);
    } else if (o.pctDemanda >= 50) {
        bullets.push(`🟡 <strong>${o.pctDemanda.toFixed(1)}%</strong> da base recebeu demanda. Existem ${semDem} psicólogos sem contatos que requerem atenção.`);
    } else {
        bullets.push(`🔴 <strong>${semDem} de ${o.totalAtivos} psicólogos ativos</strong> (${(100 - o.pctDemanda).toFixed(1)}%) NÃO receberam nenhum contato no período.`);
    }

    // 3. Churn
    if (o.churnPagantes > 0) {
        let text = `🟡 <strong>${o.churnPagantes} assinantes cancelaram</strong> neste período (Taxa: ${o.taxaChurnPagantes.toFixed(1)}%).`;
        if (o.churnPagantes < 3) text += ` <span style="font-size:0.8rem; color:#f59e0b;">(Baixa confiança p/ análise de tendência)</span>`;
        bullets.push(text);
    } else {
        bullets.push(`🟢 <strong>Nenhum churn</strong> de assinantes registrado no período selecionado.`);
    }

    bullets.forEach(b => {
        const li = document.createElement('li');
        li.style.marginBottom = '8px';
        li.innerHTML = b;
        list.appendChild(li);
    });
}

window.updateTimeAgo = function() {
    const diffMins = Math.floor((new Date() - window.growthLastUpdate) / 60000);
    const el = document.getElementById('growth-last-updated');
    if (el) el.innerText = `Dados atualizados há ${diffMins} minutos`;
}
if (!window.growthIntervalSet) {
    setInterval(window.updateTimeAgo, 60000);
    window.growthIntervalSet = true;
}

window.exportGrowthCSV = function() {
    if (!window.growthDataState) {
        alert("Aguarde os dados carregarem primeiro.");
        return;
    }
    const d = window.growthDataState;
    const periodDays = document.getElementById('growth-period').value;
    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    let csv = `\uFEFFRelatorio de Growth (Ultimos ${periodDays} dias) - Yelo\n`;
    csv += `Gerado em: ${new Date().toLocaleString()}\n\n`;

    if (d.overview) {
        csv += `--- SAUDE FINANCEIRA E BASE ---\n`;
        csv += `MRR Total;${formatBRL(d.overview.mrrTotal)}\n`;
        csv += `MRR Com Demanda;${formatBRL(d.overview.mrrComDemanda)}\n`;
        csv += `MRR Sem Demanda;${formatBRL(d.overview.mrrSemDemanda)}\n`;
        csv += `Psicologos Ativos (Total);${d.overview.totalAtivos}\n`;
        csv += `Novos Pagantes;${d.overview.novosPagantes}\n`;
        csv += `Churn (Pagantes);${d.overview.churnPagantes}\n`;
        csv += `Churn (Trial);${d.overview.churnTrial}\n`;
        csv += `Trials Ativos;${d.overview.trialsAtivos}\n\n`;
    }

    if (d.marketing) {
        csv += `--- ECONOMIA E MARKETING ---\n`;
        csv += `CAC (Custo de Aquisicao);${formatBRL(d.marketing.cac)}\n`;
        csv += `ARPU (Receita Media);${formatBRL(d.marketing.arpu)}\n`;
        csv += `LTV Estimado;${formatBRL(d.marketing.ltv)}\n`;
        csv += `Payback (Meses);${d.marketing.payback.toFixed(1)}\n`;
        csv += `Gasto Total Marketing;${formatBRL(d.marketing.totalMarketingSpend)}\n\n`;
    }

    if (d.acquisition) {
        const a = d.acquisition;
        csv += `--- FUNIL DE AQUISICAO DE PSICOLOGOS ---\n`;
        csv += `Leads Mapeados;${a.leadsIdentificados}\n`;
        csv += `Contatados;${a.primeiroContato}\n`;
        csv += `Cadastros (Trial);${a.trialsIniciados}\n`;
        csv += `Pagantes;${a.viraramPagantes}\n\n`;
    }

    if (d.demand && d.demand.funnel) {
        const f = d.demand.funnel;
        csv += `--- FUNIL DE DEMANDA (PACIENTES) ---\n`;
        csv += `Visitas Totais;${f.visitas}\n`;
        csv += `Questionarios Iniciados;${f.questionariosIniciados}\n`;
        csv += `Concluidos (Matched);${f.questionariosConcluidos}\n`;
        csv += `Contatos WhatsApp;${f.contatos}\n\n`;
    }
    
    if (d.demand && d.demand.health) {
        const h = d.demand.health.distribuicao;
        csv += `--- SAUDE DO MARKETPLACE ---\n`;
        csv += `Receberam 0 contatos;${h.zero}\n`;
        csv += `Receberam 1 ou 2 contatos;${h.um_a_dois}\n`;
        csv += `Receberam 3 a 5 contatos;${h.tres_a_cinco}\n`;
        csv += `Receberam 6+ contatos;${h.seis_ou_mais}\n`;
        csv += `Media de contatos por psicologo;${d.demand.health.media}\n\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Yelo_Growth_Report_${periodDays}dias_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.openPmfDrilldown = async function(groupName) {
    document.getElementById('pmf-sidebar-title').innerText = `Grupo de Risco: ${groupName}`;
    document.getElementById('pmf-sidebar-subtitle').innerText = 'Carregando psicólogos...';
    document.getElementById('pmf-sidebar-content').innerHTML = '<div style="text-align:center; padding: 20px;">Carregando...</div>';
    
    document.getElementById('pmf-overlay').classList.add('active');
    document.getElementById('pmf-sidebar').classList.add('active');

    try {
        const res = await fetch(`/api/admin/growth/pmf/details?group=${encodeURIComponent(groupName)}`);
        if (!res.ok) throw new Error('Falha ao carregar detalhes');
        const json = await res.json();
        const data = json.data;

        document.getElementById('pmf-sidebar-subtitle').innerText = `${data.length} profissionais neste grupo (Ativos)`;
        
        let html = '';
        if (data.length === 0) {
            html = '<div style="text-align:center; color:#64748b; padding:20px;">Nenhum profissional encontrado.</div>';
        } else {
            data.forEach(psi => {
                const phoneUrl = psi.telefone ? `https://wa.me/${psi.telefone.replace(/\D/g, '')}` : '#';
                
                html += `
                    <div style="background: white; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px rgba(0,0,0,0.02); margin-bottom: 15px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.05)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)'">
                        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 15px;">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: #f5f3ff; color: #8b5cf6; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1.2rem; flex-shrink: 0;">${psi.nome.charAt(0).toUpperCase()}</div>
                            <div>
                                <h3 style="margin: 0; color: #1e293b; font-size: 1.1rem;">${psi.nome}</h3>
                                <p style="margin: 3px 0 0 0; color: #64748b; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
                                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${psi.plano ? '#10b981' : '#f59e0b'};"></span>
                                    ${psi.plano ? 'Plano ' + psi.plano : 'Trial Expirando'}
                                </p>
                            </div>
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                            <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; color: #475569; display: flex; align-items: center; gap: 4px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                Ativo há: ${Math.floor(psi.days_active) || 0} dias
                            </span>
                            <span style="background: #f1f5f9; padding: 4px 12px; border-radius: 50px; font-size: 0.8rem; color: #475569; display: flex; align-items: center; gap: 4px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                ${psi.telefone || 'Sem telefone'}
                            </span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <a href="${phoneUrl}" target="_blank" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#10b981; color:white; padding:10px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem; transition:background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                                WhatsApp
                            </a>
                            <button onclick="window.openCSDrawer('${psi.id}')" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#f8fafc; color:#0f172a; padding:10px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem; border:1px solid #e2e8f0; cursor: pointer; transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f8fafc'">
                                Visão 360º ↗
                            </button>
                        </div>
                    </div>
                `;
            });
        }
        document.getElementById('pmf-sidebar-content').innerHTML = html;
    } catch (e) {
        document.getElementById('pmf-sidebar-content').innerHTML = `<div style="color:red; text-align:center; padding:20px;">Erro ao carregar dados.</div>`;
    }
};

window.closePmfDrilldown = function() {
    document.getElementById('pmf-overlay').classList.remove('active');
    document.getElementById('pmf-sidebar').classList.remove('active');
};

window.fetchGrowthAIInsights = async function() {
    const btn = document.getElementById('btn-ai-insights');
    const loading = document.getElementById('ai-insights-loading');
    const error = document.getElementById('ai-insights-error');
    const content = document.getElementById('ai-insights-content');

    // Desabilita o botão e mostra loading
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.innerText = 'Processando...';
    
    loading.style.display = 'block';
    error.style.display = 'none';
    content.style.display = 'none';

    try {
        // Envia o estado de dados atual da tela (que está em cache no window)
        const payload = window.growthDataState || {};
        
        const response = await fetch('/api/admin/analytics/growth/ai-insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.error || 'Erro desconhecido ao chamar a API');
        }

        // Renderiza os cards de recomendação
        content.innerHTML = '';
        const icones = ['🎯', '⚖️', '🚀']; // Ícones para cada card

        data.insights.forEach((insight, index) => {
            const card = document.createElement('div');
            card.style.cssText = 'background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); display: flex; gap: 15px; align-items: flex-start;';
            
            card.innerHTML = `
                <div style="font-size: 2rem; line-height: 1;">${icones[index % icones.length]}</div>
                <div>
                    <h3 style="margin: 0 0 5px 0; font-size: 1.1rem; color: #1e293b;">${insight.titulo}</h3>
                    <p style="margin: 0 0 12px 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;"><strong>Diagnóstico:</strong> ${insight.diagnostico}</p>
                    <div style="background: #f8fafc; border-left: 3px solid #8b5cf6; padding: 10px 15px; border-radius: 4px;">
                        <p style="margin: 0; color: #334155; font-size: 0.9rem; font-weight: 500;"><span style="color:#8b5cf6;">Ação Recomendada:</span> ${insight.acao}</p>
                    </div>
                </div>
            `;
            content.appendChild(card);
        });

        loading.style.display = 'none';
        content.style.display = 'flex';

    } catch (err) {
        console.error("Erro no Gemini:", err);
        loading.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('ai-error-text').innerText = err.message || 'Falha na comunicação com o Gemini.';
    } finally {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerText = 'Gerar Análise com IA';
    }
};

// --- GRÁFICO DE EVOLUÇÃO DE PAGAMENTOS ---
window.paymentsEvolutionChartInstance = null;
window.loadPaymentsEvolutionChart = async function() {
    try {
        const res = await window.fetch('/api/admin/growth/payments-evolution', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') }
        });
        if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error('Falha ao buscar evolução de pagamentos: ' + (errBody.error || errBody.message || res.status));
        }
        const result = await res.json();
        
        if (!result.success || !result.labels || !result.data) return;

        const ctx = document.getElementById('paymentsEvolutionChart');
        if (!ctx) return;

        if (window.paymentsEvolutionChartInstance) {
            window.paymentsEvolutionChartInstance.destroy();
        }

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

        window.paymentsEvolutionChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: result.labels,
                datasets: [{
                    label: 'Mensalidades Pagas',
                    data: result.data,
                    borderColor: '#8b5cf6',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#8b5cf6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                events: [],
                layout: {
                    padding: { left: 12, right: 12 }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1f2937',
                        padding: 12,
                        titleFont: { size: 13, family: 'Inter' },
                        bodyFont: { size: 14, family: 'Inter', weight: 'bold' },
                        displayColors: false,
                        xAlign: function(tooltipItem) {
                            if (tooltipItem.tooltip.dataPoints && tooltipItem.tooltip.dataPoints.length > 0) {
                                const index = tooltipItem.tooltip.dataPoints[0].dataIndex;
                                const total = tooltipItem.chart.data.labels.length;
                                return index === total - 1 ? 'left' : 'auto';
                            }
                            return 'auto';
                        },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y + ' pagamentos recebidos';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f1f5f9', drawBorder: false },
                        ticks: { stepSize: 1, font: { family: 'Inter', color: '#64748b' } }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { font: { family: 'Inter', color: '#64748b' } },
                        offset: false
                    }
                },
                interaction: { 
                    mode: 'point', 
                    intersect: true 
                }
            }
        });

        // ==========================================
        // LISTENER DE MOUSE MANUAL (CÁLCULO ESCALADO)
        // ==========================================
        
        // Remove listeners antigos se existirem para evitar duplicidade
        if (ctx._mouseMoveHandler) {
            ctx.removeEventListener('mousemove', ctx._mouseMoveHandler);
            ctx.removeEventListener('mouseout', ctx._mouseOutHandler);
        }

        const chart = window.paymentsEvolutionChartInstance;

        ctx._mouseMoveHandler = function(e) {
            if (!chart || !chart.chartArea || !chart.scales.x) return;

            const rect = ctx.getBoundingClientRect();
            
            // FATOR DE ESCALA:
            // O canvas está sendo espremido pelo CSS (ex: rect.width = 956)
            // mas o Chart.js desenha num mundo lógico maior (ex: clientWidth = 1087)
            const scaleX = chart.canvas.clientWidth / rect.width;
            const scaleY = chart.canvas.clientHeight / rect.height;

            const mouseX = (e.clientX - rect.left) * scaleX;
            const mouseY = (e.clientY - rect.top) * scaleY;

            const { left, right, top, bottom } = chart.chartArea;

            // 2. Esconder tooltip se fora da área do gráfico
            if (mouseX < left || mouseX > right || mouseY < top || mouseY > bottom) {
                chart.tooltip.setActiveElements([], {});
                chart.setActiveElements([]);
                chart.update();
                return;
            }

            // 3. Obter posições reais de cada ponto
            const xScale = chart.scales.x;
            const labelsCount = chart.data.labels.length;
            
            const positions = [];
            for (let i = 0; i < labelsCount; i++) {
                positions.push(xScale.getPixelForValue(i));
            }

            // 4. Calcular boundaries (pontos médios entre cada posição)
            const boundaries = [];
            
            if (labelsCount > 1) {
                boundaries.push(positions[0] - (positions[1] - positions[0]) / 2);
                for (let i = 0; i < labelsCount - 1; i++) {
                    boundaries.push((positions[i] + positions[i + 1]) / 2);
                }
                boundaries.push(positions[labelsCount - 1] + (positions[labelsCount - 1] - positions[labelsCount - 2]) / 2);
            } else {
                boundaries.push(left, right);
            }

            // 5. Determinar em qual região o mouse está
            let targetIndex = 0;
            for (let i = 0; i < labelsCount; i++) {
                if (mouseX >= boundaries[i] && mouseX <= boundaries[i + 1]) {
                    targetIndex = i;
                    break;
                }
            }

            if (mouseX > boundaries[boundaries.length - 1]) targetIndex = labelsCount - 1;
            if (mouseX < boundaries[0]) targetIndex = 0;

            // 6. Ativar explicitamente o tooltip ancorado no ponto visual
            const meta = chart.getDatasetMeta(0);
            const point = meta.data[targetIndex];

            chart.tooltip.setActiveElements(
                [{ datasetIndex: 0, index: targetIndex }],
                { x: point ? point.x : mouseX, y: point ? point.y : mouseY }
            );
            chart.setActiveElements(
                [{ datasetIndex: 0, index: targetIndex }]
            );
            chart.update();
        };

        ctx._mouseOutHandler = function() {
            if (!chart) return;
            chart.tooltip.setActiveElements([], {});
            chart.setActiveElements([]);
            chart.update();
        };

        ctx.addEventListener('mousemove', ctx._mouseMoveHandler);
        ctx.addEventListener('mouseout', ctx._mouseOutHandler);

    } catch (err) {
        console.error('Erro ao carregar gráfico de pagamentos:', err);
    }
};
