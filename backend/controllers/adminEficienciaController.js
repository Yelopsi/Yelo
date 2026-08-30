const db = require('../models');
const { Op } = require('sequelize');
const moment = require('moment');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Constantes globais
const FIXED_COST = 73.36;
const MONTHLY_SUBSCRIPTION_PRICE = 99.00;

// Função auxiliar para calcular métricas de uma semana específica com atribuição (UTM)
async function calculateWeeklyMetrics(weekStart, metaAdsSpend, googleAdsSpend) {
    const weekEnd = moment(weekStart).endOf('week').toDate(); // Sábado
    const startDate = moment(weekStart).toDate(); // Domingo

    // Buscar todos os Trials criados na semana
    const trials = await db.Psychologist.findAll({
        attributes: ['id', 'status', 'subscriptionId', 'utm_source'],
        where: {
            createdAt: { [Op.between]: [startDate, weekEnd] }
        }
    });

    let metaTrials = 0, metaPagantes = 0;
    let googleTrials = 0, googlePagantes = 0;
    let organicTrials = 0, organicPagantes = 0;

    trials.forEach(psi => {
        const isPagante = psi.status === 'active' && psi.subscriptionId !== null;
        const source = (psi.utm_source || '').toLowerCase();

        if (source.includes('meta') || source.includes('fb') || source.includes('ig') || source.includes('instagram') || source.includes('facebook')) {
            metaTrials++;
            if (isPagante) metaPagantes++;
        } else if (source.includes('google') || source.includes('adwords')) {
            googleTrials++;
            if (isPagante) googlePagantes++;
        } else {
            organicTrials++;
            if (isPagante) organicPagantes++;
        }
    });

    const novosTrials = metaTrials + googleTrials + organicTrials;
    const novosPagantes = metaPagantes + googlePagantes + organicPagantes;

    const totalAdsSpend = metaAdsSpend + googleAdsSpend;
    const cpl = novosTrials > 0 ? (totalAdsSpend / novosTrials).toFixed(2) : 0;
    const cac = novosPagantes > 0 ? (totalAdsSpend / novosPagantes).toFixed(2) : 0;

    return {
        metaTrials, metaPagantes,
        googleTrials, googlePagantes,
        organicTrials, organicPagantes,
        novosTrials,
        novosPagantes,
        cpl: parseFloat(cpl),
        cac: parseFloat(cac)
    };
}

