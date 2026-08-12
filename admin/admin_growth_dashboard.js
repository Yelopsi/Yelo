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
        const [overviewRes, acqRes, demRes, mktRes, cohortRes, pmfRes] = await Promise.all([
            fetch(`/api/admin/growth/overview?days=${periodDays}`),
            fetch(`/api/admin/growth/acquisition?days=${periodDays}`),
            fetch(`/api/admin/growth/demand?days=${periodDays}`),
            fetch(`/api/admin/growth/marketing?days=${periodDays}`),
            fetch(`/api/admin/growth/cohorts`),
            fetch(`/api/admin/growth/pmf`)
        ]);

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // 1. OVERVIEW (Saúde)
        if (overviewRes.ok) {
            const result = await overviewRes.json();
            const data = result.data;
            window.growthDataState.overview = data;
            document.getElementById('g-mrr-total').innerText = formatBRL(data.mrrTotal);
            document.getElementById('g-mrr-demanda-split').innerHTML = `
                <span style="color:#10b981">C/ demanda: ${formatBRL(data.mrrComDemanda)}</span> | 
                <span style="color:#ef4444">S/ demanda: ${formatBRL(data.mrrSemDemanda)}</span>
            `;
            document.getElementById('g-ativos').innerText = data.totalAtivos;
            document.getElementById('g-novos-pagantes').innerText = data.novosPagantes;
            document.getElementById('g-churn-pagantes').innerText = data.churnPagantes;
            document.getElementById('g-churn-trial').innerText = data.churnTrial;
            document.getElementById('g-trials-ativos').innerText = data.trialsAtivos;
        }

        // 2. ACQUISITION FUNNEL
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
        }

        // 3. DEMAND FUNNEL & MARKETPLACE
        if (demRes.ok) {
            const result = await demRes.json();
            const { funnel, health } = result.data;
            window.growthDataState.demand = result.data;
            document.getElementById('f-dem-visits').innerText = funnel.visitas;
            document.getElementById('f-dem-searches').innerText = funnel.questionariosIniciados;
            document.getElementById('f-dem-matches').innerText = funnel.questionariosConcluidos;
            document.getElementById('f-dem-wpp').innerText = funnel.contatos;

            const d1 = funnel.visitas > 0 ? (funnel.questionariosIniciados/funnel.visitas*100) : 0;
            const d2 = funnel.questionariosIniciados > 0 ? (funnel.questionariosConcluidos/funnel.questionariosIniciados*100) : 0;
            const d3 = funnel.questionariosConcluidos > 0 ? (funnel.contatos/funnel.questionariosConcluidos*100) : 0;
            document.getElementById('f-dem-c1').innerText = d1.toFixed(1)+'%';
            document.getElementById('f-dem-c2').innerText = d2.toFixed(1)+'%';
            document.getElementById('f-dem-c3').innerText = d3.toFixed(1)+'%';

            document.getElementById('mh-0').innerText = health.distribuicao.zero;
            document.getElementById('mh-1').innerText = health.distribuicao.um_a_dois;
            document.getElementById('mh-3').innerText = health.distribuicao.tres_a_cinco;
            document.getElementById('mh-5').innerText = health.distribuicao.seis_ou_mais;
            document.getElementById('mh-media').innerText = health.media;
        }

        // 4. MARKETING
        if (mktRes.ok) {
            const result = await mktRes.json();
            const d = result.data;
            window.growthDataState.marketing = d;
            
            if (d.hasMarketingSpend) {
                document.getElementById('g-cac').innerText = formatBRL(d.cac);
                document.getElementById('g-payback').innerText = d.payback ? d.payback.toFixed(1) + 'm' : '0m';
            } else {
                document.getElementById('g-cac').innerText = 'N/A';
                document.getElementById('g-payback').innerText = 'N/A';
                document.getElementById('g-cac').style.color = '#94a3b8';
                document.getElementById('g-payback').style.color = '#94a3b8';
            }
            
            document.getElementById('g-arpu').innerText = formatBRL(d.arpu);
            document.getElementById('g-ltv').innerText = d.amostraSuficienteLTV ? formatBRL(d.ltv) : 'S/ Dados';
            if (!d.amostraSuficienteLTV) document.getElementById('g-ltv').style.color = '#94a3b8';
            else document.getElementById('g-ltv').style.color = '#8b5cf6';
            
            document.getElementById('g-spend-total').innerText = 'Gasto Total: ' + formatBRL(d.totalMarketingSpend);
            
            if (!d.amostraSuficienteLTV) {
                document.getElementById('g-ltv-warn').innerText = '(Amostra insuficiente p/ Churn)';
                document.getElementById('g-ltv-warn').style.color = '#f59e0b';
            } else {
                document.getElementById('g-ltv-warn').innerText = '';
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
                
                const getTd = (val) => {
                    if (val === null) return `<td style="padding:15px; color:#cbd5e1;">-</td>`;
                    const alpha = val / 100;
                    return `<td style="padding:15px; background:rgba(16,185,129,${alpha}); font-weight:600;">${val}%</td>`;
                };

                tr.innerHTML = `
                    <td style="padding:15px; text-align:left; font-weight:700;">${c.month}</td>
                    <td style="padding:15px; font-weight:600; border-right:2px solid #e2e8f0; background:#f8fafc;" title="${c.acquisition.converted} pagantes convertidos de ${c.acquisition.size} trials">${c.acquisition.size} <span style="font-size:0.75rem; color:#10b981;">(${c.acquisition.conversionRate}%)</span></td>
                    <td style="padding:15px; font-weight:600;">${c.retention.size}</td>
                    ${getTd(c.retention.M0)}
                    ${getTd(c.retention.M1)}
                    ${getTd(c.retention.M2)}
                    ${getTd(c.retention.M3)}
                    ${getTd(c.retention.M4)}
                    ${getTd(c.retention.M5)}
                `;
                tbody.appendChild(tr);
            });
        }

        // 6. PMF V3
        if (pmfRes && pmfRes.ok) {
            const result = await pmfRes.json();
            const tbody = document.getElementById('pmf-tbody');
            tbody.innerHTML = '';
            
            let hasRisk = false;
            let riskCount = 0;

            result.data.forEach(row => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f1f5f9';
                tr.style.cursor = 'pointer';
                tr.title = "Clique para detalhar";
                tr.onclick = () => window.openPmfDrilldown(row.contact_group);
                
                // Destacar a linha de risco
                if (row.contact_group === '0 contatos' && row.active_psis > 0) {
                    tr.style.background = '#fef2f2';
                }

                tr.innerHTML = `
                    <td style="padding:15px; font-weight:700; color:#0f172a;">${row.contact_group}</td>
                    <td style="padding:15px;">${row.total_psis}</td>
                    <td style="padding:15px; font-weight:600; color:#10b981;">${row.active_psis}</td>
                    <td style="padding:15px; color:#ef4444;">${row.churned_psis}</td>
                    <td style="padding:15px; font-weight:600;">${row.churn_rate}%</td>
                `;
                tbody.appendChild(tr);

                if (row.contact_group === '0 contatos' && row.active_psis > 0) {
                    hasRisk = true;
                    riskCount = row.active_psis;
                }
            });

            const alertBanner = document.getElementById('pmf-risk-alert');
            if (hasRisk) {
                alertBanner.style.display = 'block';
                document.getElementById('pmf-risk-text').innerText = `${riskCount} psicólogos estão pagando sem receber contatos nos últimos 30 dias.`;
            } else {
                alertBanner.style.display = 'none';
            }
        }

        document.getElementById('growth-loading').style.display = 'none';
        document.getElementById('growth-content').style.display = 'block';
        window.growthLastUpdate = new Date();
        window.updateTimeAgo();

    } catch (err) {
        console.error(err);
        alert('Erro ao carregar dados do Growth Dashboard');
    }
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
                    <div class="pmf-item-card">
                        <h4 style="margin:0 0 8px 0; font-size:1.05rem; color:#0f172a; display:flex; justify-content:space-between; align-items:center;">
                            ${psi.nome}
                            <span style="font-size:0.75rem; background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:12px; font-weight:600;">${Math.floor(psi.days_active) || 0} dias ativos</span>
                        </h4>
                        <div style="font-size:0.85rem; color:#64748b; margin-bottom:12px;">
                            <span style="display:block; margin-bottom: 5px; display:flex; align-items:center; gap:5px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                Plano Atual: <b style="color:#334155;">${psi.plano || 'Trial'}</b>
                            </span>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <a href="${phoneUrl}" target="_blank" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#10b981; color:white; padding:10px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem; transition:background 0.2s;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> Contatar
                            </a>
                            <a href="/admin/psychologists/${psi.id}/full-details" target="_blank" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:#f1f5f9; color:#0f172a; padding:10px; border-radius:8px; text-decoration:none; font-weight:600; font-size:0.85rem; border:1px solid #e2e8f0; transition:background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                                Abrir CRM <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                            </a>
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
