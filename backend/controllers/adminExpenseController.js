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
        // 1. Busca todos os pagamentos confirmados ou recebidos no banco de dados local
        const localPayments = await db.Payment.findAll({
            where: {
                status: {
                    [Op.in]: ['CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH']
                }
            },
            raw: true
        });

        const mergedPayments = {};
        
        // Insere os pagamentos locais no dicionário
        localPayments.forEach(p => {
            mergedPayments[p.id] = p;
        });

        // 2. Tenta buscar o histórico diretamente do Asaas para preencher pagamentos antigos 
        // (antes da implementação da tabela local)
        try {
            const fetchAsaas = async (endpoint) => {
                const url = `${process.env.ASAAS_API_URL || 'https://www.asaas.com/api/v3'}${endpoint}`;
                const response = await fetch(url, {
                    headers: { 'access_token': process.env.ASAAS_API_KEY }
                });
                if (!response.ok) return { data: [] };
                return await response.json();
            };

            const dataConfirmed = await fetchAsaas('/payments?status=CONFIRMED&limit=100');
            const dataReceived = await fetchAsaas('/payments?status=RECEIVED&limit=100');
            const dataReceivedInCash = await fetchAsaas('/payments?status=RECEIVED_IN_CASH&limit=100');

            const asaasPayments = [
                ...(dataConfirmed.data || []),
                ...(dataReceived.data || []),
                ...(dataReceivedInCash.data || [])
            ];

            asaasPayments.forEach(p => {
                if (!mergedPayments[p.id]) {
                    mergedPayments[p.id] = {
                        id: p.id,
                        value: p.value,
                        paymentDate: p.clientPaymentDate || p.confirmedDate || p.paymentDate || p.creditDate || p.dateCreated,
                        dueDate: p.dueDate,
                        status: p.status
                    };
                }
            });
        } catch (asaasErr) {
            console.error("Aviso: Falha ao buscar histórico do Asaas, usando apenas banco local.", asaasErr);
        }

        const allPayments = Object.values(mergedPayments);

        // Agrupar por mês
        const cashFlowByMonth = {};

        allPayments.forEach(payment => {
            // Prioriza a data de pagamento
            let dateObj = payment.paymentDate || payment.dueDate || payment.createdAt;
            if (!dateObj) return;

            let monthYear = '';
            
            // Se for string no formato YYYY-MM-DD ou ISO, pega os primeiros 7 caracteres diretamente para evitar bug de fuso horário
            if (typeof dateObj === 'string' && dateObj.length >= 7) {
                monthYear = dateObj.substring(0, 7);
            } else if (dateObj instanceof Date) {
                // Se for objeto Date, converte para string local (considerando fuso) ou padroniza YYYY-MM
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                monthYear = `${year}-${month}`;
            } else {
                return; // Formato inválido
            }

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
            const netVal = grossVal - 1.99; // Estimativa de taxa Asaas

            cashFlowByMonth[monthYear].grossValue += grossVal;
            cashFlowByMonth[monthYear].netValue += netVal > 0 ? netVal : grossVal;
            cashFlowByMonth[monthYear].count += 1;
        });

        // Converter para array e ordenar (mais recente primeiro)
        const result = Object.values(cashFlowByMonth).sort((a, b) => b.monthYear.localeCompare(a.monthYear));

        res.json({ cashFlow: result });
    } catch (error) {
        console.error("Erro ao buscar fluxo de caixa:", error);
        res.status(500).json({ error: "Erro interno ao buscar fluxo de caixa." });
    }
};