// GET /api/admin/efficiency - Retorna o dashboard completo
exports.getEfficiencyDashboard = async (req, res) => {
    try {
        // 1. Current MRR e Paying Users (Em tempo real)
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

        const payingUsersCount = activePsychologists.filter(psy => !psy.is_exempt && !!(psy.subscriptionId)).length;

        const currentMRR = activePsychologists.reduce((acc, psy) => {
            if (psy.is_exempt) return acc;
            const hasSub = !!(psy.subscriptionId);
            if (!hasSub) return acc;
            return acc + (planPrices[psy.plano ? psy.plano.toLowerCase() : ''] || 0);
        }, 0);

        // 2. Buscar despesas do YeloExpense
        const expenses = await db.YeloExpense.findAll({
            where: {
                category: { [Op.in]: ['Google Ads', 'Meta Ads'] }
            }
        });
        
        const expensesByMonth = {};
        expenses.forEach(e => {
            if (!expensesByMonth[e.monthYear]) expensesByMonth[e.monthYear] = { meta_ads: 0, google_ads: 0 };
            if (e.category === 'Meta Ads') expensesByMonth[e.monthYear].meta_ads += e.amount;
            if (e.category === 'Google Ads') expensesByMonth[e.monthYear].google_ads += e.amount;
        });

        // 3. Buscar conversões por mês do Psychologists
        const conversionsQuery = `
            SELECT 
                TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as month,
                COUNT(*) FILTER (WHERE utm_source ILIKE '%meta%' OR utm_source ILIKE '%facebook%' OR utm_source ILIKE '%instagram%' OR utm_source ILIKE '%ig%' OR utm_source ILIKE '%fb%') as meta_trials,
                COUNT(*) FILTER (WHERE (utm_source ILIKE '%meta%' OR utm_source ILIKE '%facebook%' OR utm_source ILIKE '%instagram%' OR utm_source ILIKE '%ig%' OR utm_source ILIKE '%fb%') AND status = 'active' AND "subscriptionId" IS NOT NULL) as meta_pagantes,
                COUNT(*) FILTER (WHERE utm_source ILIKE '%google%' OR utm_source ILIKE '%adwords%') as google_trials,
                COUNT(*) FILTER (WHERE (utm_source ILIKE '%google%' OR utm_source ILIKE '%adwords%') AND status = 'active' AND "subscriptionId" IS NOT NULL) as google_pagantes
            FROM "Psychologists"
            WHERE "deletedAt" IS NULL
            GROUP BY month
        `;
        const conversions = await db.sequelize.query(conversionsQuery, { type: db.sequelize.QueryTypes.SELECT });
        
        // 4. Montar Histórico Mensal (Últimos 6 meses)
        const weeklyHistory = [];
        let lastMetaAds = 0;
        let lastGoogleAds = 0;
        
        for (let i = 5; i >= 0; i--) {
            const date = moment().subtract(i, 'months');
            const monthStr = date.format('YYYY-MM');
            
            const exp = expensesByMonth[monthStr] || { meta_ads: 0, google_ads: 0 };
            const conv = conversions.find(c => c.month === monthStr) || { meta_trials: 0, meta_pagantes: 0, google_trials: 0, google_pagantes: 0 };
            
            const mTrials = parseInt(conv.meta_trials || 0, 10);
            const gTrials = parseInt(conv.google_trials || 0, 10);
            const mPagantes = parseInt(conv.meta_pagantes || 0, 10);
            const gPagantes = parseInt(conv.google_pagantes || 0, 10);
            
            const totalSpend = exp.meta_ads + exp.google_ads;
            const totalTrials = mTrials + gTrials;
            const totalPagantes = mPagantes + gPagantes;
            
            weeklyHistory.push({
                week_start: date.format('YYYY-MM-01'), 
                cpl: totalTrials > 0 ? parseFloat((totalSpend / totalTrials).toFixed(2)) : 0,
                cac: totalPagantes > 0 ? parseFloat((totalSpend / totalPagantes).toFixed(2)) : 0,
                meta_ads: exp.meta_ads,
                google_ads: exp.google_ads,
                meta_trials: mTrials,
                google_trials: gTrials,
                meta_pagantes: mPagantes,
                google_pagantes: gPagantes,
                is_month: true
            });
            
            if (i === 0) { // Mês Atual
                lastMetaAds = exp.meta_ads;
                lastGoogleAds = exp.google_ads;
            }
        }
        
        // Net Burn mensal projetado baseado no mês atual
        const projectedMonthlyAds = lastMetaAds + lastGoogleAds;
        const netBurnRate = currentMRR - (FIXED_COST + projectedMonthlyAds);

        res.json({
            currentMRR,
            netBurnRate,
            payingUsersCount,
            weeklyHistory
        });

    } catch (error) {
        console.error('[Efficiency Dashboard] Erro no GET:', error);
        res.status(500).json({ error: 'Erro interno ao buscar dados de eficiência.' });
    }
};

