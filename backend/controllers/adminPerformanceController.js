const db = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { formatForWhatsApp } = require('../utils/whatsappFormatter');

async function getStandardMetrics(psiId, psi) {
    const numericId = parseInt(psiId, 10);

    const [matchEventsRaw] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id`, { replacements: { id: numericId } }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "PsychologistId" = :id`, { replacements: { id: numericId } })).catch(() => [[{count: 0}]]);
    const matchesCount = (parseInt(matchEventsRaw[0]?.count || 0, 10)) + (psi.profile_appearances || 0);

    const [profileViewsRaw] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id`, { replacements: { id: numericId } }).catch(() => db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "PsychologistId" = :id`, { replacements: { id: numericId } })).catch(() => [[{count: 0}]]);
    const viewsCount = parseInt(profileViewsRaw[0]?.count || 0, 10);

    let clicksCount = 0;
    if (db.WhatsAppClickLog) {
        clicksCount = await db.WhatsAppClickLog.count({ where: { psychologistId: numericId } }).catch(() => 0);
    }

    return { matchesCount, viewsCount, clicksCount };
}

exports.getLowPerformanceData = async () => {
    const Op = db.Sequelize.Op;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Fetch active psychologists created more than 7 days ago (pagantes ou isentos ainda ativos)
    const activePsis = await db.Psychologist.findAll({
        where: { 
            status: 'active', 
            deletedAt: null,
            createdAt: { [Op.lt]: sevenDaysAgo },
            [Op.or]: [{ subscriptionId: { [Op.ne]: null } }, { subscription_payments_count: { [Op.gt]: 0 } }],
            [Op.and]: [
                {
                    [Op.or]: [
                        { is_exempt: true },
                        { planExpiresAt: { [Op.gt]: new Date() } }
                    ]
                }
            ]
        },
        attributes: ['id', 'nome', 'telefone', 'fotoUrl', 'slug', 'status', 'is_exempt', 'planExpiresAt', 'plano', 'createdAt', 'aiOptimizationHistory']
    });

    // Fetch matches grouped by psychologist in the last 7 days
    const [matches] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "MatchEvents" 
        WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch clicks grouped by psychologist in the last 7 days
    const [clicks] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "WhatsAppClickLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch profile views grouped by psychologist in the last 7 days
    const [views] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "ProfileAppearanceLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '7 days' AND "psychologistId" IS NOT NULL
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
            matches_14d: psiMatches,
            clicks_14d: psiClicks,
            views_14d: psiViews,
            ctr: psiMatches > 0 ? (psiClicks / psiMatches) : 0
        };
    });

    const avgMatches = activePsis.length > 0 ? totalMatches / activePsis.length : 0;
    const avgCtr = totalMatches > 0 ? totalClicks / totalMatches : 0;

    // "Malha fina":
    // 1. Gargalo de Conversão: Matches acima da média, mas CTR menor que 50% da média global
    // 2. Gargalo de Visibilidade: Matches menor que 30% da média global
    // 3. Zero cliques mas com base razoável de matches (>=10)
    const nowTime = new Date();
    const lowPerformance = statsArray.filter(psi => {
        // Ignora se o perfil já foi contatado pela IA alguma vez (limite de 1 vez por psicólogo)
        if (psi.aiOptimizationHistory && Array.isArray(psi.aiOptimizationHistory)) {
            const alreadySent = psi.aiOptimizationHistory.some(entry => entry.action === 'whatsapp_ai_diagnosis' || entry.sentAt);
            if (alreadySent) return false; // Nunca mais reavalia este psicólogo para baixa performance
        }

        const hasHighMatchesLowCtr = psi.matches_14d >= avgMatches && psi.ctr < (avgCtr * 0.5);
        const hasLowMatches = psi.matches_14d < (avgMatches * 0.3) && avgMatches > 10;
        const isZeroClicks = psi.matches_14d >= 10 && psi.clicks_14d === 0;

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

        let psi, blogPosts, forumAnswers, reviews, matchesCount, clicksCount, viewsCount, unansweredLogs, talkingLogs, closedLogs, latestFeedbackToken, magicLink, history;

        if (psiId === 99999) {
            psi = { nome: 'Dr. Local', slug: 'dr-local', bio: 'Formado há 10 anos.', abordagens_tecnicas: ['TCC'], temas_atuacao: ['Ansiedade'], valor_sessao_numero: 150, fotoUrl: 'url_foto' };
            blogPosts = [];
            forumAnswers = [];
            reviews = [];
            matchesCount = 150;
            clicksCount = 0;
            viewsCount = 20;
            unansweredLogs = [{ guestName: 'Visitante', feedbackToken: 'mock_token' }];
            talkingLogs = [];
            closedLogs = [];
            latestFeedbackToken = 'mock_token';
            magicLink = `https://www.yelopsi.com.br/magic-feedback.html?token=mock_token`;
            history = [];
        } else {
            psi = await db.Psychologist.findByPk(psiId, {
                attributes: { exclude: ['senha'] }
            });

            if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

            // Coletar Métricas Padronizadas (idênticas à página de detalhes)
            const metrics = await getStandardMetrics(psiId, psi);
            matchesCount = metrics.matchesCount;
            viewsCount = metrics.viewsCount;
            clicksCount = metrics.clicksCount;

            // Coletar Dados do Dossiê para a IA
            [blogPosts] = await db.sequelize.query(`SELECT id, titulo FROM posts WHERE psychologist_id = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            [forumAnswers] = await db.sequelize.query(`SELECT id FROM "ForumComments" WHERE "PsychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            [reviews] = await db.sequelize.query(`SELECT id, rating FROM "Reviews" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            
            // Coletar Feedbacks de WhatsApp recentes (para status real e link rápido)
            const [recentLogs] = await db.sequelize.query(
                `SELECT "feedbackToken", "feedbackGiven", "dealClosed", "guestName" 
                 FROM "WhatsAppClickLogs" 
                 WHERE ("psychologistId" = :id OR "PsychologistId" = :id) 
                 ORDER BY "createdAt" DESC LIMIT 15`,
                { replacements: { id: psiId } }
            ).catch(() => [[], null]);

            unansweredLogs = recentLogs.filter(l => l.feedbackGiven === false || l.feedbackGiven === null);
            talkingLogs = recentLogs.filter(l => l.feedbackGiven === true && l.dealClosed === 'talking');
            closedLogs = recentLogs.filter(l => l.feedbackGiven === true && (l.dealClosed === 'yes' || l.dealClosed === 'started'));
            latestFeedbackToken = unansweredLogs[0]?.feedbackToken || talkingLogs[0]?.feedbackToken || recentLogs[0]?.feedbackToken || '';
            magicLink = latestFeedbackToken ? `https://www.yelopsi.com.br/magic-feedback?token=${latestFeedbackToken}` : `https://www.yelopsi.com.br/psi/dashboard`;

            // Historico de otimizacao anterior
            history = psi.aiOptimizationHistory || [];
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}, oferecendo uma consultoria rápida baseada nos dados de desempenho dele na plataforma.
Aja em tom amigável, direto, profissional e de parceria. Sem introduções longas.

[DADOS DO DESEMPENHO NA PLATAFORMA]
- Aparições nos resultados de matches: ${matchesCount}
- Visitas no Perfil: ${viewsCount}
- Cliques no WhatsApp: ${clicksCount}

[DADOS DO PERFIL]
- Gênero/Identidade: ${psi.genero_identidade || 'Não informado'}
- Práticas Inclusivas/Afirmativas: ${(psi.praticas_inclusivas && psi.praticas_inclusivas.length > 0) ? (Array.isArray(psi.praticas_inclusivas) ? psi.praticas_inclusivas.join(', ') : psi.praticas_inclusivas) : ((psi.praticas_vivencias && psi.praticas_vivencias.length > 0) ? (Array.isArray(psi.praticas_vivencias) ? psi.praticas_vivencias.join(', ') : psi.praticas_vivencias) : 'Não preenchido')}
- Abordagem: ${psi.abordagens_tecnicas && psi.abordagens_tecnicas.length > 0 ? (Array.isArray(psi.abordagens_tecnicas) ? psi.abordagens_tecnicas.join(', ') : psi.abordagens_tecnicas) : 'Não preenchido'}
- Especialidades (Tags): ${psi.temas_atuacao && psi.temas_atuacao.length > 0 ? (Array.isArray(psi.temas_atuacao) ? psi.temas_atuacao.join(', ') : psi.temas_atuacao) : 'Não preenchido'}
- Valor da Sessão: ${psi.valor_sessao_numero ? 'R$ ' + psi.valor_sessao_numero : 'Não preenchido'}
- Tem foto? ${psi.fotoUrl ? 'Sim' : 'Não'}
- Bio: "${psi.bio || 'Não preenchida'}"

[FEEDBACKS DE CONTATOS VIA WHATSAPP]
- Há feedbacks pendentes (sem resposta)? ${unansweredLogs.length > 0 ? `Sim (${unansweredLogs.length} paciente(s) sem resposta de status)` : 'Não, todos os contatos recentes foram respondidos pelo psicólogo!'}
- Em negociação ativa? ${talkingLogs.length > 0 ? `Sim (${talkingLogs.length} em negociação)` : 'Não'}
- Pacientes fechados (agendados): ${closedLogs.length}
- Link rápido de resposta de feedback (sem precisar de login): ${magicLink}

[USO DE FERRAMENTAS DA YELO E ENGAJAMENTO]
- Artigos no Blog publicados: ${blogPosts.length}
- Respostas no Fórum de Dúvidas / Comunidade: ${forumAnswers.length}
- Avaliações (Reviews): ${reviews.length}
- Especialidades cadastradas: ${psi.temas_atuacao ? psi.temas_atuacao.length : 0}
- Tamanho da Bio: ${psi.bio ? psi.bio.length : 0} caracteres

ATENÇÃO: Use formatação nativa do WhatsApp (*negrito*, _itálico_) e insira quebras de linha (\\n\\n) para tornar o texto escaneável. Separe bem os parágrafos e as dicas. Não retorne um bloco de texto contínuo!

REGRAS DA CONSULTORIA (SEJA HIPER-PERSONALIZADO E DIRETO):
1. ATENÇÃO MÁXIMA SOBRE EDIÇÃO DE PERFIL: Na nossa plataforma, os campos "Temas de Atuação", "Público Alvo", "Abordagem" e "Práticas Inclusivas" SÃO SELEÇÕES FECHADAS (DROPDOWNS). O psicólogo NÃO pode escrever textos livres neles. O ÚNICO campo onde ele pode "nichar", escrever de forma livre, falar sobre dores específicas e se diferenciar é a **BIO**. Nunca mande ele "alterar os temas para ser mais específico", mande ele **usar a Bio** para criar esse nicho hiper-específico!
2. Aja como um Cirurgião de Marketing: escolha o principal gargalo dele com base nos números (Match, Visitas, Cliques).
3. ESTRUTURA DA MENSAGEM: Você deve obrigatoriamente estruturar seu feedback no corpo do texto em duas partes claras: "*O que está ótimo ✅*" e "*O que poderia melhorar 🔧*".
4. Em "*O que está ótimo ✅*": Olhe as variáveis em [DADOS DO PERFIL]. Elogie tudo o que ele já fez certo (Ex: "Vi que sua sessão está R$ X, um valor super competitivo", "Parabéns por já ter preenchido suas práticas inclusivas", "Você escolheu ótimos temas de atuação"). Prove que você leu os dados do perfil dele.
5. Em "*O que poderia melhorar 🔧*": Dê 1 ou 2 orientações cirúrgicas do que ele deve alterar HOJE. Se o Gargalo é de Vitrine (Ex: apareceu em buscas mas não recebeu cliques) e a Bio for muito focada em currículo acadêmico, sugira fortemente: "A sua bio começa parecendo um currículo, o paciente em crise não busca diplomas. Tente alterar as primeiras linhas da Bio para focar na dor do paciente."

6. Acompanhamento de Feedbacks de WhatsApp (USE COM ATENÇÃO EXTREMA):
   - VERIFIQUE em [FEEDBACKS DE CONTATOS VIA WHATSAPP] a situação dos contatos dele:
   - SE "Há feedbacks pendentes (sem resposta)?" for NÃO (ou seja, ele já respondeu os feedbacks na plataforma): JAMAIS diga que ele "não informou se a sessão foi fechada" ou cobre atualização de status! Se houver pacientes "Em negociação ativa", você pode perguntar amigavelmente como estão as conversas e se precisa de alguma ajuda para fechar o agendamento. Se já fechou pacientes, comemore!
   - SE "Há feedbacks pendentes (sem resposta)?" for SIM: adicione uma solicitação amigável e parceira pedindo para ele nos avisar o status dos atendimentos. OBRIGATÓRIO: Forneça SEMPRE o link rápido para ele responder sem precisar acessar a plataforma (${magicLink}). Exemplo: "Vi que você recebeu contatos no WhatsApp recentemente! Para que nosso algoritmo continue impulsionando seu perfil nas buscas, por favor nos atualize sobre o status desses atendimentos através deste link rápido (não precisa nem fazer login na plataforma): ${magicLink}". NUNCA peça para ele acessar ou logar na plataforma para dar feedback se temos o link rápido!

ESTRUTURA OBRIGATÓRIA E TOM DE VOZ:
7. Inicie com um gatilho de parceria direto e amigável, SEM apresentação formal (como "Aqui é o Anderson"), pois o psicólogo já conhece você: "Olá, [Nome]! Tudo bem? Fiz uma análise detalhada da sua performance nos últimos dias e trouxe alguns pontos para potencializarmos seus resultados: você teve ${matchesCount} aparições em resultados de matches, ${viewsCount} visitas no perfil e ${clicksCount} cliques no WhatsApp."
8. Aja de forma EXTREMAMENTE EMPÁTICA, PARCEIRA e HUMANIZADA. Você está lá para ajudá-lo a ganhar dinheiro, mostre que o sucesso dele é o nosso sucesso. ZERO GÍRIAS.
9. Após a introdução do passo 7, justifique onde está o gargalo dele (ex: "O nosso gargalo hoje está na conversão da visita para o contato...").
10. Finalize com um gatilho de comprometimento: "Esses pequenos ajustes costumam destravar a agenda de muitos profissionais por aqui. Qualquer dúvida sobre como aplicar isso, é só me chamar. Estamos juntos nessa jornada para encher a sua clínica! 🌿"

Retorne SOMENTE um JSON com a seguinte estrutura (não use blocos markdown de código, apenas o objeto JSON puro):
{
  "diagnosis": "Um resumo de 1 linha apenas para o admin ler sobre qual é o problema principal",
  "whatsappCopy": "O texto completo pronto para ser copiado pro whatsapp"
}
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para o Diagnóstico IA.");
            const mockResponse = {
                diagnosis: "Baixa taxa de cliques no WhatsApp (0) e há feedbacks pendentes de pacientes que entraram em contato antes. A bio está muito curta e precisa de avaliação social.",
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Fiz uma análise detalhada da sua performance e decidi te trazer alguns pontos super estratégicos para te ajudar a destravar mais pacientes.\n\nA plataforma entregou uma excelente visibilidade para o seu perfil nos últimos dias: você teve *${matchesCount} aparições nos resultados de matches* e *${viewsCount} pacientes visitaram a sua página*. No entanto, não registramos *nenhum clique* recente no seu WhatsApp.\n\nIsso mostra um gargalo na sua vitrine, mas super simples de corrigir! Recomendo focarmos em duas ações:\n\n1. *Acesse o "Manual de Conversão":* Vi que você já tem cliques antigos, mas a nossa plataforma tem um manual focado em como não perder pacientes que chegam no WhatsApp. Ele fica lá no seu Hub de Evolução!\n\n2. *Construa Prova Social:* Peça avaliações no seu perfil usando o seu link (https://www.yelopsi.com.br/${psi.slug}?review=true). A opinião de outras pessoas é o maior gatilho para destravar o agendamento de quem está em dúvida.\n\n⚠️ Ah, um ponto importante: notei que você tem contatos recentes e ainda há *${unansweredLogs.length} paciente(s)* sem status de fechamento informado. Para que nosso algoritmo continue impulsionando seu perfil nas buscas, por favor nos atualize sobre o status desses atendimentos através deste link rápido (não precisa nem fazer login na plataforma): ${magicLink}\n\nQualquer dúvida sobre como aplicar tudo isso, é só me chamar. Estamos juntos! 🌿`
            };
            return res.status(200).json({ 
                diagnosis: mockResponse.diagnosis,
                whatsappCopy: mockResponse.whatsappCopy,
                history: history
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.5-flash-lite",
            generationConfig: { 
                responseMimeType: "application/json",
                temperature: 0.3,
                maxOutputTokens: 400
            }
        });

        let aiData;
        try {
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de IA (3.5s)')), 3500));
            const result = await Promise.race([
                model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }]
                }),
                timeoutPromise
            ]);
            const responseText = result.response.text();
            aiData = JSON.parse(responseText);
        } catch (genErr) {
            console.warn('⚠️ [generateAiDiagnosis] Falha ou timeout no Gemini:', genErr.message);
            aiData = {
                diagnosis: "Perfil necessita de enriquecimento na bio e conquista de primeiras avaliações para elevar conversão.",
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson da Yelo. 🌿\n\nEstive acompanhando as métricas do seu perfil nesta semana e vejo uma oportunidade excelente para aumentarmos os seus contatos no WhatsApp.\n\nPara atrair mais pacientes de forma prática, recomendo:\n1. Adicionar temas de dores reais na sua bio (como ansiedade e estresse);\n2. Solicitar 2 avaliações de pacientes antigos via *Evolução > Solicitar Avaliações*;\n3. Responder a uma dúvida recente de paciente no nosso Fórum.\n\nEstamos juntos nessa parceria! Se precisar de uma ajuda com a apresentação do seu perfil, conte comigo.`
            };
        }
        aiData.whatsappCopy = formatForWhatsApp(aiData.whatsappCopy);

        // Salvar histórico no banco apenas se não for mock
        const updatedHistory = [...history, {
            date: new Date().toISOString(),
            aiDiagnosis: aiData.diagnosis,
            whatsappCopy: aiData.whatsappCopy
        }];

        if (psiId !== 99999) {
            await psi.update({ aiOptimizationHistory: updatedHistory });
        }

        res.json({
            diagnosis: aiData.diagnosis,
            whatsappCopy: aiData.whatsappCopy,
            history: updatedHistory
        });

    } catch (e) {
        console.error('Erro generateAiDiagnosis:', e);
        res.status(500).json({ error: 'Erro interno no servidor de IA.' });
    }
};

exports.generateAiChurnMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const psiId = parseInt(id, 10);

        let psi, matchesCount, viewsCount, clicksCount, dealYes, dealGhosted, dealNo, dealTalking;

        if (psiId === 99999) {
            // MOCK LOCAL (APENAS DADOS)
            psi = { nome: 'Dr. Local', valor_sessao_numero: 150 };
            matchesCount = 200;
            viewsCount = 15;
            clicksCount = 2;
            dealYes = 1;
            dealGhosted = 0;
            dealNo = 0;
            dealTalking = 1;
        } else {
            // DADOS REAIS
            psi = await db.Psychologist.findByPk(psiId, {
                attributes: { exclude: ['senha'] }
            });

            if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

            // Coletar Métricas Padronizadas (idênticas à página de detalhes)
            const metrics = await getStandardMetrics(psiId, psi);
            matchesCount = metrics.matchesCount;
            viewsCount = metrics.viewsCount;
            clicksCount = metrics.clicksCount;
            
            // Feedbacks
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: psiId },
                attributes: ['dealClosed']
            });
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length : clicksCount;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no' || l.dealClosed === 'not_started').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
        }

        const hasClicks = clicksCount > 0;
        const hasConversions = dealYes > 0;

        let metricsBlockPrompt = '';
        let feedbackInstruction = '';

        if (hasClicks) {
            metricsBlockPrompt = `
[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
Você DEVE citar esses indicadores no corpo do seu texto:
1. Aparições nos resultados de matches: ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}
3. Contatos/Cliques no WhatsApp: ${clicksCount}
`;
            if (hasConversions) {
                feedbackInstruction = `Se ele fechou pacientes (${dealYes}), parabenize-o! É o maior argumento de que a plataforma funciona.`;
            } else {
                feedbackInstruction = `Ele recebeu ${clicksCount} contato(s) no WhatsApp, mas ainda não fechou. NUNCA diga "0 conversões" ou "nenhum fechamento". Em vez disso, diga em tom de equipe que o fluxo já começou a tracionar e que com a continuidade do perfil e pequenos ajustes na conversa/abordagem as conversões acontecem naturalmente.`;
            }
        } else {
            metricsBlockPrompt = `
[DADOS DO DESEMPENHO NO TRIAL - ATENÇÃO: 0 CLIQUES]
Você DEVE citar APENAS os indicadores positivos de visibilidade:
1. Aparições nos resultados de matches: ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}

REGRA CRÍTICA PARA 0 CLIQUES:
O psicólogo teve ${matchesCount} aparições e ${viewsCount} visitas, mas ainda 0 cliques no WhatsApp.
NUNCA, sob hipótese alguma, escreva "Cliques: 0", "0 cliques" ou "0 pacientes te chamaram" - isso é extremamente desanimador e destrói a conversão para assinatura!
Em vez disso:
- Destaque o volume de pessoas que já viram o perfil dele nas buscas e visitaram a página.
- Diga que o algoritmo estava aprendendo o perfil dele e gerando tração inicial de buscas e visitas. O próximo passo natural é a conversão dessas visitas em conversas no WhatsApp.
- Diga que juntos podem revisar a apresentação/foto para destravar os primeiros contatos no WhatsApp.
`;
            feedbackInstruction = `Como não houve cliques ainda, foque exclusivamente em valorizar as buscas e visitas, sem mencionar falta de fechamento ou conversões.`;
        }

        const hasValorSessaoChurn = psi.valor_sessao_numero && psi.valor_sessao_numero > 0;
        let instrucaoFinanceiraChurn = '';
        if (hasValorSessaoChurn) {
            const val = psi.valor_sessao_numero;
            if (val >= 99) {
                instrucaoFinanceiraChurn = `Compare amigavelmente o valor da sessão dele (R$ ${val}) com a mensalidade da Yelo (R$ 99,00). Mostre que realizar apenas 1 atendimento no mês inteiro já cobre os R$ 99 da plataforma e ainda deixa lucro líquido direto no consultório dele.`;
            } else {
                const sessoes2 = val * 2;
                const sessoes4 = val * 4;
                instrucaoFinanceiraChurn = `Como a sessão dele custa R$ ${val} (que é menor que os R$ 99 da assinatura), NUNCA afirme que "1 sessão já cobre a plataforma", pois matematicamente R$ ${val} não cobre R$ 99. Em vez disso, explique que fechar com apenas 1 paciente no mês (que costuma realizar acompanhamento contínuo de 2 a 4 sessões mensais, totalizando entre R$ ${sessoes2} e R$ ${sessoes4}) já cobre a assinatura de R$ 99 com folga e se transforma em lucro líquido para o consultório dele.`;
            }
        } else {
            instrucaoFinanceiraChurn = `Lembre-o amigavelmente de que a assinatura da Yelo tem um valor fixo de R$ 99 mensais e que nós NÃO cobramos nenhuma taxa ou comissão sobre os atendimentos dele. Como ele atende com valor a combinar diretamente com o paciente no WhatsApp, ele tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no consultório dele. NUNCA presuma que "1 sessão cobre a plataforma" ou "já cobre com folga", pois o valor é a combinar. Enfatize a autonomia de precificação e o fato de ser 0% de comissão.`;
        }

        const prompt = `
Você é Anderson, representante da equipe de Customer Success e Growth da Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}, cujo período de testes (Trial) de 7 dias expirou recentemente (Churn).
O objetivo da mensagem é convencer o profissional a reativar sua assinatura (que custa R$ 99,00/mês).

