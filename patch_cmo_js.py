import re

with open('admin/admin_cmo_metrics.js', 'r') as f:
    code = f.read()

# I need to find the block from: // Action Plan \n const actionPlanContainer = ... to the end of the action plan logic.
old_js = """        // Action Plan
        const actionPlanContainer = document.getElementById('sim-action-plan');
        const actionList = document.getElementById('sim-action-list');
        if (actionPlanContainer && actionList) {
            actionPlanContainer.style.display = 'block';
            actionList.innerHTML = '';
            
            const currentMetaDailyBudget = data.ads?.meta?.configuredDailyBudget || 0;
            const currentDailyGoogle = data.ads?.google?.configuredDailyBudget || 0;
            
                        const unspentCash = actionUnspentCash;
            const targetMetaDaily = actionMetaSpend / 30;
            
            const googleBudgetM1 = actionGoogleMaintenance + actionTrialGoogleSpend;
            const targetGoogleDaily = googleBudgetM1 / 30;
            
            const baseDaily = actionGoogleMaintenance / 30;
            const trialsDaily = actionTrialGoogleSpend / 30;
            
            const availableForAcquisition1 = actionMetaSpend + actionTrialGoogleSpend + actionUnspentCash;

            
            let metaAction = '';
            if (unspentCash > 100) { // Margem de tolerância
                metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O Fundo de Aquisição atual (após separar a Retenção no Google) é de <strong>${formatBRL(availableForAcquisition1)}</strong>. Devido ao teto de escala saudável do Meta Ads, o motor limitou o orçamento diário.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o Meta Ads para <strong>${formatBRL(targetMetaDaily)}/dia</strong>. O caixa excedente de <strong>${formatBRL(unspentCash)}/mês</strong> (Rollover) será preservado.`;
            } else if (targetMetaDaily <= currentMetaDailyBudget) {
                metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O orçamento configurado no Meta (<strong>${formatBRL(currentMetaDailyBudget)}/dia</strong>) é maior que o teto matemático do reinvestimento (<strong>${formatBRL(targetMetaDaily)}/dia</strong>).<br><br>💡 <strong>Sugestão Estratégica:</strong> <strong>Reduza</strong> sua configuração diária no Meta para alinhar com o fluxo de caixa gerado.`;
            } else {
                metaAction = `<br>🔍 <strong>Fato Calculado:</strong> O orçamento configurado no Meta (<strong>${formatBRL(currentMetaDailyBudget)}/dia</strong>) está abaixo do teto matemático do reinvestimento.<br><br>💡 <strong>Sugestão Estratégica:</strong> Você tem caixa para <strong>aumentar</strong> o Meta Ads até <strong>${formatBRL(targetMetaDaily)}/dia</strong> neste mês.`;
            }

            let googleAction = '';
            if (targetGoogleDaily === 0) {
                googleAction = `<br>🔍 <strong>Fato Calculado:</strong> O tráfego orgânico (SEO) já atende a demanda histórica média (${targetContactsPerPsi} contatos/psi) para toda a sua base atual de assinantes.<br><br>💡 <strong>Sugestão Estratégica:</strong> Você pode pausar o Google Ads temporariamente.`;
            } else {
                googleAction = `<br>🔍 <strong>Fato Calculado:</strong> O Google Ads na Yelo sustenta tanto a <strong>Retenção</strong> dos assinantes atuais quanto a captação de contatos para os <strong>Novos Trials</strong>.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o orçamento do Google para <strong>${formatBRL(targetGoogleDaily)}/dia</strong>. Sendo aprox. <strong>${formatBRL(baseDaily)}/dia</strong> apenas para reter a base atual, e <strong>${formatBRL(trialsDaily)}/dia</strong> para os novos profissionais em período de testes.`;
            }

            let roiAction = `<br>⏳ <strong>Diagnóstico:</strong> Analisando lucratividade com IA...<br><br>💡 <strong>Ação Recomendada:</strong> Processando motor de crescimento...`;

            actionList.innerHTML = `
                <li><strong>Meta Ads (Aquisição):</strong> ${metaAction}</li>
                <br>
                <li><strong>Google Ads (Google vs Meta Trials):</strong> ${googleAction}</li>
                <br>
                <li id="sim-roi-li"><strong>Análise de Growth (IA CFO):</strong> ${roiAction}</li>
            `;

            // Chama a IA para diagnosticar o ROI
            const token = localStorage.getItem('token');
            fetch('/api/cmo/analyze-roi', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    mrrAtual: formatBRL(currentMrr),
                    mrr12M: formatBRL(mrrAt12),
                    reinvestRate: reinvestRate,
                    extraCash: extraCash,
                    cacAtual: formatBRL(cacMeta),
                    cacPenalizado: formatBRL(cacMeta),
                    unspentCash: formatBRL(unspentCash)
                })
            })
            .then(res => res.json())
            .then(aiData => {
                if (aiData.success && aiData.html) {
                    const li = document.getElementById('sim-roi-li');
                    if (li) {
                        li.innerHTML = `<strong>Lucratividade (ROI Geral):</strong> ${aiData.html}`;
                    }
                }
            })
            .catch(err => console.error('[CMO] Erro ao analisar ROI com IA:', err));
        }"""

