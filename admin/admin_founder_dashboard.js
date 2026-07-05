window.initializePage = function() {
    loadFounderMetrics();
};

window.currentFounderGoals = {};

async function loadFounderMetrics() {
    try {
        const token = localStorage.getItem('Yelo_token');
        if (!token) return;

        const baseUrl = window.API_BASE_URL || '';
        const res = await fetch(`${baseUrl}/api/admin/founder-metrics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Falha ao buscar métricas');

        const data = await res.json();
        const { goals, metrics, trialPipeline, funnel, growthHistory, yeloScore } = data;
        window.currentFounderGoals = goals;

        // 1. TOP CARDS
        document.getElementById('f-goal-mrr').innerText = `R$ ${goals.goalMRR.toLocaleString('pt-BR')}`;
        document.getElementById('f-goal-users').innerText = goals.goalUsers;
        
        document.getElementById('f-current-users').innerText = metrics.payingUsers;
        document.getElementById('f-goal-users-display').innerText = goals.goalUsers;
        const progressPct = Math.min(100, Math.round((metrics.payingUsers / goals.goalUsers) * 100));
        document.getElementById('f-progress-pct').innerText = `${progressPct}%`;

        document.getElementById('f-current-mrr').innerText = `R$ ${metrics.currentMRR.toFixed(2).replace('.', ',')}`;
        document.getElementById('f-trials-count').innerText = metrics.activeTrialsCount;
        document.getElementById('f-conv-rate').innerText = `${(metrics.conversionRate * 100).toFixed(0)}%`;
        document.getElementById('f-churn-rate').innerText = `${(metrics.churnRate * 100).toFixed(1)}%`;
        
        // Trial Churn
        if (document.getElementById('f-trial-churn-rate')) {
            document.getElementById('f-trial-churn-rate').innerText = `${((funnel?.trialChurnRate || 0) * 100).toFixed(1)}%`;
            document.getElementById('f-trial-churn-count').innerText = funnel?.trialChurnCount || 0;
        }
        
        const convPct = Math.round(metrics.conversionRate * 100);
        const churnPct = (metrics.churnRate * 100).toFixed(1);


        // 2. BIG PROGRESS BAR
        document.getElementById('f-big-pct').innerText = `${progressPct}%`;
        const mrrLeft = Math.max(0, goals.goalMRR - metrics.currentMRR);
        document.getElementById('f-big-left').innerText = `Faltam R$ ${mrrLeft.toLocaleString('pt-BR')}`;
        setTimeout(() => {
            document.getElementById('f-big-bar').style.width = `${progressPct}%`;
        }, 100);

        // 3. BREAK-EVEN (Meta Prazo)
        document.getElementById('f-be-goal').innerText = `${goals.goalMonths} meses`;
        const start = new Date(goals.goalStartDate);
        const now = new Date();
        const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        document.getElementById('f-be-current').innerText = `${monthsElapsed} meses decorridos`;

        const requiredMonthlyPace = goals.goalMRR / goals.goalMonths;
        const actualPace = monthsElapsed > 0 ? (metrics.currentMRR / monthsElapsed) : metrics.currentMRR;
        
        const statusEl = document.getElementById('f-be-status');
        if (actualPace >= requiredMonthlyPace) {
            statusEl.innerText = '🟢 No ritmo';
            statusEl.style.background = '#d1fae5';
            statusEl.style.color = '#065f46';
        } else if (actualPace >= requiredMonthlyPace * 0.7) {
            statusEl.innerText = '🟡 Atenção';
            statusEl.style.background = '#fef3c7';
            statusEl.style.color = '#92400e';
        } else {
            statusEl.innerText = '🔴 Atrasado';
            statusEl.style.background = '#fee2e2';
            statusEl.style.color = '#991b1b';
        }

        // 4. META DO MÊS
        document.getElementById('f-month-goal').innerText = `+${goals.newPerMonth} pagantes`;
        // Simulando pagantes adicionados neste mes (apenas para viz)
        // Precisaríamos do count exato do mês atual, mas usaremos a variação do ultimo mes historico
        const lastMonthGrowth = growthHistory.length > 0 ? growthHistory[growthHistory.length-1].users - (growthHistory.length > 1 ? growthHistory[growthHistory.length-2].users : 0) : 0;
        const monthNet = Math.max(0, lastMonthGrowth);
        document.getElementById('f-month-progress').innerText = `${monthNet} / ${goals.newPerMonth}`;
        const monthPct = Math.min(100, Math.round((monthNet / goals.newPerMonth) * 100)) || 0;
        setTimeout(() => {
            document.getElementById('f-month-bar').style.width = `${monthPct}%`;
        }, 100);

        // 5. RECEITA PREVISTA
        document.getElementById('f-prev-trials').innerText = metrics.activeTrialsCount;
        document.getElementById('f-prev-conv').innerText = `${convPct}%`;
        const avgT = metrics.payingUsers > 0 ? (metrics.currentMRR / metrics.payingUsers) : 99;
        document.getElementById('f-prev-ticket').innerText = `R$ ${avgT.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
        document.getElementById('f-prev-mrr').innerText = `R$ ${metrics.projectedMRR.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

        // 5.5 CONVERSÃO AVANÇADA
        if (data.conversionAnalytics) {
            const ca = data.conversionAnalytics;
            if (document.getElementById('f-conv-tot-trials')) {
                document.getElementById('f-conv-tot-trials').innerText = ca.total.trials;
                document.getElementById('f-conv-tot-paid').innerText = ca.total.paid;
                document.getElementById('f-conv-tot-rate').innerText = `${(ca.total.rate * 100).toFixed(1)}%`;
                
                document.getElementById('f-conv-last-trials').innerText = ca.lastMonth.trials;
                document.getElementById('f-conv-last-paid').innerText = ca.lastMonth.paid;
                document.getElementById('f-conv-last-rate').innerText = `${(ca.lastMonth.rate * 100).toFixed(1)}%`;
                
                document.getElementById('f-conv-cur-trials').innerText = ca.currentMonth.trialsSoFar;
                document.getElementById('f-conv-cur-proj').innerText = ca.currentMonth.projectedTrials;
                document.getElementById('f-conv-cur-paid-tot').innerText = ca.currentMonth.projectedPaidUsingTotal;
                document.getElementById('f-conv-cur-paid-last').innerText = ca.currentMonth.projectedPaidUsingLastMonth;
            }
        }

        // 6. FUNIL
        document.getElementById('f-funnel-signup').innerText = funnel.signups;
        document.getElementById('f-funnel-trial').innerText = funnel.trials;
        document.getElementById('f-funnel-paid').innerText = funnel.paying;
        document.getElementById('f-funnel-current').innerText = metrics.payingUsers || 0;

        // 7. PIPELINE DOS TRIALS
        const tbody = document.getElementById('f-trials-table');
        tbody.innerHTML = '';
        if (trialPipeline.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="padding:15px; text-align:center; color:#9ca3af;">Nenhum trial ativo.</td></tr>';
        } else {
            trialPipeline.forEach(t => {
                let color = '#10b981'; // Verde default
                if (t.daysLeft <= 3 && t.daysLeft > 1) color = '#f59e0b'; // Amarelo
                if (t.daysLeft <= 1) color = '#ef4444'; // Vermelho

                let wppBtn = '';
                if (t.daysLeft <= 3) {
                    const firstName = t.name.split(' ')[0];
                    let msgFechou = `Vi pelo seu feedback que o paciente acabou não fechando dessa vez, mas não desanime, isso é super normal no início!\n\nOs números provam o mais importante: o tráfego existe, os pacientes têm demanda para sua especialidade e a Yelo está te dando visibilidade.`;
                    
                    if (t.dealClosed) {
                        const count = t.closedDealsCount || 1;
                        const ptTexto = count === 1 ? 'um paciente que veio selecionado' : `${count} pacientes que vieram selecionados`;
                        msgFechou = `E o melhor de tudo: notei pelo seu feedback que você conseguiu fechar terapia com ${ptTexto} pela Yelo! 🚀\n\nIsso mostra que o algoritmo funcionou e a plataforma já se pagou por meses.`;
                    }
                    
                    let tempoFaltaText = `faltam apenas ${t.daysLeft} dias para o seu período premium na plataforma encerrar`;
                    if (t.expiredSundayKeepMonday) {
                        tempoFaltaText = `o seu período premium na plataforma expirou ontem (domingo)`;
                    } else if (t.daysLeft === 0) {
                        tempoFaltaText = `o seu período premium na plataforma encerra hoje`;
                    }
                    
                    const textoMsg = encodeURIComponent(
                        `Olá, ${firstName}! Tudo bem? Aqui é o Anderson, da Yelo.\n\n` +
                        `Vi que ${tempoFaltaText} e decidi te chamar.\n\n` +
                        `Durante seus dias de teste, o algoritmo te recomendou *${t.profile_appearances || 0} vezes* no Match, seu perfil teve cerca de *${t.profile_views || 0} visualizações* e *${t.whatsapp_clicks || 0} pacientes* clicaram no seu WhatsApp. ${msgFechou}\n\n` +
                        `Como seu trial expira em breve, acesse o seu perfil e finalize a sua assinatura para manter seu perfil no ar e não perder os próximos acessos.`
                    );
                    
                    let telNumber = (t.telefone || '').replace(/\D/g, '');
                    if (telNumber.length === 10 || telNumber.length === 11) telNumber = '55' + telNumber;

                    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                    let waLink = `https://wa.me/${telNumber}?text=${textoMsg}`;
                    if (/Android/i.test(navigator.userAgent)) {
                        waLink = `intent://send?phone=${telNumber}&text=${textoMsg}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
                    }
                    
                    const openTarget = isMobile ? `window.location.href='${waLink}'` : `window.open('${waLink}', '_blank')`;
                    
                    // Escapando aspas duplas com &quot; e aspas simples com \' para evitar quebra no HTML do onclick
                    const svgCheck = `<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;12&quot; height=&quot;12&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><polyline points=&quot;20 6 9 17 4 12&quot;></polyline></svg>`;
                    const buttonClickLogic = `${openTarget}; this.innerHTML='${svgCheck} Cobrado'; this.style.backgroundColor='#9ca3af'; this.style.pointerEvents='none';`;

                    wppBtn = `<button onclick="${buttonClickLogic}" title="Enviar alerta de conversão" style="background:#22c55e; color:white; border:none; border-radius:8px; padding:4px 10px; font-size:0.75rem; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; margin-left: 10px; flex-shrink: 0; transition: background 0.3s;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> Cobrar
                    </button>`;
                }

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 15px 12px; font-weight: 600; color: #334155; display: flex; align-items: center; justify-content: space-between;">${t.name} ${wppBtn}</td>
                        <td style="padding: 15px 12px; color: ${color}; font-weight: 700;">${t.daysLeft} dias</td>
                        <td style="padding: 15px 12px; text-align: right;">
                            <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 20px; font-size: 0.85rem; color: #64748b;">${t.status}</span>
                        </td>
                    </tr>
                `;
            });
        }

        // 8. CRESCIMENTO (GRÁFICO DE BARRAS HTML)
        const chart = document.getElementById('f-growth-chart');
        chart.innerHTML = '';
        const maxUsers = Math.max(...growthHistory.map(g => g.users), 10);
        growthHistory.forEach(g => {
            const hPct = Math.max(10, Math.round((g.users / maxUsers) * 100));
            chart.innerHTML += `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; width: 40px;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #3b82f6; margin-bottom: 5px;">${g.users}</div>
                    <div style="width: 100%; background: linear-gradient(0deg, #3b82f6 0%, #60a5fa 100%); border-radius: 6px 6px 0 0; height: ${hPct}%; transition: height 1s ease;"></div>
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 10px; font-weight: 600;">${g.month}</div>
                </div>
            `;
        });

        // 9. YELO SCORE
        document.getElementById('f-score-val').innerText = yeloScore;
        const circle = document.getElementById('f-score-circle');
        setTimeout(() => {
            circle.style.strokeDasharray = `${yeloScore}, 100`;
            if (yeloScore >= 80) circle.style.stroke = '#10b981';
            else if (yeloScore >= 50) circle.style.stroke = '#f59e0b';
            else circle.style.stroke = '#ef4444';
        }, 100);

        // 10. ALERTAS
        const alerts = [];
        if (convPct > 0 && convPct < 15) alerts.push('Taxa de conversão Trial → Pago caiu abaixo de 15%.');
        if (metrics.churnCount > 3) alerts.push(`Atenção: Você perdeu ${metrics.churnCount} assinantes ativos neste mês (Quebra de Funil Pago).`);
        if (metrics.activeTrialsCount === 0) alerts.push('O funil secou: Nenhum trial ativo no momento.');
        
        const alertsArea = document.getElementById('founder-alerts-area');
        if (alerts.length > 0) {
            alertsArea.style.display = 'flex';
            alertsArea.style.flexWrap = 'wrap';
            alertsArea.style.gap = '10px';
            alertsArea.innerHTML = alerts.map(a => `
                <div style="background: #fef2f2; border: 1px solid #fca5a5; color: #991b1b; padding: 6px 16px; border-radius: 9999px; font-size: 0.9rem; font-weight: 700; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <span style="font-size: 1.1rem;">⚠️</span> ${a}
                </div>
            `).join('');
        } else {
            alertsArea.style.display = 'none';
        }

    } catch (err) {
        console.error(err);
    }
}

