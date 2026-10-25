const db = require('../models');
const { ForumPost, ForumComment, ForumCommentVote, ForumVote, ForumReport, Psychologist } = db;
const { Op } = require('sequelize');

const gamificationService = require('../services/gamificationService');
const emailService = require('../services/emailService'); // Importação do serviço de e-mail
exports.getAllPosts = async (req, res) => {
    try {
        const psychologistId = req.user.id;
        const { filter, search, category, page = 1, limit = 3, pageSize } = req.query; 
        const parsedLimit = parseInt(limit, 10);
        // Se pageSize não for enviado, usa o limit. Se for, usa ele para calcular o offset.
        const parsedPageSize = pageSize ? parseInt(pageSize, 10) : parsedLimit;
        const offset = (page - 1) * parsedPageSize;

        let orderClause;

        if (filter === 'populares') {
            orderClause = [
                db.Sequelize.literal('COALESCE("ForumPost"."isPinned", false) DESC'),
                db.Sequelize.literal('("ForumPost"."votes" + COUNT(DISTINCT "ForumComments"."id")) DESC'),
                ['createdAt', 'DESC']
            ];
        } else {
            orderClause = [
                db.Sequelize.literal('COALESCE("ForumPost"."isPinned", false) DESC'),
                ['createdAt', 'DESC']
            ];
        }

        const where = {
            [Op.and]: [
                {
                    [Op.or]: [
                        { status: null },
                        { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted'] } }
                    ]
                }
            ]
        };
        if (filter === 'meus_posts') {
            where.PsychologistId = psychologistId;
        }
        if (search) {
            where[Op.and].push({
                [Op.or]: [
                    { title: { [Op.iLike]: `%${search}%` } },
                    { content: { [Op.iLike]: `%${search}%` } }
                ]
            });
        }
        if (category) {
            where.category = category;
        }
        console.log('--- FORUM FILTER DEBUG ---', { filter, search, category, where });

        const posts = await ForumPost.findAll({
            where,
            order: orderClause,
            attributes: {
                include: [
                    [db.Sequelize.literal('COALESCE("ForumPost"."isPinned", false)'), 'isPinned'],
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('ForumComments.id'))), 'commentCount'],
                    [db.Sequelize.literal(`EXISTS (SELECT 1 FROM "ForumVotes" WHERE "ForumVotes"."ForumPostId" = "ForumPost"."id" AND "ForumVotes"."PsychologistId" = ${psychologistId})`), 'supportedByMe'],
                    [db.Sequelize.literal(`("ForumPost"."PsychologistId" = ${psychologistId})`), 'isMine']
                ]
            },
            include: [
                {
                    model: Psychologist, // Adiciona badges e nível para exibição
                    attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'],
                    required: false // Garante LEFT JOIN
                },
                {
                    model: ForumComment,
                    attributes: [], // Não traz dados, apenas para a contagem
                    required: false // Garante LEFT JOIN
                }
            ],
            group: ['ForumPost.id', 'Psychologist.id'],
            limit: parsedLimit,
            offset,
            subQuery: false // Impede que o Sequelize crie uma subquery que quebra a ordenação com COUNT
        });

        const agora = new Date();
        // Formata a resposta para o frontend
        const formattedPosts = posts.map(post => {
            let authorSlug = post.isAnonymous ? null : post.Psychologist?.slug;
            
            if (post.Psychologist && !post.isAnonymous) {
                let isActive = post.Psychologist.status === 'active';
                const isVip = post.Psychologist.is_exempt === true || String(post.Psychologist.is_exempt).toLowerCase() === 'true' || post.Psychologist.is_exempt === 1;
                if (!isVip && (!post.Psychologist.planExpiresAt || new Date(post.Psychologist.planExpiresAt) <= agora)) {
                    isActive = false;
                }
                if (!isActive) authorSlug = null;
            }

            return {
                id: post.id,
                title: post.title,
                content: post.content,
                category: post.category,
                isAnonymous: post.isAnonymous,
                createdAt: post.createdAt,
                isPinned: post.dataValues.isPinned,
                votes: post.votes,
                authorBadges: post.isAnonymous ? {} : post.Psychologist?.badges, // Passa as badges para o front
                authorLevel: post.isAnonymous ? null : post.Psychologist?.authority_level, // Passa o nível
                authorName: post.isAnonymous ? 'Anônimo' : post.Psychologist?.nome,
                authorPhoto: post.isAnonymous ? null : post.Psychologist?.fotoUrl,
                authorSlug: authorSlug,
                commentCount: parseInt(post.dataValues.commentCount, 10) || 0,
                supportedByMe: post.dataValues.supportedByMe,
                isMine: post.dataValues.isMine
            };
        });

        res.json(formattedPosts);

    } catch (error) {
        console.error("Erro ao buscar posts do fórum:", error);
        res.status(500).json({ error: 'Erro ao carregar discussões.' });
    }
};

const notificationService = require('../services/notificationService');

/**
 * Avalia se o conteúdo viola as diretrizes éticas da Psicologia (CFP) e da Comunidade Yelo.
 * Regras vetadas:
 * 1. QUEBRA DE SIGILO PROFISSIONAL (Art. 9º do Código de Ética do Psicólogo - CFP)
 * 2. PRESCRIÇÃO FARMACOLÓGICA / ATOS MÉDICOS PRIVATIVOS (Art. 2º do CEP)
 * 3. PRÁTICAS NÃO CIENTÍFICAS / "CURA GAY" (Resolução CFP 01/99)
 * 4. DISCURSO DE ÓDIO, DISCRIMINAÇÃO E ASSÉDIO
 * 5. PIRATARIA DE INSTRUMENTOS RESTRITOS (SATEPSI)
 * 6. AUTOLESÃO / INCENTIVO AO SUICÍDIO / ILEGALIDADES
 */
async function callGeminiWithFallback(genAI, prompt, safetySettings) {
    const candidateModels = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"];
    let lastError = null;
    for (const modelName of candidateModels) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName, safetySettings });
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (err) {
            lastError = err;
            console.warn(`[Gemini] Tentativa com ${modelName} falhou: ${err.message}. Tentando próximo modelo...`);
        }
    }
    throw lastError;
}

// --- UTILITÁRIOS PARA BUSCA E DETECÇÃO DE DUPLICIDADE ---
function toAccentRegex(term) {
    if (!term) return '';
    const map = {
        'a': '[aáàâãä]', 'e': '[eéèêë]', 'i': '[iíìîï]',
        'o': '[oóòôõö]', 'u': '[uúùûü]', 'c': '[cç]'
    };
    const clean = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    let pattern = '';
    for (const ch of clean) {
        pattern += map[ch] || (/[.*+?^${}()|[\]\\]/.test(ch) ? '\\' + ch : ch);
    }
    return pattern;
}

function normalizeTextForComparison(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const STOP_WORDS = new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas', 'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'pra',
    'com', 'sem', 'sob', 'sobre', 'que', 'e', 'ou', 'se', 'mas', 'como', 'qual', 'quais',
    'meu', 'minha', 'meus', 'minhas', 'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa',
    'eu', 'voce', 'voces', 'ele', 'ela', 'eles', 'elas', 'alguem', 'duvida', 'pergunta',
    'algum', 'alguma', 'alguns', 'algumas', 'onde', 'quando', 'quem', 'ter', 'tem', 'ser',
    'sou', 'sao', 'fazer', 'isso', 'isto', 'aqui', 'ai', 'la', 'mais', 'muito', 'muita',
    'muitos', 'muitas', 'pouco', 'pouca', 'ja', 'ainda', 'ate', 'ao', 'aos', 'assim', 'tambem'
]);

function stemPt(word) {
    if (!word || word.length <= 3) return word;
    let w = word.toLowerCase();

    // Substantivos / Adjetivos
    if (w.endsWith('amentos') || w.endsWith('imento')) return w.slice(0, -6);
    if (w.endsWith('amento') || w.endsWith('imentos')) return w.slice(0, -6);
    if (w.endsWith('mentos')) return w.slice(0, -6);
    if (w.endsWith('mento')) return w.slice(0, -5);
    if (w.endsWith('ancas') || w.endsWith('ancos')) return w.slice(0, -5);
    if (w.endsWith('anca') || w.endsWith('anco')) return w.slice(0, -4);
    if (w.endsWith('coes')) return w.slice(0, -4);
    if (w.endsWith('cao')) return w.slice(0, -3);

    // Formas verbais
    if (w.endsWith('ando') || w.endsWith('endo') || w.endsWith('indo')) return w.slice(0, -4);
    if (w.endsWith('aram') || w.endsWith('eram') || w.endsWith('iram')) return w.slice(0, -4);
    if (w.endsWith('ada') || w.endsWith('ida') || w.endsWith('ado') || w.endsWith('ido')) return w.slice(0, -3);
    if (w.endsWith('am') || w.endsWith('em')) return w.slice(0, -2);
    if (w.endsWith('ar') || w.endsWith('er') || w.endsWith('ir')) return w.slice(0, -2);

    // Plurais
    if (w.endsWith('res') || w.endsWith('ses') || w.endsWith('zes')) return w.slice(0, -2);
    if (w.endsWith('is') && w.length > 4) return w.slice(0, -2) + 'l';
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);

    return w;
}