Aja de forma humanizada, direta, empática e SEMPRE com tom e voz de equipe ("nós vimos", "analisamos", "acreditamos", "percebemos", "nossa equipe"). NÃO seja agressivamente vendedor e não use gírias.
Inicie cumprimentando: "Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson, da equipe da Yelo. 🌿"

${metricsBlockPrompt}

[FEEDBACKS E RESULTADOS]
- Fechou negócio (Agendou): ${dealYes}
- Em negociação: ${dealTalking}
- Paciente "fantasma" (sumiu): ${dealGhosted}
- Não fechou (achou caro ou desistiu): ${dealNo}

[ANÁLISE FINANCEIRA]
- O psicólogo cobra: ${hasValorSessaoChurn ? `R$ ${psi.valor_sessao_numero} por sessão` : 'Valor a combinar'}
- A mensalidade da Yelo custa R$ 99,00 (sem taxa nem comissão por atendimento).

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_) e quebras de linha (\\n\\n).
2. Cumprimente o psicólogo pelo nome e introduza a equipe. Comece em um tom acolhedor e agradeça por ele ter testado a plataforma.
3. Seja SUAVE ao informar que o Trial de 7 dias encerrou. Exemplo: "O seu período gratuito encerrou, mas nós estávamos analisando as suas métricas e os resultados foram muito promissores..."
4. É OBRIGATÓRIO APRESENTAR AS MÉTRICAS EM TÓPICOS NATIVOS DO WHATSAPP com os números em negrito para evidenciar os números, iniciando cada linha com '* *' (ex: * *18 aparições* nos resultados de matches, * *2 visitas* na página, * *1 paciente te chamou no WhatsApp*). Se teve 0 cliques, apresente apenas as aparições e visitas.
5. Analise os resultados de fechamento de forma consultiva e empática, em tom de equipe:
   ${feedbackInstruction}
6. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE COM RIGOR (A MATEMÁTICA DEVE SER PERFEITA E PRECISA): 
   ${instrucaoFinanceiraChurn}
7. Finalize de forma super acolhedora perguntando se faz sentido para mantermos a página ativa. Se sim, instrua-o a reativar acessando a conta na Yelo, indo na opção "Ajustes" e depois "Assinaturas e Planos".
8. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto. Finalize diretamente após perguntar se faz sentido reativar ou dar as instruções para ativar o plano.
`;

        let whatsappCopy = '';
        if (psiId !== 99999 && process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-3.5-flash-lite", 
                    systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 350
                    }
                });
                
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de IA (3.5s)')), 3500));
                const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
                const rawText = result.response.text();
                if (rawText && rawText.trim().length > 10) {
                    whatsappCopy = formatForWhatsApp(rawText.replace(/^```whatsapp\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim());
                }
            } catch (aiErr) {
                console.warn('⚠️ [AI Churn] Falha no Gemini (ativando fallback consultivo):', aiErr.message);
            }
        }

        if (!whatsappCopy) {
            let metricsText = "";
            let feedbackText = "";
            let mathText = "";

            if (hasClicks) {
                const contatoStr = clicksCount === 1 ? '1 paciente te chamou no WhatsApp' : `${clicksCount} pacientes te chamaram no WhatsApp`;
                metricsText = `Durante os testes, o seu perfil obteve:\n\n* *${matchesCount} aparições* nos resultados de matches\n* *${viewsCount} visualizações* na sua página\n* *${contatoStr}*`;
                
                if (dealYes > 0) {
                    feedbackText = `E vimos pelo seu feedback que você já conseguiu agendar com ${dealYes} paciente(s)! 🎉`;
                } else {
                    feedbackText = `O fluxo de contatos já estava começando a ganhar tração! Com a continuidade do perfil no ar e pequenos ajustes na conversa, os agendamentos acontecem naturalmente.`;
                }
            } else {
                metricsText = `Durante os testes, o seu perfil obteve:\n\n* *${matchesCount} aparições* nos resultados de buscas\n* *${viewsCount} visualizações* diretas na sua página`;
                feedbackText = `O seu perfil já começou a ganhar relevância nas buscas e visitas de potenciais pacientes. O próximo passo natural é a conversão dessas visitas em conversas no WhatsApp. Nossa equipe pode te ajudar a dar uma revisada rápida na apresentação para destravarmos esses contatos!`;
            }

            if (hasValorSessaoChurn) {
                const val = psi.valor_sessao_numero;
                if (val >= 99) {
                    mathText = `Como a sua sessão é de R$ ${val}, realizar apenas 1 atendimento no mês inteiro já cobre a plataforma com folga e ainda te deixa com lucro direto.`;
                } else {
                    const s2 = val * 2;
                    const s4 = val * 4;
                    mathText = `Como a sua sessão é de R$ ${val}, fechar com apenas 1 paciente no mês (que costuma realizar de 2 a 4 atendimentos, somando entre R$ ${s2} e R$ ${s4}) já cobre a mensalidade de R$ 99 com folga e se transforma em lucro líquido para você.`;
                }
            } else {
                mathText = `Como você atende com valor a combinar diretamente com o paciente no WhatsApp, você tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no seu consultório, sem nenhuma taxa ou comissão da nossa parte.`;
            }

            whatsappCopy = formatForWhatsApp(
                `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson, da equipe da Yelo. 🌿\n\nPassamos para agradecer por você ter testado a plataforma com a gente nesses últimos dias! O seu período gratuito encerrou, mas nós estávamos analisando as suas métricas e os resultados foram muito positivos.\n\n${metricsText}\n\n${feedbackText}\n\nPensando pelo seu lado financeiro: a assinatura da Yelo tem um valor fixo de R$ 99,00 mensais. ${mathText}\n\nFaria sentido para você reativarmos a sua página para não perder esse fluxo de pacientes que já estão te encontrando? Caso queira manter seu perfil no ar, basta acessar a sua conta na Yelo, ir em "Ajustes" e depois em "Assinaturas e Planos". Estamos totalmente à disposição!`
            );
        }

        return res.status(200).json({ whatsappCopy });
    } catch (e) {
        console.error('Erro generateAiChurnMessage:', e);
        res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
    }
};