// POST /api/admin/efficiency - Salva os dados do Funil e gera o Insight IA
exports.saveWeeklyEfficiency = async (req, res) => {
    try {
        const metaAds = parseFloat(req.body.metaAds || 0);
        const metaImpressions = parseInt(req.body.metaImpressions || 0, 10);
        const metaClicks = parseInt(req.body.metaClicks || 0, 10);

        const googleAds = parseFloat(req.body.googleAds || 0);
        const googleImpressions = parseInt(req.body.googleImpressions || 0, 10);
        const googleClicks = parseInt(req.body.googleClicks || 0, 10);

        // Pega o início da semana atual (Domingo)
        const weekStart = moment().startOf('week').format('YYYY-MM-DD');

        // Calcula as métricas e Atribuições
        const metrics = await calculateWeeklyMetrics(weekStart, metaAds, googleAds);

        // Salva ou atualiza (upsert)
        const [weeklyData, created] = await db.WeeklyEfficiency.findOrCreate({
            where: { week_start: weekStart },
            defaults: {
                meta_ads: metaAds,
                meta_impressions: metaImpressions,
                meta_clicks: metaClicks,
                google_ads: googleAds,
                google_impressions: googleImpressions,
                google_clicks: googleClicks,
                meta_trials: metrics.metaTrials,
                meta_pagantes: metrics.metaPagantes,
                google_trials: metrics.googleTrials,
                google_pagantes: metrics.googlePagantes,
                organic_trials: metrics.organicTrials,
                organic_pagantes: metrics.organicPagantes,
                novos_trials: metrics.novosTrials,
                novos_pagantes: metrics.novosPagantes,
                cpl: metrics.cpl,
                cac: metrics.cac
            }
        });

        if (!created) {
            weeklyData.meta_ads = metaAds;
            weeklyData.meta_impressions = metaImpressions;
            weeklyData.meta_clicks = metaClicks;
            weeklyData.google_ads = googleAds;
            weeklyData.google_impressions = googleImpressions;
            weeklyData.google_clicks = googleClicks;
            
            weeklyData.meta_trials = metrics.metaTrials;
            weeklyData.meta_pagantes = metrics.metaPagantes;
            weeklyData.google_trials = metrics.googleTrials;
            weeklyData.google_pagantes = metrics.googlePagantes;
            weeklyData.organic_trials = metrics.organicTrials;
            weeklyData.organic_pagantes = metrics.organicPagantes;

            weeklyData.novos_trials = metrics.novosTrials;
            weeklyData.novos_pagantes = metrics.novosPagantes;
            weeklyData.cpl = metrics.cpl;
            weeklyData.cac = metrics.cac;
            await weeklyData.save();
        }

        // --- GERAR INSIGHT ROBUSTO COM GEMINI ---
        let insightHtml = '<p>Nenhum insight disponível no momento.</p>';
        try {
            if (process.env.GEMINI_API_KEY) {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
                
                const quatroSemanasAtras = moment().subtract(4, 'weeks').startOf('week').toDate();
                const ultimasSemanas = await db.WeeklyEfficiency.findAll({
                    where: { week_start: { [Op.gte]: quatroSemanasAtras } },
                    order: [['week_start', 'ASC']]
                });
                
                const historicoTexto = ultimasSemanas.map(w => {
                    const metaCTR = w.meta_impressions > 0 ? ((w.meta_clicks / w.meta_impressions) * 100).toFixed(2) + '%' : '0%';
                    const metaCPC = w.meta_clicks > 0 ? 'R$' + (w.meta_ads / w.meta_clicks).toFixed(2) : 'R$0';
                    const googleCTR = w.google_impressions > 0 ? ((w.google_clicks / w.google_impressions) * 100).toFixed(2) + '%' : '0%';
                    const googleCPC = w.google_clicks > 0 ? 'R$' + (w.google_ads / w.google_clicks).toFixed(2) : 'R$0';
                    
                    return `Semana ${moment(w.week_start).format('DD/MM')}: 
- Meta Ads: Gastou R$${w.meta_ads} | Impressões: ${w.meta_impressions} | Cliques: ${w.meta_clicks} | CTR: ${metaCTR} | CPC: ${metaCPC} | Gerou ${w.meta_trials} trials e ${w.meta_pagantes} assinantes.
- Google Ads: Gastou R$${w.google_ads} | Impressões: ${w.google_impressions} | Cliques: ${w.google_clicks} | CTR: ${googleCTR} | CPC: ${googleCPC} | Gerou ${w.google_trials} trials e ${w.google_pagantes} assinantes.
- Tráfego Orgânico/Outros: Gerou ${w.organic_trials} trials e ${w.organic_pagantes} assinantes.
- Global: CPL R$${w.cpl} | CAC R$${w.cac}`;
                }).join('\n\n');

                const prompt = `Você é um CFO e Diretor de Growth Senior de um SaaS (Yelo, focada em assinaturas para psicólogos).
Sua tarefa é analisar os dados reais do funil de marketing (Impressão -> Clique -> Trial -> Assinante) e dar uma instrução tática para a próxima semana.
Escreva diretamente a análise e a ação em até 3 parágrafos curtos, formatando as dicas chave e métricas em negrito com HTML. 
Regras:
1. CPL ideal < R$ 29,00. CAC ideal < R$ 297,00. 
2. CTR do Meta ideal > 1%. CTR do Google ideal > 5%.
3. Diga de onde está vindo o melhor resultado baseado nas tags de Atribuição (Meta vs Google vs Orgânico).
4. Aconselhe sobre onde mexer: Se CTR estiver baixo = Trocar imagem/criativo. Se CPC estiver alto = Mudar o público. Se clique tá alto mas não converte em trial = Mudar a Landing Page/Site.
Não use Markdown. Responda apenas com tags HTML válidas (ex: <p>, <strong>, <ul>, <li>). Vá direto ao ponto. 

DADOS DAS ÚLTIMAS SEMANAS:
${historicoTexto}`;

                const result = await model.generateContent(prompt);
                const responseText = result.response.text();
                insightHtml = responseText.replace(/```html/g, '').replace(/```/g, '').trim();
            }
        } catch (geminiError) {
            console.error('[Efficiency Dashboard] Erro no Gemini:', geminiError);
            insightHtml = '<p><em>A inteligência artificial está temporariamente indisponível para gerar o insight.</em></p>';
        }

        res.json({ success: true, message: 'Funil e Atribuição atualizados.', insight: insightHtml });

    } catch (error) {
        console.error('[Efficiency Dashboard] Erro no POST:', error);
        res.status(500).json({ error: 'Erro interno ao salvar dados semanais.' });
    }
};

// DELETE /api/admin/efficiency/:id - Exclui uma semana do funil
exports.deleteWeeklyEfficiency = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await db.WeeklyEfficiency.findByPk(id);
        
        if (!record) {
            return res.status(404).json({ error: 'Semana não encontrada' });
        }

        await record.destroy();
        res.json({ message: 'Semana excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir semana do funil:', error);
        res.status(500).json({ error: 'Erro interno ao excluir semana' });
    }
};
