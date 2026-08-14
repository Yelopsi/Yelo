const db = require('../models');
const { Op } = require('sequelize');

// GET /api/admin/expenses
exports.getExpenses = async (req, res) => {
    try {
        const { monthYear } = req.query; // format: "YYYY-MM"
        if (!monthYear) {
            return res.status(400).json({ error: "monthYear é obrigatório (YYYY-MM)." });
        }

        // 1. Buscar todas as despesas daquele mês
        const expenses = await db.YeloExpense.findAll({
            where: { monthYear },
            order: [['createdAt', 'DESC']]
        });

        // Somar os gastos
        const totalExpenses = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        // 2. Calcular o MRR Atual
        const activePsychologists = await db.Psychologist.findAll({
            where: {
                plano: { [Op.ne]: null },
                status: 'active'
            },
            attributes: ['plano', 'is_exempt', 'subscriptionId']
        });

        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const currentMRR = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.subscriptionId);
            if (!hasSub) return acc;
            return acc + (planPrices[psy.plano ? psy.plano.toLowerCase() : ''] || 0);
        }, 0);

        // Lucro Líquido Estimado
        const netProfit = currentMRR - totalExpenses;

        res.json({
            expenses,
            totalExpenses,
            currentMRR,
            netProfit
        });

    } catch (error) {
        console.error("Erro ao buscar despesas:", error);
        res.status(500).json({ error: "Erro interno no servidor." });
    }
};

// POST /api/admin/expenses
exports.createExpense = async (req, res) => {
    try {
        const { name, amount, category, monthYear } = req.body;

        if (!name || !amount || !monthYear) {
            return res.status(400).json({ error: "name, amount e monthYear são obrigatórios." });
        }

        const newExpense = await db.YeloExpense.create({
            name,
            amount: parseFloat(amount),
            category: category || 'Outros',
            monthYear
        });

        res.status(201).json(newExpense);
    } catch (error) {
        console.error("Erro ao criar despesa:", error);
        res.status(500).json({ error: "Erro interno ao criar despesa." });
    }
};

// DELETE /api/admin/expenses/:id
exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await db.YeloExpense.findByPk(id);

        if (!expense) {
            return res.status(404).json({ error: "Despesa não encontrada." });
        }

        await expense.destroy();
        res.json({ message: "Despesa excluída com sucesso." });
    } catch (error) {
        console.error("Erro ao excluir despesa:", error);
        res.status(500).json({ error: "Erro interno ao excluir despesa." });
    }
};

// GET /api/admin/cash-flow
exports.getCashFlow = async (req, res) => {
    try {
        // Busca todos os pagamentos confirmados ou recebidos no banco de dados local
        const allPayments = await db.Payment.findAll({
            where: {
                status: {
                    [Op.in]: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
                }
            },
            raw: true
        });

        // Agrupar por mês
        const cashFlowByMonth = {};

        allPayments.forEach(payment => {
            // Prioriza a data de pagamento
            let dateObj = payment.paymentDate || payment.dueDate || payment.createdAt;
            if (!dateObj) return;

            // Garante que é um objeto Date para formatar
            if (!(dateObj instanceof Date)) {
                dateObj = new Date(dateObj);
            }
            
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const monthYear = `${year}-${month}`;

            if (!cashFlowByMonth[monthYear]) {
                cashFlowByMonth[monthYear] = {
                    monthYear,
                    grossValue: 0,
                    netValue: 0,
                    count: 0
                };
            }

            // Converter os valores que podem vir como string do banco
            const grossVal = parseFloat(payment.value) || 0;
            // Assumindo taxa fixa padrão do Asaas (R$ 0,99 a 1,99) ou o netValue se tivesse salvo no banco
            // Como o banco salva apenas value, calcularemos um net estimado ou usaremos o value
            // (Ideal seria ter a coluna netValue no db.Payment. Como não há, usaremos uma estimativa simplificada ou deixamos igual)
            // Se fosse boleto/pix no Asaas Pix é R$ 0,99, Cartão é % + fixo. 
            // Para ser exato precisaria ter salvado netValue. Por enquanto, estimamos -R$ 1,99 por transação ou deixamos bruto.
            const netVal = grossVal - 1.99; // Estimativa de taxa Asaas caso não esteja salvo

            cashFlowByMonth[monthYear].grossValue += grossVal;
            cashFlowByMonth[monthYear].netValue += netVal > 0 ? netVal : grossVal;
            cashFlowByMonth[monthYear].count += 1;
        });

        // Converter para array e ordenar (mais recente primeiro)
        const result = Object.values(cashFlowByMonth).sort((a, b) => b.monthYear.localeCompare(a.monthYear));

        res.json({ cashFlow: result });
    } catch (error) {
        console.error("Erro ao buscar fluxo de caixa do banco de dados local:", error);
        res.status(500).json({ error: "Erro interno ao buscar fluxo de caixa." });
    }
};
