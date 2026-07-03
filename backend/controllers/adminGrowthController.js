const db = require('../models');
const { Op } = require('sequelize');

exports.getGrowthData = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate e endDate são obrigatórios." });
        }

        // Calcula a diferença em dias
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let truncPeriod = 'day';
        if (diffDays > 31 && diffDays <= 120) {
            truncPeriod = 'week';
        } else if (diffDays > 120) {
            truncPeriod = 'month';
        }

        // Para evitar injeção, passaremos os valores diretamente
        // E usamos as variáveis de data diretamente na string (já validadas como padrão de data YYYY-MM-DD no frontend)
        const dateFilter = `'${startDate} 00:00:00'`;
        const dateFilterEnd = `'${endDate} 23:59:59'`;

        // 1. Busca os novos cadastros (Trials + Pagantes) agrupados pelo período
        const queryEntrantes = `
            SELECT 
                DATE_TRUNC('${truncPeriod}', "createdAt") as periodo,
                COUNT(*) as total_entrantes,
                SUM(CASE WHEN "subscriptionId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL AND ("planExpiresAt" IS NULL OR "planExpiresAt" >= NOW()) THEN 1 ELSE 0 END) as trials_ativos,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL AND "planExpiresAt" < NOW() THEN 1 ELSE 0 END) as trials_expirados,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL THEN 1 ELSE 0 END) as trials
            FROM "Psychologists"
            WHERE "createdAt" >= ${dateFilter} AND "createdAt" <= ${dateFilterEnd}
            GROUP BY 1
            ORDER BY 1 ASC;
        `;
        const [novosPorPeriodo] = await db.sequelize.query(queryEntrantes);

        // 2. Busca o Churn (Exclusões/Cancelamentos) agrupados pelo período
        const queryChurn = `
            SELECT 
                DATE_TRUNC('${truncPeriod}', "deletedAt") as periodo,
                COUNT(*) as total_churn
            FROM "Psychologists"
            WHERE "deletedAt" IS NOT NULL AND "deletedAt" >= ${dateFilter} AND "deletedAt" <= ${dateFilterEnd}
            GROUP BY 1
            ORDER BY 1 ASC;
        `;
        const [churnPorPeriodo] = await db.sequelize.query(queryChurn);

        // Processa os dados para o formato que o frontend espera (Chart.js)
        const labels = [];
        const dadosNovosTrials = [];
        const dadosNovosPagantes = [];
        const dadosChurn = [];
        
        const dadosPeriodoTrialsAtivos = [];
        const dadosPeriodoTrialsExpirados = [];
        const dadosPeriodoPagantes = [];
        const dadosPeriodoChurn = [];
        
        // Mantemos os acumulativos históricos apenas para os KPIs globais
        let cumulativoTrials = 0;
        let cumulativoPagantes = 0;

        // Primeiro, pega a contagem histórica *antes* do filtro de data para o gráfico cumulativo começar correto
        const queryHistoricaAntesFiltro = `
            SELECT 
                SUM(CASE WHEN "subscriptionId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL AND ("planExpiresAt" IS NULL OR "planExpiresAt" >= NOW()) THEN 1 ELSE 0 END) as trials_ativos,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL AND "planExpiresAt" < NOW() THEN 1 ELSE 0 END) as trials_expirados,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "stripeSubscriptionId" IS NULL THEN 1 ELSE 0 END) as trials
            FROM "Psychologists"
            WHERE "createdAt" < ${dateFilter} AND "deletedAt" IS NULL;
        `;
        const [historicoResult] = await db.sequelize.query(queryHistoricaAntesFiltro);
        if (historicoResult && historicoResult.length > 0) {
            cumulativoPagantes = parseInt(historicoResult[0].pagantes || 0, 10);
            cumulativoTrialsAtivos = parseInt(historicoResult[0].trials_ativos || 0, 10);
            cumulativoTrialsExpirados = parseInt(historicoResult[0].trials_expirados || 0, 10);
            cumulativoTrials = parseInt(historicoResult[0].trials || 0, 10);
        }

        const queryHistoricoChurn = `
            SELECT COUNT(*) as total
            FROM "Psychologists"
            WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${dateFilter};
        `;
        const [historicoChurnResult] = await db.sequelize.query(queryHistoricoChurn);
        const historicoChurnTotal = historicoChurnResult && historicoChurnResult.length > 0 ? parseInt(historicoChurnResult[0].total || 0, 10) : 0;
        let totalChurnGeral = historicoChurnTotal;

        // Criar um array com todas as datas do período para não pular dias sem novos cadastros
        const todasDatas = new Set();
        novosPorPeriodo.forEach(row => todasDatas.add(new Date(row.periodo).toISOString().split('T')[0]));
        churnPorPeriodo.forEach(row => todasDatas.add(new Date(row.periodo).toISOString().split('T')[0]));
        
        const labels = Array.from(todasDatas).sort();

        labels.forEach(dataStr => {
            const rowEntrantes = novosPorPeriodo.find(r => new Date(r.periodo).toISOString().split('T')[0] === dataStr);
            const trials = rowEntrantes ? parseInt(rowEntrantes.trials || 0, 10) : 0;
            const trialsAtivos = rowEntrantes ? parseInt(rowEntrantes.trials_ativos || 0, 10) : 0;
            const trialsExpirados = rowEntrantes ? parseInt(rowEntrantes.trials_expirados || 0, 10) : 0;
            const pagantes = rowEntrantes ? parseInt(rowEntrantes.pagantes || 0, 10) : 0;
            
            dadosNovosTrials.push(trials);
            dadosNovosPagantes.push(pagantes);
            
            const rowChurn = churnPorPeriodo.find(c => new Date(c.periodo).toISOString().split('T')[0] === dataStr);
            const churnCount = rowChurn ? parseInt(rowChurn.total_churn || 0, 10) : 0;
            dadosChurn.push(churnCount);

            // Acumula os valores a partir do zero (respeitando o período filtrado)
            cumulativoTrials += trials;
            cumulativoPagantes += pagantes;
            totalChurnGeral += churnCount;
            
            // Para o gráfico do período (acumulado apenas dentro do filtro)
            let acumuladoTrialsAtivos = 0;
            let acumuladoTrialsExpirados = 0;
            let acumuladoPagantes = 0;
            let acumuladoChurn = 0;
            
            if (dadosPeriodoTrialsAtivos.length > 0) {
                acumuladoTrialsAtivos = dadosPeriodoTrialsAtivos[dadosPeriodoTrialsAtivos.length - 1];
                acumuladoTrialsExpirados = dadosPeriodoTrialsExpirados[dadosPeriodoTrialsExpirados.length - 1];
                acumuladoPagantes = dadosPeriodoPagantes[dadosPeriodoPagantes.length - 1];
                acumuladoChurn = dadosPeriodoChurn[dadosPeriodoChurn.length - 1];
            }
            
            acumuladoTrialsAtivos += trialsAtivos;
            acumuladoTrialsExpirados += trialsExpirados;
            acumuladoPagantes += pagantes;
            acumuladoChurn += churnCount;
            
            dadosPeriodoTrialsAtivos.push(acumuladoTrialsAtivos);
            dadosPeriodoTrialsExpirados.push(acumuladoTrialsExpirados);
            dadosPeriodoPagantes.push(acumuladoPagantes);
            dadosPeriodoChurn.push(acumuladoChurn);
        });

        // Totais gerais atuais da base para os KPIs
        const totalPagantes = cumulativoPagantes;
        const totalTrials = cumulativoTrials;

        // --- VISÃO MACRO FINANCEIRA ---
        // 1. Calcular o MRR Atual
        const activePsychologists = await db.Psychologist.findAll({
            where: { plano: { [Op.ne]: null }, status: 'active' },
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

        // 2. Calcular Custos do Mês Atual (Snapshot)
        const hoje = new Date();
        const monthYear = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        
        const currentMonthExpensesList = await db.YeloExpense.findAll({
            where: { monthYear }
        });
        const currentMonthExpenses = currentMonthExpensesList.reduce((acc, curr) => acc + curr.amount, 0);

        const netProfit = currentMRR - currentMonthExpenses;
        // ------------------------------

        res.json({
            kpis: {
                total_trials: totalTrials,
                total_pagantes: totalPagantes,
                total_churn: totalChurnGeral,
                conversao_pagantes: totalTrials + totalPagantes > 0 ? ((totalPagantes / (totalTrials + totalPagantes)) * 100).toFixed(1) : 0,
                taxa_churn: totalPagantes > 0 ? ((totalChurnGeral / totalPagantes) * 100).toFixed(1) : 0
            },
            graficos: {
                labels,
                entrantes: {
                    trials: dadosNovosTrials,
                    pagantes: dadosNovosPagantes,
                    churn: dadosChurn
                },
                periodo: {
                    trialsAtivos: dadosPeriodoTrialsAtivos,
                    trialsExpirados: dadosPeriodoTrialsExpirados,
                    pagantes: dadosPeriodoPagantes,
                    churn: dadosPeriodoChurn
                }
            },
            finance: {
                mrr: currentMRR,
                expenses: currentMonthExpenses,
                profit: netProfit
            }
        });

    } catch (error) {
        console.error("Erro ao buscar dados de crescimento:", error);
        res.status(500).json({ error: "Erro interno no servidor ao processar os analytics de crescimento." });
    }
};
