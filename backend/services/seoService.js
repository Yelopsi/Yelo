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