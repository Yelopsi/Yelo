async function loadCMOMetrics() {
    const token = localStorage.getItem('Yelo_token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    let dateStart = document.getElementById('cmo-date-start')?.value;
    let dateEnd = document.getElementById('cmo-date-end')?.value;

    if (!dateStart || !dateEnd) {
        // Fallback rápido se ainda não inicializou o selector
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const endDay = new Date(year, now.getMonth() + 1, 0).getDate();
        dateStart = `${year}-${month}-01`;
        dateEnd = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
    }
    
    // Tenta carregar dados manuais gravados no localStorage para a data atual
    if (typeof loadGoogleManualInputs === 'function') {
        loadGoogleManualInputs();
    }

    const btn = document.querySelector('button[onclick="loadCMOMetrics()"]');
    const originalBtnHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Atualizando...';
        if (!document.getElementById('cmo-spin-style')) {
            const style = document.createElement('style');
            style.id = 'cmo-spin-style';
            style.textContent = '@keyframes spin { 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        }
    }

    try {
        const response = await fetch(`/api/cmo/dashboard?dateStart=${dateStart}&dateEnd=${dateEnd}`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

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
        
        if (data.success) {
            renderCMOMetrics(data);
        } else {
            alert('A API respondeu com falha. Verifique o console.');
        }
    } catch (e) {
        console.error('💥 ERRO FATAL NO CMO DASHBOARD');
        console.error('Mensagem:', e.message);
        console.error('Stack:', e.stack);
        console.error('Erro completo:', e);
        alert(`Erro Crítico: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.innerHTML = originalBtnHTML;
        }
    }
}

function renderCMOMetrics(data) {
    const formatCurrency = (val) => `R$ ${(val || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // 1. Atualizar KPIs (B2B e B2C)
    
    // Popula Cards da Inteligência Algorítmica (Funil B2B)
    if (data.platform) {
        // B2B (Meta) KPIs
        document.getElementById('cmo-meta-spend').textContent = formatCurrency(data.ads?.meta?.spend || 0);
        document.getElementById('cmo-meta-trials').textContent = (data.platform.b2b?.trials || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-meta-pagantes').textContent = (data.platform.b2b?.pagantes || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-meta-cac').textContent = formatCurrency(data.ads?.meta?.cac || 0);

        // B2C (Google) KPIs
        document.getElementById('cmo-google-spend').textContent = formatCurrency(data.ads?.google?.spend || 0);
        document.getElementById('cmo-google-clicks').textContent = (data.platform.b2c?.clicks || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-google-deals').textContent = (data.platform.b2c?.deals || 0).toLocaleString('pt-BR');
        document.getElementById('cmo-google-cpa').textContent = formatCurrency(data.ads?.google?.cpa || 0);

        // Cards de Transparência (seção inferior)
        const setDbg = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setDbg('dbg-meta-spend',    formatCurrency(data.ads?.meta?.spend || 0));
        setDbg('dbg-meta-trials',   (data.platform.b2b?.trials || 0).toLocaleString('pt-BR'));
        setDbg('dbg-meta-pagantes', (data.platform.b2b?.pagantes || 0).toLocaleString('pt-BR'));
        setDbg('dbg-meta-cac',      formatCurrency(data.ads?.meta?.cac || 0));
        setDbg('dbg-meta-churn',    (data.platform.b2b?.churned || 0).toLocaleString('pt-BR'));
        setDbg('dbg-google-spend',  formatCurrency(data.ads?.google?.spend || 0));
        setDbg('dbg-google-clicks', (data.platform.b2c?.clicks || 0).toLocaleString('pt-BR'));
        setDbg('dbg-google-deals',  (data.platform.b2c?.deals || 0).toLocaleString('pt-BR'));
        setDbg('dbg-google-cpa',    formatCurrency(data.ads?.google?.cpa || 0));
    }

    // 2. Atualizar Motor de Decisão Meta (B2B)
    if (data.decisionEngineMeta) {
        const actionEl = document.getElementById('ai-meta-action');
        const warningContainer = document.getElementById('ai-meta-warning-container');
        const warningEl = document.getElementById('ai-meta-warning');

        if(actionEl) {
            actionEl.textContent = data.decisionEngineMeta.action;
            if (data.decisionEngineMeta.action.includes('AUMENTAR')) actionEl.style.color = '#10b981';
            else if (data.decisionEngineMeta.action.includes('PAUSAR') || data.decisionEngineMeta.action.includes('TETO') || data.decisionEngineMeta.action.includes('INVESTIGAR')) actionEl.style.color = '#ef4444';
            else actionEl.style.color = '#f59e0b';
        }

        document.getElementById('ai-meta-confidence').textContent = `Confiança: ${data.decisionEngineMeta.confidence || 0}%`;
        document.getElementById('ai-meta-target').textContent = formatCurrency(data.decisionEngineMeta.target);
        document.getElementById('ai-meta-scale').textContent = data.decisionEngineMeta.scaleCapacity || '-';
        
        const trend = data.decisionEngineMeta.trend || 0;
        const trendEl = document.getElementById('ai-meta-trend');
        if (trendEl) {
            trendEl.textContent = `${trend > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(trend))}`;
            trendEl.style.color = trend > 0 ? '#ef4444' : '#10b981';
        }
        
        document.getElementById('ai-meta-recommendation').textContent = data.decisionEngineMeta.recommendation || '';

        if (data.decisionEngineMeta.warning) {
            if(warningContainer) warningContainer.style.display = 'block';
            if(warningEl) warningEl.textContent = data.decisionEngineMeta.warning;
        } else {
            if(warningContainer) warningContainer.style.display = 'none';
        }
    }

    // 3. Atualizar Motor de Decisão Google (B2C)
    if (data.decisionEngineGoogle) {
        const actionEl = document.getElementById('ai-google-action');
        const warningContainer = document.getElementById('ai-google-warning-container');
        const warningEl = document.getElementById('ai-google-warning');

        if(actionEl) {
            actionEl.textContent = data.decisionEngineGoogle.action;
            if (data.decisionEngineGoogle.action.includes('AUMENTAR')) actionEl.style.color = '#059669'; // Verde mais escuro para Google
            else if (data.decisionEngineGoogle.action.includes('PAUSAR') || data.decisionEngineGoogle.action.includes('TETO') || data.decisionEngineGoogle.action.includes('INVESTIGAR')) actionEl.style.color = '#ef4444';
            else actionEl.style.color = '#f59e0b';
        }

        document.getElementById('ai-google-confidence').textContent = `Confiança: ${data.decisionEngineGoogle.confidence || 0}%`;
        document.getElementById('ai-google-target').textContent = formatCurrency(data.decisionEngineGoogle.target);
        document.getElementById('ai-google-scale').textContent = data.decisionEngineGoogle.scaleCapacity || '-';
        
        const trend = data.decisionEngineGoogle.trend || 0;
        const trendEl = document.getElementById('ai-google-trend');
        if (trendEl) {
            trendEl.textContent = `${trend > 0 ? '↑' : '↓'} ${formatCurrency(Math.abs(trend))}`;
            trendEl.style.color = trend > 0 ? '#ef4444' : '#10b981';
        }
        
        document.getElementById('ai-google-recommendation').textContent = data.decisionEngineGoogle.recommendation || '';

        if (data.decisionEngineGoogle.warning) {
            if(warningContainer) warningContainer.style.display = 'block';
            if(warningEl) warningEl.textContent = data.decisionEngineGoogle.warning;
        } else {
            if(warningContainer) warningContainer.style.display = 'none';
        }
    }

    // 4. Atualizar Tabela de Campanhas Meta (Detalhada)
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
                    <td style="text-align: right;">${(c.conversions || 0).toLocaleString('pt-BR')}</td>
                `;
                metaTable.appendChild(tr);
            });
        } else {
            metaTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhuma campanha Meta encontrada no período.</td></tr>';
        }
    }

    // 4. Atualizar Tabela Google
    // A tabela do Google está em modo manual temporário (HTML estático).
    // O JS não sobrescreve os inputs do usuário.
}

// Funções para salvar e carregar os inputs manuais da tabela do Google
async function saveGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    if (!dateStart || !dateEnd) return;
    
    // Formatar o spend para número (remove R$ e converte vírgula para ponto)
    let spendRaw = document.getElementById('google-manual-spend')?.value || '0';
    spendRaw = spendRaw.replace(/[^\d,-]/g, '').replace(',', '.');
    const spend = parseFloat(spendRaw) || 0;

    const payload = {
        dateStart,
        dateEnd,
        platform: 'google',
        campaignName: 'Manual',
        spend: spend,
        impressions: parseInt(document.getElementById('google-manual-impressions')?.value) || 0,
        clicks: parseInt(document.getElementById('google-manual-clicks')?.value) || 0,
        conversions: parseInt(document.getElementById('google-manual-conversions')?.value) || 0
    };
    
    try {
        const response = await fetch('/api/cmo/manual-ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const json = await response.json();
        if (!json.success) {
            // Se foi bloqueado pela regra dos 7 dias
            alert('Aviso: ' + json.error);
            loadGoogleManualInputs(); // reverte os inputs para o valor real do DB
            return;
        }

        // Bloqueia os inputs após salvar
        toggleGoogleInputs(true);

        // Recarrega as métricas para a IA processar os novos gastos no funil B2C
        loadCMOMetrics();
    } catch (e) {
        console.error('Erro ao salvar inputs manuais no DB:', e);
    }
}

function toggleGoogleInputs(disabled) {
    document.getElementById('google-manual-spend').disabled = disabled;
    document.getElementById('google-manual-impressions').disabled = disabled;
    document.getElementById('google-manual-clicks').disabled = disabled;
    document.getElementById('google-manual-conversions').disabled = disabled;
    document.getElementById('google-manual-save-btn').disabled = disabled;
    
    // Opacidade visual para indicar bloqueio
    const opacity = disabled ? '0.6' : '1';
    document.getElementById('google-manual-spend').style.opacity = opacity;
    document.getElementById('google-manual-impressions').style.opacity = opacity;
    document.getElementById('google-manual-clicks').style.opacity = opacity;
    document.getElementById('google-manual-conversions').style.opacity = opacity;
    document.getElementById('google-manual-save-btn').style.opacity = opacity;
}

async function deleteGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    if (!dateStart || !dateEnd) return;

    if (!confirm('Tem certeza que deseja excluir os dados do Google deste período? Você poderá preencher novamente.')) return;

    try {
        const response = await fetch('/api/cmo/manual-ads', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dateStart, dateEnd, platform: 'google' })
        });
        
        const json = await response.json();
        if (json.success) {
            document.getElementById('google-manual-spend').value = '';
            document.getElementById('google-manual-impressions').value = '';
            document.getElementById('google-manual-clicks').value = '';
            document.getElementById('google-manual-conversions').value = '';
            
            toggleGoogleInputs(false); // Libera os campos novamente
            loadCMOMetrics();
        } else {
            alert('Erro ao excluir: ' + json.error);
        }
    } catch (e) {
        console.error('Erro ao excluir inputs manuais do DB:', e);
    }
}

async function loadGoogleManualInputs() {
    const dateStart = document.getElementById('cmo-date-start')?.value;
    const dateEnd = document.getElementById('cmo-date-end')?.value;
    
    const spendEl = document.getElementById('google-manual-spend');
    const impEl = document.getElementById('google-manual-impressions');
    const clicksEl = document.getElementById('google-manual-clicks');
    const convEl = document.getElementById('google-manual-conversions');
    
    if (!spendEl) return;
    
    if (dateStart && dateEnd) {
        try {
            const res = await fetch(`/api/cmo/manual-ads?dateStart=${dateStart}&dateEnd=${dateEnd}&platform=google`);
            const json = await res.json();
            
            if (json.success && json.record) {
                const data = json.record;
                spendEl.value = `R$ ${(parseFloat(data.spend) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
                impEl.value = data.impressions || '';
                clicksEl.value = data.clicks || '';
                convEl.value = data.conversions || '';
                
                // Bloqueia se já tiver dados carregados
                toggleGoogleInputs(true);
            } else {
                spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
                toggleGoogleInputs(false); // Libera os campos
            }
        } catch (e) {
            console.error('Erro ao buscar inputs manuais do DB:', e);
            spendEl.value = ''; impEl.value = ''; clicksEl.value = ''; convEl.value = '';
            toggleGoogleInputs(false);
        }
    }
}

function initCMOMonthSelector() {
    const selector = document.getElementById('cmo-month-selector');
    if (!selector) return;
    
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    const now = new Date();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();
    
    let html = '';
    for (let i = 0; i < 12; i++) {
        const monthName = months[currentMonth];
        const year = currentYear;
        
        const start = `${year}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const endDay = new Date(year, currentMonth + 1, 0).getDate();
        const end = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
        
        html += `<option value="${start}|${end}">${monthName} ${year}</option>`;
        
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
    }
    selector.innerHTML = html;
    
    const [start, end] = selector.value.split('|');
    document.getElementById('cmo-date-start').value = start;
    document.getElementById('cmo-date-end').value = end;
}

function updateCMOMonth() {
    const selector = document.getElementById('cmo-month-selector');
    if (!selector) return;
    
    const [start, end] = selector.value.split('|');
    document.getElementById('cmo-date-start').value = start;
    document.getElementById('cmo-date-end').value = end;
    
    loadCMOMetrics();
}

// Iniciar imediatamente para arquitetura SPA
initCMOMonthSelector();
loadCMOMetrics();
