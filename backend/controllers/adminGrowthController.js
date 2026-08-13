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
                SUM(CASE WHEN "subscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN "subscriptionId" IS NULL AND ("planExpiresAt" IS NULL OR "planExpiresAt" >= NOW()) THEN 1 ELSE 0 END) as trials_ativos,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "planExpiresAt" < NOW() THEN 1 ELSE 0 END) as trials_expirados,
                SUM(CASE WHEN "subscriptionId" IS NULL THEN 1 ELSE 0 END) as trials
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
        let labels = [];
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
                SUM(CASE WHEN "subscriptionId" IS NOT NULL THEN 1 ELSE 0 END) as pagantes,
                SUM(CASE WHEN "subscriptionId" IS NULL AND ("planExpiresAt" IS NULL OR "planExpiresAt" >= NOW()) THEN 1 ELSE 0 END) as trials_ativos,
                SUM(CASE WHEN "subscriptionId" IS NULL AND "planExpiresAt" < NOW() THEN 1 ELSE 0 END) as trials_expirados,
                SUM(CASE WHEN "subscriptionId" IS NULL THEN 1 ELSE 0 END) as trials
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
        
        labels = Array.from(todasDatas).sort();

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
            attributes: ['plano', 'is_exempt', 'subscriptionId']
        });

        const planPrices = { 
            'essential': 99.00, 'clinical': 159.00, 'reference': 259.00,
            'essencial': 99.00, 'clínico': 159.00, 'sol': 259.00 
        };

        const currentMRR = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!psy.subscriptionId;
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

const growthService = require('../services/growthService');
const growthAcquisitionService = require('../services/growthAcquisitionService');
const growthDemandService = require('../services/growthDemandService');
const growthMarketingService = require('../services/growthMarketingService');
const growthCohortService = require('../services/growthCohortService');

exports.getOverview = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.days) || 30;
        const data = await growthService.getOverview(periodDays);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching growth overview:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar dados de growth', error: error.message, stack: error.stack });
    }
};

exports.getAcquisition = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.days) || 30;
        const data = await growthAcquisitionService.getFunnel(periodDays);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching acquisition funnel:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar funil de aquisição' });
    }
};

exports.getDemand = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.days) || 30;
        const funnel = await growthDemandService.getFunnel(periodDays);
        const health = await growthDemandService.getMarketplaceHealth(periodDays);
        res.json({ success: true, data: { funnel, health } });
    } catch (error) {
        console.error('Error fetching demand funnel:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar funil de demanda' });
    }
};

exports.getMarketing = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.days) || 30;
        const data = await growthMarketingService.getUnitEconomics(periodDays);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching marketing data:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar unit economics', error: error.message, stack: error.stack });
    }
};

exports.getCohorts = async (req, res) => {
    try {
        const data = await growthCohortService.getRetentionCohorts(6);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching cohorts:', error);
        res.status(500).json({ success: false, message: 'Erro ao carregar cohorts' });
    }
};

