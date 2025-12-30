window.initializePage = function() {
    const token = localStorage.getItem('Yelo_token');
    const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3001';

    const kpiMrr = document.getElementById('kpi-mrr');
    const kpiChurn = document.getElementById('kpi-churn');
    const kpiLtv = document.getElementById('kpi-ltv');
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
                            <td data-label="Psicólogo">${invoice.psychologistName}</td>
                            <td data-label="Data">${new Date(invoice.date).toLocaleDateString('pt-BR')}</td>
                            <td data-label="Valor">R$ ${invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td data-label="Status"><span class="status ${statusClass}">${invoice.status}</span></td>
                            <td data-label="Ações"><button class="btn-tabela btn-details">Ver Detalhes</button></td>
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
                    faturasBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhuma fatura recente encontrada.</td></tr>';
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados financeiros:", error);
            if (faturasBody) faturasBody.innerHTML = `<tr><td colspan="5" class="error-row">${error.message}</td></tr>`;
        }
    }

    loadFinancials();
};