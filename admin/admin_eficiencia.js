document.addEventListener('DOMContentLoaded', () => {
    
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString) => {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}`; // Apenas dia e mês para caber na tabela
    };

    const applyCurrencyMask = (input) => {
        input.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value === '') {
                e.target.value = '';
                return;
            }
            value = (parseInt(value, 10) / 100).toFixed(2) + '';
            value = value.replace('.', ',');
            value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
            e.target.value = value;
        });
    };

    const parseCurrencyString = (str) => {
        if (!str) return 0;
        return parseFloat(str.replace(/\./g, '').replace(',', '.'));
    };

    applyCurrencyMask(document.getElementById('input-meta-ads'));
    applyCurrencyMask(document.getElementById('input-google-ads'));

    const fetchEfficiencyData = async () => {
        try {
            const response = await fetch(`/api/admin/efficiency`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}`
                }
            });

            if (!response.ok) throw new Error('Erro ao buscar dados de eficiência');

            const data = await response.json();

            // 1. Farol Financeiro
            document.getElementById('val-mrr').textContent = formatCurrency(data.currentMRR);
            
            const netBurnEl = document.getElementById('val-netburn');
            netBurnEl.textContent = formatCurrency(data.netBurnRate);
            if (data.netBurnRate >= 0) {
                netBurnEl.className = 'metric-value text-green';
            } else {
                netBurnEl.className = 'metric-value text-red';
            }

            const meta = 17;
            const paying = data.payingUsersCount || 0;
            const percentage = Math.min((paying / meta) * 100, 100);
            document.getElementById('val-paying-count').textContent = `${paying}/${meta}`;
            document.getElementById('val-paying-bar').style.width = `${percentage}%`;

            // 2. Tabela Histórica do Funil
            const tbody = document.getElementById('history-table-body');
            tbody.innerHTML = '';

            if (data.weeklyHistory && data.weeklyHistory.length > 0) {
                const reversed = [...data.weeklyHistory].reverse();
                
                reversed.forEach(row => {
                    const tr = document.createElement('tr');
                    
                    const metaCTR = row.meta_impressions > 0 ? ((row.meta_clicks / row.meta_impressions) * 100).toFixed(1) + '%' : '0%';
                    const googleCTR = row.google_impressions > 0 ? ((row.google_clicks / row.google_impressions) * 100).toFixed(1) + '%' : '0%';
                    
                    const cplClass = parseFloat(row.cpl) <= 29 ? 'color: #10b981; font-weight: 700;' : 'color: #ef4444; font-weight: 700;';
                    const cacClass = parseFloat(row.cac) <= 297 ? 'color: #10b981; font-weight: 700;' : 'color: #ef4444; font-weight: 700;';

                    tr.innerHTML = `
                        <td><strong>${formatDate(row.week_start)}</strong></td>
                        
                        <!-- META -->
                        <td style="background: #f8fafc;">${formatCurrency(row.meta_ads)}</td>
                        <td>${metaCTR}</td>
                        <td>${row.meta_trials}</td>
                        <td style="font-weight: 600;">${row.meta_pagantes}</td>
                        
                        <!-- GOOGLE -->
                        <td style="background: #f8fafc;">${formatCurrency(row.google_ads)}</td>
                        <td>${googleCTR}</td>
                        <td>${row.google_trials}</td>
                        <td style="font-weight: 600;">${row.google_pagantes}</td>
                        
                        <!-- ORGÂNICO -->
                        <td>${row.organic_trials}</td>
                        <td style="font-weight: 600;">${row.organic_pagantes}</td>
                        
                        <!-- GLOBAL -->
                        <td style="${cplClass} background: #f8fafc;">${formatCurrency(row.cpl)}</td>
                        <td style="${cacClass} background: #f8fafc;">${formatCurrency(row.cac)}</td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; color: #64748b; padding: 20px;">Nenhum funil gravado. Preencha e salve sua primeira semana.</td></tr>';
            }

        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast('Erro ao carregar histórico.', 'error');
        }
    };

    const saveWeeklyData = async () => {
        const btn = document.getElementById('btn-save-week');
        const originalText = btn.textContent;
        btn.textContent = 'Processando Funil & IA...';
        btn.disabled = true;

        try {
            const metaAds = parseCurrencyString(document.getElementById('input-meta-ads').value);
            const metaImpressions = document.getElementById('input-meta-imp').value || 0;
            const metaClicks = document.getElementById('input-meta-clicks').value || 0;

            const googleAds = parseCurrencyString(document.getElementById('input-google-ads').value);
            const googleImpressions = document.getElementById('input-google-imp').value || 0;
            const googleClicks = document.getElementById('input-google-clicks').value || 0;

            const payload = {
                metaAds, metaImpressions, metaClicks,
                googleAds, googleImpressions, googleClicks
            };

            const response = await fetch(`/api/admin/efficiency`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('Yelo_token')}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Erro ao salvar dados');

            const result = await response.json();
            
            document.getElementById('ai-insight-content').innerHTML = result.insight || '<p>Análise concluída.</p>';
            
            if (window.showToast) window.showToast('Funil salvo com sucesso!', 'success');

            await fetchEfficiencyData();

            // Limpa os campos após salvar
            document.querySelectorAll('.funnel-input').forEach(i => i.value = '');

        } catch (error) {
            console.error(error);
            if (window.showToast) window.showToast('Erro ao salvar os dados.', 'error');
            document.getElementById('ai-insight-content').innerHTML = '<p style="color: #ef4444;">Erro ao processar análise da IA.</p>';
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    };

    document.getElementById('btn-save-week').addEventListener('click', saveWeeklyData);

    fetchEfficiencyData();
});
