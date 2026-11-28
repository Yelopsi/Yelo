const db = require('../models');
const { Op } = require('sequelize');
const subscriptionRevenue = require('../utils/subscriptionRevenue');

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

        // 2. Calcular o MRR Atual Efetivo (considerando ciclos multi-mês/promocionais)
        const activePsychologists = await db.Psychologist.findAll({
            where: {
                plano: { [Op.ne]: null },
                status: 'active',
                [Op.or]: [{ is_exempt: true }, { planExpiresAt: { [Op.gt]: new Date() } }]
            },
            attributes: ['id', 'plano', 'is_exempt', 'subscriptionId', 'subscription_payments_count', 'firstPaidAt', 'subscribedAt', 'planExpiresAt'],
            raw: true
        });

        const revenueContext = await subscriptionRevenue.loadRevenueContext(db, {
            psychologistIds: activePsychologists.map(p => p.id)
        });

        const currentMRR = subscriptionRevenue.round2(activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt || !psy.subscriptionId) return acc;
            return acc + subscriptionRevenue.computePsychologistRevenueSummary(psy, revenueContext).effectiveMonthly;
        }, 0));

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
        const cashFlowService = require('../services/cashFlowService');
        const result = await cashFlowService.buildCashFlowData();
        res.json({ cashFlow: result.monthly, weeklyCashFlow: result.weekly });
    } catch (error) {
        console.error("Erro ao buscar fluxo de caixa:", error);
        res.status(500).json({ error: "Erro interno ao buscar fluxo de caixa." });
    }
};