function extractKeywords(str) {
    const norm = normalizeTextForComparison(str);
    return norm.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w)).map(stemPt);
}

function calculateTitleSimilarity(titleA, titleB) {
    const normA = normalizeTextForComparison(titleA);
    const normB = normalizeTextForComparison(titleB);

    if (!normA || !normB) return 0;
    if (normA === normB) return 1.0;

    if (normA.includes(normB) || normB.includes(normA)) {
        const shorter = Math.min(normA.length, normB.length);
        const longer = Math.max(normA.length, normB.length);
        if (shorter >= 10 && shorter / longer >= 0.55) return 0.9;
    }

    const wordsA = extractKeywords(titleA);
    const wordsB = extractKeywords(titleB);

    if (wordsA.length === 0 || wordsB.length === 0) return 0;

    const setA = new Set(wordsA);
    const setB = new Set(wordsB);

    let intersection = 0;
    for (const w of setA) {
        if (setB.has(w)) intersection++;
    }

    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = union > 0 ? intersection / union : 0;
    const minLen = Math.min(wordsA.length, wordsB.length);
    const overlapMin = minLen > 0 ? intersection / minLen : 0;

    if (overlapMin >= 0.75 && intersection >= 2) return 0.88;
    return Math.max(jaccard, overlapMin * 0.8);
}

