const db = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.getLowPerformanceData = async () => {
    const Op = db.Sequelize.Op;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch active psychologists created more than 7 days ago
    const activePsis = await db.Psychologist.findAll({
        where: { 
            status: 'active', 
            deletedAt: null,
            createdAt: { [Op.lt]: sevenDaysAgo }
        },
        attributes: ['id', 'nome', 'telefone', 'fotoUrl', 'slug', 'status', 'is_exempt', 'planExpiresAt', 'plano', 'createdAt', 'aiOptimizationHistory']
    });

    // Fetch matches grouped by psychologist in the last 30 days
    const [matches] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "MatchEvents" 
        WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch clicks grouped by psychologist in the last 30 days
    const [clicks] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "WhatsAppClickLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch profile views grouped by psychologist in the last 30 days
    const [views] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "ProfileAppearanceLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '30 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    const matchMap = {};
    matches.forEach(m => matchMap[m.id] = parseInt(m.count, 10));

    const clickMap = {};
    clicks.forEach(c => clickMap[c.id] = parseInt(c.count, 10));
    
    const viewMap = {};
    views.forEach(v => viewMap[v.id] = parseInt(v.count, 10));

    let totalMatches = 0;
    let totalClicks = 0;
    
    const statsArray = activePsis.map(psi => {
        const psiMatches = matchMap[psi.id] || 0;
        const psiClicks = clickMap[psi.id] || 0;
        const psiViews = viewMap[psi.id] || 0;
        
        totalMatches += psiMatches;
        totalClicks += psiClicks;

        return {
            ...psi.toJSON(),
            matches_30d: psiMatches,
            clicks_30d: psiClicks,
            views_30d: psiViews,
            ctr: psiMatches > 0 ? (psiClicks / psiMatches) : 0
        };
    });

    const avgMatches = activePsis.length > 0 ? totalMatches / activePsis.length : 0;
    const avgCtr = totalMatches > 0 ? totalClicks / totalMatches : 0;

    // "Malha fina":
    // 1. Gargalo de Conversão: Matches acima da média, mas CTR menor que 50% da média global
    // 2. Gargalo de Visibilidade: Matches menor que 30% da média global
    // 3. Zero cliques mas com base razoável de matches (>=10)
    const lowPerformance = statsArray.filter(psi => {
        const hasHighMatchesLowCtr = psi.matches_30d >= avgMatches && psi.ctr < (avgCtr * 0.5);
        const hasLowMatches = psi.matches_30d < (avgMatches * 0.3) && avgMatches > 10;
        const isZeroClicks = psi.matches_30d >= 10 && psi.clicks_30d === 0;

        if (hasHighMatchesLowCtr || hasLowMatches || isZeroClicks) {
            psi.low_performance_reason = hasHighMatchesLowCtr ? 'high_matches_low_ctr' : (hasLowMatches ? 'low_matches' : 'zero_clicks');
            return true;
        }
        return false;
    });

    return {
        platformAvgMatches: avgMatches,
        platformAvgCtr: avgCtr,
        count: lowPerformance.length,
        psychologists: lowPerformance
    };
};

exports.getLowPerformancePsychologists = async (req, res) => {
    try {
        const data = await exports.getLowPerformanceData();
        res.json(data);
    } catch (e) {
        console.error('Erro getLowPerformancePsychologists:', e);
        res.status(500).json({ error: e.message });
    }
};

