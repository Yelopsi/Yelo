import re

with open('backend/routes/cmoRoutes.js', 'r') as f:
    code = f.read()

# Replace the analyze-roi route with two routes: GET /action-plan and POST /generate-action-plan
old_route = """// POST /api/cmo/analyze-roi — Analisa a lucratividade e projeções do Simulador com IA
router.post('/analyze-roi', async (req, res) => {
    try {
        const { mrrAtual, mrr12M, reinvestRate, extraCash, cacAtual, cacPenalizado, unspentCash } = req.body;
        
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const prompt = `Você é um CMO/CFO experiente em negócios SaaS B2B2C. Analise os dados do simulador de crescimento de 12 meses da nossa plataforma e forneça um diagnóstico sobre a lucratividade e o risco da estratégia.

DADOS DO MOTOR (Projeção 12 Meses):
- MRR Atual: ${mrrAtual} | MRR Projetado 12M: ${mrr12M}
- Reinvestimento da Receita: ${reinvestRate}% | Aporte Extra Mensal: R$ ${extraCash}
- CAC B2B Atual: ${cacAtual} | CAC Projetado (Teto Saudável): ${cacPenalizado}
- Caixa Excedente / Poupado ao Mês: ${unspentCash} (dinheiro que o sistema se recusou a queimar no Meta Ads para não destruir o CAC)

INSTRUÇÕES RESTRITAS:
Avalie a saúde financeira da estratégia, baseando-se ESTRITAMENTE na matemática provada.
NÃO use opiniões subjetivas como "ineficiência de escala", "perdendo momentum de mercado" ou "validar PMF".
Separe rigidamente: FATO CALCULADO (matemático real) e SUGESTÃO ESTRATÉGICA (apenas se óbvia baseada nos números).
Retorne APENAS um bloco HTML com a seguinte estrutura (SEM MARKDOWN DE CÓDIGO NO INÍCIO OU FIM):
<br>🔍 <strong>Fato Calculado:</strong> [Leitura objetiva da sobra de caixa (cite os valores)]<br><br>💡 <strong>Sugestão Estratégica:</strong> [Alocação lógica do caixa excedente sem extrapolar contexto]`;

        const result = await model.generateContent(prompt);
        let analysis = result.response.text().trim();
        
        if (analysis.startsWith('```html')) {
            analysis = analysis.replace(/^```html/, '').replace(/```$/, '').trim();
        }

        res.json({ success: true, html: analysis });
    } catch (error) {
        console.error('[CMO] Erro ao analisar ROI com IA:', error);
        // Fallback gracefull
        res.json({ success: true, html: `<br>🔍 <strong>Diagnóstico (Fallback):</strong> Não foi possível acessar a IA no momento.<br><br>💡 <strong>Ação Recomendada:</strong> Monitore o custo marginal de aquisição caso aumente o investimento.` });
    }
});"""

new_routes = """// GET /api/cmo/action-plan - Recupera o último plano gerado
router.get('/action-plan', async (req, res) => {
    try {
        const db = require('../models');
        const setting = await db.SystemSetting.findOne({ where: { key: 'cmo_ai_action_plan' } });
        res.json({ success: true, html: setting ? setting.value : null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Erro ao buscar plano' });
    }
});

// POST /api/cmo/generate-action-plan — Analisa a lucratividade e projeções do Simulador com IA
router.post('/generate-action-plan', async (req, res) => {
    try {
        const { mrrAtual, mrr12M, reinvestRate, extraCash, cacAtual, cacPenalizado, unspentCash, targetMetaDaily, currentMetaDailyBudget, availableForAcquisition1, targetGoogleDaily, currentDailyGoogle, baseDaily, trialsDaily } = req.body;
        
        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash" }); // Using a slightly better model for complex output

        const prompt = `Você é o Diretor de Crescimento (CMO) e Diretor Financeiro (CFO) da Yelo (Plataforma SaaS B2B2C para Psicólogos).
Analise os dados do Motor de Crescimento e produza o "Seu Plano de Ação" para o administrador da plataforma.

DADOS DO MOTOR:
- MRR Atual: ${mrrAtual} | MRR 12 Meses: ${mrr12M}
- Reinvestimento: ${reinvestRate}% | Aporte Extra Mensal: R$ ${extraCash}
- CAC B2B Meta Ads Atual: ${cacAtual} | CAC Projetado no teto: ${cacPenalizado}
- Fundo de Aquisição Meta Ads (mês): ${availableForAcquisition1}
- Sobra de Caixa (Rollover/mês): ${unspentCash}
- Orçamento Diário Meta Atual Configurado: ${currentMetaDailyBudget} | Orçamento Matemático Ideal (Meta): ${targetMetaDaily}
- Orçamento Diário Google Atual: ${currentDailyGoogle} | Orçamento Matemático Ideal (Google): ${targetGoogleDaily} (Sendo ${baseDaily} para base e ${trialsDaily} para trials)

INSTRUÇÕES:
Retorne APENAS E ESTRITAMENTE o código HTML das 3 tags <li> (sem tag <ul>, sem markdown \`\`\`html) seguindo o padrão abaixo. Formate os valores em Reais (R$). Seja analítico, matemático e baseie-se nos dados acima.

<li><strong>Meta Ads (Aquisição):</strong> <br>🔍 <strong>Fato Calculado:</strong> [Análise comparando o orçamento atual com o ideal e o fundo] <br><br>💡 <strong>Sugestão Estratégica:</strong> [O que fazer com o Meta Ads]</li>
<br>
<li><strong>Google Ads (Google vs Meta Trials):</strong> <br>🔍 <strong>Fato Calculado:</strong> [Análise do orçamento do Google] <br><br>💡 <strong>Sugestão Estratégica:</strong> [O que fazer com o Google Ads]</li>
<br>
<li><strong>Lucratividade (ROI Geral):</strong> <br>🔍 <strong>Diagnóstico:</strong> [Análise do caixa excedente, MRR e CAC] <br><br>💡 <strong>Ação Recomendada:</strong> [Sugestão final]</li>`;

        const result = await model.generateContent(prompt);
        let analysis = result.response.text().trim();
        
        if (analysis.startsWith('```html')) {
            analysis = analysis.replace(/^```html/, '').replace(/```$/, '').trim();
        } else if (analysis.startsWith('```')) {
            analysis = analysis.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const db = require('../models');
        await db.SystemSetting.upsert({ key: 'cmo_ai_action_plan', value: analysis });

        res.json({ success: true, html: analysis });
    } catch (error) {
        console.error('[CMO] Erro ao analisar ROI com IA:', error);
        res.json({ success: false, error: 'Erro ao chamar IA' });
    }
});"""

code = code.replace(old_route, new_routes)
with open('backend/routes/cmoRoutes.js', 'w') as f:
    f.write(code)

