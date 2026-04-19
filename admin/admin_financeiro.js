window.initializePage = function() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const kpiMrr = document.getElementById('kpi-mrr');
    const kpiChurn = document.getElementById('kpi-churn');
    const kpiLtv = document.getElementById('kpi-ltv');
    const kpiArpu = document.getElementById('kpi-arpu');
    const faturasBody = document.getElementById('faturas-recentes-body');
    const planosBody = document.getElementById('planos-ativos-body');

    if (!token) {
        console.error("Token não encontrado.");
        return;
    }

    async function loadFinancials() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/financials`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao carregar dados financeiros.');
            }

            const data = await response.json();
            
            // 1. Atualizar KPIs
            if (kpiMrr) kpiMrr.textContent = `R$ ${data.kpis.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (kpiChurn) kpiChurn.textContent = `${data.kpis.churnRate}%`;
            if (kpiLtv) kpiLtv.textContent = `R$ ${data.kpis.ltv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            if (kpiArpu) kpiArpu.textContent = `R$ ${data.kpis.arpu.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            // 2. Renderizar Faturas Recentes
            if (faturasBody) {
                faturasBody.innerHTML = ''; // Limpa o conteúdo
                if (data.recentInvoices && data.recentInvoices.length > 0) {
                    data.recentInvoices.forEach(invoice => {
                        const row = document.createElement('tr');
                        
                        const statusClass = {
                            'Paga': 'status-ativo',
                            'Atrasada': 'status-pendente',
                            'Cancelada': 'status-inativo'
                        }[invoice.status] || 'status-inativo';

                        row.innerHTML = `
                            <td data-label="Psicólogo">
                                <div style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                                        ${invoice.psychologistName.charAt(0).toUpperCase()}
                                    </div>
                                    <span>${invoice.psychologistName}</span>
                                </div>
                            </td>
                            <td data-label="Data" style="color: #666; font-size: 0.9rem;">${new Date(invoice.date).toLocaleDateString('pt-BR')}</td>
                            <td data-label="Valor" style="font-weight: 600; color: #333;">R$ ${invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td data-label="Status"><span class="status ${statusClass}">${invoice.status}</span></td>
                            <td data-label="Ações" style="white-space: nowrap;"><button class="btn-tabela btn-details" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 20px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Ver Detalhes
                            </button></td>
                        `;

                        // Adiciona o listener para o botão "Ver Detalhes"
                        const detailsBtn = row.querySelector('.btn-details');
                        detailsBtn.addEventListener('click', () => {
                            const detailsHtml = `
                                <p><strong>Psicólogo:</strong> ${invoice.psychologistName}</p>
                                <p><strong>Data da Fatura:</strong> ${new Date(invoice.date).toLocaleString('pt-BR')}</p>
                                <p><strong>Valor:</strong> R$ ${invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                <p><strong>Status:</strong> ${invoice.status}</p>
                                <p><strong>ID da Transação:</strong> (não disponível)</p>
                            `;
                            if (window.openConfirmationModal) {
                                window.openConfirmationModal('Detalhes da Fatura', detailsHtml, () => {});
                            } else {
                                alert(detailsHtml.replace(/<[^>]*>/g, '\n'));
                            }
                        });

                        faturasBody.appendChild(row);
                    });
                } else {
                    faturasBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--cinza-texto);">Nenhuma fatura recente encontrada.</td></tr>';
                }
            }

            // 3. Renderiza Planos Ativos
            if (planosBody) {
                planosBody.innerHTML = '';
                if (data.activePlans && data.activePlans.length > 0) {
                    data.activePlans.forEach(plan => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-label="Psicólogo">
                                <div style="font-weight: 600; color: var(--verde-escuro); display: flex; align-items: center; gap: 8px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #f0fdf4; color: var(--verde-escuro); display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.85rem;">
                                        ${plan.psychologistName.charAt(0).toUpperCase()}
                                    </div>
                                    <span>${plan.psychologistName}</span>
                                </div>
                            </td>
                            <td data-label="Plano"><span style="background-color: var(--cor-Yelo); color: var(--verde-escuro); padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">${plan.planName}</span></td>
                            <td data-label="MRR" style="font-weight: 600; color: #333;">R$ ${plan.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td data-label="Próxima Cobrança" style="color: #666; font-size: 0.9rem;">${plan.nextBilling ? new Date(plan.nextBilling).toLocaleDateString('pt-BR') : '<span style="background: #f1f3f5; padding: 2px 8px; border-radius: 4px;">Isento</span>'}</td>
                        `;
                        planosBody.appendChild(row);
                    });
                } else {
                    planosBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px; color: var(--cinza-texto);">Nenhum plano ativo no momento.</td></tr>';
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados financeiros:", error);
            if (faturasBody) faturasBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--coral-quente);">${error.message}</td></tr>`;
        }
    }

    loadFinancials();
};