const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// Função auxiliar para inicializar a API sob demanda (lazy load)
let genAIInstance = null;
const getGenAI = () => {
    if (!genAIInstance && process.env.GEMINI_API_KEY) {
        genAIInstance = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAIInstance;
};

exports.generateSEO = async (postContent, postTitle) => {
    try {
        const genAI = getGenAI();
        if (!genAI) {
            console.error("❌ [SEO Service] CHAVE DO GEMINI NÃO ENCONTRADA NO .env!");
            return { meta_description: '', tags: [] };
        }

        if (!postContent || postContent.length < 50) {
            return { meta_description: '', tags: [] };
        }

        // Limita o texto para não gastar muitos tokens (os primeiros 3000 caracteres dão contexto suficiente)
        const truncatedContent = postContent.substring(0, 3000);

        // Atualizado para o Gemini 3.1 Flash-Lite (Versão mais leve, rápida e otimizada para JSON)
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: {
                responseMimeType: "application/json", // Garante que o Gemini sempre retorne JSON
            },
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        });

        // Constrói o comando (prompt)
        const prompt = `
Você é um especialista em SEO para a área da saúde e psicologia.
Sua tarefa é analisar o artigo de um psicólogo e retornar um JSON estrito contendo:
1. "meta_description": Um texto persuasivo de até 155 caracteres focado na dor do paciente e na intenção de busca.
2. "tags": Um array com 5 palavras-chave de cauda longa (long-tail keywords) mais relevantes para ranquear o artigo no Google.

Título do Artigo: ${postTitle}

Conteúdo:
${truncatedContent}
`;

        console.log("⏳ [SEO Service] Enviando texto para o Google Gemini...");
        const result = await model.generateContent(prompt);
        
        let rawText = result.response.text();
        console.log("✅ [SEO Service] Resposta bruta do Gemini:", rawText);
        
        // Extrator robusto de JSON (ignora qualquer texto antes ou depois)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Nenhum JSON válido encontrado na resposta da IA.");
        }

        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        return {
            meta_description: parsedResponse.meta_description || '',
            tags: parsedResponse.tags || []
        };
    } catch (error) {
        console.error("❌ [SEO Service] Erro detalhado:", error.message);
        return { meta_description: '', tags: [] };
    }
};

