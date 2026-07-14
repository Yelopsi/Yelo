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
            attributes: ['plano', 'is_exempt', 'stripeSubscriptionId', 'subscriptionId']
        });

        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const currentMRR = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.stripeSubscriptionId || psy.subscriptionId);
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
        let ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/v3';
        ASAAS_API_URL = ASAAS_API_URL.trim().replace(/\/+$/, '');
        if (ASAAS_API_URL.includes('sandbox.asaas.com') && !ASAAS_API_URL.includes('/api')) {
            ASAAS_API_URL = ASAAS_API_URL.replace('sandbox.asaas.com', 'sandbox.asaas.com/api');
        }
        const ASAAS_API_KEY = process.env.ASAAS_API_KEY ? process.env.ASAAS_API_KEY.trim() : '';

        if (!ASAAS_API_KEY) {
            return res.status(500).json({ error: "ASAAS_API_KEY não configurada." });
        }

        // Fetch pagamentos CONFIRMED
        const resConfirmed = await fetch(`${ASAAS_API_URL}/payments?status=CONFIRMED&limit=100`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const dataConfirmed = await resConfirmed.json();

        // Fetch pagamentos RECEIVED
        const resReceived = await fetch(`${ASAAS_API_URL}/payments?status=RECEIVED&limit=100`, {
            headers: { 'access_token': ASAAS_API_KEY }
        });
        const dataReceived = await resReceived.json();

        const allPayments = [
            ...(dataConfirmed.data || []),
            ...(dataReceived.data || [])
        ];

        // Agrupar por mês
        const cashFlowByMonth = {};

        allPayments.forEach(payment => {
            // Usa paymentDate se existir, ou dateCreated, ou clientPaymentDate
            const dateStr = payment.paymentDate || payment.clientPaymentDate || payment.dateCreated;
            if (!dateStr) return;
            
            // dateStr vem no formato YYYY-MM-DD
            const monthYear = dateStr.substring(0, 7); // "YYYY-MM"

            if (!cashFlowByMonth[monthYear]) {
                cashFlowByMonth[monthYear] = {
                    monthYear,
                    grossValue: 0,
                    netValue: 0,
                    count: 0
                };
            }

            cashFlowByMonth[monthYear].grossValue += (payment.value || 0);
            cashFlowByMonth[monthYear].netValue += (payment.netValue || 0);
            cashFlowByMonth[monthYear].count += 1;
        });

        // Converter para array e ordenar (mais recente primeiro)
        const result = Object.values(cashFlowByMonth).sort((a, b) => b.monthYear.localeCompare(a.monthYear));

        res.json({ cashFlow: result });
    } catch (error) {
        console.error("Erro ao buscar fluxo de caixa do Asaas:", error);
        res.status(500).json({ error: "Erro interno ao buscar fluxo de caixa." });
    }
};
