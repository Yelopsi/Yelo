let lastUpdate = new Date();

window.initializePage = function() {
    loadGrowthData();
};

window.loadGrowthData = async function() {
    const periodDays = document.getElementById('growth-period').value;
    document.getElementById('growth-content').style.display = 'none';
    document.getElementById('growth-loading').style.display = 'block';

    try {
        const [overviewRes, acqRes, demRes, mktRes, cohortRes] = await Promise.all([
            fetch(`/api/admin/growth/overview?days=${periodDays}`),
            fetch(`/api/admin/growth/acquisition?days=${periodDays}`),
            fetch(`/api/admin/growth/demand?days=${periodDays}`),
            fetch(`/api/admin/growth/marketing?days=${periodDays}`),
            fetch(`/api/admin/growth/cohorts`)
        ]);

        const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

        // 1. OVERVIEW (Saúde)
        if (overviewRes.ok) {
            const result = await overviewRes.json();
            const data = result.data;
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
            document.getElementById('g-cac').innerText = formatBRL(d.cac);
            document.getElementById('g-arpu').innerText = formatBRL(d.arpu);
            document.getElementById('g-ltv').innerText = formatBRL(d.ltv);
            document.getElementById('g-payback').innerText = d.payback.toFixed(1) + 'm';
            document.getElementById('g-spend-total').innerText = 'Gasto Total: ' + formatBRL(d.totalMarketingSpend);
            
            if (!d.amostraSuficienteLTV) {
                document.getElementById('g-ltv-warn').innerText = '(Baixa confiança - amostra pequena)';
                document.getElementById('g-ltv-warn').style.color = '#f59e0b';
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
                    <td style="padding:15px; font-weight:600;">${c.cohortSize}</td>
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

        document.getElementById('growth-loading').style.display = 'none';
        document.getElementById('growth-content').style.display = 'block';
        lastUpdate = new Date();
        updateTimeAgo();

    } catch (err) {
        console.error(err);
        alert('Erro ao carregar dados do Growth Dashboard');
    }
}

function updateTimeAgo() {
    const diffMins = Math.floor((new Date() - lastUpdate) / 60000);
    const el = document.getElementById('growth-last-updated');
    if (el) el.innerText = `Dados atualizados há ${diffMins} minutos`;
}
setInterval(updateTimeAgo, 60000);
