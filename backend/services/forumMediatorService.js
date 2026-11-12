// backend/services/forumMediatorService.js
const crypto = require('crypto');
const defaultDb = require('../models');
const { Op } = require('sequelize');

const FORUM_CATEGORIES = [
    'Discussão de Casos (Intervisão)',
    'Burocracia e Legislação (CRP/CFP)',
    'Indicações e Encaminhamentos',
    'Ferramentas e Referências',
    'Marketing e Carreira',
    'Sala de Café (Off-topic)'
];

const VALID_ACTIONS = new Set([
    'APPROVE',
    'REDIRECT_DUPLICATE',
    'MOVE_CATEGORY',
    'MULTI_TOPIC_SPLIT',
    'CLOSE_OFF_SCOPE'
]);

const DEFAULT_MIN_CONFIDENCE = 0.82;
const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

function stripHtmlAndCompact(text, maxLen = 600) {
    const clean = String(text || '')
        .replace(/<[^>]*>?/gm, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
}

async function callGeminiMediator(prompt) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY não configurada');
    }
    const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
    ];

    let lastError = null;
    for (const modelName of CANDIDATE_MODELS) {
        try {
            const model = genAI.getGenerativeModel({
                model: modelName,
                safetySettings,
                generationConfig: { temperature: 0.2 }
            });
            const result = await Promise.race([
                model.generateContent(prompt),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout Gemini Mediador (20s)')), 20000))
            ]);
            return result.response.text();
        } catch (err) {
            lastError = err;
            const msg = String(err.message || '');
            if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
                await new Promise(r => setTimeout(r, 4200));
            }
            console.warn(`[ForumMediator] Modelo ${modelName} falhou: ${msg}`);
        }
    }
    throw lastError || new Error('Nenhum modelo Gemini respondeu');
}

function normalizeAiDecision(rawJsonText, post, candidateMap) {
    const cleanJson = String(rawJsonText || '')
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
    const parsed = JSON.parse(cleanJson);

    let action = VALID_ACTIONS.has(parsed?.action) ? parsed.action : 'APPROVE';
    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence ?? 0.5)));
    let targetPostId = parsed?.targetPostId ? parseInt(parsed.targetPostId, 10) : null;
    let targetCategory = parsed?.targetCategory ? String(parsed.targetCategory).trim() : null;
    const reasonSummary = String(parsed?.reasonSummary || '').trim().slice(0, 300);
    const commentMessage = String(parsed?.commentMessage || '').trim();

    if (targetPostId === post.id) {
        targetPostId = null;
    }

    if (action === 'REDIRECT_DUPLICATE') {
        if (!targetPostId || !candidateMap.has(targetPostId)) {
            // Se não apontou destino válido real, rebaixa para aprovação/revisão segura
            return {
                action: 'DEFER_INVALID_TARGET',
                originalAction: action,
                confidence,
                targetPostId: parsed?.targetPostId || null,
                targetCategory,
                reasonSummary: reasonSummary || 'IA sugeriu redirecionamento sem ID de destino válido.',
                commentMessage
            };
        }
    }

    if (action === 'MOVE_CATEGORY') {
        if (!targetCategory || !FORUM_CATEGORIES.includes(targetCategory) || targetCategory === post.category) {
            return {
                action: 'APPROVE',
                confidence: 1,
                targetPostId: null,
                targetCategory: post.category,
                reasonSummary: 'Categoria atual já é a mais adequada.',
                commentMessage: ''
            };
        }
    }

    if (action !== 'APPROVE' && !commentMessage) {
        return {
            action: 'DEFER_EMPTY_COMMENT',
            originalAction: action,
            confidence,
            targetPostId,
            targetCategory,
            reasonSummary: 'Comentário do mediador veio vazio.',
            commentMessage: ''
        };
    }

    return {
        action,
        confidence,
        targetPostId,
        targetCategory,
        reasonSummary,
        commentMessage
    };
}

/**
 * Monta contexto compacto com tópicos oficiais (fixados) e demais discussões ativas
 * e consulta o Gemini em background para classificar o post.
 */
