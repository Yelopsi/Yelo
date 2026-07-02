// Definir o mês atual no input de competência (YYYY-MM)
if (!document.getElementById('filter-month').value) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('filter-month').value = `${ano}-${mes}`;
}

carregarDespesas();

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

        // Renderizar Tabela
        const tbody = document.getElementById('expenses-table-body');
        const emptyState = document.getElementById('expenses-empty-state');
        
        tbody.innerHTML = '';
        
        if (data.expenses && data.expenses.length > 0) {
            emptyState.style.display = 'none';
            
            data.expenses.forEach(exp => {
                const dataFormatada = new Date(exp.createdAt).toLocaleDateString('pt-BR');
                
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #e2e8f0';
                
                tr.innerHTML = `
                    <td style="padding: 15px 25px; color: #1e293b; font-weight: 500;">${exp.name}</td>
                    <td style="padding: 15px 25px;">
                        <span style="background: #f1f5f9; padding: 4px 10px; border-radius: 50px; font-size: 0.8rem; color: #475569;">${exp.category}</span>
                    </td>
                    <td style="padding: 15px 25px; color: #64748b; font-size: 0.9rem;">${dataFormatada}</td>
                    <td style="padding: 15px 25px; text-align: right; color: #ef4444; font-weight: 600;">- ${formatarMoeda(exp.amount)}</td>
                    <td style="padding: 15px 25px; text-align: center;">
                        <button onclick="excluirDespesa(${exp.id})" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 5px; opacity: 0.7; transition: opacity 0.2s;" title="Excluir">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            emptyState.style.display = 'block';
        }

    } catch (error) {
        console.error(error);
        alert("Falha ao carregar os dados financeiros.");
    }
}

async function salvarDespesa(event) {
    event.preventDefault();
    const btnSave = document.getElementById('btn-save-expense');
    
    const name = document.getElementById('expense-name').value;
    const category = document.getElementById('expense-category').value;
    const amount = document.getElementById('expense-amount').value;
    const monthYear = document.getElementById('filter-month').value;
    
    if (!name || !amount || !monthYear) return;

    btnSave.textContent = "Salvando...";
    btnSave.disabled = true;

    try {
        const response = await fetch('/api/admin/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, category, amount, monthYear })
        });
        
        if (!response.ok) throw new Error("Erro ao salvar despesa");
        
        document.getElementById('form-despesa').reset();
        
        // Re-carregar para atualizar KPIs e Tabela
        await carregarDespesas();
        
    } catch (error) {
        console.error(error);
        alert("Ocorreu um erro ao salvar o custo.");
    } finally {
        btnSave.textContent = "+ Lançar Custo";
        btnSave.disabled = false;
    }
}

async function excluirDespesa(id) {
    if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;
    
    try {
        const response = await fetch(`/api/admin/expenses/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error("Erro ao excluir");
        
        await carregarDespesas();
    } catch (error) {
        console.error(error);
        alert("Erro ao excluir o lançamento.");
    }
}