window.openFounderGoalsModal = function() {
    try {
        console.log("Abrindo modal de metas...");
        
        const allModals = document.querySelectorAll('#modal-founder-goals');
        console.log("Modais encontrados na tela:", allModals.length);
        
        let modalToUse = null;
        
        if (allModals.length > 0) {
            modalToUse = allModals[0];
            for (let i = 1; i < allModals.length; i++) {
                allModals[i].remove();
            }
        }
        
        if (modalToUse) {
            console.log("Modal validado. Preparando para exibir...");
            const goals = window.currentFounderGoals || {};
            
            if (modalToUse.parentElement !== document.body) {
                document.body.appendChild(modalToUse);
            }
            
            // Usando querySelector direto no modal para evitar conflitos de ID globais
            const inMRR = modalToUse.querySelector('#input-goal-mrr');
            const inUsers = modalToUse.querySelector('#input-goal-users');
            const inMonths = modalToUse.querySelector('#input-goal-months');
            const inNew = modalToUse.querySelector('#input-goal-new');
            
            if (inMRR) inMRR.value = goals.goalMRR || 1980;
            if (inUsers) inUsers.value = goals.goalUsers || 20;
            if (inMonths) inMonths.value = goals.goalMonths || 8;
            if (inNew) inNew.value = goals.newPerMonth || 2;
            
            modalToUse.style.display = 'flex';
            modalToUse.style.setProperty('display', 'flex', 'important');
            modalToUse.style.opacity = '1'; // <--- Ignora CSS global de opacidade
            modalToUse.style.pointerEvents = 'auto'; // <--- Ignora CSS de pointer-events: none
            modalToUse.style.zIndex = '999999';
            console.log("Modal agora deve estar visível e clicável.");
        } else {
            console.error('Modal não encontrado na página.');
        }
    } catch (e) {
        console.error('Erro ao abrir o modal:', e);
    }
};

window.saveFounderGoals = async function() {
    const token = localStorage.getItem('Yelo_token');
    const goals = window.currentFounderGoals || {};
    const newGoals = {
        goalMRR: parseFloat(document.getElementById('input-goal-mrr').value),
        goalUsers: parseInt(document.getElementById('input-goal-users').value),
        goalMonths: parseInt(document.getElementById('input-goal-months').value),
        newPerMonth: parseInt(document.getElementById('input-goal-new').value),
        goalStartDate: goals.goalStartDate || '2026-05-01'
    };

    try {
        const baseUrl = window.API_BASE_URL || '';
        const res = await fetch(`${baseUrl}/api/admin/founder-goals`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newGoals)
        });

        if(res.ok) {
            document.getElementById('modal-founder-goals').style.display = 'none';
            loadFounderMetrics(); // Recarrega a tela com as novas metas
            alert('Metas salvas com sucesso!');
        }
    } catch(err) {
        console.error(err);
        alert('Erro ao salvar metas.');
    }
};
