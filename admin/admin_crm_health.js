async function initHealthDashboard() {
    console.log("=== STARTING HEALTH DASHBOARD INITIALIZATION ===");
    try {
        const token = localStorage.getItem('yelo_admin_token');
        if (!token) {
            console.error("Token não encontrado!");
            return;
        }

        console.log("Fetching /api/admin/growth/health...");
        const response = await fetch('/api/admin/growth/health', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Erro na resposta da API:", errorText);
            throw new Error(`Falha ao carregar métricas. Status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log("Data recebida:", data);
        
        if (data.success && data.dashboard) {
            console.log("Renderizando dashboard...");
            renderDashboard(data.dashboard);
            console.log("Dashboard renderizado com sucesso!");
        } else {
            console.error("Dados inválidos:", data);
            alert("Dados da API vieram em formato inesperado.");
        }
    } catch (error) {
        console.error("=== ERRO FATAL NO HEALTH DASHBOARD ===", error);
        alert("Erro ao carregar Health Dashboard: " + error.message);
        
        // Coloca o erro na tela para fácil visualização
        const healthText = document.getElementById('health-status-text');
        if (healthText) healthText.textContent = "Erro: " + error.message;
    } finally {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
        console.log("=== END HEALTH DASHBOARD INITIALIZATION ===");
    }
}

function formatCurrency(value) {
    if (value === 'N/D' || value == null) return 'N/D';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function renderDashboard(dashboard) {
    // Diagnóstico
    const healthIcon = document.getElementById('health-status-icon');
    const healthText = document.getElementById('health-status-text');
    if(healthIcon) healthIcon.className = `status-indicator status-${dashboard.health}`;
    if (dashboard.health === 'SAUDÁVEL') { if(healthIcon) healthIcon.innerHTML = '✅'; }
    else if (dashboard.health === 'ATENÇÃO') { if(healthIcon) healthIcon.innerHTML = '⚠️'; }
    else if (dashboard.health === 'PROBLEMA') { if(healthIcon) healthIcon.innerHTML = '🚨'; }
    if(healthText) healthText.textContent = dashboard.health;

    const investIcon = document.getElementById('invest-status-icon');
    const investText = document.getElementById('invest-status-text');
    const investReason = document.getElementById('invest-reason');
    if(investIcon) investIcon.className = `status-indicator status-${dashboard.recommendation.action}`;
    if (dashboard.recommendation.action === 'AUMENTAR') { if(investIcon) investIcon.innerHTML = '🟢'; }
    else if (dashboard.recommendation.action === 'MANTER') { if(investIcon) investIcon.innerHTML = '🟡'; }
    else if (dashboard.recommendation.action === 'REDUZIR') { if(investIcon) investIcon.innerHTML = '🔴'; }
    if(investText) investText.textContent = dashboard.recommendation.action;
    if(investReason) investReason.textContent = dashboard.recommendation.reason;

    const bottleneckIssue = document.getElementById('bottleneck-issue');
    const bottleneckReason = document.getElementById('bottleneck-reason');
    if(bottleneckIssue) bottleneckIssue.textContent = dashboard.bottleneck.issue;
    if(bottleneckReason) bottleneckReason.textContent = dashboard.bottleneck.reason;

    // Marcos
    const m20 = dashboard.marcos.m20;
    if(document.getElementById('marco-20-atual')) document.getElementById('marco-20-atual').textContent = m20.atual;
    if(document.getElementById('marco-20-bar')) document.getElementById('marco-20-bar').style.width = m20.percentual + '%';
    if(document.getElementById('marco-20-percent')) document.getElementById('marco-20-percent').textContent = m20.percentual + '%';
    if(document.getElementById('marco-20-proj')) document.getElementById('marco-20-proj').textContent = m20.projection;

    const m70 = dashboard.marcos.m70;
    if(document.getElementById('marco-70-atual')) document.getElementById('marco-70-atual').textContent = m70.atual;
    if(document.getElementById('marco-70-bar')) document.getElementById('marco-70-bar').style.width = m70.percentual + '%';
    if(document.getElementById('marco-70-percent')) document.getElementById('marco-70-percent').textContent = m70.percentual + '%';
    if(document.getElementById('marco-70-proj')) document.getElementById('marco-70-proj').textContent = m70.projection;

    const m120 = dashboard.marcos.m120;
    if(document.getElementById('marco-120-atual')) document.getElementById('marco-120-atual').textContent = m120.atual;
    if(document.getElementById('marco-120-bar')) document.getElementById('marco-120-bar').style.width = m120.percentual + '%';
    if(document.getElementById('marco-120-percent')) document.getElementById('marco-120-percent').textContent = m120.percentual + '%';
    if(document.getElementById('marco-120-proj')) document.getElementById('marco-120-proj').textContent = m120.projection;

    // Métricas Base
    if(document.getElementById('kpi-mrr')) document.getElementById('kpi-mrr').textContent = formatCurrency(dashboard.mrr);
    if(document.getElementById('kpi-arpu')) document.getElementById('kpi-arpu').textContent = 'ARPU: ' + formatCurrency(dashboard.arpu);
    
    if(document.getElementById('kpi-base')) document.getElementById('kpi-base').textContent = dashboard.pagantesAtivos;
    if(document.getElementById('kpi-novos')) document.getElementById('kpi-novos').textContent = dashboard.novosClientes;
    if(document.getElementById('kpi-cancelados')) document.getElementById('kpi-cancelados').textContent = dashboard.cancelamentos;
    
    if(document.getElementById('kpi-churn')) document.getElementById('kpi-churn').textContent = dashboard.churnRate;
    
    if(document.getElementById('kpi-ltv')) document.getElementById('kpi-ltv').textContent = 'LTV: ' + formatCurrency(dashboard.ltv);
    if(document.getElementById('kpi-cac')) document.getElementById('kpi-cac').textContent = formatCurrency(dashboard.cac);
    if(document.getElementById('kpi-payback')) document.getElementById('kpi-payback').textContent = dashboard.cacPayback;
}

window.initializePage = function() {
    initHealthDashboard();
};
