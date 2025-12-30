const db = require('../models');
const { ForumPost, ForumComment, ForumCommentVote, ForumVote, ForumReport, Psychologist } = db;
const { Op } = require('sequelize');

exports.getAllPosts = async (req, res) => {
    try {
        const psychologistId = req.user.id;
        const { filter, search, page = 1, limit = 3, pageSize } = req.query; 
        const parsedLimit = parseInt(limit, 10);
        // Se pageSize não for enviado, usa o limit. Se for, usa ele para calcular o offset.
        const parsedPageSize = pageSize ? parseInt(pageSize, 10) : parsedLimit;
        const offset = (page - 1) * parsedPageSize;

        // Define a ordem da busca baseada no filtro
        let order;
        if (filter === 'populares') {
            // Otimização: Usa COUNT agregado em vez de subquery para cada linha.
            // O DISTINCT é importante para não contar errado devido ao JOIN.
            order = [[db.Sequelize.literal('"votes" + COUNT(DISTINCT "ForumComments"."id")'), 'DESC']];
        } else {
            // Lógica Híbrida: Recentes no topo, mas "Virais" (Interações >= 5) furam a fila
            order = [
                [db.Sequelize.literal('CASE WHEN "votes" + COUNT(DISTINCT "ForumComments"."id") >= 5 THEN 1 ELSE 0 END'), 'DESC'],
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
            order,
            limit: parsedLimit,
            offset,
            attributes: {
                include: [
                    // Otimização: Conta comentários usando JOIN + GROUP BY em vez de subquery
                    [db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('ForumComments.id'))), 'commentCount'],
                    // Otimização: EXISTS é geralmente rápido, especialmente com índices. Mantido.
                    [db.Sequelize.literal(`EXISTS (SELECT 1 FROM "ForumVotes" WHERE "ForumVotes"."ForumPostId" = "ForumPost"."id" AND "ForumVotes"."PsychologistId" = ${psychologistId})`), 'supportedByMe'],
                    // Subconsulta para verificar se o post pertence ao psicólogo logado
                    [db.Sequelize.literal(`("ForumPost"."PsychologistId" = ${psychologistId})`), 'isMine']
                ]
            },
            include: [
                {
                    model: Psychologist,
                    attributes: ['nome', 'fotoUrl'],
                    required: false // Garante LEFT JOIN
                },
                {
                    model: ForumComment,
                    attributes: [], // Não traz dados, apenas para a contagem
                    required: false // Garante LEFT JOIN
                }
            ],
            group: ['ForumPost.id', 'Psychologist.id'], // Agrupa para a contagem funcionar
            subQuery: false
        });

        // Formata a resposta para o frontend
        const formattedPosts = posts.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content,
            category: post.category,
            isAnonymous: post.isAnonymous,
            createdAt: post.createdAt,
            votes: post.votes,
            authorName: post.isAnonymous ? 'Anônimo' : post.Psychologist?.nome,
            authorPhoto: post.isAnonymous ? null : post.Psychologist?.fotoUrl,
            commentCount: parseInt(post.dataValues.commentCount, 10) || 0,
            supportedByMe: post.dataValues.supportedByMe,
            isMine: post.dataValues.isMine
        }));

        res.json(formattedPosts);

    } catch (error) {
        console.error("Erro ao buscar posts do fórum:", error);
        res.status(500).json({ error: 'Erro ao carregar discussões.' });
    }
};

exports.createPost = async (req, res) => {
    try {
        const { title, content, category, isAnonymous } = req.body;
        const post = await ForumPost.create({
            title, content, category, isAnonymous,
            PsychologistId: req.user.id
        });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar post' });
    }
};

exports.getPostDetails = async (req, res) => {
    try {
        const post = await ForumPost.findByPk(req.params.id, {
            include: [{ model: Psychologist, attributes: ['nome', 'fotoUrl'] }]
        });
        
        if (!post) return res.status(404).json({ error: 'Post não encontrado' });

        const supported = await ForumVote.findOne({ 
            where: { ForumPostId: post.id, PsychologistId: req.user.id } 
        });

        res.json({
            id: post.id,
            title: post.title,
            content: post.content,
            category: post.category,
            votes: post.votes,
            createdAt: post.createdAt,
            isAnonymous: post.isAnonymous,
            authorName: post.isAnonymous ? 'Anônimo' : post.Psychologist.nome,
            authorPhoto: post.isAnonymous ? null : post.Psychologist.fotoUrl,
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
                { model: Psychologist, attributes: ['nome', 'fotoUrl'], required: false },
                // Inclui as respostas aninhadas
                { 
                    model: ForumComment, 
                    as: 'Replies', 
                    include: [{ model: Psychologist, attributes: ['nome', 'fotoUrl'], required: false }],
                    required: false
                }
            ],
            // Comentários: Populares (>= 3 likes) no topo, depois os mais recentes
            order: [
                [db.Sequelize.literal('CASE WHEN "ForumComment"."likes" >= 3 THEN 1 ELSE 0 END'), 'DESC'],
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

        // 4. Mapeia os dados com a informação de 'like' já em mãos (muito mais rápido)
        const data = comments.map(c => {
            const authorName = c.isAnonymous ? 'Anônimo' : (c.Psychologist ? c.Psychologist.nome : 'Usuário Desconhecido');
            const authorPhoto = c.isAnonymous ? null : (c.Psychologist ? c.Psychologist.fotoUrl : null);

            // Processa as respostas (Replies) para incluir authorName e likedByMe
            let processedReplies = [];
            if (c.Replies && c.Replies.length > 0) {
                processedReplies = c.Replies.map(r => {
                    const rAuthorName = r.isAnonymous ? 'Anônimo' : (r.Psychologist ? r.Psychologist.nome : 'Usuário Desconhecido');
                    const rAuthorPhoto = r.isAnonymous ? null : (r.Psychologist ? r.Psychologist.fotoUrl : null);
                    return {
                        id: r.id,
                        content: r.content,
                        createdAt: r.createdAt,
                        isAnonymous: r.isAnonymous,
                        authorName: rAuthorName,
                        authorPhoto: rAuthorPhoto,
                        likes: r.likes,
                        likedByMe: likedCommentIds.has(r.id), // Checagem O(1)
                        isMine: r.PsychologistId === userId, // Verifica autoria da resposta
                        parentId: c.id
                    };
                });
                // Ordena respostas por data (mais antigas primeiro)
                processedReplies.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            }

            return {
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                isAnonymous: c.isAnonymous,
                authorName: authorName,
                authorPhoto: authorPhoto,
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
        
        // Retorna dados formatados para o frontend adicionar na lista imediatamente
        const user = await Psychologist.findByPk(req.user.id);
        res.json({
            id: comment.id,
            content: comment.content,
            createdAt: comment.createdAt,
            isAnonymous: comment.isAnonymous,
            authorName: comment.isAnonymous ? 'Anônimo' : user.nome,
            authorPhoto: comment.isAnonymous ? null : user.fotoUrl,
            likes: 0 // Novo comentário começa com 0 likes
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
        } else {
            await ForumVote.create({ ForumPostId: postId, PsychologistId: userId });
            post.votes += 1;
        }
        await post.save();
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
        } else {
            await ForumCommentVote.create({ ForumCommentId: commentId, PsychologistId: userId });
            comment.likes += 1;
        }
        await comment.save();
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
        res.json({ message: 'Post excluído com sucesso.' });
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
        res.json({ message: 'Comentário excluído com sucesso.' });
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
                await ForumPost.destroy({ where: { id: report.itemId } });
            } else {
                await ForumComment.destroy({ where: { id: report.itemId } });
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