exports.generateAiPaidChurnMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const psiId = parseInt(id, 10);

        let psi, matchesCount, viewsCount, clicksCount, dealYes, dealGhosted, dealNo, dealTalking;

        if (psiId === 99999) {
            psi = { nome: 'Dr. Local', valor_sessao_numero: 150 };
            matchesCount = 450;
            viewsCount = 62;
            clicksCount = 12;
            dealYes = 3;
            dealGhosted = 0;
            dealNo = 0;
            dealTalking = 1;
        } else {
            psi = await db.Psychologist.findByPk(psiId, {
                attributes: { exclude: ['senha'] }
            });
            if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

            // Coletar Métricas Padronizadas
            const metrics = await getStandardMetrics(psiId, psi);
            matchesCount = metrics.matchesCount;
            viewsCount = metrics.viewsCount;
            clicksCount = metrics.clicksCount;
            
            // Feedbacks
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: psiId },
                attributes: ['dealClosed']
            });
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length : clicksCount;
        }

        const hasClicks = clicksCount > 0;
        let metricsBlockPrompt = '';
        if (hasClicks) {
            metricsBlockPrompt = `
[DADOS HISTÓRICOS DE DESEMPENHO]
Você DEVE citar esses três indicadores no corpo do texto para lembrá-lo do valor que a plataforma já gerou:
1. Total de Aparições nos resultados de matches: ${matchesCount}
2. Total de Visitas na Página (Views): ${viewsCount}
3. Total de Cliques no WhatsApp: ${clicksCount}
`;
        } else {
            metricsBlockPrompt = `
[DADOS HISTÓRICOS DE DESEMPENHO - 0 CLIQUES]
Você DEVE citar APENAS os indicadores de visibilidade:
1. Total de Aparições nos resultados de matches: ${matchesCount}
2. Total de Visitas na Página (Views): ${viewsCount}
NUNCA escreva "0 cliques" ou "Cliques: 0". Valorize o histórico de buscas e visitas para gerar ancoragem de relevância.
`;
        }

        const hasValorSessaoPaid = psi.valor_sessao_numero && psi.valor_sessao_numero > 0;
        let instrucaoFinanceiraPaid = '';
        if (hasValorSessaoPaid) {
            const val = psi.valor_sessao_numero;
            if (val >= 99) {
                instrucaoFinanceiraPaid = `cite o valor da sessão dele (R$ ${val}) e compare com a mensalidade (R$ 99,00). Mostre que manter o perfil ativo custa menos do que realizar apenas 1 único atendimento no mês todo.`;
            } else {
                const s2 = val * 2;
                const s4 = val * 4;
                instrucaoFinanceiraPaid = `como a sessão dele é R$ ${val} (menor que R$ 99), NUNCA diga que custa menos que 1 sessão. Mostre que fechar com apenas 1 paciente no mês (que costuma realizar de 2 a 4 consultas, somando de R$ ${s2} a R$ ${s4}) já cobre todo o custo de manter o perfil ativo e ainda deixa lucro.`;
            }
        } else {
            instrucaoFinanceiraPaid = `lembre que a mensalidade tem taxa zero de comissão, sendo um valor fixo de R$ 99 mensais.`;
        }

        const prompt = `
Você é Anderson, representante da equipe de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}. 
Situação atual: Este profissional já era assinante do plano Essencial (R$ 99,00), mas a sua assinatura expirou/foi cancelada recentemente (Churn de Pagante). 
O objetivo da mensagem é entender o que houve e convencê-lo a reativar a assinatura.

Aja de forma humanizada, parceira, e SEMPRE em tom de equipe ("nós vimos", "acompanhamos", "acreditamos"). NÃO use NENHUMA gíria.

${metricsBlockPrompt}

[ANÁLISE FINANCEIRA]
- O psicólogo cobra: ${hasValorSessaoPaid ? `R$ ${psi.valor_sessao_numero} por sessão` : 'Valor a combinar'}
- A mensalidade da Yelo custa R$ 99,00 (sem taxa nem comissão).

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_).
2. Cumprimente pelo nome. Comece dizendo que você notou que a assinatura dele na Yelo expirou e o perfil acabou saindo do ar, e pergunte se houve algum problema com a renovação do cartão ou se foi uma decisão de pausa.
3. Apresente os resultados históricos dele para gerar ancoragem de valor. Mostre que o perfil dele já tem relevância e que recomeçar depois pode ser mais lento.
4. Seja empático. Se ele teve cliques no passado, lembre-o de que o perfil dele atrai pacientes. Se o problema for conversão, ofereça ajuda: 'Se o volume de fechamentos não estava como você gostaria, nossa equipe pode revisar seu perfil junto com você para melhorarmos isso!'
5. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE COM PRECISÃO: ${instrucaoFinanceiraPaid}
6. Finalize deixando a porta aberta. Pergunte como a nossa equipe pode ajudá-lo hoje a reativar o perfil, ou informe para acessar "Ajustes > Assinaturas e Planos" no app.
7. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto.
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para Paid Churn.");
            const metricsText = hasClicks
                ? `Ao todo, você já apareceu em *${matchesCount} buscas*, teve *${viewsCount} visitas* e recebeu *${clicksCount} cliques* no WhatsApp.`
                : `Ao todo, você já apareceu em *${matchesCount} buscas* e teve *${viewsCount} visitas* na sua página.`;

            let mathPaidText = '';
            if (hasValorSessaoPaid) {
                const val = psi.valor_sessao_numero;
                if (val >= 99) {
                    mathPaidText = `Como a sua sessão particular é de R$ ${val}, queríamos te lembrar que manter a sua assinatura na Yelo (R$ 99,00) acaba custando menos do que 1 único atendimento no mês todo.`;
                } else {
                    const s2 = val * 2;
                    mathPaidText = `Como a sua sessão particular é de R$ ${val}, queríamos te lembrar que fechar com apenas 1 paciente no mês (que costuma fazer ao menos 2 a 4 consultas, somando R$ ${s2}+) já cobre a assinatura da Yelo (R$ 99,00) com folga e se paga com facilidade.`;
                }
            } else {
                mathPaidText = `Como a sua assinatura na Yelo tem taxa zero de comissão, manter o seu perfil ativo tem o custo fixo de apenas R$ 99,00 mensais.`;
            }

            return res.json({
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson, da equipe da Yelo. 🌿\n\nNotamos aqui no sistema que a sua assinatura expirou nos últimos dias e, por conta disso, seu perfil acabou sendo ocultado das buscas dos pacientes. Houve algum problema com a renovação do cartão ou você decidiu dar uma pausa?\n\nFomos dar uma olhada no seu histórico e vimos que seu perfil construiu uma relevância bem legal com a gente! ${metricsText}\n\n${mathPaidText}\n\nSe o motivo da pausa foi não estar conseguindo converter esses contatos, nos avise! Nossa equipe pode revisar o seu perfil com você.\n\nFaz sentido para você reativarmos o seu perfil hoje e não perder esse fluxo?`
            });
        }

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        let text = '';
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-3.5-flash-lite",
                    systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 350
                    }
                });

                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de IA (3.5s)')), 3500));
                const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
                const response = await result.response;
                text = formatForWhatsApp(response.text());
            } catch (aiErr) {
                console.warn('⚠️ [generateAiConversionFailure] Falha no Gemini:', aiErr.message);
            }
        }

        if (!text) {
            text = formatForWhatsApp(`Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson, da Yelo. 🌿\n\nEstava acompanhando as métricas do seu perfil na Yelo e é muito bom ver que a sua página está gerando interesse e atraindo cliques no WhatsApp! Notei, porém, que os últimos contatos acabaram ainda não avançando para o agendamento.\n\nQuando o paciente clica no WhatsApp, os primeiros minutos de acolhimento e a forma de conduzir a conversa até o valor da sessão fazem toda a diferença. Recomendo dar uma olhada na ferramenta *Clínica > Manual de Conversão* lá no seu painel — preparamos roteiros práticos justamente para evitar que o paciente deixe no vácuo.\n\nQualquer dúvida ou se quiser trocar uma ideia sobre a abordagem inicial, estou por aqui! 🌿`);
        }

        res.json({ whatsappCopy: text });
    } catch (e) {
        console.error('Erro generateAiPaidChurnMessage:', e);
        res.status(500).json({ error: 'Erro interno no servidor de IA.' });
    }
};

