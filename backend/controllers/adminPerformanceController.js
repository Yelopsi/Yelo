const db = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
    clicksCount += (psi.whatsapp_clicks || 0);

    return { matchesCount, viewsCount, clicksCount };
}

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

    // Fetch matches grouped by psychologist in the last 14 days
    const [matches] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "MatchEvents" 
        WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch clicks grouped by psychologist in the last 14 days
    const [clicks] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "WhatsAppClickLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "psychologistId" IS NOT NULL
        GROUP BY "psychologistId"
    `).catch(() => [[], null]);

    // Fetch profile views grouped by psychologist in the last 14 days
    const [views] = await db.sequelize.query(`
        SELECT "psychologistId" as "id", COUNT(*) as count 
        FROM "ProfileAppearanceLogs" 
        WHERE "createdAt" >= NOW() - INTERVAL '14 days' AND "psychologistId" IS NOT NULL
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
        // Ignora se o perfil já foi contatado nos últimos 7 dias (período de carência)
        if (psi.aiOptimizationHistory && Array.isArray(psi.aiOptimizationHistory)) {
            const recentlySent = psi.aiOptimizationHistory.some(entry => {
                if (!entry.sentAt) return false;
                const diffDays = (nowTime - new Date(entry.sentAt)) / (1000 * 60 * 60 * 24);
                return diffDays <= 7;
            });
            if (recentlySent) return false; // Remove da lista de baixa performance temporariamente
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
- Aparições em Buscas (Matches): ${matchesCount}
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
7. Inicie com um gatilho de parceria EXATAMENTE com esta estrutura, trocando apenas o nome: "Olá, [Nome]. Como vai? Aqui é o Anderson, da equipe de Sucesso da Yelo. Fiz uma análise detalhada da sua performance nos últimos 14 dias e trouxe alguns pontos para potencializarmos seus resultados: você teve ${matchesCount} aparições em resultados de matches, ${viewsCount} visitas no perfil e ${clicksCount} cliques no WhatsApp."
8. Aja de forma EXTREMAMENTE EMPÁTICA, PARCEIRA e HUMANIZADA. Você está lá para ajudá-lo a ganhar dinheiro, mostre que o sucesso dele é o nosso sucesso. ZERO GÍRIAS.
9. Após a introdução do passo 7, justifique onde está o gargalo dele (ex: "O nosso gargalo hoje está na conversão da visita para o contato...").
10. Finalize com um gatilho de comprometimento: "Esses pequenos ajustes costumam destravar a agenda de muitos profissionais por aqui. Qualquer dúvida sobre como aplicar isso, é só me chamar. Estamos juntos nessa jornada para encher a sua clínica! 🌿"

Retorne SOMENTE um JSON com a seguinte estrutura (não use marcações markdown como \`\`\`json, apenas o objeto):
{
  "diagnosis": "Um resumo de 1 linha apenas para o admin ler sobre qual é o problema principal",
  "whatsappCopy": "O texto completo pronto para ser copiado pro whatsapp"
}
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para o Diagnóstico IA.");
            const mockResponse = {
                diagnosis: "Baixa taxa de cliques no WhatsApp (0) e há feedbacks pendentes de pacientes que entraram em contato antes. A bio está muito curta e precisa de avaliação social.",
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}. Como vai? Aqui é o Anderson, da equipe de Sucesso da Yelo. Fiz uma análise detalhada da sua performance e decidi te trazer alguns pontos super estratégicos para te ajudar a destravar mais pacientes.\n\nA plataforma entregou uma excelente visibilidade para o seu perfil nos últimos dias: você teve *${matchesCount} aparições nas buscas* e *${viewsCount} pacientes visitaram a sua página*. No entanto, não registramos *nenhum clique* recente no seu WhatsApp.\n\nIsso mostra um gargalo na sua vitrine, mas super simples de corrigir! Recomendo focarmos em duas ações:\n\n1. *Acesse o "Manual de Conversão":* Vi que você já tem cliques antigos, mas a nossa plataforma tem um manual focado em como não perder pacientes que chegam no WhatsApp. Ele fica lá no seu Hub de Evolução!\n\n2. *Construa Prova Social:* Peça avaliações no seu perfil usando o seu link (https://www.yelopsi.com.br/${psi.slug}?review=true). A opinião de outras pessoas é o maior gatilho para destravar o agendamento de quem está em dúvida.\n\n⚠️ Ah, um ponto importante: notei que você tem contatos recentes e ainda há *${unansweredLogs.length} paciente(s)* sem status de fechamento informado. Para que nosso algoritmo continue impulsionando seu perfil nas buscas, por favor nos atualize sobre o status desses atendimentos através deste link rápido (não precisa nem fazer login na plataforma): ${magicLink}\n\nQualquer dúvida sobre como aplicar tudo isso, é só me chamar. Estamos juntos! 🌿`
            };
            return res.status(200).json({ 
                diagnosis: mockResponse.diagnosis,
                whatsappCopy: mockResponse.whatsappCopy,
                history: history
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
        });

        const responseText = result.response.text();
        const aiData = JSON.parse(responseText);

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
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length + (psi.whatsapp_clicks || 0) : clicksCount;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no' || l.dealClosed === 'not_started').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}, cujo período de testes (Trial) de 14 dias expirou recentemente (Churn).
O objetivo da mensagem é convencer o profissional a reativar sua assinatura (que custa R$ 99,00/mês).

Aja de forma humanizada, direta, e TOTALMENTE PROFISSIONAL. NÃO use NENHUMA gíria (como "dar um tchan", "dar um grito", etc.).

[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
Você DEVE SEMPRE citar esses três indicadores no corpo do seu texto de forma clara:
1. Aparições em Buscas (Matches): ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}
3. Cliques no WhatsApp: ${clicksCount}

[FEEDBACKS E RESULTADOS (SE HOUVER CLIQUES)]
- Fechou negócio (Agendou): ${dealYes}
- Em negociação: ${dealTalking}
- Paciente "fantasma" (sumiu): ${dealGhosted}
- Não fechou (achou caro ou desistiu): ${dealNo}

[ANÁLISE FINANCEIRA]
- O psicólogo cobra R$ ${psi.valor_sessao_numero ? psi.valor_sessao_numero : '(Valor não preenchido)'} por sessão.
- A mensalidade da Yelo custa R$ 99,00.

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_) e quebras de linha (\n\n).
2. Cumprimente o psicólogo pelo nome e se apresente. Comece em um tom acolhedor e agradeça por ele ter testado a plataforma.
3. Seja SUAVE ao informar que o Trial de 14 dias expirou. Exemplo: "O seu período gratuito encerrou, mas eu estava analisando as suas métricas e os resultados foram super interessantes..."
4. Apresente os resultados dele (os 3 indicadores numéricos são obrigatórios: Aparições, Visitas e Cliques).
5. Analise os resultados de fechamento de forma consultiva e empática:
   - Se ele fechou pacientes, parabenize-o! É o maior argumento de que a plataforma funciona.
   - Se não fechou ou teve fantasmas, use uma frase de conforto como "Apesar de não ter fechado com nenhum paciente dessa vez, isso é super normal no início para quem está ajustando o público."
   - Se ele não teve cliques, diga que os pacientes estão encontrando ele nas buscas e visitando a página (se aplicável), e que juntos podem ajustar o perfil para melhorar a conversão.
6. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE, mas faça de forma amigável e parceira: cite explicitamente o valor que ele cobra por sessão (R$ ${psi.valor_sessao_numero || 'X'}) e compare com a mensalidade (R$ 99,00). Prove que fechar apenas 1 sessão já paga a mensalidade toda. (Ex: "Como a sua sessão é R$ 150,00, fechando apenas 1 sessão você já cobre todo o custo da plataforma e garante o seu lucro. É um investimento que se paga com um único atendimento"). NUNCA use a expressão "fechar 1 paciente", use SEMPRE "fechar 1 sessão".
7. Finalize de forma super acolhedora perguntando se faz sentido para ele manter o perfil ativo. Se sim, instrua-o a reativar acessando a conta na Yelo, indo na opção "Ajustes" e depois "Assinaturas e Planos".
8. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto (como "Um abraço, Anderson - CS & Growth Yelo", "Equipe Yelo", etc.). Finalize diretamente após perguntar se faz sentido reativar ou dar as instruções para ativar o plano.
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente.");
            let feedbackText = "";
            let mathText = "";

            if (dealYes > 0) {
                feedbackText = `E notei pelo seu feedback que você já conseguiu fechar ${dealYes} sessão(ões)! 🎉`;
                mathText = `essa sessão que você fechou já paga o investimento da plataforma do mês todo e ainda sobra lucro.`;
            } else {
                feedbackText = `Apesar de os pacientes não terem fechado negócio dessa vez, não desanime, isso é super normal nesse período de adaptação de público!`;
                mathText = `fechar apenas 1 sessão já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            }

            return res.status(200).json({ 
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson da equipe da Yelo. 🌿\n\nPassei para agradecer por você ter testado a plataforma com a gente nesses últimos dias! O seu período gratuito acabou encerrando, mas eu estava analisando as suas métricas e os resultados foram bem legais.\n\nDurante os testes, o seu perfil obteve ${matchesCount} aparições nas buscas, ${viewsCount} visualizações na sua página e gerou ${clicksCount} cliques no WhatsApp. ${feedbackText}\n\nPensando pelo seu lado financeiro, a assinatura da Yelo é apenas R$ 99,00 mensais. Como a sua sessão é de R$ ${psi.valor_sessao_numero || 'X'}, ${mathText}\n\nFaria sentido para você reativar a sua página para não perder esse fluxo de pacientes que já estão te encontrando? Caso queira manter seu perfil no ar, basta acessar a sua conta na Yelo, clicar em "Ajustes" e depois ir em "Assinaturas e Planos". Qualquer dúvida, estou por aqui!`
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite", 
            systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800
            }
        });
        
        const result = await model.generateContent(prompt);
        let whatsappCopy = result.response.text();
        whatsappCopy = whatsappCopy.replace(/^```whatsapp\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

        res.status(200).json({ whatsappCopy });
    } catch (e) {
        console.error('Erro generateAiChurnMessage:', e);
        res.status(500).json({ error: 'Erro interno no servidor de IA.' });
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
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length + (psi.whatsapp_clicks || 0) : clicksCount;
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}. 
Situação atual: Este profissional já era assinante do plano Essencial (R$ 99,00), mas a sua assinatura expirou/foi cancelada recentemente (Churn de Pagante). 
O objetivo da mensagem é entender o que houve e convencê-lo a reativar a assinatura.

Aja de forma humanizada, parceira, e TOTALMENTE PROFISSIONAL. NÃO use NENHUMA gíria.

[DADOS HISTÓRICOS DE DESEMPENHO]
Você DEVE SEMPRE citar esses três indicadores no corpo do texto para lembrá-lo do valor que a plataforma já gerou:
1. Total de Aparições em Buscas (Matches): ${matchesCount}
2. Total de Visitas na Página (Views): ${viewsCount}
3. Total de Cliques no WhatsApp: ${clicksCount}

[ANÁLISE FINANCEIRA]
- O psicólogo cobra R$ ${psi.valor_sessao_numero ? psi.valor_sessao_numero : '(Valor não preenchido)'} por sessão.
- A mensalidade da Yelo custa R$ 99,00.

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_).
2. Cumprimente pelo nome. Comece dizendo que você notou que a assinatura dele na Yelo expirou e o perfil acabou saindo do ar, e pergunte se houve algum problema com o cartão ou se foi uma decisão de pausa.
3. Apresente os resultados históricos dele (Aparições, Visitas e Cliques) para gerar ancoragem de valor. Mostre que o perfil dele já tem relevância e que recomeçar depois pode ser mais lento.
4. Seja empático. Se ele teve bons cliques no passado, lembre-o de que o perfil dele atrai pacientes. Se o problema for conversão, ofereça ajuda: 'Se o volume de fechamentos não estava como você gostaria, eu posso revisar seu perfil junto com você para melhorarmos isso!'
5. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE: cite o valor que ele cobra por sessão e compare com a mensalidade (R$ 99,00). Mostre que manter o perfil ativo é um investimento muito baixo comparado ao retorno. (Ex: 'Lembrando que como a sua sessão é R$ 150,00, manter seu perfil no ar custa menos do que 1 única sessão fechada no mês inteiro').
6. Finalize deixando a porta aberta. Pergunte como você pode ajudá-lo hoje a reativar o perfil, ou informe para acessar "Ajustes > Assinaturas e Planos" no app.
7. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto.
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para Paid Churn.");
            return res.json({
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson, da Yelo.\n\nNotei aqui no sistema que a sua assinatura expirou nos últimos dias e, por conta disso, seu perfil acabou sendo ocultado das buscas dos pacientes. Houve algum problema com a renovação do cartão ou você decidiu dar uma pausa?\n\nFui dar uma olhada no seu histórico e vi que seu perfil construiu uma relevância bem legal com a gente! Ao todo, você já apareceu em *${matchesCount} buscas*, teve *${viewsCount} visitas* e recebeu *${clicksCount} cliques* no WhatsApp.\n\nComo a sua sessão particular é de R$ ${psi.valor_sessao_numero || '150,00'}, queria te lembrar que manter a sua assinatura na Yelo (R$ 99,00) acaba custando menos do que 1 única sessão fechada no mês todo.\n\nSe o motivo da pausa foi não estar conseguindo converter esses contatos, me avisa! Posso revisar o seu perfil com você.\n\nFaz sentido para você reativarmos o seu perfil hoje e não perder esse fluxo?`
            });
        }

        const { GoogleGenerativeAI } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800
            }
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        
        // Remove blocos markdown de resposta crua, caso a IA ainda retorne
        text = text.replace(/```(?:html|json)?\n?/g, '').replace(/```/g, '').trim();

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

        let psi, matchesCount, viewsCount, clicksCount, dealYes, dealGhosted, dealNo, dealTalking, daysLeft;

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
            
            clicksCount = wppLogs.length > 0 ? wppLogs.length + (psi.whatsapp_clicks || 0) : clicksCount;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no' || l.dealClosed === 'not_started').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome.split(' ')[0]}.