exports.generateAiDiagnosis = async (req, res) => {
    try {
        const { id } = req.params;
        const psiId = parseInt(id, 10);

        const psi = await db.Psychologist.findByPk(psiId, {
            attributes: { exclude: ['senha'] }
        });

        if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

        // Coletar Dados do Dossiê para a IA
        const [blogPosts] = await db.sequelize.query(`SELECT id, titulo FROM posts WHERE psychologist_id = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
        const [forumAnswers] = await db.sequelize.query(`SELECT id FROM "ForumComments" WHERE "PsychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
        const [reviews] = await db.sequelize.query(`SELECT id, rating FROM "Reviews" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
        
        // Coletar Métricas dos últimos 30 dias
        const [matches] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '30 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
        const [clicks] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '30 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
        const [views] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '30 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);

        // Historico de otimizacao anterior
        const history = psi.aiOptimizationHistory || [];

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome}, oferecendo uma consultoria rápida baseada nos dados do perfil dele nos últimos 30 dias.
Aja em tom amigável, direto, profissional e de parceria. Sem introduções longas.

[DADOS DO PSICÓLOGO NOS ÚLTIMOS 30 DIAS]
- Aparições em Buscas (Matches): ${matches[0]?.count || 0}
- Visitas no Perfil: ${views[0]?.count || 0}
- Cliques no WhatsApp: ${clicks[0]?.count || 0}

[DADOS DO PERFIL]
- Abordagem: ${psi.abordagens_tecnicas && psi.abordagens_tecnicas.length > 0 ? (Array.isArray(psi.abordagens_tecnicas) ? psi.abordagens_tecnicas.join(', ') : psi.abordagens_tecnicas) : 'Não preenchido'}
- Especialidades (Tags): ${psi.temas_atuacao && psi.temas_atuacao.length > 0 ? (Array.isArray(psi.temas_atuacao) ? psi.temas_atuacao.join(', ') : psi.temas_atuacao) : 'Não preenchido'}
- Valor da Sessão: ${psi.valor_sessao_numero ? 'R$ ' + psi.valor_sessao_numero : 'Não preenchido'}
- Tem foto? ${psi.fotoUrl ? 'Sim' : 'Não'}
- Bio: "${psi.bio || 'Não preenchida'}"

[USO DE FERRAMENTAS DA YELO]
- Artigos no Blog publicados: ${blogPosts.length}
- Respostas no Fórum de Dúvidas: ${forumAnswers.length}
- Avaliações recebidas de pacientes antigos: ${reviews.length}

[HISTÓRICO ANTERIOR DA IA]
${history.length > 0 ? `Na última vez que você falou com ele (em ${new Date(history[history.length-1].date).toLocaleDateString()}), você deu a seguinte dica: ${history[history.length-1].aiDiagnosis}` : 'Este é o primeiro contato de otimização de perfil.'}

[DIAGNÓSTICO E INSTRUÇÕES DE COPY]
Analise os dados acima com muita atenção e escreva a mensagem EXATA que será enviada pelo WhatsApp.
ATENÇÃO: Use formatação nativa do WhatsApp (*negrito*, _itálico_) e insira quebras de linha (\n\n) para tornar o texto escaneável. Separe bem os parágrafos e as dicas. Não retorne um bloco de texto contínuo!

REGRAS DE ANÁLISE:
1. NÃO sugira preencher algo que o profissional JÁ preencheu! Olhe atentamente os [DADOS DO PERFIL] e [USO DE FERRAMENTAS]. Se "Especialidades" ou "Valor da Sessão" já estiver preenchido, não aja como se estivesse vazio.
2. Visibilidade (Aparições baixas): se ele já tem muitas tags, o problema não são as tags. IMPORTANTE: Não use o blog ou as respostas à comunidade como meio de "aumentar ranqueamento" ou "tráfego do Google". Apresente o Blog e as Respostas à Comunidade como uma forma de se aproximar mais dos pacientes e mostrar sua forma de trabalhar, e o Fórum como fortalecimento da comunidade de profissionais. Se ele NÃO tiver tags, aí sim sugira preenchê-las.
3. Conversão (Visitas altas, Cliques baixos): o problema é o convencimento. Se a bio for muito curta/técnica, sugira deixá-la mais acolhedora. Se ele tiver poucas ou zero avaliações, sugira pedir avaliações pelo Link Mágico para gerar prova social.
4. Otimize as sugestões. Se ele já escreveu artigos, não diga "escreva seu primeiro artigo". Reconheça o que ele já fez.
5. Inicie de forma calorosa (ex: "Oi, [Nome]! Como vai? Estive analisando o desempenho do seu perfil...").
6. Escreva no máximo 2 dicas diretas. Seja sucinto e direto.
7. Finalize lembrando que estamos juntos na parceria e se colocando à disposição.

Retorne SOMENTE um JSON com a seguinte estrutura (não use marcações markdown como \`\`\`json, apenas o objeto):
{
  "diagnosis": "Um resumo de 1 linha apenas para o admin ler sobre qual é o problema principal",
  "whatsappCopy": "O texto completo pronto para ser copiado pro whatsapp"
}
`;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const responseText = result.response.text();
        const aiData = JSON.parse(responseText);

        // Salvar histórico no banco
        const updatedHistory = [...history, {
            date: new Date().toISOString(),
            aiDiagnosis: aiData.diagnosis,
            whatsappCopy: aiData.whatsappCopy
        }];

        await psi.update({ aiOptimizationHistory: updatedHistory });

        res.json({
            diagnosis: aiData.diagnosis,
            whatsappCopy: aiData.whatsappCopy,
            history: updatedHistory
        });

    } catch (e) {
        console.error('Erro generateAiDiagnosis:', e);
        res.status(500).json({ error: e.message });
    }
};
