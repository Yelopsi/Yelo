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
        else if (group === "sem_demanda_cs") {
            condition = `
                p."subscriptionId" IS NOT NULL 
                AND (p.is_exempt IS NULL OR p.is_exempt = false)
                AND NOT (p."cancelAtPeriodEnd" = true AND p."planExpiresAt" < NOW())
                AND COALESCE(c.total_contacts, 0) = 0
            `;
        }
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
        const seoService = require('../services/seoService');
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
            attributes: ['id', 'nome', 'telefone', 'planExpiresAt', 'admin_billing_sent_at', 'fotoUrl', 'bio', 'crp', 'valor_sessao_numero'],
            order: [['planExpiresAt', 'ASC']]
        });

        // First format trials for AI consumption
        const trialsForAI = await Promise.all(trials.map(async (psi) => {
            const psiData = psi.toJSON();
            let clickCount = 0;
            if (db.WhatsAppClickLog) {
                clickCount = await db.WhatsAppClickLog.count({
                    where: { psychologistId: psiData.id }
                });
            }
            psiData.clickCount = clickCount;
            return psiData;
        }));

        // Ask AI for probabilities
        let aiProbabilities = null;
        try {
            aiProbabilities = await seoService.generateTrialProbabilities(trialsForAI);
        } catch (err) {
            console.error("AI Error:", err.message);
        }

        const enrichedTrials = trialsForAI.map((psiData) => {
            let probability = 10; // Base probability 10%
            
            // If AI returned data, use it!
            if (aiProbabilities && Array.isArray(aiProbabilities)) {
                const aiItem = aiProbabilities.find(a => a.id === psiData.id);
                if (aiItem && typeof aiItem.probability === 'number') {
                    psiData.probability = aiItem.probability;
                    psiData.reason = aiItem.reason || "Calculado por inteligência algorítmica baseada no perfil.";
                    psiData.ai_powered = true;
                    return psiData;
                }
            }
            
            // Fallback: Heuristic
            let reasons = [];
            if (psiData.fotoUrl && psiData.fotoUrl !== 'default.jpg') { probability += 20; reasons.push("Possui foto"); }
            if (psiData.bio && psiData.bio.length > 50) { probability += 15; reasons.push("Bio descritiva"); }
            if (psiData.crp) { probability += 10; reasons.push("CRP validado"); }
            if (psiData.valor_sessao_numero) { probability += 10; reasons.push("Valor configurado"); }
            
            if (psiData.clickCount > 5) { probability += 40; reasons.push("Alta demanda"); }
            else if (psiData.clickCount > 0) { probability += 20; reasons.push("Recebeu demanda"); }
            else { reasons.push("Sem demanda recente"); }
            
            if (probability > 95) probability = 95;
            psiData.probability = probability;
            psiData.reason = `Heurística: ${reasons.join(', ')}`;
            psiData.ai_powered = false;
            return psiData;
        });

        res.json({ success: true, data: enrichedTrials });
    } catch (e) {
        console.error('Error fetching upcoming trials:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.getPaymentsEvolution = async (req, res) => {
    try {
        const cashFlowService = require('../services/cashFlowService');
        const cashFlowData = await cashFlowService.buildCashFlowData();
        
        // Formatar para retorno (Garantir meses sequenciais)
        // Mapear "2026-05" -> count
        const evolutionMap = {};
        cashFlowData.forEach(r => {
            evolutionMap[r.monthYear] = parseInt(r.count, 10);
        });
        
        // Descobrir qual o mês mais antigo com pagamento
        const keys = Object.keys(evolutionMap).sort();
        let startMonthObj;
        if (keys.length > 0) {
            const firstKey = keys[0]; // "YYYY-MM"
            startMonthObj = new Date(parseInt(firstKey.substring(0, 4)), parseInt(firstKey.substring(5, 7)) - 1, 1);
        } else {
            // Se não houver nenhum pagamento, mostra apenas os últimos 5 meses como default
            const today = new Date();
            startMonthObj = new Date(today.getFullYear(), today.getMonth() - 5, 1);
        }
        
        const labels = [];
        const data = [];
        
        const today = new Date();
        const startYear = startMonthObj.getFullYear();
        const startMonthIndex = startMonthObj.getMonth();
        
        // Quantos meses existem entre o primeiro pagamento e hoje
        const totalMonths = (today.getFullYear() - startYear) * 12 + (today.getMonth() - startMonthIndex);
        const monthsToIterate = Math.max(0, totalMonths);
        
        for (let i = monthsToIterate; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            
            // Corrige o fuso horário (Evita que o toISOString volte um dia para o mês anterior em UTC-3)
            const yearLocal = d.getFullYear();
            const monthLocal = String(d.getMonth() + 1).padStart(2, '0');
            const monthStr = `${yearLocal}-${monthLocal}`; // YYYY-MM
            
            // Format label as "Jan/26"
            const ptMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const labelStr = `${ptMonths[d.getMonth()]}/${d.getFullYear().toString().slice(2)}`;
            
            labels.push(labelStr);
            data.push(evolutionMap[monthStr] || 0);
        }
        
        res.json({ success: true, labels, data });
    } catch (e) {
        console.error('Error fetching payments evolution:', e);
        res.status(500).json({ error: e.stack });
    }
};

exports.getCompanyHealthDashboard = async (req, res) => {
    try {
        const CashFlowService = require('../services/cashFlowService');
        const GrowthMarketingService = require('../services/growthMarketingService');
        const MetricsService = require('../services/metricsService');

        const growthService = require('../services/growthService');

        // 1. Get Marketing & Growth Unit Economics
        const unitEconomics = await GrowthMarketingService.getUnitEconomics(30);
        
        // 1.5 Get Overview (Exact same logic as Growth Dashboard)
        const overview = await growthService.getOverview(30);
        
        // 2. Get Cash Flow Data (for pagamentos no mês)
        const cashFlowData = await CashFlowService.buildCashFlowData();
        
        // Determine the current month payments
        const today = new Date();
        const yearLocal = today.getFullYear();
        const monthLocal = String(today.getMonth() + 1).padStart(2, '0');
        const currentMonthStr = `${yearLocal}-${monthLocal}`;
        const currentMonthFlow = cashFlowData.find(c => c.monthYear === currentMonthStr) || { count: 0 };
        const pagamentosMes = currentMonthFlow.count;

        // 3. Heuristic: Invest Recommendation
        let investRecommendation = 'MANTER';
        let investReason = 'Sem dados de gastos em Ads suficientes no mês para calcular o Payback seguro. Ação: Configure a importação de dados de Marketing.';
        
        if (unitEconomics.payback > 0 && unitEconomics.payback <= 3 && unitEconomics.hasMarketingSpend) {
            investRecommendation = 'AUMENTAR';
            investReason = `Acelere os anúncios! O CAC Payback está excelente (${unitEconomics.payback.toFixed(1)} meses). Ação: Dobre o orçamento da sua melhor campanha.`;
        } else if (unitEconomics.payback > 6 && unitEconomics.hasMarketingSpend) {
            investRecommendation = 'REDUZIR';
            investReason = `O CAC de R$ ${unitEconomics.cac} demora ${unitEconomics.payback.toFixed(1)} meses para se pagar. Ação: Pause campanhas ruins e revise público/criativos.`;
        } else if (unitEconomics.payback > 3 && unitEconomics.payback <= 6 && unitEconomics.hasMarketingSpend) {
            investRecommendation = 'MANTER';
            investReason = `Retorno em ${unitEconomics.payback.toFixed(1)} meses. Ação: Mantenha o orçamento e faça testes A/B na Landing Page para reduzir o CAC.`;
        }

        // 4. Heuristic: Bottleneck
        let bottleneck = 'Atração (Topo de Funil)';
        let bottleneckReason = 'Retenção e conversão estão boas, mas falta volume. Ação: Escale o tráfego pago e feche novas parcerias de conteúdo.';
        
        if (unitEconomics.novosPagantes === 0 && unitEconomics.hasMarketingSpend) {
            bottleneck = 'Conversão de Vendas';
            bottleneckReason = 'Você atrai leads, mas não assinam. Ação: Reduza a fricção no checkout e ofereça uma garantia forte ou trial guiado.';
        } else if (overview.taxaChurnPagantes > 10.0) {
            bottleneck = 'Retenção (Churn Alto)';
            bottleneckReason = `A evasão de ${overview.taxaChurnPagantes.toFixed(1)}% anula as vendas. Ação: Melhore o onboarding e fale com os últimos 5 clientes que cancelaram.`;
        }

        // 5. Heuristic: Company Health
        let companyHealth = 'ATENÇÃO';
        let companyHealthReason = `MRR de R$ ${overview.mrrTotal} e Churn de ${overview.taxaChurnPagantes.toFixed(1)}%. Ação: Foco em reengajar usuários inativos para evitar cancelamentos.`;
        
        if (pagamentosMes >= 70 && overview.taxaChurnPagantes < 8.0) {
            companyHealth = 'SAUDÁVEL';
            companyHealthReason = `MRR sólido e Churn controlado (${overview.taxaChurnPagantes.toFixed(1)}%). Ação: Máquina validada. Foque 100% em expandir os canais de aquisição.`;
        } else if (overview.taxaChurnPagantes > 15.0 || overview.mrrTotal < 1000) {
            companyHealth = 'PROBLEMA';
            companyHealthReason = `Alerta Vermelho! ${overview.taxaChurnPagantes > 15.0 ? 'A evasão está destruindo a base.' : 'A receita está muito baixa.'} Ação: Pare a máquina de vendas e conserte o produto base primeiro.`;
        } else if (pagamentosMes >= 20 && overview.taxaChurnPagantes <= 10.0) {
            companyHealth = 'SAUDÁVEL';
            companyHealthReason = `Boa tração. O negócio validou receita. Ação: Aumente gradualmente o orçamento de Ads para crescer a base mais rápido.`;
        }

        // 6. Projections
        // Simple linear projection based on payments trend (last 3 months)
        let projectionRate = 0;
        if (cashFlowData.length >= 3) {
            const m1 = cashFlowData[0].count; // Current
            const m2 = cashFlowData[1].count;
            const m3 = cashFlowData[2].count;
            projectionRate = ((m1 - m2) + (m2 - m3)) / 2;
        } else if (cashFlowData.length >= 2) {
            projectionRate = cashFlowData[0].count - cashFlowData[1].count;
        }
        
        const pagantesAtivos = overview.totalAtivos;
        
        const calcProjection = (target) => {
            if (pagantesAtivos >= target) return 'Atingido';
            if (projectionRate <= 0) return 'DADOS INSUFICIENTES PARA PROJEÇÃO.';
            const monthsToTarget = Math.ceil((target - pagantesAtivos) / projectionRate);
            const targetDate = new Date();
            targetDate.setMonth(targetDate.getMonth() + monthsToTarget);
            return `${targetDate.toLocaleString('pt-BR', { month: 'short' })}/${targetDate.getFullYear()} (Cenário Base)`;
        };

        const marcos = {
            m20: { meta: 20, atual: pagantesAtivos, percentual: Math.min(100, Math.round((pagantesAtivos / 20) * 100)), projection: calcProjection(20) },
            m70: { meta: 70, atual: pagantesAtivos, percentual: Math.min(100, Math.round((pagantesAtivos / 70) * 100)), projection: calcProjection(70) },
            m120: { meta: 120, atual: pagantesAtivos, percentual: Math.min(100, Math.round((pagantesAtivos / 120) * 100)), projection: calcProjection(120) }
        };

        // Combine into payload
        const payload = {
            success: true,
            dashboard: {
                pagantesAtivos: overview.totalAtivos,
                pagamentosMes,
                mrr: overview.mrrTotal,
                churnRate: overview.taxaChurnPagantes.toFixed(1) + '%',
                novosClientes: overview.novosPagantes,
                cancelamentos: overview.churnPagantes,
                arpu: overview.totalAtivos > 0 ? (overview.mrrTotal / overview.totalAtivos) : 0,
                cac: unitEconomics.cac || 'N/D',
                ltv: unitEconomics.ltvProjetado,
                investimentoAds: unitEconomics.totalMarketingSpend,
                cacPayback: unitEconomics.payback > 0 ? unitEconomics.payback.toFixed(1) + ' meses' : 'N/D',
                marcos,
                recommendation: {
                    action: investRecommendation,
                    reason: investReason
                },
                bottleneck: {
                    issue: bottleneck,
                    reason: bottleneckReason
                },
                health: companyHealth,
                healthReason: companyHealthReason
            }
        };

        res.json(payload);
    } catch (error) {
        console.error("Erro no getCompanyHealthDashboard:", error);
        res.status(500).json({ error: "Falha ao compilar health dashboard." });
    }
};

exports.getAdsExpenses = async (req, res) => {
    try {
        const expenses = await db.YeloExpense.findAll({
            where: {
                category: {
                    [Op.in]: ['Google Ads', 'Meta Ads']
                }
            },
            order: [['monthYear', 'DESC']]
        });
        res.json({ success: true, data: expenses });
    } catch (error) {
        console.error('Error fetching ads expenses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.saveAdsExpense = async (req, res) => {
    try {
        const { monthYear, googleAds, metaAds } = req.body;
        if (!monthYear) {
            return res.status(400).json({ success: false, error: 'Mês/Ano é obrigatório.' });
        }

        const t = await db.sequelize.transaction();
        try {
            // Google Ads
            if (googleAds !== undefined) {
                const gAdsAmount = Number(googleAds) || 0;
                let gExp = await db.YeloExpense.findOne({
                    where: { monthYear, category: 'Google Ads' },
                    transaction: t
                });
                if (gExp) {
                    await gExp.update({ amount: gAdsAmount }, { transaction: t });
                } else {
                    await db.YeloExpense.create({ name: 'Google Ads', amount: gAdsAmount, monthYear, category: 'Google Ads' }, { transaction: t });
                }
            }

            // Meta Ads
            if (metaAds !== undefined) {
                const mAdsAmount = Number(metaAds) || 0;
                let mExp = await db.YeloExpense.findOne({
                    where: { monthYear, category: 'Meta Ads' },
                    transaction: t
                });
                if (mExp) {
                    await mExp.update({ amount: mAdsAmount }, { transaction: t });
                } else {
                    await db.YeloExpense.create({ name: 'Meta Ads', amount: mAdsAmount, monthYear, category: 'Meta Ads' }, { transaction: t });
                }
            }

            await t.commit();
            res.json({ success: true, message: 'Gastos de anúncios salvos com sucesso.' });
        } catch (err) {
            await t.rollback();
            throw err;
        }
    } catch (error) {
        console.error('Error saving ads expenses:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