async function findDeterministicDuplicate(newTitle, excludeId = null, candidatePosts = null) {
    if (!newTitle || newTitle.trim().length < 5) return { isDuplicate: false };

    let existingPosts = candidatePosts;
    if (!Array.isArray(existingPosts)) {
        const where = {
            [Op.or]: [
                { status: null },
                { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted'] } }
            ]
        };
        const parsedExcludeId = parseInt(excludeId, 10);
        if (Number.isInteger(parsedExcludeId) && parsedExcludeId > 0) {
            where.id = { [Op.ne]: parsedExcludeId };
        }

        existingPosts = await ForumPost.findAll({
            where,
            attributes: ['id', 'title', 'category'],
            order: [['createdAt', 'DESC']],
            limit: 120
        });
    }

    for (const p of existingPosts) {
        const sim = calculateTitleSimilarity(newTitle, p.title);
        if (sim >= 0.72) {
            return {
                isDuplicate: true,
                matchedPostId: p.id,
                matchedPostTitle: p.title,
                similarity: sim,
                explanation: `Identificamos que já existe uma discussão aberta com o mesmo tema na comunidade: "${p.title}".`
            };
        }
    }
    return { isDuplicate: false };
}

const evaluateContentEthicsWithAI = async ({ title, content, category }) => {
    const textToCheck = `${title || ''}\n${content || ''}`.trim();
    if (!textToCheck) return { isProhibited: false };

    // Tratamento especial para citações e links internos do fórum:
    // Se o texto consistir unicamente de links/citações da comunidade Yelo, libera imediatamente sem falsos positivos.
    const textWithoutForumLinks = textToCheck
        .replace(/(?:https?:\/\/[^\s<]+)?(?:\/psi\/|psi_|\/forum\/|\/posts\/|\.html|\?tab=forum)[^\s<]*(?:[?&#]|&amp;)(?:postId|post)=\d+[^\s<]*/gi, '')
        .replace(/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|www\.yelopsi\.com\.br|yelopsi\.com\.br)(?::\d+)?[^\s<]*/gi, '')
        .replace(/(?:#|@topico:|@post:|#topico:)\d+\b/gi, '')
        .trim();

    if (!textWithoutForumLinks) {
        // Contém somente link/citação do próprio fórum Yelo
        return { isProhibited: false };
    }

    // 1. Heurísticas rápidas determinísticas (zero latência e fallback offline)
    // 1.1 CPF exposto (Violação grave de sigilo do paciente - CFP Art. 9º)
    // Remove URLs antes de testar regex de CPF para evitar que portas, timestamps ou query params disparem falso positivo
    const textWithoutUrls = textToCheck.replace(/https?:\/\/[^\s<]+/gi, '').replace(/\b(?:postId|post)=\d+\b/gi, '');
    const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
    if (cpfRegex.test(textWithoutUrls)) {
        return {
            isProhibited: true,
            category: 'SIGILO_PROFISSIONAL',
            reason: 'Identificamos um número de CPF no texto. O Código de Ética do Psicólogo (Art. 9º) veda a exposição de documentos e dados de identificação de pacientes ou terceiros.',
            suggestion: 'Remova qualquer número de documento (CPF, RG) antes de submeter a publicação.'
        };
    }

    // 1.2 Prescrição medicamentosa explícita (Ato privativo de médico - CFP Art. 2º)
    const rxRegex = /\b(?:prescrevo|receito|tome|tomar|dosagem de|dose de)\s+\d+\s*(?:mg|gotas|comprimidos|ml)\b/i;
    if (rxRegex.test(textToCheck)) {
        return {
            isProhibited: true,
            category: 'PRESCRICAO_MEDICAMENTOSA',
            reason: 'Psicólogos não possuem competência legal para receitar fármacos, indicar dosagens ou ajustar medicamentos psiquiátricos (Art. 2º do Código de Ética).',
            suggestion: 'Remova a indicação de dosagem ou prescrição. Recomende sempre encaminhamento a médico psiquiatra.'
        };
    }

    // 1.3 Divulgação ou recomendação de concorrentes diretos da Yelo
    const competitorsRegex = /\b(?:zenklub|vittude|psicologia\s*viva|doctoralia|psitto|telavita|starbem|conexa\s*saude|e-?psicologo|guia\s*da\s*alma|psymeet)\b/i;
    if (competitorsRegex.test(textToCheck)) {
        return {
            isProhibited: true,
            category: 'DIVULGACAO_CONCORRENTES',
            reason: 'É expressamente proibida a promoção, divulgação, compartilhamento de links ou recomendação de plataformas, softwares e ferramentas concorrentes à Yelo.',
            suggestion: 'Concentre o tópico em discussões técnicas, condutas profissionais ou ferramentas neutras de gestão de consultório, sem citar plataformas concorrentes.'
        };
    }

    // 2. Análise Semântica Profunda com Gemini (Diretrizes de Convivência + Código de Ética)
    // Otimização de Performance: Comentários e réplicas cotidianas (< 250 caracteres)
    // que já passaram pelas heurísticas acima não necessitam de round-trip de 3 segundos para API de IA.
    if (!title && textToCheck.length < 250) {
        return { isProhibited: false };
    }

    if (!process.env.GEMINI_API_KEY) {
        return { isProhibited: false };
    }

    try {
        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        const prompt = `Você é o Moderador Ético e de Convivência da Comunidade Yelo Psi (fórum exclusivo de psicólogos clínicos regulamentados pelo CFP - Conselho Federal de Psicologia).
Sua missão é avaliar se o texto abaixo VIOLA AS REGRAS DA COMUNIDADE, DIRETRIZES DE CONVIVÊNCIA OU O CÓDIGO DE ÉTICA PROFISSIONAL para impedir a publicação.

TEXTO SUBMETIDO:
Título: "${title || ''}"
Categoria: "${category || 'Geral'}"
Conteúdo: "${content || ''}"

REGRAS DA COMUNIDADE - DIRETRIZES DE CONVIVÊNCIA (BARRAR SE VIOLAR QUALQUER UMA):
1. Respeito acima de tudo: Debates são bem-vindos; ataques pessoais, ofensas e desrespeito não serão tolerados. (Categoria: "RESPEITO_URBANIDADE")
2. Sigilo profissional é inegociável: Ao discutir casos clínicos, sempre anonimize completamente qualquer dado que possa identificar um paciente (nomes reais, telefones, endereços, detalhes ultraespecíficos). (Categoria: "SIGILO_PROFISSIONAL")
3. Conteúdo construtivo: Evite autopromoção direta e spam. O foco é a troca mútua de conhecimento técnico e suporte profissional. (Categoria: "SPAM_AUTOPROMOCAO")
4. Sem divulgação de concorrentes: É expressamente proibida a promoção, divulgação, compartilhamento de links ou recomendação de plataformas, softwares e ferramentas concorrentes à Yelo (ex: Zenklub, Vittude, Psicologia Viva, Doctoralia, etc.). (Categoria: "DIVULGACAO_CONCORRENTES")
5. Direitos Humanos: Discursos de ódio, discriminação de qualquer natureza ou violações éticas resultarão em remoção imediata e banimento. (Categoria: "DIREITOS_HUMANOS")

DIRETRIZES ADICIONAIS DO CÓDIGO DE ÉTICA (CFP):
6. Prescrição medicamentosa: Indicação ativa de remédios, dosagens ou ajuste de psicofármacos (ato privativo médico - CFP Art. 2º). (Categoria: "PRESCRICAO_MEDICAMENTOSA")
7. Práticas não científicas ou terapias de conversão sexual (Resolução CFP 01/99). (Categoria: "TERAPIA_REVERSAO")
8. Pirataria ou compartilhamento de testes privativos do SATEPSI. (Categoria: "TESTES_PSICOLOGICOS")
9. Autolesão ou incentivo ao suicídio. (Categoria: "AUTOEXTERMINIO")

REGRA DE BOM SENSO E LINKS DO FÓRUM:
- Links para outros tópicos ou discussões do próprio fórum da Yelo (ex: contendo 'postId', 'post=', 'psi_forum', 'psi_dashboard', 'yelopsi.com.br', 'localhost', IPs locais ou '#123') e menções/citações entre colegas NÃO SÃO SPAM NEM DIVULGAÇÃO DE CONCORRENTES. ELES DEVEM SER TOTALMENTE PERMITIDOS ("isProhibited": false).
- Comentários curtos, textos de teste, mensagens breves com links de discussão (ex: 'la la', 'veja esse post', 'olha isso', etc.), debates técnicos, discordâncias respeitosas de opiniões teóricas ou relatos devidamente anonimizados NÃO SÃO SPAM ("isProhibited": false). SPAM_AUTOPROMOCAO refere-se estritamente à venda comercial de cursos externos, produtos de terceiros ou links maliciosos fora da Yelo.

Responda ESTRITAMENTE em formato JSON puro, sem crases ou markdown:
{
  "isProhibited": true ou false,
  "category": "RESPEITO_URBANIDADE" | "SIGILO_PROFISSIONAL" | "SPAM_AUTOPROMOCAO" | "DIVULGACAO_CONCORRENTES" | "DIREITOS_HUMANOS" | "PRESCRICAO_MEDICAMENTOSA" | "TERAPIA_REVERSAO" | "TESTES_PSICOLOGICOS" | "AUTOEXTERMINIO" | "OUTRO" | null,
  "reason": "Explicação curta e educada em português do motivo da recusa (1 frase clara).",
  "suggestion": "Como o profissional pode corrigir para conseguir publicar (1 recomendação prática e acolhedora)."
}`;

        const text = await callGeminiWithFallback(genAI, prompt, safetySettings);
        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed && typeof parsed.isProhibited === 'boolean') {
            // Regra de segurança: menções/links a discussões internas do fórum Yelo NUNCA são considerados SPAM_AUTOPROMOCAO
            if (parsed.isProhibited && parsed.category === 'SPAM_AUTOPROMOCAO') {
                const hasForumLink = /(?:postId|post)=\d+|\/posts\/\d+|\/forum\/\d+|#\d+/i.test(textToCheck);
                if (hasForumLink) {
                    console.log('[ETHICS CHECK OVERRIDE] Comentário com link/menção interna do fórum liberado (não é spam de autopromoção).');
                    return { isProhibited: false };
                }
            }

            if (parsed.isProhibited) {
                console.warn('[ETHICS CHECK BLOCKED]', { category: parsed.category, reason: parsed.reason });
            }
            return parsed;
        }
        return { isProhibited: false };
    } catch (err) {
        console.warn('Erro ao avaliar ética com Gemini, liberando por fallback:', err.message);
        return { isProhibited: false };
    }
};

exports.createPost = async (req, res) => {
    try {
        if (req.user.status === 'pending') {
            return res.status(403).json({ error: 'Você precisa preencher seu CPF no perfil para liberar os 7 dias de teste e interagir no Fórum.' });
        }
        const { title, content, category, isAnonymous, forcePublish } = req.body;

        // --- BARREIRA ÉTICA COM IA (CFP / YELO) ---
        const ethicsCheck = await evaluateContentEthicsWithAI({ title, content, category });
        if (ethicsCheck.isProhibited) {
            return res.status(422).json({
                error: 'Publicação bloqueada pelas diretrizes éticas da comunidade.',
                reason: ethicsCheck.reason,
                suggestion: ethicsCheck.suggestion,
                category: ethicsCheck.category,
                code: 'ETHICS_VIOLATION'
            });
        }

        // --- PREVENÇÃO DETERMINÍSTICA DE DUPLICIDADE ---
        if (!forcePublish) {
            const dupCheck = await findDeterministicDuplicate(title);
            if (dupCheck.isDuplicate) {
                return res.status(409).json({
                    error: 'DUPLICATE_POST',
                    isDuplicate: true,
                    matchedPostId: dupCheck.matchedPostId,
                    matchedPostTitle: dupCheck.matchedPostTitle,
                    matchedPost: { id: dupCheck.matchedPostId, title: dupCheck.matchedPostTitle },
                    explanation: dupCheck.explanation
                });
            }
        }

        const post = await ForumPost.create({
            title, content, category, isAnonymous,
            PsychologistId: req.user.id
        });

        // --- GAMIFICATION HOOK ---
        gamificationService.processAction(req.user.id, 'forum_post').catch(err => console.error("Gamification hook error (createPost):", err));

        // --- NOTIFICATION HOOK ---
        notificationService.notifyNewPost(post, 'forum').catch(err => console.error("Notification hook error (createPost):", err));

        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar post' });
    }
};

exports.getPostDetails = async (req, res) => {
    try {
        const post = await ForumPost.findByPk(req.params.id, {
            include: [{ model: Psychologist, attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'] }]
        });
        
        if (!post) return res.status(404).json({ error: 'Post não encontrado' });
        
        const isAdmin = req.user && (req.user.isAdmin === true || req.user.role === 'admin' || req.user.type === 'admin');
        if ((post.status === 'hidden_by_admin' || post.status === 'deleted') && !isAdmin) {
            return res.status(404).json({ error: 'Post não encontrado ou indisponível.' });
        }

        const supported = await ForumVote.findOne({ 
            where: { ForumPostId: post.id, PsychologistId: req.user.id } 
        });

        let authorSlug = post.isAnonymous ? null : (post.Psychologist ? post.Psychologist.slug : null);
        if (post.Psychologist && !post.isAnonymous) {
            const agora = new Date();
            let isActive = post.Psychologist.status === 'active';
            const isVip = post.Psychologist.is_exempt === true || String(post.Psychologist.is_exempt).toLowerCase() === 'true' || post.Psychologist.is_exempt === 1;
            if (!isVip && (!post.Psychologist.planExpiresAt || new Date(post.Psychologist.planExpiresAt) <= agora)) {
                isActive = false;
            }
            if (!isActive) authorSlug = null;
        }

        let redirectPost = null;
        if (post.redirectPostId) {
            const rPost = await ForumPost.findByPk(post.redirectPostId, {
                attributes: ['id', 'title', 'category', 'votes']
            });
            if (rPost) {
                const rCount = await ForumComment.count({ where: { ForumPostId: rPost.id } }).catch(() => 0);
                redirectPost = {
                    id: rPost.id,
                    title: rPost.title,
                    category: rPost.category,
                    votes: rPost.votes,
                    commentCount: rCount
                };
            }
        }

        res.json({
            id: post.id,
            title: post.title,
            content: post.content,
            category: post.category,
            votes: post.votes,
            createdAt: post.createdAt,
            isAnonymous: post.isAnonymous,
            isPinned: post.isPinned,
            redirectPostId: post.redirectPostId || null,
            redirectPost: redirectPost,
            authorName: post.isAnonymous ? 'Anônimo' : (post.Psychologist ? post.Psychologist.nome : 'Usuário'),
            authorPhoto: post.isAnonymous ? null : (post.Psychologist ? post.Psychologist.fotoUrl : null),
            authorBadges: post.isAnonymous ? {} : (post.Psychologist ? post.Psychologist.badges : {}),
            authorLevel: post.isAnonymous ? null : (post.Psychologist ? post.Psychologist.authority_level : null),
            authorSlug: authorSlug,
            supportedByMe: !!supported,
            isMine: post.PsychologistId === req.user.id
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar post' });
    }
};

exports.getComments = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 3;
        const pageSize = req.query.pageSize ? parseInt(req.query.pageSize) : limit;
        const offset = (page - 1) * pageSize;

        // 1. Busca os comentários de nível superior (paginados)
        const topLevelComments = await ForumComment.findAll({
            where: { 
                ForumPostId: req.params.id,
                parentId: null 
            },
            include: [
                { model: Psychologist, attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'], required: false }
            ],
            order: [
                [db.Sequelize.literal('COALESCE("ForumComment"."isPinned", false)'), 'DESC'],
                ['likes', 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit,
            offset
        });

        const totalTopLevel = await ForumComment.count({ where: { ForumPostId: req.params.id, parentId: null } });
        res.set('X-Total-Count', totalTopLevel);

        const topLevelIds = topLevelComments.map(c => c.id);

        let allReplies = [];
        if (topLevelIds.length > 0) {
            // 2. Busca TODAS as respostas para o post
            allReplies = await ForumComment.findAll({
                where: {
                    ForumPostId: req.params.id,
                    parentId: { [Op.ne]: null }
                },
                include: [
                    { model: Psychologist, attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'], required: false }
                ]
            });
        }

        // 3. Busca todos os votos do usuário para esses comentários (top level e respostas)
        const allCommentIds = [...topLevelIds, ...allReplies.map(r => r.id)];
        let likedCommentIds = new Set();
        if (allCommentIds.length > 0 && ForumCommentVote) {
            const userVotes = await ForumCommentVote.findAll({
                where: {
                    ForumCommentId: { [Op.in]: allCommentIds },
                    PsychologistId: userId
                },
                attributes: ['ForumCommentId']
            });
            likedCommentIds = new Set(userVotes.map(v => v.ForumCommentId));
        }

        const agora = new Date();

        // 4. Função recursiva para mapear comentários e construir a árvore
        const processComment = (commentObj) => {
            const authorName = commentObj.isAnonymous ? 'Anônimo' : (commentObj.Psychologist ? commentObj.Psychologist.nome : 'Usuário Desconhecido');
            const authorPhoto = commentObj.isAnonymous ? null : (commentObj.Psychologist ? commentObj.Psychologist.fotoUrl : null);
            const authorBadges = commentObj.isAnonymous ? {} : commentObj.Psychologist?.badges;
            const authorLevel = commentObj.isAnonymous ? null : commentObj.Psychologist?.authority_level;
            
            let authorSlug = commentObj.isAnonymous ? null : commentObj.Psychologist?.slug;
            if (commentObj.Psychologist && !commentObj.isAnonymous) {
                let isActive = commentObj.Psychologist.status === 'active';
                const isVip = commentObj.Psychologist.is_exempt === true || String(commentObj.Psychologist.is_exempt).toLowerCase() === 'true' || commentObj.Psychologist.is_exempt === 1;
                if (!isVip && (!commentObj.Psychologist.planExpiresAt || new Date(commentObj.Psychologist.planExpiresAt) <= agora)) {
                    isActive = false;
                }
                if (!isActive) authorSlug = null;
            }

            // Pega as respostas diretas desse comentário
            const directReplies = allReplies.filter(r => r.parentId === commentObj.id);
            
            // Processa as respostas recursivamente
            let processedReplies = directReplies.map(r => processComment(r));
            
            // Ordena respostas por fixação, likes e data (mais recentes primeiro)
            processedReplies.sort((a, b) => {
                if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
                if (b.likes !== a.likes) return b.likes - a.likes;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            // Calcula o total de respostas (diretas + todas as aninhadas de forma recursiva)
            const totalRepliesCount = processedReplies.reduce((acc, curr) => acc + 1 + (curr.totalRepliesCount || 0), 0);

            return {
                id: commentObj.id,
                content: commentObj.content,
                createdAt: commentObj.createdAt,
                isAnonymous: commentObj.isAnonymous,
                isPinned: Boolean(commentObj.isPinned),
                authorName: authorName,
                authorPhoto: authorPhoto,
                authorBadges: authorBadges,
                authorLevel: authorLevel,
                authorSlug: authorSlug,
                likes: commentObj.likes || 0,
                likedByMe: likedCommentIds.has(commentObj.id),
                isMine: commentObj.PsychologistId === userId,
                parentId: commentObj.parentId || null,
                replies: processedReplies,
                totalRepliesCount: totalRepliesCount
            };
        };

        // 5. Monta o resultado final processando os comentários de nível superior
        const data = topLevelComments.map(c => processComment(c));
        
        res.json(data);
    } catch (error) {
        console.error("Erro em getComments:", error);
        res.status(500).json({ error: 'Erro ao carregar comentários' });
    }
};

exports.createComment = async (req, res) => {
    try {
        if (req.user.status === 'pending') {
            return res.status(403).json({ error: 'Você precisa preencher seu CPF no perfil para liberar os 7 dias de teste e interagir no Fórum.' });
        }

        const post = await ForumPost.findByPk(req.params.id); // BOLA-Safe: Validação de post público da comunidade
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
        if (post.redirectPostId) {
            return res.status(400).json({ 
                error: 'Esta discussão foi redirecionada para um tópico oficial. Novos comentários devem ser feitos no tópico principal.',
                redirectPostId: post.redirectPostId
            });
        }
        if (post.status === 'archived' || post.status === 'hidden_by_admin' || post.status === 'deleted') {
            return res.status(403).json({ error: 'Esta discussão está encerrada para novos comentários.' });
        }

        const { content, isAnonymous, parentId } = req.body; // Adiciona parentId

        // --- BARREIRA ÉTICA COM IA (CFP / YELO) ---
        const ethicsCheck = await evaluateContentEthicsWithAI({ title: '', content, category: '' });
        if (ethicsCheck.isProhibited) {
            return res.status(422).json({
                error: 'Comentário bloqueado pelas diretrizes éticas da comunidade.',
                reason: ethicsCheck.reason,
                suggestion: ethicsCheck.suggestion,
                category: ethicsCheck.category,
                code: 'ETHICS_VIOLATION'
            });
        }

        const comment = await ForumComment.create({
            content, isAnonymous,
            ForumPostId: req.params.id,
            parentId: parentId || null, // Salva o ID do comentário pai, se houver
            PsychologistId: req.user.id
        });
        
        // --- GAMIFICATION HOOK ---
        // Responder Pergunta (20 pts, max 5/dia)
        gamificationService.processAction(req.user.id, 'forum_reply').catch(err => console.error("Gamification hook error:", err));

        // --- INÍCIO: SISTEMA DE NOTIFICAÇÕES E MENÇÕES (ROBUSTO COM ORM) ---
        console.log(`\n--- [NOTIF DEBUG] INICIANDO FLUXO DE NOTIFICAÇÃO ---`);
        console.log(`[NOTIF DEBUG] Comentário criado por: ${req.user.id} | isReply: ${!!parentId}`);        
        
        (async () => {
            try {
                // 1. Busca o remetente
                const senderUser = await db.Psychologist.findByPk(req.user.id);
                const senderName = isAnonymous ? 'Um colega (Anônimo)' : (senderUser ? senderUser.nome : 'Um colega');

                const frontendUrl = process.env.FRONTEND_URL || 'https://www.yelopsi.com.br';
                let targetId = null;
                let notifTitle = '';
                let notifContent = '';
                let postTitle = 'Tópico';

                // 2. Descobre o alvo
                if (parentId) {
                    console.log(`[NOTIF DEBUG] Buscando dono do comentário pai ID: ${parentId}`);
                    const parentComment = await db.ForumComment.findByPk(parentId);
                    
                    if (parentComment) {
                        targetId = parentComment.PsychologistId || parentComment.psychologistId;
                        notifTitle = 'Nova resposta ao seu comentário!';
                        notifContent = `<strong>${senderName}</strong> respondeu ao seu comentário no fórum da Yelo:<br><br><em>"${content.substring(0, 100)}..."</em><br><br><a href="#" class="aviso-link-direto" data-post-id="${req.params.id}" data-comment-id="${comment.id}" onclick="window.loadPage('psi_forum.html?postId=${req.params.id}&commentId=${comment.id}'); return false;" style="color: #1B4332; font-weight: bold; text-decoration: underline;">Clique aqui para acessar o fórum</a>.`;
                    }
                } else {
                    console.log(`[NOTIF DEBUG] Buscando post original ID: ${req.params.id}`);
                    const postInfo = await db.ForumPost.findByPk(req.params.id);
                    
                    if (postInfo) {
                        targetId = postInfo.PsychologistId || postInfo.psychologistId;
                        postTitle = postInfo.title || postInfo.titulo || 'Tópico';
                        notifTitle = 'Nova resposta na sua discussão!';
                        notifContent = `<strong>${senderName}</strong> respondeu ao seu tópico "<strong>${postTitle}</strong>":<br><br><em>"${content.substring(0, 100)}..."</em><br><br><a href="#" class="aviso-link-direto" data-post-id="${req.params.id}" data-comment-id="${comment.id}" onclick="window.loadPage('psi_forum.html?postId=${req.params.id}&commentId=${comment.id}'); return false;" style="color: #1B4332; font-weight: bold; text-decoration: underline;">Clique aqui para acessar a discussão</a>.`;
                    }
                }

                // 3. Se temos alvo e não for auto-resposta
                if (targetId && String(targetId) !== String(req.user.id)) {
                    console.log(`[NOTIF DEBUG] Alvo encontrado: ${targetId}. Inserindo aviso...`);
                    
                    try {
                        const novoAviso = await db.Aviso.create({
                            title: notifTitle,
                            content: notifContent,
                            author: 'Comunidade Yelo',
                            status: 'published',
                            psychologistId: targetId
                        });
                        console.log(`[NOTIF DEBUG] Aviso INSERIDO COM SUCESSO! ID:`, novoAviso.id);
                    } catch (ormErr) {
                        console.error(`[NOTIF DEBUG] Erro ao criar aviso no banco:`, ormErr);
                    }

                    // 4. Busca alvo para e-mail
                    const targetUser = await db.Psychologist.findByPk(targetId);

                    if (targetUser && targetUser.email) {
                        if (emailService && emailService.sendForumReplyEmail) {
                            await emailService.sendForumReplyEmail(targetUser, senderName, content, req.params.id).catch(e => console.error("Erro ao enviar email:", e));
                            console.log(`[NOTIF DEBUG] E-mail de notificação editorial enviado para: ${targetUser.email}`);
                        }
                    }
                } else {
                    console.log(`[NOTIF DEBUG] Notificação ignorada (Auto-resposta ou alvo não encontrado).`);
                }
            } catch (notifyErr) {
                console.error("Erro FATAL ao processar notificações do Fórum:", notifyErr);
            }
        })();
        // --- FIM: SISTEMA DE NOTIFICAÇÕES E MENÇÕES ---

        // Retorna dados formatados para o frontend adicionar na lista imediatamente
        const user = await Psychologist.findByPk(req.user.id);
        res.json({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            isAnonymous: comment.isAnonymous,
            authorName: comment.isAnonymous ? 'Anônimo' : user.nome,
            authorPhoto: comment.isAnonymous ? null : user.fotoUrl,
            likes: 0, // Novo comentário começa com 0 likes
            isMine: true
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao comentar' });
    }
};

exports.toggleVote = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        const existingVote = await ForumVote.findOne({ where: { ForumPostId: postId, PsychologistId: userId } });
        const post = await ForumPost.findByPk(postId);

        if (existingVote) {
            await existingVote.destroy();
            post.votes -= 1;
            
            // --- GAMIFICATION ROLLBACK: REMOVER LIKE ---
            if (post.PsychologistId !== userId) {
                gamificationService.rollbackAction(post.PsychologistId, 'receive_like').catch(e => console.error(e));
            }
        } else {
            await ForumVote.create({ ForumPostId: postId, PsychologistId: userId });
            post.votes += 1;
        }
        await post.save();

        // --- GAMIFICATION: RECEBER LIKE (5 pts) ---
        // Se foi um like (não deslike) e não é auto-like
        if (!existingVote && post.PsychologistId !== userId) {
            gamificationService.processAction(post.PsychologistId, 'receive_like').catch(e => console.error(e));
        }

        res.json({ votes: post.votes });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao votar' });
    }
};

exports.toggleCommentVote = async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;

        const existingVote = await ForumCommentVote.findOne({ where: { ForumCommentId: commentId, PsychologistId: userId } });
        const comment = await ForumComment.findByPk(commentId);

        if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });

        if (existingVote) {
            await existingVote.destroy();
            comment.likes -= 1;

            // --- GAMIFICATION ROLLBACK: REMOVER LIKE EM COMENTÁRIO ---
            if (comment.PsychologistId !== userId) {
                gamificationService.rollbackAction(comment.PsychologistId, 'receive_like').catch(e => console.error(e));
            }
        } else {
            await ForumCommentVote.create({ ForumCommentId: commentId, PsychologistId: userId });
            comment.likes += 1;
        }
        await comment.save();

        // --- GAMIFICATION: RECEBER LIKE EM COMENTÁRIO (5 pts) ---
        if (!existingVote && comment.PsychologistId !== userId) {
            gamificationService.processAction(comment.PsychologistId, 'receive_like').catch(e => console.error(e));
        }

        res.json({ likes: comment.likes });
    } catch (error) {
        console.error("Erro ao votar no comentário:", error);
        res.status(500).json({ error: 'Erro ao votar no comentário' });
    }
};

exports.reportContent = async (req, res) => {
    try {
        const { type, id } = req.body;
        await ForumReport.create({
            type,
            itemId: id,
            reporterId: req.user.id
        });
        res.json({ message: 'Denúncia recebida.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao salvar denúncia.' });
    }
};

exports.deletePost = async (req, res) => {
    try {
        const post = await ForumPost.findByPk(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado' });
        
        const isAdmin = req.user && (
            req.user.isAdmin === true || 
            req.user.role === 'admin' || 
            req.user.type === 'admin' || 
            req.user.email === 'pix@yelopsi.com.br'
        );
        if (post.PsychologistId !== req.user.id && !isAdmin) {
            return res.status(403).json({ error: 'Você não tem permissão para excluir este post.' });
        }
        
        await post.destroy();

        if (db.Aviso) {
            await db.Aviso.destroy({
                where: {
                    content: {
                        [Op.or]: [
                            { [Op.like]: `%data-post-id="${req.params.id}"%` },
                            { [Op.like]: `%postId=${req.params.id}%` }
                        ]
                    }
                }
            }).catch(err => console.error("Erro ao remover avisos do post excluído:", err));
        }

        // --- GAMIFICATION ROLLBACK ---
        let pointsDeducted = 0;
        try {
            const rollbackResult = await gamificationService.rollbackAction(req.user.id, 'forum_post');
            if (rollbackResult && rollbackResult.pointsDeducted) {
                pointsDeducted = rollbackResult.pointsDeducted;
            }
        } catch (err) {
            console.error("Gamification rollback error:", err);
        }

        res.json({ message: 'Post excluído com sucesso.', pointsDeducted });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir post' });
    }
};

exports.deleteComment = async (req, res) => {
    try {
        const comment = await ForumComment.findByPk(req.params.id);
        if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
        
        if (comment.PsychologistId !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para excluir este comentário.' });
        }
        
        await comment.destroy();

        // --- GAMIFICATION ROLLBACK ---
        let pointsDeducted = 0;
        try {
            const rollbackResult = await gamificationService.rollbackAction(req.user.id, 'forum_reply');
            if (rollbackResult && rollbackResult.pointsDeducted) {
                pointsDeducted = rollbackResult.pointsDeducted;
            }
        } catch (err) {
            console.error("Gamification rollback error:", err);
        }

        res.json({ message: 'Comentário excluído com sucesso.', pointsDeducted });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao excluir comentário' });
    }
};

exports.updatePost = async (req, res) => {
    try {
        const { title, content, category, isAnonymous } = req.body;
        const post = await ForumPost.findByPk(req.params.id);

        if (!post) return res.status(404).json({ error: 'Post não encontrado' });

        if (post.PsychologistId !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para editar este post.' });
        }

        // --- BARREIRA ÉTICA COM IA (CFP / YELO) ---
        const ethicsCheck = await evaluateContentEthicsWithAI({ title, content, category });
        if (ethicsCheck.isProhibited) {
            return res.status(422).json({
                error: 'Alteração bloqueada pelas diretrizes éticas da comunidade.',
                reason: ethicsCheck.reason,
                suggestion: ethicsCheck.suggestion,
                category: ethicsCheck.category,
                code: 'ETHICS_VIOLATION'
            });
        }

        await post.update({ title, content, category, isAnonymous });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar post' });
    }
};

exports.updateComment = async (req, res) => {
    try {
        const { content } = req.body;
        const comment = await ForumComment.findByPk(req.params.id);

        if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });

        if (comment.PsychologistId !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para editar este comentário.' });
        }

        const post = await ForumPost.findByPk(comment.ForumPostId);
        if (post) {
            if (post.redirectPostId || post.isClosed || post.status === 'archived' || post.status === 'hidden_by_admin' || post.status === 'deleted' || post.status === 'closed' || post.status === 'encerrada') {
                return res.status(403).json({ error: 'Esta discussão está encerrada para edições.' });
            }
        }

        // --- BARREIRA ÉTICA COM IA (CFP / YELO) ---
        const ethicsCheck = await evaluateContentEthicsWithAI({ title: '', content, category: '' });
        if (ethicsCheck.isProhibited) {
            return res.status(422).json({
                error: 'Edição bloqueada pelas diretrizes éticas da comunidade.',
                reason: ethicsCheck.reason,
                suggestion: ethicsCheck.suggestion,
                category: ethicsCheck.category,
                code: 'ETHICS_VIOLATION'
            });
        }

        await comment.update({ content });
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar comentário' });
    }
};

// --- ÁREA ADMINISTRATIVA ---

exports.getReports = async (req, res) => {
    try {
        // Busca denúncias pendentes
        const reports = await ForumReport.findAll({
            where: { status: 'pending' },
            include: [{ model: Psychologist, as: 'Reporter', attributes: ['nome', 'email'] }],
            order: [['createdAt', 'DESC']]
        });

        // Enriquece os dados com o conteúdo original (Post ou Comentário)
        const enrichedReports = await Promise.all(reports.map(async (r) => {
            let content = null;
            if (r.type === 'post') {
                content = await ForumPost.findByPk(r.itemId, { include: [{ model: Psychologist, attributes: ['nome', 'email'] }] });
            } else {
                content = await ForumComment.findByPk(r.itemId, { include: [{ model: Psychologist, attributes: ['nome', 'email'] }] });
            }
            
            return {
                id: r.id,
                type: r.type,
                itemId: r.itemId,
                createdAt: r.createdAt,
                reporter: r.Reporter,
                content: content ? content : { content: '[Conteúdo deletado ou não encontrado]', Psychologist: { nome: 'Desconhecido' } }
            };
        }));

        res.json(enrichedReports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar denúncias.' });
    }
};

exports.resolveReport = async (req, res) => {
    try {
        const { action } = req.body; // 'delete_content' ou 'dismiss'
        const report = await ForumReport.findByPk(req.params.id); // BOLA-Safe: Rota protegida por middleware admin

        if (!report) return res.status(404).json({ error: 'Denúncia não encontrada' });

        if (action === 'delete_content') {
            if (report.type === 'post') {
                const post = await ForumPost.findByPk(report.itemId);
                if (post) {
                    const psiId = post.PsychologistId;
                    await post.destroy();
                    // --- GAMIFICATION ROLLBACK (Admin Deletou) ---
                    gamificationService.rollbackAction(psiId, 'forum_post').catch(e => console.error(e));
                }
            } else {
                const comment = await ForumComment.findByPk(report.itemId);
                if (comment) {
                    const psiId = comment.PsychologistId;
                    await comment.destroy();
                    // --- GAMIFICATION ROLLBACK (Admin Deletou) ---
                    gamificationService.rollbackAction(psiId, 'forum_reply').catch(e => console.error(e));
                }
            }
        }

        report.status = action === 'delete_content' ? 'resolved_deleted' : 'dismissed';
        await report.save();

        res.json({ message: 'Ação realizada com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao moderar.' });
    }
};

exports.generateAiComment = async (req, res) => {
    try {
        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
        
        // Verifica se o usuário é admin
        const psychologistId = req.user.id;
        const psychologist = await Psychologist.findByPk(psychologistId);
        
        if (!psychologist) {
            return res.status(403).json({ error: 'Acesso negado. Usuário não encontrado.' });
        }
        
        const isAuthorized = psychologist.isAdmin || psychologist.email === 'pix@yelopsi.com.br' || psychologist.email === 'pix@yeloposi.com.br';
        
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem gerar comentários com IA.' });
        }

        const { postTitle, postContent, comments, targetComment, authorName } = req.body;

        if (!postTitle && !postContent) {
            return res.status(400).json({ error: 'Conteúdo do post é obrigatório.' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Chave da API do Gemini não configurada.' });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-3.1-flash-lite",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        });

        let prompt = "";
        
        const primeiroNome = authorName ? authorName.split(' ')[0] : "colega";

        if (targetComment) {
            prompt = `Você é um psicólogo clínico homem, de 35 anos, com base na psicanálise, engajando no fórum da comunidade Yelo. Sua comunicação é leve, acolhedora, humana e natural (nada engessado, acadêmico ou excessivamente formal). Não seja didático e não tente ensinar as pessoas; o objetivo é trocar experiências de igual para igual.

Você está conversando DIRETAMENTE com o colega chamado ${primeiroNome}, que escreveu este comentário:
"${targetComment}"

Contexto do post onde isso ocorreu:
Título: ${postTitle || 'Sem título'}
Conteúdo: ${postContent || ''}

Sua tarefa: Escreva uma resposta curta (metade do tamanho de uma resposta normal), direta e exclusiva para ${primeiroNome}. Valide o que a pessoa disse, traga uma contribuição rápida a partir da sua vivência clínica e termine de forma empática. Use o nome da pessoa na resposta de forma natural. Não fale com o resto do grupo.
Retorne SOMENTE a resposta, sem aspas e sem enrolação.`;
        } else {
            prompt = `Você é um psicólogo clínico homem, de 35 anos, com base na psicanálise, engajando no fórum da comunidade Yelo. Sua comunicação é leve, acolhedora, humana e natural (nada engessado, acadêmico ou excessivamente formal). Não seja didático e não tente ensinar as pessoas; o objetivo é trocar experiências de igual para igual.

Você está conversando DIRETAMENTE e EXCLUSIVAMENTE com o autor deste post, chamado ${primeiroNome}:
Título: ${postTitle || 'Sem título'}
Conteúdo: ${postContent || ''}

Comentários já feitos na thread (apenas para seu contexto):
${comments || 'Nenhum comentário ainda.'}

Sua tarefa: Escreva um comentário curto (metade do tamanho de um texto padrão), em tom de conversa direta e exclusiva com ${primeiroNome}. Traga uma validação rápida e uma reflexão leve e acolhedora baseada na sua vivência clínica. Use o nome da pessoa na resposta de forma natural. Não se dirija ao resto da discussão.
Retorne SOMENTE a resposta, sem aspas e sem enrolação.`;
        }

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        res.status(200).json({ generatedText: responseText.trim() });
    } catch (error) {
        console.error('Erro ao gerar comentário com IA:', error);
        res.status(500).json({ error: 'Erro interno ao gerar comentário.' });
    }
};

/**
 * Rota: PUT /api/forum/comments/:id/pin
 * Descrição: Fixa ou desafixa um comentário de um post no fórum.
 * Acesso exclusivo: Administrador ou pix@yelopsi.com.br
 */
exports.togglePinComment = async (req, res) => {
    try {
        const userId = req.user.id;
        const psychologist = await Psychologist.findByPk(userId);
        
        if (!psychologist) {
            return res.status(403).json({ error: 'Acesso negado. Usuário não encontrado.' });
        }

        const isAuthorized = psychologist.isAdmin || psychologist.email === 'pix@yelopsi.com.br' || psychologist.email === 'pix@yeloposi.com.br';
        if (!isAuthorized) {
            return res.status(403).json({ error: 'Acesso negado. Apenas o administrador pode fixar comentários.' });
        }

        const comment = await ForumComment.findByPk(req.params.id); // BOLA-Safe: ação administrativa restrita
        if (!comment) {
            return res.status(404).json({ error: 'Comentário não encontrado.' });
        }

        const targetPinned = req.body && typeof req.body.isPinned === 'boolean'
            ? req.body.isPinned
            : !comment.isPinned;

        if (targetPinned) {
            // Ao fixar um comentário, desfixa qualquer outro comentário do mesmo post para manter o destaque único
            await ForumComment.update(
                { isPinned: false },
                { where: { ForumPostId: comment.ForumPostId, isPinned: true } }
            );
        }

        await comment.update({ isPinned: targetPinned });

        const message = targetPinned ? 'Comentário fixado no topo com sucesso!' : 'Comentário desfixado com sucesso!';
        res.json({
            message,
            isPinned: targetPinned,
            commentId: comment.id,
            postId: comment.ForumPostId
        });
    } catch (error) {
        console.error('Erro ao fixar/desafixar comentário do fórum:', error);
        res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
    }
};

/**
 * Busca rápida de tópicos semelhantes (Instant Search)
 * Rota: GET /api/forum/posts/search-similar
 */
exports.searchSimilarPosts = async (req, res) => {
    try {
        const { q, category, excludeId } = req.query;
        const rawQuery = (q || '').trim();

        const baseWhere = [
            {
                [Op.or]: [
                    { status: null },
                    { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted'] } }
                ]
            }
        ];

        if (excludeId) {
            const exId = parseInt(excludeId, 10);
            if (!isNaN(exId) && exId > 0) {
                baseWhere.push({ id: { [Op.ne]: exId } });
            }
        }

        // Se query vazia (ex: abertura do modal de vincular/redirecionar):
        // Retorna tópicos ativos mais recentes para seleção imediata
        if (!rawQuery) {
            const recentPosts = await ForumPost.findAll({
                where: { [Op.and]: baseWhere },
                attributes: [
                    'id', 'title', 'category', 'votes', 'createdAt',
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('ForumComments.id'))), 'commentCount']
                ],
                include: [{ model: ForumComment, attributes: [], required: false }],
                group: ['ForumPost.id'],
                order: [['createdAt', 'DESC']],
                limit: 15,
                subQuery: false
            });

            return res.json({
                posts: recentPosts.map(p => ({
                    id: p.id,
                    title: p.title,
                    category: p.category,
                    votes: p.votes,
                    commentCount: parseInt(p.get('commentCount') || 0, 10),
                    createdAt: p.createdAt
                }))
            });
        }

        // 1. Checa se o usuário colou URL ou digitou ID diretamente
        let targetId = null;
        const urlIdMatch = rawQuery.match(/(?:postId|post)[=:_](\d+)/i) || rawQuery.match(/(?:#|@)(\d+)/) || rawQuery.match(/\/(\d+)$/);
        if (urlIdMatch) {
            targetId = parseInt(urlIdMatch[1], 10);
        } else {
            const cleanId = rawQuery.replace(/^[#@]/, '').trim();
            const numId = parseInt(cleanId, 10);
            if (!isNaN(numId) && numId > 0 && String(numId) === cleanId) {
                targetId = numId;
            }
        }

        if (targetId) {
            const byIdWhere = [...baseWhere, { id: targetId }];
            const idPost = await ForumPost.findOne({
                where: { [Op.and]: byIdWhere },
                attributes: [
                    'id', 'title', 'category', 'votes', 'createdAt',
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('ForumComments.id'))), 'commentCount']
                ],
                include: [{ model: ForumComment, attributes: [], required: false }],
                group: ['ForumPost.id'],
                subQuery: false
            });

            if (idPost) {
                return res.json({
                    posts: [{
                        id: idPost.id,
                        title: idPost.title,
                        category: idPost.category,
                        votes: idPost.votes,
                        commentCount: parseInt(idPost.get('commentCount') || 0, 10),
                        createdAt: idPost.createdAt
                    }]
                });
            }
        }

        // 2. Extração de termos significativos (sem stopwords genéricas como "vocês", "como", "dúvida")
        const meaningfulTerms = extractKeywords(rawQuery);

        // Se o usuário digitou apenas stopwords genéricas (ex: "como vocês", "dúvida sobre"),
        // não busca nem retorna tópicos aleatórios
        if (meaningfulTerms.length === 0 && rawQuery.length < 6) {
            return res.json({ posts: [] });
        }

        const termsToSearch = meaningfulTerms.length > 0
            ? meaningfulTerms
            : rawQuery.toLowerCase().split(/\s+/).filter(t => t.length >= 3);

        const orClauses = [];

        // Padrão da frase completa
        const cleanPhrase = rawQuery.replace(/[^\w\sáéíóúâêîôûãõç]/gi, ' ').trim();
        const fullPattern = toAccentRegex(cleanPhrase);
        if (fullPattern && cleanPhrase.length >= 4) {
            orClauses.push(db.Sequelize.literal(`"ForumPost"."title" ~* '${fullPattern.replace(/'/g, "''")}'`));
            orClauses.push(db.Sequelize.literal(`"ForumPost"."content" ~* '${fullPattern.replace(/'/g, "''")}'`));
        }

        // Padrão apenas dos termos significativos
        termsToSearch.forEach(term => {
            const p = toAccentRegex(term);
            if (p && term.length >= 2) {
                orClauses.push(db.Sequelize.literal(`"ForumPost"."title" ~* '${p.replace(/'/g, "''")}'`));
                orClauses.push(db.Sequelize.literal(`"ForumPost"."content" ~* '${p.replace(/'/g, "''")}'`));
            }
        });

        // Fallback ILIKE padrão se houver termos
        if (rawQuery.length >= 4) {
            orClauses.push({ title: { [Op.iLike]: `%${rawQuery}%` } });
        }

        if (orClauses.length === 0) {
            return res.json({ posts: [] });
        }

        const searchWhere = [...baseWhere, { [Op.or]: orClauses }];

        const posts = await ForumPost.findAll({
            where: { [Op.and]: searchWhere },
            attributes: [
                'id', 'title', 'category', 'votes', 'createdAt',
                [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('ForumComments.id'))), 'commentCount']
            ],
            include: [{ model: ForumComment, attributes: [], required: false }],
            group: ['ForumPost.id'],
            subQuery: false,
            limit: 30
        });

        // 3. Ranqueamento inteligente baseado em RELEVÂNCIA (e não em votos)
        const RELEVANCE_THRESHOLD = 0.20;
        const scored = posts.map(p => {
            const titleSim = calculateTitleSimilarity(rawQuery, p.title);
            const postKeywords = new Set(extractKeywords(p.title));

            let titleMatches = 0;
            termsToSearch.forEach(k => {
                if (postKeywords.has(k)) titleMatches++;
            });
            const titleMatchRatio = termsToSearch.length > 0 ? (titleMatches / termsToSearch.length) : 0;

            // Score prioriza forte semelhança de título e correspondência de palavras-chave
            let score = Math.max(titleSim, titleMatchRatio * 0.75);

            // Bônus se a categoria coincide
            if (category && p.category === category) {
                score += 0.05;
            }

            // Votos servem apenas como micro critério de desempate
            score += Math.min((p.votes || 0) * 0.0002, 0.02);

            return {
                post: p,
                score
            };
        });

        // Filtra os que não atingiram o limite mínimo de relevância
        const relevant = scored
            .filter(item => item.score >= RELEVANCE_THRESHOLD)
            .sort((a, b) => b.score - a.score);

        const resultList = relevant.slice(0, 6).map(item => {
            const p = item.post;
            return {
                id: p.id,
                title: p.title,
                category: p.category,
                votes: p.votes,
                commentCount: parseInt(p.get('commentCount') || 0, 10),
                createdAt: p.createdAt,
                similarity: Math.round(item.score * 100)
            };
        });

        res.json({ posts: resultList });
    } catch (error) {
        console.error('Erro em searchSimilarPosts:', error);
        res.status(500).json({ error: 'Erro ao buscar tópicos semelhantes.' });
    }
};

/**
 * Retorna dados resumidos de um post para Card de Citação
 * Rota: GET /api/forum/posts/:id/snippet
 */
exports.getPostSnippet = async (req, res) => {
    try {
        const post = await ForumPost.findByPk(req.params.id, {
            attributes: ['id', 'title', 'category', 'votes', 'createdAt', 'status', 'isAnonymous'],
            include: [{
                model: Psychologist,
                attributes: ['id', 'nome']
            }]
        });

        if (!post || post.status === 'hidden_by_admin' || post.status === 'deleted') {
            return res.status(404).json({ error: 'Post não encontrado ou indisponível.' });
        }

        const commentCount = await ForumComment.count({
            where: { ForumPostId: post.id }
        }).catch(() => 0);

        const authorName = post.isAnonymous ? 'Anônimo' : (post.Psychologist?.nome ? post.Psychologist.nome.split(' ')[0] : 'Colega');

        res.json({
            id: post.id,
            title: post.title,
            category: post.category,
            votes: post.votes,
            commentCount,
            authorName,
            createdAt: post.createdAt
        });
    } catch (error) {
        console.error('Erro em getPostSnippet:', error);
        res.status(500).json({ error: 'Erro ao obter dados do post.' });
    }
};

/**
 * Vincula ou desvincula redirecionamento de tópico oficial
 * Rota: PUT /api/forum/posts/:id/redirect
 */
exports.setPostRedirect = async (req, res) => {
    try {
        const postId = req.params.id;
        const { redirectPostId } = req.body;

        const post = await ForumPost.findByPk(postId);
        if (!post) {
            return res.status(404).json({ error: 'Post não encontrado.' });
        }

        // Autorização: Autor do post OU Administrador
        const isAuthor = post.PsychologistId === req.user.id;
        const isAdmin = req.user && (req.user.isAdmin === true || req.user.role === 'admin' || req.user.email === 'pix@yelopsi.com.br');

        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: 'Acesso negado. Apenas o autor ou o administrador podem redirecionar este tópico.' });
        }

        let targetPostData = null;
        if (redirectPostId) {
            const targetId = parseInt(redirectPostId, 10);
            if (targetId === post.id) {
                return res.status(400).json({ error: 'Um tópico não pode ser redirecionado para ele mesmo.' });
            }

            const targetPost = await ForumPost.findByPk(targetId, {
                attributes: ['id', 'title', 'category']
            });

            if (!targetPost || targetPost.status === 'hidden_by_admin' || targetPost.status === 'deleted') {
                return res.status(404).json({ error: 'O tópico de destino não foi encontrado ou está inativo.' });
            }

            post.redirectPostId = targetId;
            targetPostData = {
                id: targetPost.id,
                title: targetPost.title,
                category: targetPost.category
            };
        } else {
            post.redirectPostId = null;
        }

        await post.save();

        res.json({
            success: true,
            message: post.redirectPostId ? 'Tópico vinculado com sucesso!' : 'Vínculo de redirecionamento removido.',
            redirectPostId: post.redirectPostId,
            redirectPost: targetPostData
        });
    } catch (error) {
        console.error('Erro em setPostRedirect:', error);
        res.status(500).json({ error: 'Erro ao atualizar redirecionamento do tópico.' });
    }
};

/**
 * Análise Semântica de Duplicidade com IA (Gemini)
 * Rota: POST /api/forum/posts/check-duplicate-ai
 */
exports.checkDuplicateAi = async (req, res) => {
    try {
        const { title, content, category } = req.body;
        if (!title || title.trim().length < 5) {
            return res.json({ isDuplicate: false, isProhibited: false });
        }

        // 1. CHECAGEM ÉTICA COM IA ANTES DE QUALQUER OUTRA AÇÃO:
        const ethicsCheck = await evaluateContentEthicsWithAI({ title, content, category });
        if (ethicsCheck.isProhibited) {
            return res.json({
                isProhibited: true,
                isDuplicate: false,
                category: ethicsCheck.category,
                reason: ethicsCheck.reason,
                suggestion: ethicsCheck.suggestion
            });
        }

        // 2. DETECÇÃO DETERMINÍSTICA RÁPIDA (100% confiável para títulos iguais ou muito similares):
        const deterministicMatch = await findDeterministicDuplicate(title);
        if (deterministicMatch.isDuplicate) {
            return res.json({
                isProhibited: false,
                isDuplicate: true,
                matchedPost: {
                    id: deterministicMatch.matchedPostId,
                    title: deterministicMatch.matchedPostTitle
                },
                matchedPostId: deterministicMatch.matchedPostId,
                matchedPostTitle: deterministicMatch.matchedPostTitle,
                explanation: deterministicMatch.explanation
            });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.json({ isDuplicate: false, isProhibited: false, reason: 'AI_KEY_NOT_CONFIGURED' });
        }

        // 3. SELEÇÃO INTELIGENTE DE CANDIDATOS (Palavras-chave do título + Recentes)
        const baseWhere = {
            [Op.or]: [
                { status: null },
                { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted'] } }
            ]
        };

        const titleKeywords = extractKeywords(title);
        const keywordOrClauses = [];
        titleKeywords.forEach(kw => {
            const p = toAccentRegex(kw);
            if (p) {
                keywordOrClauses.push(db.Sequelize.literal(`"ForumPost"."title" ~* '${p.replace(/'/g, "''")}'`));
            }
        });

        let candidatePosts = [];
        if (keywordOrClauses.length > 0) {
            candidatePosts = await ForumPost.findAll({
                where: {
                    [Op.and]: [baseWhere, { [Op.or]: keywordOrClauses }]
                },
                attributes: ['id', 'title', 'category', 'content'],
                limit: 10
            });
        }

        // Completa com os mais populares/recentes
        const candidateIds = new Set(candidatePosts.map(p => p.id));
        const recentPosts = await ForumPost.findAll({
            where: baseWhere,
            attributes: ['id', 'title', 'category', 'content'],
            order: [
                ['votes', 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit: 12
        });

        recentPosts.forEach(p => {
            if (!candidateIds.has(p.id) && candidatePosts.length < 15) {
                candidatePosts.push(p);
                candidateIds.add(p.id);
            }
        });

        if (!candidatePosts || candidatePosts.length === 0) {
            return res.json({ isDuplicate: false, isProhibited: false });
        }

        const candidateTopics = candidatePosts.map(p => {
            const shortContent = (p.content || '').replace(/\s+/g, ' ').substring(0, 140);
            return `[ID: ${p.id}] Título: "${p.title}" | Categoria: "${p.category}" | Resumo: "${shortContent}..."`;
        }).join('\n');

        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ];

        const prompt = `Você é um moderador da comunidade Yelo de psicólogos clínicos.
Sua função é verificar se uma nova discussão que o usuário quer criar já aborda O MESMO TEMA CENTRAL de um tópico já existente, para evitar discussões duplicadas.

NOVO POST QUE O PSICÓLOGO QUER CRIAR:
- Título: "${title}"
- Categoria: "${category || 'Geral'}"
- Conteúdo: "${content || ''}"

TÓPICOS JÁ EXISTENTES NA COMUNIDADE:
${candidateTopics}

CRITÉRIO DE AVALIAÇÃO:
- "isDuplicate": true se a dúvida central, dilema ético, caso ou questão burocrática for essencialmente o mesmo de algum dos tópicos listados.
- Se for um tema correlato com foco ou nuances claramente diferentes, responda "isDuplicate": false.
- A explicação deve ser amigável, gentil e acolhedora em português (1 frase curta).

Responda ESTRITAMENTE em formato JSON puro, sem blocos de código markdown ou texto extra:
{
  "isDuplicate": true,
  "matchedPostId": 42,
  "matchedPostTitle": "Título do post existente",
  "explanation": "Uma frase cordial explicando porque este post já trata desse tema."
}`;

        const text = await callGeminiWithFallback(genAI, prompt, safetySettings);
        
        let parsed = null;
        try {
            const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            console.warn('Falha no parse do JSON do Gemini:', text);
            return res.json({ isDuplicate: false, isProhibited: false });
        }

        const matchedPost = (parsed.isDuplicate && parsed.matchedPostId) ? {
            id: parsed.matchedPostId,
            title: parsed.matchedPostTitle || `Discussão #${parsed.matchedPostId}`
        } : null;

        res.json({
            isProhibited: false,
            isDuplicate: !!parsed.isDuplicate && !!matchedPost,
            matchedPost: matchedPost,
            matchedPostId: parsed.matchedPostId || null,
            matchedPostTitle: parsed.matchedPostTitle || null,
            explanation: parsed.explanation || null
        });
    } catch (error) {
        console.error('Erro em checkDuplicateAi:', error);
        res.json({ isDuplicate: false, isProhibited: false });
    }
};

exports.evaluateContentEthicsWithAI = evaluateContentEthicsWithAI;
exports.findDeterministicDuplicate = findDeterministicDuplicate;
exports.calculateTitleSimilarity = calculateTitleSimilarity;
