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
            document.getElementById('f-trial-churn-rate').innerText = `${((metrics.funnel?.trialChurnRate || 0) * 100).toFixed(1)}%`;
            document.getElementById('f-trial-churn-count').innerText = metrics.funnel?.trialChurnCount || 0;
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

        // 6. FUNIL
        document.getElementById('f-funnel-signup').innerText = funnel.signups;
        document.getElementById('f-funnel-trial').innerText = funnel.trials;
        document.getElementById('f-funnel-paid').innerText = funnel.paying;
        document.getElementById('f-funnel-current').innerText = metrics.activeUsersCount;

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

                tbody.innerHTML += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 15px 12px; font-weight: 600; color: #334155;">${t.name}</td>
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
        if (convPct > 0 && convPct < 30) alerts.push('Taxa de conversão Trial → Pago caiu abaixo de 30%.');
        if (churnPct > 5) alerts.push('Churn estourou o limite saudável de 5%.');
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
        const goals = window.currentFounderGoals || {};
        let modal = document.getElementById('modal-founder-goals');
        if (modal) {
            document.body.appendChild(modal); // Move para o body para evitar problemas de z-index
            document.getElementById('input-goal-mrr').value = goals.goalMRR || 1980;
            document.getElementById('input-goal-users').value = goals.goalUsers || 20;
            document.getElementById('input-goal-months').value = goals.goalMonths || 8;
            document.getElementById('input-goal-new').value = goals.newPerMonth || 2;
            modal.style.display = 'flex';
        } else {
            alert('Modal não encontrado na página.');
        }
    } catch (e) {
        alert('Erro ao abrir: ' + e.message);
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
