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

        let psi, blogPosts, forumAnswers, reviews, matches, clicks, views, pendingFeedbacks, history;

        if (psiId === 99999) {
            psi = { nome: 'Dr. Local', slug: 'dr-local', bio: 'Formado há 10 anos.', abordagens_tecnicas: ['TCC'], temas_atuacao: ['Ansiedade'], valor_sessao_numero: 150, fotoUrl: 'url_foto' };
            blogPosts = [];
            forumAnswers = [];
            reviews = [];
            matches = [{count: 150}];
            clicks = [{count: 0}];
            views = [{count: 20}];
            pendingFeedbacks = [{count: 2}];
            history = [];
        } else {
            psi = await db.Psychologist.findByPk(psiId, {
                attributes: { exclude: ['senha'] }
            });

            if (!psi) return res.status(404).json({ error: 'Psicólogo não encontrado.' });

            // Coletar Dados do Dossiê para a IA
            [blogPosts] = await db.sequelize.query(`SELECT id, titulo FROM posts WHERE psychologist_id = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            [forumAnswers] = await db.sequelize.query(`SELECT id FROM "ForumComments" WHERE "PsychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            [reviews] = await db.sequelize.query(`SELECT id, rating FROM "Reviews" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[], null]);
            
            // Coletar Métricas dos últimos 7 dias
            [matches] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '7 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            [clicks] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '7 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            [views] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id AND "createdAt" >= NOW() - INTERVAL '7 days'`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);

            // Coletar Feedbacks Pendentes de WhatsApp (para PLG)
            [pendingFeedbacks] = await db.sequelize.query(`SELECT COUNT(*) as count FROM "WhatsAppClickLogs" WHERE "psychologistId" = :id AND "feedbackGiven" = false`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);

            // Historico de otimizacao anterior
            history = psi.aiOptimizationHistory || [];
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome}, oferecendo uma consultoria rápida baseada nos dados do perfil dele nos últimos 7 dias.
Aja em tom amigável, direto, profissional e de parceria. Sem introduções longas.

[DADOS DO PSICÓLOGO NOS ÚLTIMOS 7 DIAS]
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
- Especialidades: ${psi.temas_atuacao ? psi.temas_atuacao.length : 0} cadastradas
- Bio: ${psi.bio ? psi.bio.length : 0} caracteres
- Abordagem: ${psi.abordagens_tecnicas ? psi.abordagens_tecnicas.length : 0} cadastradas
- Valor da Sessão: R$ ${psi.valor_sessao_numero || 'Não informado'}
- Tem Foto de Perfil: ${psi.fotoUrl ? 'Sim' : 'Não'}

[USO DE FERRAMENTAS E ENGAJAMENTO]
- Artigos no Blog: ${blogPosts.length}
- Respostas na Comunidade: ${forumAnswers.length}
- Avaliações (Reviews): ${reviews.length}

ATENÇÃO: Use formatação nativa do WhatsApp (*negrito*, _itálico_) e insira quebras de linha (\\n\\n) para tornar o texto escaneável. Separe bem os parágrafos e as dicas. Não retorne um bloco de texto contínuo!

REGRAS DE ANÁLISE DO FUNIL (Siga rigorosamente para dar as dicas certas):
1. Gargalo de Aparições (Baixos Matches): O perfil não está ganhando pontos no algoritmo de busca. Acolha dizendo que no começo é assim mesmo. Explique que o nosso algoritmo prioriza: (A) Preenchimento completo das 4 Especialidades (Tags); (B) Valor da sessão estar alinhado com a média do mercado; (C) Informar Gênero e Práticas Inclusivas/Afirmativas (gera bônus alto de ranqueamento); (D) Abordagem e Modalidade corretas. Dê exemplos de como a busca do paciente cruza com esses dados.
2. Gargalo de Visitas (Altos Matches, Baixos Views): Ele aparece bem nas buscas, mas os pacientes não clicam no card. O problema está na vitrine. Explique que o paciente decide o clique em 2 segundos. Sugira revisar a Foto de Perfil (precisa estar profissional, com boa luz, transmitindo acolhimento) e a primeira frase da Bio. Um Valor de Sessão ausente ou irreal também espanta. Dê um exemplo do que torna uma foto ou frase atrativa.
3. Gargalo de Conversão (Altas Visitas, Baixos Cliques no WhatsApp): Os pacientes abrem a página completa dele, leem, mas saem sem chamar no WhatsApp. O algoritmo pune perfis com Bio menor que 10 caracteres, mas para converter, a Bio precisa ser focada na dor do paciente. Sugira reescrever a Bio (ex: "Em vez de listar currículo, comece falando sobre como você pode ajudar na ansiedade"). Sugira pedir Avaliações usando o link (https://www.yelopsi.com.br/${psi.slug}?review=true) explicando que Prova Social é o maior gatilho de confiança na internet.
4. Ferramentas Estratégicas (USE QUANDO FIZER SENTIDO): Temos algumas páginas e ferramentas gratuitas dentro da plataforma. Você pode sugerir:
   - "Calculadora de Honorários" (para ajudar quem tem dúvidas sobre precificação).
   - "Manual de Conversão" (para psicólogos que recebem cliques no WhatsApp mas não conseguem fechar a venda da sessão).
   - "Meu Analytics" (recomende para que eles mesmos acompanhem seu funil diariamente).
   - "Hub de Evolução" (para aprenderem estratégias de marketing para consultório).
5. Cobrança Suave (Feedbacks Pendentes): SE o número de "Feedbacks de WhatsApp Pendentes" for maior que 0, adicione um parágrafo amigável alertando: "Vi que você tem pacientes que te chamaram no WhatsApp, mas não nos contou se eles fecharam ou não. Precisamos que acesse a plataforma e nos avise para o algoritmo continuar te recomendando!" (Use palavras parecidas, mantendo o tom parceiro).

ESTRUTURA OBRIGATÓRIA E TOM DE VOZ:
5. Inicie com um gatilho de parceria: "Olá, [Nome]. Como vai? Aqui é o Anderson, da equipe de Sucesso da Yelo. Fiz uma análise detalhada da sua performance e..." (Substitua [Nome] pelo primeiro nome).
6. Aja de forma EXTREMAMENTE EMPÁTICA, PARCEIRA e HUMANIZADA. Você está lá para ajudá-lo a ganhar dinheiro, mostre que o sucesso dele é o nosso sucesso. ZERO GÍRIAS.
7. Informe no texto os números EXATOS de Matches, Visitas no Perfil e Cliques no WhatsApp, justificando onde está o gargalo dele.
8. Para cada dica que você der, explique O PORQUÊ aquilo funciona na cabeça do paciente e DÊ UM EXEMPLO PRÁTICO de como fazer.
9. Finalize com um gatilho de comprometimento: "Esses pequenos ajustes costumam destravar a agenda de muitos profissionais por aqui. Qualquer dúvida sobre como aplicar isso, é só me chamar. Estamos juntos nessa jornada para encher a sua clínica! 🌿"

Retorne SOMENTE um JSON com a seguinte estrutura (não use marcações markdown como \`\`\`json, apenas o objeto):
{
  "diagnosis": "Um resumo de 1 linha apenas para o admin ler sobre qual é o problema principal",
  "whatsappCopy": "O texto completo pronto para ser copiado pro whatsapp"
}
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para o Diagnóstico IA.");
            const mockResponse = {
                diagnosis: "Baixa taxa de cliques no WhatsApp (0) e há 2 feedbacks pendentes de pacientes que entraram em contato antes. A bio está muito curta e precisa de avaliação social.",
                whatsappCopy: `Olá, ${psi.nome}. Como vai? Aqui é o Anderson, da equipe de Sucesso da Yelo. Fiz uma análise detalhada da sua performance e decidi te trazer alguns pontos super estratégicos para te ajudar a destravar mais pacientes.\n\nA plataforma entregou uma excelente visibilidade para o seu perfil nos últimos dias: você teve *${matches[0]?.count || 0} aparições nas buscas* e *${views[0]?.count || 0} pacientes visitaram a sua página*. No entanto, não registramos *nenhum clique* recente no seu WhatsApp.\n\nIsso mostra um gargalo na sua vitrine, mas super simples de corrigir! Recomendo focarmos em duas ações:\n\n1. *Acesse o "Manual de Conversão":* Vi que você já tem cliques antigos, mas a nossa plataforma tem um manual focado em como não perder pacientes que chegam no WhatsApp. Ele fica lá no seu Hub de Evolução!\n\n2. *Construa Prova Social:* Peça avaliações no seu perfil usando o seu link (https://www.yelopsi.com.br/${psi.slug}?review=true). A opinião de outras pessoas é o maior gatilho para destravar o agendamento de quem está em dúvida.\n\n⚠️ Ah, um ponto importante: notei que você tem *${pendingFeedbacks[0]?.count || 0} pacientes* que te chamaram pelo WhatsApp recentemente e você ainda não nos deu o *Feedback de Fechamento* lá na plataforma. Precisamos que você entre na Yelo e nos avise se eles fecharam ou não. O nosso algoritmo precisa dessa confirmação para continuar impulsionando o seu ranking, combinado?\n\nQualquer dúvida sobre como aplicar tudo isso, é só me chamar. Estamos juntos! 🌿`
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

        let psi, matches, views, clicksCount, dealYes, dealGhosted, dealNo, dealTalking;

        if (psiId === 99999) {
            // MOCK LOCAL (APENAS DADOS)
            psi = { nome: 'Dr. Local', valor_sessao_numero: 150 };
            matches = [{ count: 200 }];
            views = [{ count: 15 }];
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

            // Coletar Métricas do Trial
            const m = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            matches = m[0];
            const v = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            views = v[0];
            
            // Feedbacks
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: psiId },
                attributes: ['dealClosed']
            });
            
            clicksCount = wppLogs.length;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no' || l.dealClosed === 'not_started').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da plataforma de saúde mental Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome}, cujo período de testes (Trial) de 14 dias expirou recentemente (Churn).
O objetivo da mensagem é convencer o profissional a reativar sua assinatura (que custa R$ 99,00/mês).

Aja de forma humanizada, direta, e TOTALMENTE PROFISSIONAL. NÃO use NENHUMA gíria (como "dar um tchan", "dar um grito", etc.).

[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
Você DEVE SEMPRE citar esses três indicadores no corpo do seu texto de forma clara:
1. Aparições em Buscas (Matches): ${matches[0]?.count || 0}
2. Visitas na Página (Views): ${views[0]?.count || 0}
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
4. Apresente os resultados dele (os 3 indicadores numéricos são obrigatórios).
5. Analise os resultados de fechamento de forma consultiva e empática:
   - Se ele fechou pacientes, parabenize-o! É o maior argumento de que a plataforma funciona.
   - Se não fechou ou teve fantasmas, use uma frase de conforto como "Apesar de não ter fechado com nenhum paciente dessa vez, isso é super normal no início para quem está ajustando o público."
   - Se ele não teve cliques, diga que os pacientes estão encontrando ele nas buscas e visitando a página (se aplicável), e que juntos podem ajustar o perfil para melhorar a conversão.
6. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE, mas faça de forma amigável e parceira: cite explicitamente o valor que ele cobra por sessão (R$ ${psi.valor_sessao_numero || 'X'}) e compare com a mensalidade (R$ 99,00). Prove que fechar apenas X pacientes já paga a mensalidade toda. (Ex: "Como a sua sessão é R$ 150,00, fechando apenas 1 paciente você já paga a plataforma").
7. Finalize de forma super acolhedora perguntando se faz sentido para ele manter o perfil ativo. Se sim, instrua-o a reativar acessando a conta na Yelo, indo na opção "Ajustes" e depois "Assinaturas e Planos".
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente.");
            let feedbackText = "";
            let mathText = "";

            if (dealYes > 0) {
                feedbackText = `E notei pelo seu feedback que você já conseguiu fechar com ${dealYes} paciente! 🎉`;
                mathText = `esse paciente que você fechou já paga o investimento da plataforma do mês todo e ainda sobra lucro.`;
            } else {
                feedbackText = `Apesar de os pacientes não terem fechado negócio dessa vez, não desanime, isso é super normal nesse período de adaptação de público!`;
                mathText = `fechar apenas 1 paciente já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            }

            return res.status(200).json({ 
                whatsappCopy: `Olá, ${psi.nome}! Tudo bem? Aqui é o Anderson da equipe da Yelo. 🌿\n\nPassei para agradecer por você ter testado a plataforma com a gente nesses últimos dias! O seu período gratuito acabou encerrando, mas eu estava analisando as suas métricas e os resultados foram bem legais.\n\nDurante os testes, o seu perfil obteve ${matches[0]?.count || 0} aparições nas buscas, ${views[0]?.count || 0} visualizações na sua página e gerou ${clicksCount} cliques no WhatsApp. ${feedbackText}\n\nPensando pelo seu lado financeiro, a assinatura da Yelo é apenas R$ 99,00 mensais. Como a sua sessão é de R$ ${psi.valor_sessao_numero || 'X'}, ${mathText}\n\nFaria sentido para você reativar a sua página para não perder esse fluxo de pacientes que já estão te encontrando? Caso queira manter seu perfil no ar, basta acessar a sua conta na Yelo, clicar em "Ajustes" e depois ir em "Assinaturas e Planos". Qualquer dúvida, estou por aqui!`
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

exports.generateAiExpiringTrialMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const psiId = parseInt(id, 10);

        let psi, matches, views, clicksCount, dealYes, dealGhosted, dealNo, dealTalking, daysLeft;

        if (psiId === 99999) {
            // MOCK LOCAL (APENAS DADOS)
            psi = { nome: 'Dr. Local', valor_sessao_numero: 150 };
            matches = [{ count: 180 }];
            views = [{ count: 10 }];
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

            // Coletar Métricas do Trial
            const m = await db.sequelize.query(`SELECT COUNT(*) as count FROM "MatchEvents" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            matches = m[0];
            const v = await db.sequelize.query(`SELECT COUNT(*) as count FROM "ProfileAppearanceLogs" WHERE "psychologistId" = :id`, { replacements: { id: psiId } }).catch(() => [[{count:0}], null]);
            views = v[0];
            
            // Feedbacks
            const wppLogs = await db.WhatsAppClickLog.findAll({
                where: { psychologistId: psiId },
                attributes: ['dealClosed']
            });
            
            clicksCount = wppLogs.length;
            dealYes = wppLogs.filter(l => l.dealClosed === 'yes' || l.dealClosed === 'started').length;
            dealGhosted = wppLogs.filter(l => l.dealClosed === 'ghosted').length;
            dealNo = wppLogs.filter(l => l.dealClosed === 'no' || l.dealClosed === 'not_started').length;
            dealTalking = wppLogs.filter(l => l.dealClosed === 'talking').length;
        }

        const prompt = `
Atue como Anderson, gerente de Customer Success da Yelo. 
Você vai redigir uma mensagem de WhatsApp para o psicólogo(a) ${psi.nome}.
Situação atual: O período de testes gratuito (Trial) de 14 dias deste profissional vai expirar em exatos ${daysLeft} dias.

Aja de forma humanizada, empática e consultiva. NÃO seja agressivamente vendedor e não use gírias como "dar um tchan".

[DADOS OBRIGATÓRIOS DO DESEMPENHO NO TRIAL]
Você DEVE SEMPRE citar esses três indicadores no corpo do seu texto de forma clara:
1. Aparições em Buscas (Matches): ${matches[0]?.count || 0}
2. Visitas na Página (Views): ${views[0]?.count || 0}
3. Cliques no WhatsApp: ${clicksCount}

[FEEDBACKS E RESULTADOS (SE HOUVER CLIQUES)]
- Fechou negócio (Agendou): ${dealYes}
- Em negociação: ${dealTalking}
- Paciente "fantasma" (sumiu): ${dealGhosted}
- Não fechou (achou caro ou desistiu): ${dealNo}

[INSTRUÇÕES DA COPY (MENSAGEM)]
1. A mensagem deve ser enviada via WhatsApp. Use formatação nativa (*negrito*, _itálico_) e quebras de linha (\\n\\n).
2. Cumprimente pelo nome. Seja SUAVE ao informar que faltam apenas ${daysLeft} dia(s) para o Trial expirar. Diga que resolveu dar uma olhada nas métricas e que os resultados foram interessantes.
3. Apresente os resultados dele (Aparições, Visitas, Cliques e Fechamentos).
4. Analise os resultados de fechamento de forma consultiva e parceira.
   - Se ele fechou pacientes, parabenize-o! É a maior prova de que vale a pena assinar.
   - Se não fechou ou teve fantasmas, use uma frase de conforto como "Apesar de não ter fechado com nenhum paciente dessa vez, isso é super normal no início para quem está ajustando o público."
   - Se não teve cliques, diga que ele está sendo visto, mas a bio ou foto precisam de ajustes para converter melhor.
5. É OBRIGATÓRIO EXPLICAR MATEMATICAMENTE A MENSALIDADE: Compare amigavelmente o valor da sessão dele (R$ ${psi.valor_sessao_numero || 'X'}) com a mensalidade da Yelo (R$ 99,00). Prove que fechar apenas X pacientes já paga a mensalidade toda. (Ex: "Como a sua sessão é R$ 150,00, fechando apenas 1 paciente você já paga a plataforma").
6. Finalize perguntando de forma aberta se faz sentido para ele ativar a assinatura para não perder a página e os pacientes que já estão chegando. Instrua-o a reativar acessando a conta na Yelo, indo em "Ajustes" e depois em "Assinaturas e Planos". Não fale em enviar links.
`;

        if (psiId === 99999 || !process.env.GEMINI_API_KEY) {
            console.warn("⚠️ MOCK: Utilizando texto gerado localmente para Trial Expirando.");
            let feedbackText = "";
            let mathText = "";

            if (dealYes > 0) {
                feedbackText = `Notei que você conseguiu fechar terapia com ${dealYes} deles! 🎉`;
                mathText = `esse paciente que você fechou já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            } else {
                feedbackText = `Apesar de os pacientes não terem fechado negócio dessa vez, não desanime, isso é super normal nesse período de adaptação de público!`;
                mathText = `fechar apenas 1 paciente já garante o pagamento da plataforma do mês todo e ainda te deixa com lucro.`;
            }

            return res.status(200).json({ 
                whatsappCopy: `Olá, ${psi.nome}! Tudo bem? Aqui é o Anderson da equipe da Yelo. 🌿\n\nVi que faltam apenas ${daysLeft} dias para o seu período gratuito encerrar, então vim dar uma olhada nas suas métricas. Os resultados de visibilidade foram ótimos!\n\nSeu perfil obteve ${matches[0]?.count || 0} aparições nas buscas, ${views[0]?.count || 0} visitas na página e ${clicksCount} pacientes te chamaram no WhatsApp. ${feedbackText}\n\nPensando no seu lado financeiro: a assinatura da Yelo será de R$ 99 mensais. Como a sua sessão é R$ ${psi.valor_sessao_numero || 'X'}, ${mathText}\n\nVale muito a pena continuar colhendo os frutos do perfil ativo. Para não perdermos esse fluxo de pacientes, basta acessar sua conta na Yelo, ir na opção "Ajustes" e depois em "Assinaturas e Planos". Se precisar de ajuda, estou por aqui!`
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