new_js = """        // Action Plan
        const actionPlanContainer = document.getElementById('sim-action-plan');
        const actionList = document.getElementById('sim-action-list');
        if (actionPlanContainer && actionList) {
            actionPlanContainer.style.display = 'block';
            
            // Check if title needs a button
            const h5 = actionPlanContainer.querySelector('h5');
            if (h5 && !document.getElementById('btn-generate-ai')) {
                h5.innerHTML += ` <button id="btn-generate-ai" style="margin-left:auto; background:#7e22ce; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.8rem; cursor:pointer; font-weight:bold;">Gerar Novo Diagnóstico com IA ✨</button>`;
            }
            
            const btnAi = document.getElementById('btn-generate-ai');
            const token = localStorage.getItem('token');

            // Load last plan on render
            if (actionList.innerHTML.trim() === '') {
                actionList.innerHTML = `<li>⏳ Carregando último diagnóstico...</li>`;
                fetch('/api/cmo/action-plan', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.html) {
                        actionList.innerHTML = data.html;
                    } else {
                        actionList.innerHTML = `<li>Nenhum diagnóstico salvo. Clique no botão acima para gerar.</li>`;
                    }
                }).catch(() => actionList.innerHTML = `<li>Erro ao carregar o plano.</li>`);
            }

            if (btnAi) {
                btnAi.onclick = () => {
                    btnAi.disabled = true;
                    btnAi.innerText = 'Processando...';
                    actionList.innerHTML = `<li>⏳ <strong>A IA está analisando os dados do motor...</strong> Isso pode levar alguns segundos.</li>`;
                    
                    const currentMetaDailyBudget = data.ads?.meta?.configuredDailyBudget || 0;
                    const currentDailyGoogle = data.ads?.google?.configuredDailyBudget || 0;
                    const unspentCash = actionUnspentCash;
                    const targetMetaDaily = actionMetaSpend / 30;
                    const googleBudgetM1 = actionGoogleMaintenance + actionTrialGoogleSpend;
                    const targetGoogleDaily = googleBudgetM1 / 30;
                    const baseDaily = actionGoogleMaintenance / 30;
                    const trialsDaily = actionTrialGoogleSpend / 30;
                    const availableForAcquisition1 = actionMetaSpend + actionTrialGoogleSpend + actionUnspentCash;

                    fetch('/api/cmo/generate-action-plan', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json' 
                        },
                        body: JSON.stringify({
                            mrrAtual: formatBRL(currentMrr),
                            mrr12M: formatBRL(mrrAt12),
                            reinvestRate: reinvestRate,
                            extraCash: extraCash,
                            cacAtual: formatBRL(cacMeta),
                            cacPenalizado: formatBRL(cacMeta),
                            unspentCash: formatBRL(unspentCash),
                            targetMetaDaily: formatBRL(targetMetaDaily),
                            currentMetaDailyBudget: formatBRL(currentMetaDailyBudget),
                            availableForAcquisition1: formatBRL(availableForAcquisition1),
                            targetGoogleDaily: formatBRL(targetGoogleDaily),
                            currentDailyGoogle: formatBRL(currentDailyGoogle),
                            baseDaily: formatBRL(baseDaily),
                            trialsDaily: formatBRL(trialsDaily)
                        })
                    })
                    .then(res => res.json())
                    .then(aiData => {
                        if (aiData.success && aiData.html) {
                            actionList.innerHTML = aiData.html;
                        } else {
                            actionList.innerHTML = `<li>❌ Falha ao gerar diagnóstico com IA.</li>`;
                        }
                    })
                    .catch(err => {
                        console.error('[CMO] Erro ao analisar ROI com IA:', err);
                        actionList.innerHTML = `<li>❌ Falha de conexão ao gerar diagnóstico.</li>`;
                    })
                    .finally(() => {
                        btnAi.disabled = false;
                        btnAi.innerText = 'Gerar Novo Diagnóstico com IA ✨';
                    });
                };
            }
        }"""

code = code.replace(old_js, new_js)
with open('admin/admin_cmo_metrics.js', 'w') as f:
    f.write(code)

# We should also empty the actionList in the HTML just in case
with open('admin/admin_cmo_metrics.html', 'r') as f:
    html_code = f.read()

old_html = """                <ul id="sim-action-list" style="margin: 0; padding-left: 20px; color: #4c1d95; font-size: 0.9rem; line-height: 1.5;">
                <li><strong>Meta Ads (Aquisição):</strong> <br>🔍 <strong>Fato Calculado:</strong> O Fundo de Aquisição atual (após separar a Retenção no Google) é de <strong>R$&nbsp;3.108,28</strong>. Devido ao teto de escala saudável do Meta Ads, o motor limitou o orçamento diário.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o Meta Ads para <strong>R$&nbsp;4,53/dia</strong>. O caixa excedente de <strong>R$&nbsp;2.119,20/mês</strong> (Rollover) será preservado.</li>
                <br>
                <li><strong>Google Ads (Google vs Meta Trials):</strong> <br>🔍 <strong>Fato Calculado:</strong> O Google Ads na Yelo sustenta tanto a <strong>Retenção</strong> dos assinantes atuais quanto a captação de contatos para os <strong>Novos Trials</strong>.<br><br>💡 <strong>Sugestão Estratégica:</strong> Ajuste o orçamento do Google para <strong>R$&nbsp;91,26/dia</strong>. Sendo aprox. <strong>R$&nbsp;62,83/dia</strong> apenas para reter a base atual, e <strong>R$&nbsp;28,43/dia</strong> para os novos profissionais em período de testes.</li>
                <br>
                <li id="sim-roi-li"><strong>Lucratividade (ROI Geral):</strong> <br>🔍 <strong>Diagnóstico (Fallback):</strong> Não foi possível acessar a IA no momento.<br><br>💡 <strong>Ação Recomendada:</strong> Monitore o custo marginal de aquisição caso aumente o investimento.</li>
            </ul>"""

new_html = """                <ul id="sim-action-list" style="margin: 0; padding-left: 20px; color: #4c1d95; font-size: 0.9rem; line-height: 1.5;">
            </ul>"""

html_code = html_code.replace(old_html, new_html)
with open('admin/admin_cmo_metrics.html', 'w') as f:
    f.write(html_code)