exports.generateProfileSEO = async (nome, bio, especialidades) => {
    try {
        const genAI = getGenAI();
        if (!genAI || !bio || bio.length < 30) {
            return { meta_description: '' };
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
Você é um especialista em SEO.
Crie uma "meta_description" (máximo 155 caracteres) muito atrativa para o perfil público de um psicólogo.
Foque em conversão, acolhimento e nas especialidades clínicas.
Retorne um JSON estrito com a chave "meta_description".

Nome: ${nome}
Especialidades: ${especialidades}
Bio: ${bio.substring(0, 1500)}
`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Nenhum JSON válido encontrado na resposta.");

        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        return { meta_description: parsedResponse.meta_description || '' };
    } catch (error) {
        console.error("❌ [SEO Service - Perfil] Erro:", error.message);
        return { meta_description: '' };
    }
};

exports.optimizeBio = async (currentBio, nome, especialidades) => {
    try {
        const genAI = getGenAI();
        if (!genAI) throw new Error("Chave do Gemini não configurada.");
        
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        
        const prompt = `Você é um copywriter especialista em marketing médico e saúde mental.
Sua tarefa é reescrever o rascunho de biografia deste psicólogo para torná-la mais empática, atraente e focada em conversão de pacientes.

Regras OBRIGATÓRIAS:
1. Corrija qualquer erro gramatical.
2. Comece com foco na dor do paciente ou no acolhimento (empatia), e só depois fale do currículo.
3. Escreva em primeira pessoa ("Eu sou...").
4. Divida em parágrafos curtos com uma quebra de linha entre eles (para facilitar a leitura no celular).
5. NÃO invente formações acadêmicas ou promessas que não foram mencionadas.
6. Mantenha o tom profissional, ético (de acordo com o CRP), porém caloroso.

DADOS DO PROFISSIONAL:
Nome: ${nome}
Especialidades: ${especialidades || 'Psicologia Clínica'}
Rascunho Atual: "${currentBio}"

Retorne APENAS o texto final da nova biografia. Sem aspas, sem introduções como "Aqui está". Apenas o texto pronto para uso.`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("❌ [SEO Service - Otimizar Bio] Erro:", error.message);
        throw new Error("Não foi possível otimizar a bio no momento.");
    }
};

exports.optimizeArticle = async (nome, especialidades, currentTitle, currentContent) => {
    try {
        const genAI = getGenAI();
        if (!genAI) throw new Error("Chave do Gemini não configurada.");
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });
        
        const prompt = `Você é um copywriter e revisor experiente em marketing para a área da saúde.
Sua tarefa é otimizar o artigo escrito pelo psicólogo ${nome} (especialidades: ${especialidades || 'Psicologia Clínica'}).

O profissional já escreveu um rascunho. Você deve melhorar a coesão, corrigir erros gramaticais, melhorar o SEO e tornar a leitura mais envolvente para pacientes, mantendo o tom de voz profissional e ético.

Rascunho do Título: "${currentTitle}"
Rascunho do Conteúdo: "${currentContent}"

Crie um JSON estrito com as chaves:
1. "titulo": Título otimizado e atrativo (máximo 70 caracteres).
2. "conteudo": Conteúdo otimizado em HTML (use as tags <p>, <strong>, <h3>, <ul> para estruturar bem o texto).

Retorne APENAS o JSON estrito.`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON inválido");
        
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ [SEO Service - Otimizar Artigo] Erro:", error.message);
        throw new Error("Não foi possível otimizar o artigo no momento.");
    }
};

exports.generateMatchCopy = async (patientPreferences, psychologists) => {
    try {
        const genAI = getGenAI();
        if (!genAI) return null;
        
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });
        
        const temasArray = Array.isArray(patientPreferences.temas) 
            ? patientPreferences.temas 
            : (typeof patientPreferences.temas === 'string' ? [patientPreferences.temas] : []);

        const patientContext = `Faixa de Valor: ${patientPreferences.faixa_valor || 'Não informada'}
Temas buscados: ${temasArray.join(', ')}
Gênero preferido: ${patientPreferences.pref_genero_prof || 'Indiferente'}
Modalidade: ${patientPreferences.modalidade_atendimento || 'Indiferente'}`;

        const psiContext = psychologists.map(p => `ID: ${p.id} | Nome: ${p.nome} | Especialidades: ${(p.temas_atuacao || []).join(', ')} | Modalidade: ${(p.modalidade || []).join(', ')} | Bio Original: ${(p.bio || '').substring(0, 300)}`).join('\n');

        const prompt = `Aja como um "Matchmaker" empático de uma clínica de psicologia.
Nós cruzamos o perfil de um paciente com 3 psicólogos ideais. Sua tarefa para CADA psicólogo é criar:
1. "reasons": Array com EXATAMENTE 1 única frase curta (máximo 60 caracteres) explicando o principal motivo de ele ser uma ótima escolha para esse paciente. Foco no acolhimento e nas dores do paciente.
2. "miniBio": Uma resposta direta e empática à pergunta "Como eu posso te ajudar?". Para criar esta resposta, analise obrigatoriamente a Bio Original e TODAS as personalizações do perfil do psicólogo (especialidades, modalidade), cruzando isso com as respostas que o paciente acabou de dar no questionário. (máx 150 caracteres). A frase deve iniciar respondendo a pergunta diretamente, sem saudações (sem "Olá" ou "Sou especialista"). O tom deve ser do próprio psicólogo falando. (Ex: "Posso te ajudar a compreender suas emoções e construir ferramentas práticas para superar a ansiedade no seu dia a dia.").

DADOS PACIENTE:
${patientContext}

PSICÓLOGOS SELECIONADOS:
${psiContext}

Retorne APENAS um JSON onde as chaves são os IDs dos psicólogos passados, e o valor é um objeto contendo "reasons" e "miniBio".
Exemplo de formato esperado:
{
  "123": {
    "reasons": ["Especialista em Ansiedade", "Atende Online", "Abordagem humanizada"],
    "miniBio": "Eu posso te ajudar oferecendo um espaço seguro para explorarmos juntos a origem dessa angústia e construirmos novos caminhos."
  }
}`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return { error: "Regex não encontrou JSON" };
        
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ [SEO Service - Match Copy] Erro:", error.message);
        return { error: error.message };
    }
};

exports.generateQuestionSEO = async (questionTitle, questionContent, answerContent) => {
    try {
        const genAI = getGenAI();
        if (!genAI) {
            return { meta_description: '' };
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
Você é um especialista em SEO.
Crie uma "meta_description" (máximo 155 caracteres) muito atrativa para uma página de Dúvida Clínica respondida por psicólogos.
Foque na dor do paciente e em convidar para ler a resposta completa.
Retorne um JSON estrito com a chave "meta_description".

Pergunta: ${questionTitle}
Detalhes: ${questionContent.substring(0, 500)}
Resposta do Especialista: ${answerContent.substring(0, 1000)}
`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Nenhum JSON válido encontrado na resposta.");

        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        return { meta_description: parsedResponse.meta_description || '' };
    } catch (error) {
        console.error("❌ [SEO Service - QnA] Erro:", error.message);
        return { meta_description: '' };
    }
};

exports.generatePatientQuestionSEO = async (questionContent) => {
    try {
        const genAI = getGenAI();
        if (!genAI) return null;
        
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `
Você é um especialista em SEO e saúde mental.
Um paciente enviou a seguinte dúvida anônima para nossa comunidade de psicólogos:
"${questionContent.substring(0, 1000)}"

Sua tarefa é extrair e otimizar essa dúvida criando:
1. "title": Um título claro, empático e com alta intenção de busca no Google, formatado como pergunta (máximo 60 caracteres).
2. "meta_description": Uma meta descrição atrativa (máximo 155 caracteres) focada na dor relatada para gerar cliques no Google.

Retorne um JSON estrito com as chaves "title" e "meta_description".
`;
        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON inválido");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ [SEO Service - Dúvida Paciente] Erro:", error.message);
        return null;
    }
};