async function analyzePostWithAI(post, contextPosts = [], options = {}) {
    const aiRunner = options.aiRunner || callGeminiMediator;
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

    const candidateMap = new Map();
    const hubsLines = [];
    const activeLines = [];

    for (const c of contextPosts) {
        if (!c || c.id === post.id) continue;
        if (c.redirectPostId || ['archived', 'closed', 'encerrada', 'hidden_by_admin', 'deleted'].includes(String(c.status || '').toLowerCase())) {
            continue;
        }
        candidateMap.set(Number(c.id), c);
        const line = `[ID: ${c.id}]${c.isPinned ? ' [FIXADO/OFICIAL]' : ''} | Categoria: "${c.category}" | Título: "${c.title}" | Resumo: "${stripHtmlAndCompact(c.content, 110)}"`;
        if (c.isPinned) hubsLines.push(line);
        else activeLines.push(line);
    }

    if (options.virtualPresentationHub && options.virtualPresentationHub.id && !candidateMap.has(Number(options.virtualPresentationHub.id))) {
        const vh = options.virtualPresentationHub;
        candidateMap.set(Number(vh.id), vh);
        hubsLines.unshift(`[ID: ${vh.id}] [FIXADO/OFICIAL - NOVO] | Categoria: "Sala de Café (Off-topic)" | Título: "${vh.title}" | Resumo: "Tópico oficial único para novos psicólogos se apresentarem e darem boas-vindas na comunidade."`);
    }

    const virtualIntroHubNote = '';

    const prompt = `Você é o Mediador Oficial da Comunidade Yelo Psi (fórum exclusivo de psicólogos clínicos no Brasil).
Analise a publicação abaixo e decida com bom senso clínico, ética e acolhimento se ela deve permanecer como está ou se precisa de organização.

POST EM ANÁLISE:
- ID: ${post.id}
- Título: "${post.title}"
- Categoria atual: "${post.category}"
- Comentários existentes: ${Number(post.commentCount || 0)}
- Conteúdo: "${stripHtmlAndCompact(post.content, 1200)}"

CATEGORIAS OFICIAIS DISPONÍVEIS (USE EXATAMENTE UMA DESTAS):
${FORUM_CATEGORIES.map((c, idx) => `${idx + 1}. ${c}`).join('\n')}

TÓPICOS OFICIAIS FIXADOS / HUBS:
${hubsLines.length > 0 ? hubsLines.join('\n') : '(Nenhum tópico oficial fixado além da lista geral abaixo)'}${virtualIntroHubNote}

OUTRAS DISCUSSÕES ATIVAS RECENTES:
${activeLines.slice(0, 35).join('\n') || '(Nenhuma outra discussão ativa)'}

REGRAS DE MEDIAÇÃO (SIGA ESTRITAMENTE):
1. "APPROVE": O post pertence ao fórum, trata de 1 tema coerente, está na categoria certa e não duplica tópico oficial/ativo relevante. Discussões reflexivas ou casos em "Sala de Café" que sejam claramente desabafos pessoais sem pergunta clínica também podem ficar em "Sala de Café" se fizer sentido.
2. "REDIRECT_DUPLICATE": Use SOMENTE quando o objetivo principal do post for uma apresentação pessoal/boas-vindas solta (em vez de usar o tópico oficial de apresentações) OU quando for pergunta/debate repetido idêntico a outro tópico aberto listado acima. Se o autor disser apenas "sou nova por aqui" em uma frase e passar a uma pergunta específica (ex.: captação de pacientes), avalie pelo assunto principal (ou use MULTI_TOPIC_SPLIT se estiver misturando dois assuntos grandes). Informe "targetPostId" com o ID exato da lista acima e escreva um comentário cordial citando o título do tópico principal.
3. "MOVE_CATEGORY": O tema pertence ao fórum e é único, mas foi postado na categoria errada (ex.: relato de caso clínico em "Sala de Café", dúvida de CRP/documentos em "Sala de Café", dúvida de captação em "Indicações", ferramenta/prontuário em "Sala de Café"). Escolha "targetCategory" dentre as 6 categorias oficiais e escreva um comentário simpático avisando que movemos o tópico para a categoria correta para alcançar os colegas certos.
4. "MULTI_TOPIC_SPLIT": O texto mistura 2 ou mais assuntos independentes que merecem threads diferentes (ex.: apresentação pessoal detalhada + dúvida jurídica de CRP + pergunta de precificação no mesmo texto). Escreva um comentário acolhedor listando cada assunto separado, sugerindo criar um tópico específico para cada tema (e usar o tópico oficial se um dos temas for apresentação), e avisando gentilmente que este post foi encerrado para manter os debates organizados.
5. "CLOSE_OFF_SCOPE": O post NÃO pertence ao fórum aberto da comunidade (ex.: suporte técnico individual de conta/pagamento que deve ir na Central de Ajuda/Suporte, manifestação político-partidária fora do escopo da psicologia, propaganda comercial externa, ou mensagem vazia/teste). Escreva um comentário respeitoso direcionando para o canal correto e informando o encerramento deste tópico.

TRAVAS IMPORTANTES:
- Seja acolhedor, humano e colegial ("Olá! Que bom te ver por aqui..."). Nunca soe punitivo ou robótico.
- NUNCA escreva IDs numéricos técnicos como "(ID: 123)", "[ID 123]" ou "#999999" dentro de "commentMessage" — cite apenas o nome/título do tópico, porque a plataforma já exibe automaticamente o botão clicável de redirecionamento.
- Discussões clínicas legítimas que façam sentido na categoria NÃO devem ser fechadas — use "APPROVE".
- Só retorne "confidence" >= 0.85 quando tiver certeza clara da regra aplicada. Caso contrário use confidence < 0.80.

Responda ESTRITAMENTE em JSON puro (sem markdown):
{
  "action": "APPROVE" | "REDIRECT_DUPLICATE" | "MOVE_CATEGORY" | "MULTI_TOPIC_SPLIT" | "CLOSE_OFF_SCOPE",
  "confidence": 0.90,
  "targetPostId": null ou numero,
  "targetCategory": null ou "Nome exato da categoria",
  "reasonSummary": "Resumo técnico curto do motivo (1 frase)",
  "commentMessage": "Texto acolhedor para comentar no post (obrigatório quando action != APPROVE)"
}`;

    const rawText = await aiRunner(prompt);
    const decision = normalizeAiDecision(rawText, post, candidateMap);

    if (decision.action !== 'APPROVE' && decision.action !== 'DEFER_INVALID_TARGET' && decision.action !== 'DEFER_EMPTY_COMMENT') {
        if (decision.confidence < minConfidence) {
            return {
                ...decision,
                originalAction: decision.action,
                action: 'DEFER_LOW_CONFIDENCE',
                reasonSummary: `Confiança (${decision.confidence.toFixed(2)}) abaixo do limiar (${minConfidence}): ${decision.reasonSummary}`
            };
        }
        // Protege posts que já possuem 5+ comentários humanos contra fechamento automático (MOVE_CATEGORY permanece permitido pois mantém o debate aberto)
        if (Number(post.commentCount || 0) >= 5 && (decision.action === 'MULTI_TOPIC_SPLIT' || decision.action === 'CLOSE_OFF_SCOPE')) {
            return {
                ...decision,
                originalAction: decision.action,
                action: 'DEFER_ACTIVE_DISCUSSION',
                reasonSummary: `Tópico já possui ${post.commentCount} comentários humanos — mantido aberto para revisão manual.`
            };
        }
        // Protege posts que já são destino de redirecionamento de outros tópicos contra redirecionamento em cadeia
        if (post.hasIncomingRedirects && decision.action === 'REDIRECT_DUPLICATE') {
            return {
                ...decision,
                action: 'APPROVE',
                reasonSummary: 'Post já atua como tópico principal de redirecionamentos existentes; mantido ativo.'
            };
        }
    }

    return decision;
}