exports.generateAiExpiringTrialMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const psiId = parseInt(id, 10);

        let psi, matchesCount, viewsCount, clicksCount, dealYes, dealGhosted, dealNo, dealTalking, dealNoFeedback, daysLeft;

        if (psiId === 99999) {
            // MOCK LOCAL (APENAS DADOS)
            psi = { nome: 'Dr. Local', valor_sessao_numero: 150 };
            matchesCount = 180;
            viewsCount = 10;
            clicksCount = 3;
            dealYes = 0;
            dealGhosted = 1;
            dealNo = 2;
            dealTalking = 0;
            dealNoFeedback = 2;
            daysLeft = 2;
        } else {
            // DADOS REAIS
            psi = await db.Psychologist.findByPk(psiId, {
                attributes: { exclude: ['senha'] }
            });

            if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });
            
            if (psi.planExpiresAt) {
                daysLeft = Math.ceil((new Date(psi.planExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            } else {
                daysLeft = 0;
            }

            // Coletar Métricas Padronizadas
            const metrics = await getStandardMetrics(psiId, psi);
            matchesCount = metrics.matchesCount;
            viewsCount = metrics.viewsCount;
            clicksCount = metrics.clicksCount;
            
            // Feedbacks
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: psiId },
                attributes: ['dealClosed']
            });
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length : clicksCount;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
            dealNoFeedback = wppLogs.filter(l => !l.dealClosed || l.dealClosed === 'not_started').length;
        }

        const nowTime = new Date();
        const expDate = psi.planExpiresAt ? new Date(psi.planExpiresAt) : new Date(Date.now() + 24 * 60 * 60 * 1000);
        const diffHours = (expDate.getTime() - nowTime.getTime()) / (1000 * 60 * 60);

        const options = { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' };
        const todayStr = nowTime.toLocaleDateString('pt-BR', options);
        const expDateStr = expDate.toLocaleDateString('pt-BR', options);

        const isToday = expDateStr === todayStr || diffHours <= 16;
        const expiryPhrase = isToday ? 'expira nas próximas horas' : 'expirará amanhã';
        const timingClosing = isToday ? 'nas próximas horas' : 'amanhã';

        const hasValorSessao = psi.valor_sessao_numero && psi.valor_sessao_numero > 0;
        let instrucaoFinanceira = '';
        if (hasValorSessao) {
            const val = psi.valor_sessao_numero;
            if (val >= 99) {
                instrucaoFinanceira = `Compare amigavelmente o valor da sessão dele (R$ ${val}) com a mensalidade da Yelo (R$ 99,00). Mostre que realizar apenas 1 atendimento no mês inteiro já cobre os R$ 99 da plataforma e ainda deixa lucro líquido direto no consultório dele.`;
            } else {
                const sessoes2 = val * 2;
                const sessoes4 = val * 4;
                instrucaoFinanceira = `Como a sessão dele custa R$ ${val} (que é menor que os R$ 99 da assinatura), NUNCA afirme que "1 sessão já cobre a plataforma", pois matematicamente R$ ${val} não cobre R$ 99. Em vez disso, explique que fechar com apenas 1 paciente no mês (que costuma realizar acompanhamento contínuo de 2 a 4 sessões mensais, totalizando entre R$ ${sessoes2} e R$ ${sessoes4}) já cobre a assinatura de R$ 99 com folga e se transforma em lucro líquido para o consultório dele.`;
            }
        } else {
            instrucaoFinanceira = `Lembre-o amigavelmente de que a assinatura da Yelo tem um valor fixo de R$ 99 mensais e que nós NÃO cobramos nenhuma taxa ou comissão sobre os atendimentos dele. Como ele atende com valor a combinar diretamente com o paciente no WhatsApp, ele tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no consultório dele. NUNCA presuma que "1 sessão cobre a plataforma" ou "já cobre com folga", pois o valor é a combinar. Enfatize a autonomia de precificação e o fato de ser 0% de comissão.`;
        }

        const hasClicks = clicksCount > 0;
        const hasConversions = dealYes > 0;

        let performanceSection = '';
        let resultAnalysisGuideline = '';

        if (hasClicks) {
            performanceSection = `
[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
1. Aparições nos resultados de matches: ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}
3. Contatos recebidos no WhatsApp: ${clicksCount}
`;
            if (hasConversions) {
                resultAnalysisGuideline = `- O profissional já conseguiu agendar/fechar com ${dealYes} paciente(s)! Parabenize-o calorosamente em tom de equipe e mostre que isso já comprova o retorno da plataforma.`;
            } else if (dealNoFeedback > 0) {
                resultAnalysisGuideline = `- Ele recebeu ${clicksCount} contato(s) no WhatsApp, e ${dealNoFeedback} ainda estão pendentes/sem feedback. NUNCA diga "0 conversões" ou "você não fechou nada". Dê um forte incentivo para que ele chame esses contatos de volta! Reforce que fechar com *apenas um* desses contatos já garante o pagamento da plataforma e o deixa com lucro. EM SEGUIDA, adicione a instrução: "Caso já tenha conversado com eles, atualize a situação na opção *Evolução > Histórico de Contatos* para que o nosso algoritmo te entregue sempre os melhores pacientes."`;
            } else {
                resultAnalysisGuideline = `- Ele recebeu ${clicksCount} contato(s) no WhatsApp, mas ainda não houve fechamentos. NUNCA diga "0 conversões" ou "nenhum fechamento" (isso é desanimador). Use um tom de parceria construtiva e de equipe: mostre que o fluxo já começou a tracionar e que essas primeiras conversas são essenciais para calibrar a abordagem, e que manter a página ativa garante a continuidade desses contatos.`;
            }
        } else {
            // 0 CLIQUES NO WHATSAPP
            performanceSection = `
[DADOS DO DESEMPENHO NO TRIAL - ATENÇÃO: 0 CLIQUES]
1. Aparições nos resultados de matches: ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}

REGRA CRÍTICA PARA 0 CLIQUES:
O psicólogo teve ${matchesCount} aparições e ${viewsCount} visitas, mas ainda 0 cliques no WhatsApp.
NUNCA, em hipótese alguma, escreva "Cliques no WhatsApp: 0", "0 cliques" ou "0 pacientes te chamaram" - isso é extremamente desanimador e destrói a conversão para assinatura!
Em vez disso:
- Apresente no texto APENAS os indicadores positivos de visibilidade: as aparições nas buscas (${matchesCount}) e as visitas na página (${viewsCount}).
- Explique de forma consultiva e positiva que nesses primeiros 7 dias o perfil dele já foi bastante encontrado e visitado, e que o algoritmo de distribuição da plataforma estava aprendendo o perfil dele. O próximo passo natural é a conversão dessas visitas em conversas no WhatsApp.
- Diga que com pequenos ajustes na apresentação/foto e dando continuidade com a assinatura, os primeiros contatos no WhatsApp começam a chegar.
`;
            resultAnalysisGuideline = `- Como ele não teve cliques ainda, foque exclusivamente em valorizar as buscas e visitas que ele já conquistou, sem falar em falta de fechamento ou conversões.`;
        }

        const prompt = `
Você é Anderson, representante da equipe de Customer Success e Growth da Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}.
Situação atual: O período de testes gratuito (Trial) de 7 dias deste profissional ${isToday ? 'expira HOJE, nas próximas horas' : 'expirará AMANHÃ'}.

Aja de forma humanizada, empática, consultiva e SEMPRE com tom e voz de EQUIPE ("nós vimos", "analisamos", "acreditamos", "percebemos", "nossa equipe"). NÃO seja agressivamente vendedor e não use gírias.
NÃO se apresente ("Aqui é o Anderson..." ou similar) pois o psicólogo já conversa com você e já sabe quem você é.

${performanceSection}

[FEEDBACKS E RESULTADOS (SE HOUVER CLIQUES)]
- Fechou negócio (Agendou): ${dealYes}
- Em negociação: ${dealTalking}
- Paciente "fantasma" (sumiu): ${dealGhosted}
- Não fechou (achou caro ou desistiu): ${dealNo}
- Contatos pendentes (Ainda sem feedback): ${dealNoFeedback}

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_) e quebras de linha (\\n\\n).
2. Vá direto ao ponto (cumprimente com um 'Olá [Nome], tudo bem?' ou 'Olá [Nome], como vai?' e avance em tom de equipe informando sobre o encerramento do teste):
   ${isToday 
     ? '- Como o período expira hoje/em breve, mencione que o período gratuito "expira nas próximas horas" ou "está encerrando nas próximas horas".' 
     : '- Como o período expira amanhã, mencione que o período gratuito "expirará amanhã".'}
   NUNCA use "restam X dias" ou "último dia (restam X dias)". Seja direto usando a referência temporal indicada.
3. É OBRIGATÓRIO APRESENTAR AS MÉTRICAS EM TÓPICOS NATIVOS DO WHATSAPP com os números em negrito para evidenciar os números, exatamente neste formato:
Seu perfil obteve:

* *${matchesCount} aparições* nos resultados de matches
* *${viewsCount} visitas* na página
* *${clicksCount === 1 ? '1 paciente te chamou no WhatsApp' : `${clicksCount} pacientes te chamaram no WhatsApp`}*

(Inicie cada linha com '* *' para que no WhatsApp apareça como tópicos e com os números em destaque em negrito. Se teve 0 cliques, apresente apenas as aparições e visitas, nunca mencione 0 cliques).
4. Analise os resultados de forma consultiva e parceira, sempre em tom de equipe:
   ${resultAnalysisGuideline}
5. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE COM RIGOR (A MATEMÁTICA DEVE SER PERFEITA E PRECISA): 
   ${instrucaoFinanceira}
6. Finalize perguntando de forma aberta se faz sentido para mantermos a página ativa para não perder o histórico e os pacientes que já estão chegando. Instrua-o a reativar acessando a conta na Yelo, indo em "Ajustes" e depois em "Assinaturas e Planos".
7. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto. Finalize diretamente após a pergunta de assinatura.
`;

        let whatsappCopy = '';
        if (psiId !== 99999 && process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-3.5-flash-lite", 
                    systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 350
                    }
                });
                
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de IA (3.5s)')), 3500));
                const result = await Promise.race([model.generateContent(prompt), timeoutPromise]);
                const responseText = result.response.text();
                if (responseText && responseText.trim().length > 10) {
                    whatsappCopy = formatForWhatsApp(responseText);
                }
            } catch (aiErr) {
                console.warn('⚠️ [AI Trial Expirando] Falha no Gemini (ativando fallback consultivo):', aiErr.message);
            }
        }

        // Se a IA não gerou, deu erro ou é mock, usa o gerador consultivo determinístico de alta conversão
        if (!whatsappCopy) {
            let metricsText = "";
            let feedbackText = "";
            let mathText = "";

            if (hasClicks) {
                const contatoStr = clicksCount === 1 ? '1 paciente te chamou no WhatsApp' : `${clicksCount} pacientes te chamaram no WhatsApp`;
                metricsText = `Seu perfil obteve nestes 7 dias:\n\n* *${matchesCount} aparições* nos resultados de busca\n* *${viewsCount} visitas* diretas na sua página\n* *${contatoStr}*`;

                if (dealYes > 0) {
                    feedbackText = `Notamos que você conseguiu fechar com ${dealYes} paciente(s)! 🎉 Isso comprova na prática que a sua vitrine já está gerando pacientes reais.`;
                } else if (dealNoFeedback > 0) {
                    feedbackText = `Vimos que você recebeu ${clicksCount} contato(s) e alguns ainda estão em conversa. Como o nosso algoritmo leva alguns dias para calibrar o perfil e as primeiras pessoas já começaram a chegar até você, acreditamos que manter o seu consultório virtual ativo é fundamental para não interromper esse fluxo que começou a tracionar.`;
                } else {
                    feedbackText = `Como o nosso algoritmo leva alguns dias para calibrar o perfil e as primeiras conversas já começaram a chegar, acreditamos que manter o seu consultório virtual ativo é essencial para dar continuidade a esse ritmo.`;
                }
            } else {
                // 0 CLIQUES
                metricsText = `Seu perfil obteve nestes 7 dias:\n\n* *${matchesCount} aparições* nos resultados de busca\n* *${viewsCount} visitas* diretas na sua página`;
                feedbackText = `Como o nosso algoritmo de distribuição leva alguns dias para calibrar o seu público ideal e o seu perfil já começou a ganhar visibilidade e visitas, o próximo passo natural é a chegada dos primeiros contatos no WhatsApp. Acreditamos que manter a sua vitrine ativa é fundamental para não perder essa tração inicial.`;
            }

            if (hasValorSessao) {
                const val = psi.valor_sessao_numero;
                if (val >= 99) {
                    mathText = `Pensando no lado financeiro: a assinatura da Yelo é de apenas R$ 99 mensais. Como a sua sessão é R$ ${val}, realizar apenas 1 atendimento no mês inteiro já cobre a plataforma com folga e ainda te deixa com lucro direto.`;
                } else {
                    const duasSessoes = val * 2;
                    const quatroSessoes = val * 4;
                    mathText = `Pensando no lado financeiro: a assinatura da Yelo é de apenas R$ 99 mensais e nós não cobramos nenhuma taxa ou comissão sobre os seus atendimentos. Como a sua sessão é R$ ${val}, fechar com apenas 1 paciente no mês (que costuma realizar acompanhamento de 2 a 4 consultas, somando entre R$ ${duasSessoes} e R$ ${quatroSessoes}) já cobre a mensalidade de R$ 99 com muita folga e se transforma em lucro líquido para você.`;
                }
            } else {
                mathText = `Pensando no lado financeiro: a assinatura da Yelo tem um valor fixo de R$ 99 mensais e nós *não cobramos nenhuma taxa ou comissão* sobre as suas consultas. Como você atende com valor a combinar diretamente com o paciente no WhatsApp, você tem total autonomia na sua precificação e 100% de tudo o que acordar nos atendimentos fica no seu consultório.`;
            }

            whatsappCopy = formatForWhatsApp(
                `Olá, ${psi.nome.split(' ')[0]}! Como vai?\n\nNotamos que o seu período de teste gratuito na Yelo ${expiryPhrase}, e passamos para compartilhar um panorama do seu perfil nesses primeiros 7 dias.\n\n${metricsText}\n\n${feedbackText}\n\n${mathText}\n\nFaz sentido para você mantermos a sua página ativa para continuar recebendo os pacientes que chegam pela plataforma?\n\nPara renovar, basta acessar o seu painel em *Ajustes > Assinaturas e Planos*. Estamos à disposição caso precise de qualquer apoio com o acesso! 🌿`
            );
        }

        return res.status(200).json({ whatsappCopy });
    } catch (e) {
        console.error('Erro generateAiExpiringTrialMessage:', e);
        res.status(500).json({ error: 'Erro interno ao processar mensagem.' });
    }
};
