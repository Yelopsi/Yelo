const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const db = require('../models');

async function generateAiQuestionV2() {
    try {
        console.log("🤖 Iniciando Motor Editorial da Comunidade (V3 - Arquitetura de 3 Fases)...");

        if (!process.env.GEMINI_API_KEY) {
            console.error("❌ ERRO: Chave da API do Gemini não configurada.");
            return;
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Modelo base (vamos usar configurações de temperatura diferentes nas chamadas)
        const getModel = (temp) => genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite", 
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        }, { apiVersion: 'v1beta' });

        // 1. DADOS DA YELO: Busca Histórico Recente
        // Vamos buscar as 50 mais recentes para evitar repetições
        const recentQuestions = await db.Question.findAll({
            limit: 50,
            order: [['createdAt', 'DESC']],
            attributes: ['title', 'content']
        });
        
        // Também pegamos os últimos 5 rascunhos pendentes (para a IA não repetir o que ela acabou de gerar agorinha)
        const recentDrafts = await db.AiQuestionDraft.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']],
            attributes: ['title', 'content']
        });

        const combinedHistory = [...recentDrafts, ...recentQuestions].slice(0, 50);
        const historyText = combinedHistory.map((q, i) => `${i+1}. ${q.title || ''} (${q.content.substring(0, 80)}...)`).join('\n');

        // ============================================================================
        // FASE 1: O GERADOR (Temperatura Alta - Explorar)
        // ============================================================================
        const promptGerador = `
# MOTOR EDITORIAL DA COMUNIDADE YELO

Você é o motor editorial inteligente da Comunidade Yelo. A Yelo conecta pessoas a psicólogos.
Sua função é gerar 4 perguntas candidatas diferentes que pareçam ter sido escritas espontaneamente por pessoas reais (pacientes em potencial).

MUITO IMPORTANTE SOBRE NATURALIDADE:
A naturalidade é mais importante que a correção formal. A pergunta não deve parecer "muito bem construída" nem um "artigo de psicologia".
Não introduza erros ortográficos artificialmente para parecer humano (não escreva "tipo eu n sei pq eu fico assim sabe...").
A naturalidade vem de:
- pensamento incompleto;
- contexto específico e cotidiano;
- dúvida genuína e ambivalência;
- vocabulário comum e pequenas contradições;
- não saber exatamente o que está acontecendo.
Pequenas informalidades podem aparecer quando compatíveis com a situação, mas nunca force erros.

MUITO IMPORTANTE SOBRE A ESTRUTURA E TAMANHO (QUEBRE O PADRÃO):
Você DEVE variar radicalmente a estrutura e o tamanho das 4 candidatas. Faça uma mistura de estilos, inspirando-se nos seguintes exemplos REAIS da nossa plataforma:
- "Como funciona a primeira sessão de terapia e o que devo esperar dela?"
- "muito legal esse espaço. pessoal, façam terapia porque é importante!!!!"
- "Tem um tempo certo pra mudar de psi? Anos, meses etc?"
- "É verdade que psicólogo tem paciente favorito e outros nem tanto"
- "Psicólogo pode indicar psiquiatra? Pq eu pesquisei e me parece que o que eu tenho é de psiquiatra e "
- "Eu não tenho dinheiro para pagar terapia particular. Onde consigo atendimento de graça?"
- "Estou vendo um amigo muito mal. O que eu posso falar para ajudar sem piorar as coisas?"
- "eu trabalho num serviço muito puxado. como é o processo pra pedir afastamento por saúde mental?"
- "eu geralmente passo bastante tempo pensando em coisas inúteis e que tomam bastante o meu tempo. pesq"
- "Pq todo psicólogo fala que tá td bem se afastar de quem te faz mal?"

Note como as perguntas reais são curtas, às vezes terminam no meio da frase ("e que tomam bastante o meu tempo. pesq"), usam abreviações ("Pq", "psi", "td") e vão direto ao ponto.
A estrutura TEM que ser imprevisível. Algumas devem ter "?", outras não. A MAIORIA deve ser super curta (1 a 2 frases), e apenas uma ou outra pode ser um relato um pouquinho maior.

MUITO IMPORTANTE SOBRE A LINGUAGEM E O CONTEXTO:
1. Cuidado com clichês de IA (ex: sempre terminar com "Isso é normal?" ou "Isso tem nome?"). Varie! Use "o que pode ser?", "é loucura né", ou simplesmente termine no ponto final sem fazer pergunta alguma.
2. NUNCA use "Alguém mais sente isso?" ou dirija-se a outras pessoas (como num fórum). O paciente não interage com outros pacientes, ele apenas escreve para um Psicólogo ler e responder. 

MUITO IMPORTANTE SOBRE OS TEMAS (VARIEDADE):
1. É ESTRITAMENTE PROIBIDO gerar perguntas sobre os mesmos assuntos das PERGUNTAS RECENTES. Leia as últimas 5 do histórico e fuja desse assunto. Se o histórico recente fala de "Luto", você NÃO PODE fazer perguntas de "Luto".
2. As 4 perguntas candidatas que você vai gerar DEVEM ter temas COMPLETAMENTE DIFERENTES entre si. (Ex: uma sobre relacionamento abusivo, outra sobre síndrome do impostor, outra sobre fobia social, outra sobre insônia, etc.).

PERGUNTAS RECENTES (Não repita os temas abaixo!):
${historyText || "Nenhuma ainda."}

Gere exatamente 4 perguntas candidatas diferentes explorando temas variados.
Retorne APENAS um array JSON válido, sem markdown, contendo as 4 candidatas.
Formato:
[
  {
    "id_candidata": 1,
    "pergunta": "Texto final da pergunta com a situação concreta e a dúvida.",
    "tema": "tema geral"
  },
  ...
]
        `;

        console.log("🧠 FASE 1: Acionando o GERADOR...");
        const resultGerador = await getModel(0.8).generateContent({
            contents: [{ role: 'user', parts: [{ text: promptGerador }] }],
            generationConfig: { temperature: 0.8 }
        });
        
        let responseGerador = resultGerador.response.text().trim();
        if (responseGerador.startsWith('```json')) responseGerador = responseGerador.replace(/^```json/, '').replace(/```$/, '').trim();

        let candidates;
        try {
            candidates = JSON.parse(responseGerador);
        } catch (err) {
            console.error("❌ ERRO: O Gerador não retornou um JSON válido.");
            return;
        }

        if (!Array.isArray(candidates) || candidates.length !== 4) {
            console.error("❌ ERRO: O Gerador não retornou 4 candidatos.");
            return;
        }

        // ============================================================================
        // FASE 2: FISCAL EDITORIAL (Temperatura Baixa - Comparar e Escolher)
        // ============================================================================
        console.log("🕵️ FASE 2: Acionando o FISCAL EDITORIAL...");
        
        const candidatasTexto = candidates.map(c => `Candidata ${c.id_candidata}: "${c.pergunta}" (Tema: ${c.tema})`).join('\n\n');

        const promptFiscal = `
# FISCAL E CURADOR EDITORIAL

Você é o fiscal editorial da Yelo. Você recebeu 4 candidatas a perguntas. Sua função é analisar as 4, compará-las entre si e com o histórico, e ESCOLHER APENAS UMA para ser publicada.

### AS 4 CANDIDATAS:
${candidatasTexto}

### PERGUNTAS RECENTES NO SITE (Para não repetir ângulo/tema):
${historyText || "Nenhuma ainda."}

REGRAS DE OURO DO FISCAL (PORTEIRO, NÃO REDATOR):
1. Escolha a que soa mais real, humana, espontânea e útil para um psicólogo responder.
2. É ESTRITAMENTE PROIBIDO aprovar uma candidata cujo tema seja o mesmo das perguntas do histórico recente. Privilegie temas inéditos, surpreendentes e diferentes.
3. REJEITE perguntas que usam linguagem de fórum ("Alguém mais sente isso?", "Vocês também passam por isso?").
4. APROVE a diversidade estrutural: algumas perguntas devem ser curtas ("Como parar de chorar por tudo?"), outras podem ser desabafos sem interrogação, e outras podem ter perguntas no meio ou no fim ("É loucura né").
5. Se a pergunta escolhida já for publicável, PRESERVE EXATAMENTE O TEXTO ORIGINAL. Não reescreva para melhorar gramática, clareza, elegância ou estrutura. Você é um porteiro, não um redator.
6. Se TODAS forem horríveis, artificiais ou repetitivas, você pode rejeitar todas (retorne id_escolhida: null).

Retorne SOMENTE um JSON válido neste formato exato, sem markdown:
{
  "id_escolhida": 1, 
  "texto_original": "Texto exato da candidata escolhida",
  "motivo_da_escolha": "Explicação breve de por que superou as outras",
  "rejeitou_todas": false
}
        `;

        const resultFiscal = await getModel(0.2).generateContent({
            contents: [{ role: 'user', parts: [{ text: promptFiscal }] }],
            generationConfig: { temperature: 0.2 }
        });

        let responseFiscal = resultFiscal.response.text().trim();
        if (responseFiscal.startsWith('```json')) responseFiscal = responseFiscal.replace(/^```json/, '').replace(/```$/, '').trim();

        let fiscalDecisao;
        try {
            fiscalDecisao = JSON.parse(responseFiscal);
        } catch (err) {
            console.error("❌ ERRO: O Fiscal retornou um JSON inválido.");
            return;
        }

        if (fiscalDecisao.rejeitou_todas || !fiscalDecisao.id_escolhida) {
            console.log("⚠️ O Fiscal rejeitou todas as 4 candidatas desta rodada.");
            return;
        }

        const perguntaEscolhida = fiscalDecisao.texto_original;
        console.log(`✅ O Fiscal escolheu a candidata ${fiscalDecisao.id_escolhida}: "${perguntaEscolhida.substring(0, 40)}..."`);

        // ============================================================================
        // FASE 3: FILTRO DE SEGURANÇA (Temperatura Zero - Validação Rígida)
        // ============================================================================
        console.log("🛡️ FASE 3: Acionando o FILTRO DE SEGURANÇA...");

        const promptSeguranca = `
Você é o Filtro de Segurança Clínica de uma plataforma de psicologia (Yelo).
Avalie se a seguinte publicação feita por um usuário anônimo viola regras de segurança graves.

PERGUNTA A SER PUBLICADA:
"${perguntaEscolhida}"

Diretrizes de Rejeição (DEVE REJEITAR SE):
- Apologia a suicídio, automutilação iminente ou crimes violentos.
- Conteúdo sexualmente explícito, pedofilia ou abusos graves relatados de forma gráfica.
- Venda de drogas, serviços ilegais ou spam.

A pergunta deve ser APROVADA se for um desabafo seguro, mesmo que demonstre sofrimento emocional intenso (ansiedade, depressão, luto), pois a plataforma serve justamente para acolher isso de psicólogos.

Retorne SOMENTE um JSON válido:
{
  "aprovado": true ou false,
  "motivo": "Breve justificativa"
}
        `;

        const resultSeguranca = await getModel(0.0).generateContent({
            contents: [{ role: 'user', parts: [{ text: promptSeguranca }] }],
            generationConfig: { temperature: 0.0 }
        });

        let responseSeg = resultSeguranca.response.text().trim();
        if (responseSeg.startsWith('```json')) responseSeg = responseSeg.replace(/^```json/, '').replace(/```$/, '').trim();

        let segDecisao;
        try {
            segDecisao = JSON.parse(responseSeg);
        } catch (err) {
            console.error("❌ ERRO: Filtro de Segurança retornou JSON inválido.");
            return;
        }

        if (segDecisao.aprovado) {
            console.log("✅ Filtro de Segurança APROVOU. Salvando no Rascunho!");
            
            await db.AiQuestionDraft.create({
                title: perguntaEscolhida.substring(0, 250), // Trunca só por segurança de limite do campo (não é usado na tela)
                content: perguntaEscolhida,
                meta_description: JSON.stringify({ 
                    motivo_fiscal: fiscalDecisao.motivo_da_escolha,
                    motivo_seguranca: segDecisao.motivo
                }),
                status: 'pending'
            });
            
            console.log("🎉 Pergunta guardada com sucesso na Fila da IA!");
        } else {
            console.log(`❌ Filtro de Segurança REJEITOU a pergunta: ${segDecisao.motivo}`);
        }

    } catch (error) {
        console.error("❌ Erro fatal no Motor Editorial V3:", error);
    }
}

module.exports = generateAiQuestionV2;