exports.analyzeProfileForCS = async (profileData) => {
    try {
        const genAI = getGenAI();
        if (!genAI) return "Chave da API não configurada no servidor.";
        
        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite"
        });

        const prompt = `Aja como a equipe de Marketing e Sucesso do Cliente da Yelo. Analise VERDADEIRAMENTE o JSON abaixo com os dados do perfil de um profissional e crie uma mensagem de feedback focada em conversão.

Regras da mensagem:
1. Tom de voz: Mensagem de WhatsApp, sucinta, humana, amigável e próxima.
2. NADA de formatações engessadas: NÃO USE listas com marcadores (bullet points, hifens) nem subtítulos marcados. Escreva a mensagem inteira em parágrafos textuais fluidos, naturais e bem divididos.
3. Formatação visual: Use quebras de linha reais para separar os assuntos e dar respiro à leitura.

ESTRUTURA EXATA DA MENSAGEM:

[Abertura Obrigatória]
"Oi, ${profileData.nome ? profileData.nome.split(' ')[0] : 'colega'}! Tudo bem? Aqui é o Anderson do time da Yelo. 🌿
Pedi à nossa equipe de Growth para analisar sua página pública e trouxe algumas sugestões. Espero que goste:"

[Elogio Estratégico - 1 parágrafo fluído]
Elogie algo REAL e positivo que já existe no perfil (ex: foto com boa luz, nicho bem definido no texto, etc). Seja específico e acolhedor, mostrando que lemos o perfil com carinho.

[Transição Obrigatória]
"Pensando em te ajudar a receber ainda mais contatos, separamos algumas dicas rápidas:"

[Sugestões de Melhoria - 1 ou 2 parágrafos fluidos, SEM marcadores (bullets)]
Baseie-se APENAS na realidade dos dados fornecidos:
- Se a "bio" for um bloco de texto muito longo (sem quebras), sugira quebrar em parágrafos mais curtos e usar negrito nas palavras principais, pois a maioria lê pelo celular.
- Se a "bio" começar falando de currículo, sugira falar primeiro com a dor do paciente. (Se já focar no paciente, NÃO dê essa dica).
- Se as "tags" do público-alvo (ex: Adolescentes) não baterem com o texto da bio (ex: fala apenas sobre Adultos), sugira esse alinhamento para não confundir o paciente.
- Se "preco_ou_valor" for "A combinar", sugira adicionar o valor exato para quebrar a barreira do medo. (Se já tiver preço, NÃO dê essa dica).
- Se "avaliacoes" for 0, sugira pedir para 2 ou 3 pacientes deixarem uma avaliação, explicando que é o maior gatilho de segurança na internet e quebra a desconfiança.
- Se "tem_foto" for false, recomende urgentemente adicionar uma foto de perfil, explicando que é fundamental para gerar confiança.

"Esperamos que essas dicas ajudem a dar aquele empurrãozinho nos seus contatos pela Yelo.
Qualquer dúvida, estamos por aqui. 🚀"

DADOS REAIS DO PROFISSIONAL (Analise com atenção antes de escrever):
${JSON.stringify(profileData, null, 2)}`;

        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("❌ [SEO Service - CS Analysis] Erro:", error.message);
        return "Erro ao gerar análise de perfil.";
    }
};