exports.getAudit = async (req, res) => {
    try {
        const periodDays = parseInt(req.query.days) || 30;
        const now = new Date();
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - periodDays);

        // 1. Demand Funnel
        const visitas = await db.SiteVisit.count({ where: { createdAt: { [Op.gte]: periodStart } } });
        const startedCount = await db.DemandSearch.count({ where: { createdAt: { [Op.gte]: periodStart }, status: 'started' } });
        const matchedCount = await db.DemandSearch.count({ where: { createdAt: { [Op.gte]: periodStart }, status: { [Op.in]: ['completed', 'matched'] } } });
        const totalInitiatedCount = await db.DemandSearch.count({ where: { createdAt: { [Op.gte]: periodStart } } });
        
        // 2. Pagantes Ativos & MRR
        const pagantesAtivos = await db.Psychologist.findAll({
            where: {
                status: 'active',
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { subscriptionId: { [Op.not]: null } },
                    { subscriptionId: { [Op.not]: null } }
                ]
            },
            attributes: ['id', 'cancelAtPeriodEnd', 'planExpiresAt', 'plano', 'status']
        });
        
        const activeIds = [];
        let expiredButNotStatusUpdated = 0;
        pagantesAtivos.forEach(p => {
            if (p.cancelAtPeriodEnd && p.planExpiresAt && new Date(p.planExpiresAt) < now) {
                expiredButNotStatusUpdated++;
            } else {
                activeIds.push(p.id);
            }
        });

        // 3. Churn
        const allChurners = await db.Psychologist.findAll({
            where: {
                is_exempt: { [Op.or]: [false, null] },
                [Op.or]: [
                    { status: 'inactive', updatedAt: { [Op.gte]: periodStart } },
                    { cancelAtPeriodEnd: true, planExpiresAt: { [Op.gte]: periodStart, [Op.lte]: now } }
                ]
            },
            attributes: ['id', 'subscriptionId', 'createdAt']
        });
        
        let churnPagantes = 0;
        let churnTrial = 0;
        allChurners.forEach(c => {
            if (c.subscriptionId) churnPagantes++;
            else churnTrial++;
        });

        // 4. Marketing Expenses
        const expenses = await db.YeloExpense.findAll({ where: { createdAt: { [Op.gte]: periodStart } } });
        const expenseCategories = expenses.map(e => e.category).join(', ');

        res.json({
            success: true,
            diagnostics: {
                demandFunnel: {
                    visitas,
                    abandonedSearches: startedCount,
                    completedOrMatched: matchedCount,
                    totalInitiated: totalInitiatedCount
                },
                actives: {
                    rawTotal: pagantesAtivos.length,
                    expiredButNotStatusUpdated,
                    cleanActives: activeIds.length,
                    activeIds
                },
                churn: {
                    totalChurnersFound: allChurners.length,
                    churnPagantes,
                    churnTrial
                },
                marketing: {
                    expenseCount: expenses.length,
                    categories: expenseCategories
                }
            }
        });
    } catch (e) {
        console.error('Audit Error:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getPMFReport = async (req, res) => {
    try {
        const query = `
            WITH RecentContacts AS (
                SELECT "psychologistId", COUNT(*) as total_contacts
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= NOW() - INTERVAL '30 days'
                GROUP BY "psychologistId"
            ),
            PsiStats AS (
                SELECT 
                    p.id, p.nome, p.status, p.plano, p."planExpiresAt", p."createdAt",
                    COALESCE(c.total_contacts, 0) as contacts_last_30_days,
                    CASE
                        WHEN COALESCE(c.total_contacts, 0) = 0 THEN '0 contatos'
                        WHEN COALESCE(c.total_contacts, 0) BETWEEN 1 AND 2 THEN '1-2 contatos'
                        WHEN COALESCE(c.total_contacts, 0) BETWEEN 3 AND 5 THEN '3-5 contatos'
                        ELSE '6+ contatos'
                    END as contact_group
                FROM "Psychologists" p
                LEFT JOIN RecentContacts c ON p.id = c."psychologistId"
                WHERE p."deletedAt" IS NULL AND (p.status = 'active' OR p.status = 'inactive')
            )
            SELECT 
                contact_group,
                COUNT(*) as total_psis,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_psis,
                SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as churned_psis,
                ROUND(SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0), 2) as churn_rate
            FROM PsiStats
            GROUP BY contact_group
            ORDER BY contact_group;
        `;
        const result = await db.sequelize.query(query, { type: db.sequelize.QueryTypes.SELECT });
        res.json({ success: true, data: result });
    } catch (e) {
        console.error('Error fetching PMF Report:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getPMFDetails = async (req, res) => {
    try {
        const group = req.query.group;
        if (!group) return res.status(400).json({ error: "Parâmetro 'group' é obrigatório" });
        
        let condition = "";
        if (group === "0 contatos") condition = "COALESCE(c.total_contacts, 0) = 0";
        else if (group === "1-2 contatos") condition = "COALESCE(c.total_contacts, 0) BETWEEN 1 AND 2";
        else if (group === "3-5 contatos") condition = "COALESCE(c.total_contacts, 0) BETWEEN 3 AND 5";
        else if (group === "6+ contatos") condition = "COALESCE(c.total_contacts, 0) >= 6";
        else return res.status(400).json({ error: "Grupo inválido" });

        const query = `
            WITH RecentContacts AS (
                SELECT "psychologistId", COUNT(*) as total_contacts, MAX("createdAt") as last_contact
                FROM "WhatsAppClickLogs"
                WHERE "createdAt" >= NOW() - INTERVAL '30 days'
                GROUP BY "psychologistId"
            )
            SELECT 
                p.id, p.nome, p.status, p.plano, p."createdAt" as join_date,
                c.total_contacts, c.last_contact,
                p.telefone,
                EXTRACT(DAY FROM (NOW() - p."createdAt")) as days_active
            FROM "Psychologists" p
            LEFT JOIN RecentContacts c ON p.id = c."psychologistId"
            WHERE p."deletedAt" IS NULL 
              AND (p.status = 'active')
              AND ${condition}
            ORDER BY p."createdAt" DESC;
        `;
        const result = await db.sequelize.query(query, { type: db.sequelize.QueryTypes.SELECT });
        res.json({ success: true, data: result });
    } catch (e) {
        console.error('Error fetching PMF Details:', e);
        res.status(500).json({ error: e.message });
    }
};

const seoService = require('../services/seoService');

exports.getAIInsights = async (req, res) => {
    try {
        const growthData = req.body;
        if (!growthData || Object.keys(growthData).length === 0) {
            return res.status(400).json({ error: "Payload de dados vazio." });
        }
        
        const insights = await seoService.generateGrowthInsights(growthData);
        if (!insights) {
            return res.status(500).json({ error: "Falha ao gerar insights da IA." });
        }
        
        res.json({ success: true, insights });
    } catch (e) {
        console.error('Error fetching Growth AI Insights:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getUpcomingTrials = async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const db = require('../models');
        const now = new Date();
        const next7Days = new Date(now);
        next7Days.setDate(next7Days.getDate() + 7);

        const trials = await db.Psychologist.findAll({
            where: {
                status: 'active',
                is_exempt: { [Op.or]: [false, null] },
                subscriptionId: null,
                planExpiresAt: {
                    [Op.gte]: now,
                    [Op.lte]: next7Days
                }
            },
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt'],
            order: [['planExpiresAt', 'ASC']]
        });

        res.json({ success: true, data: trials });
    } catch (e) {
        console.error('Error fetching upcoming trials:', e);
        res.status(500).json({ error: e.message });
    }
};
