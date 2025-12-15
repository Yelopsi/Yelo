// admin/admin_financeiro.js

window.initializePage = function() {
    const token = localStorage.getItem('girassol_token');
    if (!token) {
        console.error("Token de autenticação não encontrado.");
        return;
    }

    const faturasTableBody = document.getElementById('faturas-recentes-body');
    const planosTableBody = document.getElementById('planos-ativos-body');

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    async function fetchFinancialData() {
        if (!faturasTableBody || !planosTableBody) {
            console.error("Tabelas não encontradas no DOM.");
            return;
        }

        faturasTableBody.innerHTML = '<tr><td colspan="5" class="loading-row">Carregando faturas...</td></tr>';
        planosTableBody.innerHTML = '<tr><td colspan="4" class="loading-row">Carregando planos...</td></tr>';

        try {
            const response = await fetch('http://localhost:3001/api/admin/financials', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Falha ao buscar dados financeiros.');
            }

            const data = await response.json();

            // Renderiza os KPIs
            document.getElementById('kpi-mrr').textContent = formatCurrency(data.kpis.mrr);
            document.getElementById('kpi-churn').textContent = `${data.kpis.churnRate}%`;
            document.getElementById('kpi-ltv').textContent = formatCurrency(data.kpis.ltv);

            // Renderiza Faturas Recentes
            faturasTableBody.innerHTML = '';
            if (data.recentInvoices.length > 0) {
                data.recentInvoices.forEach(invoice => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${invoice.psychologistName}</td>
                        <td>${new Date(invoice.date).toLocaleDateString('pt-BR')}</td>
                        <td>${formatCurrency(invoice.amount)}</td>
                        <td><span class="status status-${invoice.status.toLowerCase()}">${invoice.status}</span></td>
                        <td><button class="btn-tabela">Ver Detalhes</button></td>
                    `;
                    faturasTableBody.appendChild(row);
                });
            } else {
                faturasTableBody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhuma fatura recente.</td></tr>';
            }

            // Renderiza Planos Ativos
            planosTableBody.innerHTML = '';
            if (data.activePlans.length > 0) {
                data.activePlans.forEach(plan => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${plan.psychologistName}</td>
                        <td>${plan.planName}</td>
                        <td>${formatCurrency(plan.mrr)}</td>
                        <td>${new Date(plan.nextBilling).toLocaleDateString('pt-BR')}</td>
                    `;
                    planosTableBody.appendChild(row);
                });
            } else {
                planosTableBody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum plano ativo.</td></tr>';
            }

        } catch (error) {
            console.error("Erro ao carregar dados financeiros:", error);
            faturasTableBody.innerHTML = `<tr><td colspan="5" class="error-row">${error.message}</td></tr>`;
            planosTableBody.innerHTML = `<tr><td colspan="4" class="error-row">${error.message}</td></tr>`;
        }
    }

    fetchFinancialData();
};