exports.generateDashboardInsights = async (stats, psychologistData) => {
    try {
        const genAI = getGenAI();
        if (!genAI) return null;

        const model = genAI.getGenerativeModel({
            model: "gemini-3.1-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        let diasDePerfil = psychologistData.createdAt ? Math.floor((new Date() - new Date(psychologistData.createdAt)) / (1000 * 60 * 60 * 24)) : 30;

        // Se o plano expira em breve (sinal de trial ativado recentemente), calculamos a idade real do perfil público
        if (psychologistData.planExpiresAt) {
            const expiraEm = new Date(psychologistData.planExpiresAt);
            const diasParaExpirar = Math.ceil((expiraEm - new Date()) / (1000 * 60 * 60 * 24));
            
            // Se faltam entre 0 e 14 dias para expirar, significa que ele ativou o trial recentemente.
            // Exemplo: se faltam 14 dias, o perfil foi ativado hoje (0 dias de vida).
            if (diasParaExpirar >= 0 && diasParaExpirar <= 14) {
                diasDePerfil = 14 - diasParaExpirar;
            }
        }

        const prompt = `Você é um 'Consultor de Crescimento' (Growth Coach) amigável da comunidade Yelo.
Sua missão é ajudar um psicólogo a conseguir mais pacientes ou aumentar sua autoridade na plataforma.
Analise os DADOS REAIS abaixo (funil, interações, preço, especialidades).

Regras Absolutas:
- NÃO invente nem suponha dados que não estão listados abaixo (ex: não diga para adicionar foto se você não sabe se a pessoa já tem foto).
- Nunca diga que o perfil está "invisível" se ele tem "profileViews" maior que 0.

Hierarquia de Urgência:
1. Se o "Dias desde a criação do perfil" for menor que 14 dias -> Ignore as métricas de conversão. O perfil é recém-nascido! Dê as boas-vindas, acalme o profissional lembrando que o algoritmo está aprendendo sobre ele e que os resultados orgânicos levam tempo. Sugira revisar com calma a "Bio" ou interagir no Fórum para acelerar essa visibilidade.
2. Se "whatsappClicks" for baixo (ex: menos de 5% de conversão), mas "profileViews" for alto -> O perfil está sendo VISTO, mas não está convencendo o paciente a clicar. Sugira revisar o início do texto de apresentação (Bio) para focar mais na dor do paciente, ou conferir se o preço está muito fora da média. Ferramenta: "psi_meu_perfil.html"
3. Se "whatsappClicks" for alto e "valor_sessao" for baixo -> O problema é a precificação. Sugira reajustar o preço para valorizar a hora clínica. Ferramenta: "psi_meu_perfil.html"
4. Se o funil estiver excelente, mas a comunidade estiver parada (Dias sem interagir alto) -> Sugira responder pacientes ("psi_comunidade.html") ou postar no fórum ("psi_forum.html").
5. Se tudo estiver fluindo perfeitamente -> Sugira escrever um Artigo para o Blog focado nas suas especialidades ("psi_blog.html").

Tom de Voz:
Amigável, construtivo, orgânico e motivador. NUNCA pareça um robô. Use emojis com moderação. Mostre que fazemos parte da mesma comunidade e o objetivo é crescer juntos.

Retorne EXATAMENTE este JSON:
{
  "marketingTip": {
    "title": "Sua dica de conversão ou negócio aqui (amigável e direta)",
    "impact": "Mais Contatos" ou "Maior Conversão" ou "Mais Valor",
    "url": "psi_meu_perfil.html"
  },
  "contentIdea": {
    "title": "Sua sugestão de conteúdo ou engajamento comunitário (seja bem específico sobre o tema, ex: 'Que tal escrever sobre ansiedade noturna?')",
    "impact": "Autoridade" ou "Comunidade",
    "url": "psi_blog.html" ou "psi_forum.html" ou "psi_comunidade.html"
  }
}

DADOS DO PSICÓLOGO:
Especialidades: ${(psychologistData.temas_atuacao || []).join(', ')}
Valor da Sessão: ${psychologistData.valor_sessao_numero || 'Não informado'}
XP Atual: ${psychologistData.xp || 0}
Dias sem interagir: ${stats.diasDesdeUltimaInteracao !== undefined ? stats.diasDesdeUltimaInteracao : 10}
Dias desde a criação do perfil: ${diasDePerfil}

MÉTRICAS DO FUNIL (Últimos 30 dias):
Impressões no Match: ${stats.matchImpressions || 0}
Visualizações de Perfil: ${stats.profileViews || 0}
Cliques no WhatsApp: ${stats.whatsappClicks || 0}
`;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("JSON inválido");
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error("❌ [SEO Service - Dashboard Insights] Erro:", error.message);
        return null;
    }
};