// Definir o mês atual no input de competência (YYYY-MM)
if (!document.getElementById('filter-month').value) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('filter-month').value = `${ano}-${mes}`;
}

carregarDespesas();
carregarFluxoCaixa();

function formatarMoeda(valor) {
    return `R$ ${parseFloat(valor).toFixed(2).replace('.', ',')}`;
}

async function carregarDespesas() {
    const monthYear = document.getElementById('filter-month').value;
    if (!monthYear) return;

    try {
        const response = await fetch(`/api/admin/expenses?monthYear=${monthYear}`);
        if (!response.ok) throw new Error("Erro ao buscar dados financeiros.");
        
        const data = await response.json();
        
        // Atualizar KPIs
        document.getElementById('kpi-mrr').textContent = formatarMoeda(data.currentMRR);
        document.getElementById('kpi-custos').textContent = formatarMoeda(data.totalExpenses);
        
        const kpiLucro = document.getElementById('kpi-lucro');
        kpiLucro.textContent = formatarMoeda(data.netProfit);
        
        // Cor do lucro dependendo se é positivo ou negativo
        if (data.netProfit < 0) {
            kpiLucro.style.color = '#ef4444'; // Vermelho
        } else {
            kpiLucro.style.color = '#3b82f6'; // Azul
        }

    } catch (error) {
        console.error(error);
        alert("Falha ao carregar os dados financeiros.");
    }
}

async function carregarFluxoCaixa() {
    const tbody = document.getElementById('cash-flow-table-body');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #94a3b8;">Buscando dados no Asaas...</td></tr>';
    
    try {
        const response = await fetch('/api/admin/cash-flow');
        if (!response.ok) throw new Error("Erro ao buscar fluxo de caixa");
        
        const data = await response.json();
        const cashFlow = data.cashFlow || [];
        
        tbody.innerHTML = '';
        
        if (cashFlow.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #94a3b8;">Nenhum pagamento encontrado.</td></tr>';
            return;
        }
        
        cashFlow.forEach(item => {
            // item.monthYear = "YYYY-MM"
            const [ano, mes] = item.monthYear.split('-');
            const dataFormatada = `${mes}/${ano}`;
            
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid #e2e8f0';
            tr.innerHTML = `
                <td data-label="Mês/Ano" style="font-weight: 500;">${dataFormatada}</td>
                <td data-label="Transações" style="text-align: center;">
                    <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 50px; font-size: 12px; color: #475569;">${item.count} pagamentos</span>
                </td>
                <td data-label="Valor Bruto" style="text-align: right; color: var(--cinza-texto);">${formatarMoeda(item.grossValue)}</td>
                <td data-label="Valor Líquido (Recebido)" style="text-align: right; color: #10b981; font-weight: bold;">${formatarMoeda(item.netValue)}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color: #ef4444;">Erro ao carregar os dados. Verifique a chave de API do Asaas.</td></tr>';
    }
}
