async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    const month = document.getElementById('cmo-month-selector')?.value || 'current';
    
    const now = new Date();
    let dateStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    let dateEnd = new Date().toISOString().split('T')[0];

    if (month === 'last') {
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        dateStart = firstDayLastMonth.toISOString().split('T')[0];
        dateEnd = lastDayLastMonth.toISOString().split('T')[0];
    }

    try {
        console.log(`[CMO Debug] Iniciando busca de dados. Período: ${dateStart} até ${dateEnd}`);
        console.log(`[CMO Debug] Disparando requisição para: /api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`);
        
        console.log('🟢 CHECKPOINT 1 - Iniciando fetch');
        const response = await fetch(`/api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log(`[CMO Debug] Resposta HTTP status: ${response.status}`);
        console.log('🟢 CHECKPOINT 2 - Fetch concluído');

        if (!response.ok) {
            let errorDetails = '';
            try {
                const errorJson = await response.json();
                errorDetails = errorJson.details || errorJson.error || JSON.stringify(errorJson);
            } catch(err) {
                errorDetails = await response.text();
            }
            alert(`Falha na API CMO (Erro ${response.status}):\n${errorDetails.substring(0, 200)}`);
            if(document.getElementById('ai-decision-action')) document.getElementById('ai-decision-action').textContent = 'Erro de Conexão';
            if(document.getElementById('ai-decision-reason')) document.getElementById('ai-decision-reason').textContent = 'Não foi possível carregar os dados. Veja o console (F12).';
            return;
        }

        const data = await response.json();
        console.log('🟢 CHECKPOINT 3 - JSON convertido');
        
        console.group('🔎 [CMO DEBUG] PAYLOAD COMPLETO');
        console.log('📦 data completo:', data);
        console.log('📦 data.success:', data?.success);
        console.log('📦 data.period:', data?.period);
        console.log('📊 data.ads:', data?.ads);
        console.log('📊 data.ads keys:', data?.ads ? Object.keys(data.ads) : 'SEM ADS');
        console.log('📣 data.campaigns:', data?.campaigns);
        console.log('📣 data.campaigns keys:', data?.campaigns ? Object.keys(data.campaigns) : 'SEM CAMPAIGNS');
        console.log('🏢 data.platform:', data?.platform);
        console.log('🏢 data.platform keys:', data?.platform ? Object.keys(data.platform) : 'SEM PLATFORM');
        console.log('🔑 Todas as chaves do payload:', Object.keys(data));
        console.groupEnd();

        if (data.success) {
            console.group('🎯 [CMO DEBUG] VALORES DOS KPIs');
            console.log('Gasto total:', data?.ads?.totalSpend);
            console.log('Assinaturas:', data?.platform?.pagantes);
            console.log('CAC:', data?.platform?.cac);
            console.log('Churn:', data?.platform?.churned);
            console.groupEnd();
            
            console.group('🎨 [CMO DEBUG] DOM');
            console.log('cmo-total-spend:', document.getElementById('cmo-total-spend'));
            console.log('cmo-total-paying:', document.getElementById('cmo-total-paying'));
            console.log('cmo-cac:', document.getElementById('cmo-cac'));
            console.log('cmo-churn:', document.getElementById('cmo-churn'));
            console.log('cmo-meta-table:', document.getElementById('cmo-meta-table'));
            console.log('cmo-google-table:', document.getElementById('cmo-google-table'));
            console.groupEnd();
            
            console.group('📣 [CMO DEBUG] CAMPAIGNS');
            console.log('campaigns completo:', data?.campaigns);
            console.log('Meta:', data?.campaigns?.meta);
            console.log('Google:', data?.campaigns?.google);
            console.log('Quantidade Meta:', Array.isArray(data?.campaigns?.meta) ? data.campaigns.meta.length : 'NÃO É ARRAY');
            console.log('Quantidade Google:', Array.isArray(data?.campaigns?.google) ? data.campaigns.google.length : 'NÃO É ARRAY');
            console.groupEnd();

            console.log('🟢 CHECKPOINT 4 - iniciando KPIs');
            renderCMOMetrics(data);
            console.log('🟢 CHECKPOINT 7 - Tudo concluído');
        } else {
            alert('A API respondeu com falha. Verifique o console.');
        }
    } catch (e) {
        console.error('💥 ERRO FATAL NO CMO DASHBOARD');
        console.error('Mensagem:', e.message);
        console.error('Stack:', e.stack);
        console.error('Erro completo:', e);
        alert(`Erro Crítico: ${e.message}`);
    }
}

function renderCMOMetrics(data) {
    console.log('🚨 RENDER DASHBOARD FOI CHAMADO 🚨');
    
    // 1. Atualizar KPIs Consolidados
    console.log('🟢 CHECKPOINT 5 - Renderizando DOM');
    if (document.getElementById('cmo-total-spend')) document.getElementById('cmo-total-spend').textContent = `R$ ${(data.ads?.totalSpend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (document.getElementById('cmo-total-paying')) document.getElementById('cmo-total-paying').textContent = data.platform?.pagantes || 0;
    if (document.getElementById('cmo-cac')) document.getElementById('cmo-cac').textContent = `R$ ${(data.platform?.cac || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if (document.getElementById('cmo-churn')) document.getElementById('cmo-churn').textContent = data.platform?.churned || 0;

    // 2. Atualizar Motor de Decisão
    const actionEl = document.getElementById('ai-decision-action');
    if (actionEl && data.decisionEngine) {
        actionEl.textContent = data.decisionEngine.action;
        if (data.decisionEngine.action.includes('AUMENTAR')) {
            actionEl.style.color = '#10b981'; // Verde
        } else if (data.decisionEngine.action.includes('PAUSAR') || data.decisionEngine.action.includes('DIMINUIR')) {
            actionEl.style.color = '#ef4444'; // Vermelho
        } else {
            actionEl.style.color = '#f59e0b'; // Laranja
        }
    }
    
    if (document.getElementById('ai-decision-reason') && data.decisionEngine) {
        document.getElementById('ai-decision-reason').textContent = data.decisionEngine.reason;
    }

    // 3. Atualizar Tabela Meta
    console.log('🟢 CHECKPOINT 6 - Tabelas');
    const metaTable = document.querySelector('#cmo-meta-table tbody');
    if (metaTable) {
        metaTable.innerHTML = '';
        if (data.campaigns?.meta && data.campaigns.meta.length > 0) {
            data.campaigns.meta.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.campaign_name || c.id}</td>
                    <td style="text-align: right;">R$ ${(c.spend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td style="text-align: right;">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                `;
                metaTable.appendChild(tr);
            });
        } else {
            metaTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma campanha Meta encontrada no período.</td></tr>';
        }
    }

    // 4. Atualizar Tabela Google
    const googleTable = document.querySelector('#cmo-google-table tbody');
    if (googleTable) {
        googleTable.innerHTML = '';
        if (data.campaigns?.google && data.campaigns.google.length > 0) {
            data.campaigns.google.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${c.campaign_name || c.id}</td>
                    <td style="text-align: right;">R$ ${(c.spend || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    <td style="text-align: right;">${(c.impressions || 0).toLocaleString('pt-BR')}</td>
                    <td style="text-align: right;">${(c.clicks || 0).toLocaleString('pt-BR')}</td>
                `;
                googleTable.appendChild(tr);
            });
        } else {
            googleTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhuma campanha Google encontrada no período.</td></tr>';
        }
    }
}

// Iniciar imediatamente para arquitetura SPA
loadCMOMetrics();