/**
 * Busca ou cria o perfil institucional não-clínico do Mediador (apenas em modo live).
 */
async function ensureMediatorAccount(db = defaultDb, dryRun = true) {
    const mediatorEmail = (process.env.FORUM_MEDIATOR_EMAIL || 'mediador@yelopsi.com.br').trim().toLowerCase();
    const existing = await db.Psychologist.findOne({
        where: { email: mediatorEmail },
        attributes: ['id', 'nome', 'email', 'status', 'isAdmin']
    });
    if (existing) return existing;

    if (dryRun) {
        return { id: null, nome: 'Moderação Yelo', email: mediatorEmail, status: 'content_creator' };
    }

    const bcrypt = require('bcryptjs');
    const randomPassword = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);

    return db.Psychologist.create({
        nome: 'Moderação Yelo',
        email: mediatorEmail,
        senha: randomPassword,
        status: 'content_creator',
        is_exempt: true,
        isAdmin: false,
        bio: 'Canal automático de organização e curadoria da Comunidade Clínica Yelo.'
    });
}

async function notifyAuthorQuietly(db, post, mediatorCommentText, mediatorAction, extraInfo = '') {
    if (!db.Aviso || !post.PsychologistId) return;
    let title = 'Atualização da Moderação no seu tópico';
    if (mediatorAction === 'MOVE_CATEGORY') {
        title = `Seu tópico foi organizado em ${extraInfo}`;
    } else if (mediatorAction === 'REDIRECT_DUPLICATE') {
        title = 'Seu tópico foi unificado com uma discussão oficial';
    } else if (mediatorAction === 'MULTI_TOPIC_SPLIT') {
        title = 'Sugestão para separar os assuntos do seu tópico';
    } else if (mediatorAction === 'CLOSE_OFF_SCOPE') {
        title = 'Orientação sobre seu tópico no Fórum';
    }

    const preview = stripHtmlAndCompact(mediatorCommentText, 180);
    const content = `A Moderação da Yelo deixou uma orientação no seu tópico "<strong>${post.title}</strong>":<br><br><em>"${preview}"</em><br><br><a href="#" class="aviso-link-direto" data-post-id="${post.id}" onclick="window.loadPage('psi_forum.html?postId=${post.id}'); return false;" style="color: #1B4332; font-weight: bold; text-decoration: underline;">Ver orientação completa no Fórum</a>.`;

    await db.Aviso.create({
        title,
        content,
        author: 'Moderação Yelo',
        status: 'published',
        psychologistId: post.PsychologistId
    }).catch(() => {});
}