Situação atual: O período de testes gratuito (Trial) de 14 dias deste profissional vai expirar em exatos ${daysLeft} dias.

Aja de forma humanizada, empática e consultiva. NÃO seja agressivamente vendedor e não use gírias.

[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
Você DEVE SEMPRE citar esses três indicadores no corpo do seu texto de forma clara:
1. Aparições em Buscas (Matches): ${matchesCount}
2. Visitas na Página (Views): ${viewsCount}
3. Cliques no WhatsApp: ${clicksCount}

[FEEDBACKS E RESULTADOS (SE HOUVER CLIQUES)]
- Fechou negócio (Agendou): ${dealYes}
- Em negociação: ${dealTalking}
- Paciente "fantasma" (sumiu): ${dealGhosted}
- Não fechou (achou caro ou desistiu): ${dealNo}

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_) e quebras de linha (\n\n).
2. Cumprimente pelo nome. Seja SUAVE ao informar que faltam apenas ${daysLeft} dia(s) para o Trial expirar.
3. Apresente os resultados dele (Aparições, Visitas, Cliques e Fechamentos).
4. Analise os resultados de fechamento de forma consultiva e parceira.
   - Se ele fechou pacientes, parabenize-o! É a maior prova de que vale a pena assinar.
   - Se não fechou ou teve fantasmas, use uma frase de conforto como "Apesar de não ter fechado com nenhum paciente dessa vez, isso é super normal no início para quem está ajustando o público."
   - Se não teve cliques, diga que ele está sendo visto, mas a bio ou foto precisam de ajustes para converter melhor.
5. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE: Compare amigavelmente o valor da sessão dele (R$ ${psi.valor_sessao_numero || 'X'}) com a mensalidade da Yelo (R$ 99,00). Prove que fechar apenas 1 sessão já paga a mensalidade toda. (Ex: "Como a sua sessão é R$ 150,00, fechando apenas 1 sessão você já cobre todo o custo da plataforma e garante o seu lucro. É um investimento que se paga com um único atendimento"). NUNCA use a expressão "fechar 1 paciente", use SEMPRE "fechar 1 sessão".
6. Finalize perguntando de forma aberta se faz sentido para ele ativar a assinatura para não perder a página e os pacientes que já estão chegando. Instrua-o a reativar acessando a conta na Yelo, indo em "Ajustes" e depois em "Assinaturas e Planos".
7. REGRAS EXTRAS E ASSINATURA: NUNCA coloque despedidas ou assinaturas no final do texto. Finalize diretamente após perguntar se faz sentido ativar a assinatura ou colocar "Se precisar de ajuda, estou por aqui!".
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para Trial Expirando.");
            let feedbackText = "";
            let mathText = "";

            if (dealYes > 0) {
                feedbackText = `Notei que você conseguiu fechar terapia com ${dealYes} sessão(ões)! 🎉`;
                mathText = `essa sessão que você fechou já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            } else {
                feedbackText = `Apesar de os pacientes não terem fechado negócio dessa vez, não desanime, isso é super normal nesse período de adaptação de público!`;
                mathText = `fechar apenas 1 sessão já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            }

            return res.status(200).json({ 
                whatsappCopy: `Olá, ${psi.nome.split(' ')[0]}! Tudo bem? Aqui é o Anderson da equipe da Yelo. 🌿\n\nVi que faltam apenas ${daysLeft} dias para o seu período gratuito encerrar, então vim dar uma olhada nas suas métricas. Os resultados de visibilidade foram ótimos!\n\nSeu perfil obteve ${matchesCount} aparições nas buscas, ${viewsCount} visitas na página e ${clicksCount} pacientes te chamaram no WhatsApp. ${feedbackText}\n\nPensando no seu lado financeiro: a assinatura da Yelo será de R$ 99 mensais. Como a sua sessão é R$ ${psi.valor_sessao_numero || 'X'}, ${mathText}\n\nVale muito a pena continuar colhendo os frutos do perfil ativo. Para não perdermos esse fluxo de pacientes, basta acessar sua conta na Yelo, ir na opção "Ajustes" e depois em "Assinaturas e Planos". Se precisar de ajuda, estou por aqui!`
            });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite", 
            systemInstruction: "Você é o gerente de CS e Growth da Yelo. Retorne APENAS o texto exato da mensagem de WhatsApp sem aspas extras, blocos markdown (```) ou comentários.",
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 800
            }
        });
        
        const result = await model.generateContent(prompt);
        let whatsappCopy = result.response.text();
        whatsappCopy = whatsappCopy.replace(/^```whatsapp\s*/i, '').replace(/^```\s*/, '').replace(/```$/, '').trim();

        res.status(200).json({ whatsappCopy });
    } catch (e) {
        console.error('Erro generateAiExpiringTrialMessage:', e);
        res.status(500).json({ error: 'Erro interno no servidor de IA.' });
    }
};
