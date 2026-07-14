const db = require('../models');
const { ForumPost, ForumComment, ForumCommentVote, ForumVote, ForumReport, Psychologist } = db;
const { Op } = require('sequelize');

const gamificationService = require('../services/gamificationService');
const emailService = require('../services/emailService'); // Importação do serviço de e-mail
exports.getAllPosts = async (req, res) => {
    try {
        const psychologistId = req.user.id;
        const { filter, search, page = 1, limit = 3, pageSize } = req.query; 
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

        const where = {};
        if (filter === 'meus_posts') {
            where.PsychologistId = psychologistId;
        }
        if (search) {
            where[Op.or] = [
                { title: { [Op.iLike]: `%${search}%` } },
                { content: { [Op.iLike]: `%${search}%` } }
            ];
        }

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

exports.createPost = async (req, res) => {
    try {
        const { title, content, category, isAnonymous } = req.body;
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

        res.json({
            id: post.id,
            title: post.title,
            content: post.content,
            category: post.category,
            votes: post.votes,
            createdAt: post.createdAt,
            isAnonymous: post.isAnonymous,
            isPinned: post.isPinned,
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

        // 1. Busca comentários e suas respostas aninhadas de uma vez
        const comments = await ForumComment.findAll({
            where: { 
                ForumPostId: req.params.id,
                parentId: null 
            },
            include: [
                { model: Psychologist, attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'], required: false },
                // Inclui as respostas aninhadas
                { 
                    model: ForumComment, 
                    as: 'Replies', 
                    include: [{ model: Psychologist, attributes: ['nome', 'fotoUrl', 'badges', 'authority_level', 'slug', 'status', 'planExpiresAt', 'is_exempt'], required: false }],
                    required: false
                }
            ],
            // Comentários: Mais curtidos no topo, depois os mais recentes
            order: [
                ['likes', 'DESC'],
                ['createdAt', 'DESC']
            ],
            limit,
            offset
        });

        // 2. Otimização N+1: Coleta todos os IDs de comentários e respostas de uma vez
        const allCommentIds = [];
        comments.forEach(c => {
            allCommentIds.push(c.id);
            if (c.Replies) {
                c.Replies.forEach(r => allCommentIds.push(r.id));
            }
        });

        // 3. Otimização N+1: Busca todos os votos do usuário para esses comentários em uma única query
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

        // 4. Mapeia os dados com a informação de 'like' já em mãos (muito mais rápido)
        const data = comments.map(c => {
            const authorName = c.isAnonymous ? 'Anônimo' : (c.Psychologist ? c.Psychologist.nome : 'Usuário Desconhecido');
            const authorPhoto = c.isAnonymous ? null : (c.Psychologist ? c.Psychologist.fotoUrl : null);
            const authorBadges = c.isAnonymous ? {} : c.Psychologist?.badges;
            const authorLevel = c.isAnonymous ? null : c.Psychologist?.authority_level;
            
            let authorSlug = c.isAnonymous ? null : c.Psychologist?.slug;
            if (c.Psychologist && !c.isAnonymous) {
                let isActive = c.Psychologist.status === 'active';
                const isVip = c.Psychologist.is_exempt === true || String(c.Psychologist.is_exempt).toLowerCase() === 'true' || c.Psychologist.is_exempt === 1;
                if (!isVip && (!c.Psychologist.planExpiresAt || new Date(c.Psychologist.planExpiresAt) <= agora)) {
                    isActive = false;
                }
                if (!isActive) authorSlug = null;
            }

            // Processa as respostas (Replies) para incluir authorName e likedByMe
            let processedReplies = [];
            if (c.Replies && c.Replies.length > 0) {
                processedReplies = c.Replies.map(r => {
                    const rAuthorName = r.isAnonymous ? 'Anônimo' : (r.Psychologist ? r.Psychologist.nome : 'Usuário Desconhecido');
                    const rAuthorPhoto = r.isAnonymous ? null : (r.Psychologist ? r.Psychologist.fotoUrl : null);
                    const rAuthorBadges = r.isAnonymous ? {} : r.Psychologist?.badges;
                    const rAuthorLevel = r.isAnonymous ? null : r.Psychologist?.authority_level;
                    
                    let rAuthorSlug = r.isAnonymous ? null : r.Psychologist?.slug;
                    if (r.Psychologist && !r.isAnonymous) {
                        let isActive = r.Psychologist.status === 'active';
                        const isVip = r.Psychologist.is_exempt === true || String(r.Psychologist.is_exempt).toLowerCase() === 'true' || r.Psychologist.is_exempt === 1;
                        if (!isVip && (!r.Psychologist.planExpiresAt || new Date(r.Psychologist.planExpiresAt) <= agora)) {
                            isActive = false;
                        }
                        if (!isActive) rAuthorSlug = null;
                    }
                    
                    return {
                        id: r.id,
                        content: r.content,
                        createdAt: r.createdAt,
                        isAnonymous: r.isAnonymous,
                        authorName: rAuthorName,
                        authorPhoto: rAuthorPhoto,
                        authorBadges: rAuthorBadges,
                        authorLevel: rAuthorLevel,
                        authorSlug: rAuthorSlug,
                        likes: r.likes,
                        likedByMe: likedCommentIds.has(r.id), // Checagem O(1)
                        isMine: r.PsychologistId === userId, // Verifica autoria da resposta
                        parentId: c.id
                    };
                });
                // Ordena respostas por likes e data (mais recentes primeiro)
                processedReplies.sort((a, b) => {
                    if (b.likes !== a.likes) return b.likes - a.likes;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
            }

            return {
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                isAnonymous: c.isAnonymous,
                authorName: authorName,
                authorPhoto: authorPhoto,
                authorBadges: authorBadges,
                authorLevel: authorLevel,
                authorSlug: authorSlug,
                likes: c.likes,
                likedByMe: likedCommentIds.has(c.id), // Checagem O(1)
                isMine: c.PsychologistId === userId, // Verifica autoria do comentário
                replies: processedReplies
            };
        });
        res.json(data);
    } catch (error) {
        console.error("Erro em getComments:", error);
        res.status(500).json({ error: 'Erro ao carregar comentários' });
    }
};

exports.createComment = async (req, res) => {
    try {
        const { content, isAnonymous, parentId } = req.body; // Adiciona parentId
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
                        // FIX: Garante que a tabela existe no banco
                        if (db.Aviso) await db.Aviso.sync();

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
                        const postLink = `${frontendUrl}/psi/psi_dashboard.html?postId=${req.params.id}`;
                        const emailHtml = `
                            <div style="font-family: Arial, sans-serif; color: #374151; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
                                <div style="text-align: center; margin-bottom: 20px;">
                                    <h2 style="color: #1B4332; margin: 0;">${notifTitle} 💬</h2>
                                </div>
                                <p>Olá <strong>${targetUser.nome}</strong>,</p>
                                <p><strong>${senderName}</strong> respondeu a você na comunidade da Yelo:</p>
                                <div style="background-color: #f3f4f6; padding: 15px; border-left: 4px solid #1B4332; margin: 20px 0; border-radius: 4px; font-style: italic; color: #4b5563;">
                                    "${content.substring(0, 150)}${content.length > 150 ? '...' : ''}"
                                </div>
                                <div style="text-align: center; margin-top: 30px; margin-bottom: 20px;">
                                    <a href="${postLink}" style="background-color: #1B4332; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 50px; font-weight: bold; display: inline-block;">Acessar Comunidade</a>
                                </div>
                            </div>
                        `;
                        if (emailService && emailService.sendEmail) {
                            await emailService.sendEmail(targetUser.email, notifTitle, emailHtml).catch(e => console.error("Erro ao enviar email:", e));
                            console.log(`[NOTIF DEBUG] E-mail de notificação enviado para: ${targetUser.email}`);
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
        
        if (post.PsychologistId !== req.user.id) {
            return res.status(403).json({ error: 'Você não tem permissão para excluir este post.' });
        }
        
        await post.destroy();

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
        const report = await ForumReport.findByPk(req.params.id);

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