const OFFICIAL_INTRO_TOPIC = {
    title: '👋 Apresente-se aqui! Bem-vindo(a) à Comunidade Yelo',
    category: 'Sala de Café (Off-topic)',
    content: [
        'Sejam muito bem-vindos/as à nossa comunidade! 🌿',
        '',
        'Para mantermos o Fórum organizado e garantirmos que todos os colegas consigam conhecer quem está chegando, este é o nosso espaço oficial e único para apresentações.',
        '',
        'Se você é novo(a) por aqui, deixe um comentário contando um pouco sobre você:',
        '• De qual cidade/estado você atende (ou se atende online);',
        '• Qual é a sua abordagem e principais temas clínicos;',
        '• O que você mais busca trocar com outros psicólogos aqui na Yelo.',
        '',
        'Se tiver alguma dúvida técnica de caso clínico, CRP ou divulgação do consultório, sinta-se à vontade para abrir um tópico específico na categoria correspondente! 👇'
    ].join('\n')
};

/**
 * Garante a existência do Tópico Oficial Fixado de Apresentações (sem disparar e-mail em massa).
 */
async function ensureOfficialIntroTopic(db = defaultDb, options = {}) {
    const dryRun = options.dryRun === true;
    const existing = await db.ForumPost.findOne({
        where: {
            isPinned: true,
            title: { [Op.iLike]: '%apresente-se%' },
            [Op.or]: [
                { status: null },
                { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted'] } }
            ]
        },
        order: [['id', 'ASC']]
    });

    if (existing) {
        return { created: false, post: existing };
    }

    if (dryRun) {
        return { created: false, dryRun: true, post: { id: null, ...OFFICIAL_INTRO_TOPIC, isPinned: true } };
    }

    let authorId = options.authorPsychologistId || null;
    if (!authorId) {
        const preferredEmails = [
            process.env.FORUM_INTRO_AUTHOR_EMAIL,
            'pix@yelopsi.com.br',
            'anderson@yelopsi.com.br'
        ].filter(Boolean);

        for (const email of preferredEmails) {
            const found = await db.Psychologist.findOne({
                where: { email },
                attributes: ['id']
            }).catch(() => null);
            if (found?.id) {
                authorId = found.id;
                break;
            }
        }
        if (!authorId) {
            const fallbackAdmin = await db.Psychologist.findOne({
                where: { isAdmin: true },
                attributes: ['id']
            }).catch(() => null);
            authorId = fallbackAdmin?.id || null;
        }
        if (!authorId) {
            const mediator = await ensureMediatorAccount(db, false);
            authorId = mediator.id;
        }
    }

    const post = await db.ForumPost.create({
        title: OFFICIAL_INTRO_TOPIC.title,
        content: OFFICIAL_INTRO_TOPIC.content,
        category: OFFICIAL_INTRO_TOPIC.category,
        isAnonymous: false,
        isPinned: true,
        status: 'active',
        PsychologistId: authorId
    });

    return { created: true, post };
}

/**
 * Avalia (e opcionalmente executa) a mediação em lote nos posts elegíveis.
 * Em dryRun=true: ZERO escritas em banco, retorna apenas o diagnóstico e plano detalhado.
 */
async function runMediatorBatch(options = {}) {
    const db = options.db || defaultDb;
    const dryRun = options.dryRun !== false;
    const limit = Number(options.limit || (options.includeBackfill ? 40 : 10));
    const singlePostId = options.postId ? Number(options.postId) : null;

    const allOpenPosts = await db.ForumPost.findAll({
        where: {
            [Op.or]: [
                { status: null },
                { status: { [Op.notIn]: ['hidden_by_admin', 'hidden', 'deleted', 'archived', 'closed', 'encerrada'] } }
            ],
            redirectPostId: null
        },
        include: [
            { model: db.ForumComment, attributes: ['id'], required: false }
        ],
        order: [['createdAt', 'DESC']]
    });

    const redirectTargetsSet = new Set();
    const redirectedAll = await db.ForumPost.findAll({
        where: { redirectPostId: { [Op.ne]: null } },
        attributes: ['redirectPostId']
    }).catch(() => []);
    for (const rp of redirectedAll) {
        if (rp.redirectPostId) redirectTargetsSet.add(Number(rp.redirectPostId));
    }

    const formattedPool = allOpenPosts.map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        category: p.category,
        status: p.status || 'active',
        isPinned: Boolean(p.isPinned),
        redirectPostId: p.redirectPostId || null,
        hasIncomingRedirects: redirectTargetsSet.has(p.id),
        PsychologistId: p.PsychologistId,
        commentCount: Array.isArray(p.ForumComments) ? p.ForumComments.length : Number(p.commentCount || 0),
        createdAt: p.createdAt,
        _model: p
    }));

    const reviewedLogs = (!singlePostId && db.SystemLog)
        ? await db.SystemLog.findAll({
            where: { message: { [Op.like]: '[FORUM_MEDIATOR_REVIEWED]%' } },
            attributes: ['message', 'meta']
        }).catch(() => [])
        : [];

    const reviewedIds = new Set();
    for (const log of reviewedLogs) {
        if (log.meta?.postId) reviewedIds.add(Number(log.meta.postId));
        const match = String(log.message || '').match(/post:(\d+)/);
        if (match) reviewedIds.add(Number(match[1]));
    }

    let targets = formattedPool.filter(p => !p.isPinned);
    if (singlePostId) {
        targets = targets.filter(p => p.id === singlePostId);
    } else {
        targets = targets.filter(p => !reviewedIds.has(p.id));
    }
    targets = targets.slice(0, limit);

    const mediatorUser = targets.length > 0 ? await ensureMediatorAccount(db, dryRun) : null;
    const results = [];

    for (const post of targets) {
        try {
            const decision = await analyzePostWithAI(post, formattedPool, {
                aiRunner: options.aiRunner,
                minConfidence: options.minConfidence,
                virtualPresentationHub: options.virtualPresentationHub
            });

            const entry = {
                postId: post.id,
                title: post.title,
                currentCategory: post.category,
                commentCount: post.commentCount,
                action: decision.action,
                confidence: decision.confidence,
                targetPostId: decision.targetPostId || null,
                targetCategory: decision.targetCategory || null,
                reasonSummary: decision.reasonSummary,
                commentMessage: decision.commentMessage,
                applied: false
            };

            if (!dryRun) {
                const postModel = post._model;
                const action = decision.action;

                if (action === 'MOVE_CATEGORY') {
                    const oldCat = postModel.category;
                    postModel.category = decision.targetCategory;
                    await postModel.save();

                    await db.ForumComment.create({
                        content: decision.commentMessage,
                        ForumPostId: post.id,
                        PsychologistId: mediatorUser.id,
                        isAnonymous: false,
                        isPinned: true
                    });
                    await notifyAuthorQuietly(db, post, decision.commentMessage, action, decision.targetCategory);
                    entry.applied = true;
                    entry.oldCategory = oldCat;
                } else if (action === 'REDIRECT_DUPLICATE') {
                    postModel.redirectPostId = decision.targetPostId;
                    postModel.status = 'closed';
                    await postModel.save();

                    await db.ForumComment.create({
                        content: decision.commentMessage,
                        ForumPostId: post.id,
                        PsychologistId: mediatorUser.id,
                        isAnonymous: false,
                        isPinned: true
                    });
                    await notifyAuthorQuietly(db, post, decision.commentMessage, action);
                    entry.applied = true;
                } else if (action === 'MULTI_TOPIC_SPLIT' || action === 'CLOSE_OFF_SCOPE') {
                    postModel.status = 'closed';
                    await postModel.save();

                    await db.ForumComment.create({
                        content: decision.commentMessage,
                        ForumPostId: post.id,
                        PsychologistId: mediatorUser.id,
                        isAnonymous: false,
                        isPinned: true
                    });
                    await notifyAuthorQuietly(db, post, decision.commentMessage, action);
                    entry.applied = true;
                } else if (action === 'DEFER_LOW_CONFIDENCE' && db.AdminAdjustment) {
                    await db.AdminAdjustment.create({
                        title: `[Mediador Fórum] Revisar tópico #${post.id}: "${post.title.slice(0, 45)}"`,
                        target_page: 'psi_forum.html',
                        file_path: 'backend/services/forumMediatorService.js',
                        category: 'Comunidade & Fórum',
                        environment: 'admin',
                        device: 'todos',
                        priority: 'media',
                        status: 'pendente',
                        notes: `Sugestão da IA (${decision.originalAction}, confiança ${(decision.confidence * 100).toFixed(0)}%): ${decision.reasonSummary}`
                    }).catch(() => {});
                }

                if (db.SystemLog) {
                    await db.SystemLog.create({
                        level: 'info',
                        message: `[FORUM_MEDIATOR_REVIEWED] post:${post.id} | action:${decision.action}`,
                        meta: {
                            postId: post.id,
                            action: decision.action,
                            confidence: decision.confidence,
                            targetPostId: decision.targetPostId || null,
                            targetCategory: decision.targetCategory || null,
                            reasonSummary: decision.reasonSummary
                        }
                    }).catch(() => {});
                }
            }

            results.push(entry);
            // Espaçamento respeitando cota de RPM do plano gratuito ao rodar em lote
            if (targets.length > 1) {
                const spacingMs = targets.length > 5 ? 1200 : 300;
                await new Promise(r => setTimeout(r, spacingMs));
            }
        } catch (err) {
            console.error(`[ForumMediator] Erro ao avaliar post #${post.id}:`, err.message);
            results.push({
                postId: post.id,
                title: post.title,
                currentCategory: post.category,
                action: 'ERROR',
                error: err.message,
                applied: false
            });
        }
    }

    return {
        dryRun,
        scannedPoolCount: formattedPool.length,
        evaluatedCount: results.length,
        results
    };
}

/**
 * Agenda avaliação em background após criação do post sem impactar o tempo de resposta HTTP.
 */
function scheduleBackgroundReview(postId) {
    if (process.env.ENABLE_FORUM_MEDIATOR !== 'true' || !postId) return;
    const timer = setTimeout(() => {
        runMediatorBatch({ dryRun: false, postId: Number(postId), limit: 1 })
            .catch(err => console.error(`[ForumMediator] Erro em scheduleBackgroundReview (#${postId}):`, err.message));
    }, 15000);
    if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
    FORUM_CATEGORIES,
    OFFICIAL_INTRO_TOPIC,
    stripHtmlAndCompact,
    normalizeAiDecision,
    analyzePostWithAI,
    ensureMediatorAccount,
    ensureOfficialIntroTopic,
    runMediatorBatch,
    scheduleBackgroundReview
};
