const db = require('../models');

/**
 * Rota: GET /api/admin/forum/reports
 * Descrição: Busca todos os conteúdos denunciados no fórum.
 */
exports.getForumReports = async (req, res) => {
    try {
        const query = `
            SELECT
                FR."itemId" AS "contentId",
                FR."type" AS "contentType",
                COUNT(FR.id) AS "reportCount",
                MIN(FR."createdAt") AS "firstReportDate",
                MAX(COALESCE(FP.status, FC.status, 'active')) AS "contentStatus",
                MAX(COALESCE(FP.title, FP.content, FC.content)) AS "contentText",
                MAX(COALESCE(author_p.nome, 'Usuário Removido')) AS "authorName",
                MAX(CAST(FP."isPinned" AS text))::boolean AS "isPinned"
            FROM "ForumReports" AS FR
            LEFT JOIN "ForumPosts" AS FP ON FR."itemId" = FP.id AND FR."type" = 'post'
            LEFT JOIN "ForumComments" AS FC ON FR."itemId" = FC.id AND FR."type" = 'comment'
            LEFT JOIN "Psychologists" AS author_p ON (FP."PsychologistId" = author_p.id OR FC."PsychologistId" = author_p.id)
            GROUP BY FR."itemId", FR."type"
            ORDER BY 
                CASE 
                    WHEN MAX(COALESCE(FP.status, FC.status, 'active')) IN ('active', 'pending') THEN 1
                    ELSE 2 
                END, 
                COUNT(FR.id) DESC, 
                MIN(FR."createdAt") ASC;
        `;

        const [reports] = await db.sequelize.query(query);
        res.json(reports);

    } catch (error) {
        if (error.message.includes('relation "ForumReports" does not exist')) {
            console.warn("Tabela 'ForumReports' não encontrada. Retornando lista de denúncias vazia.");
            return res.json([]);
        }
        console.error("Erro ao buscar denúncias do fórum:", error);
        res.status(500).json({ error: "Erro interno ao buscar denúncias." });
    }
};

/**
 * Rota: PUT /api/admin/forum/moderate
 * Descrição: Modera um conteúdo do fórum (mantém, oculta ou exclui).
 */
exports.moderateForumContent = async (req, res) => {
    const { contentType, contentId, action } = req.body;

    const validActions = ['approve', 'restore', 'remove', 'hide', 'reject', 'delete'];
    if (!['post', 'comment'].includes(contentType) || !contentId || !validActions.includes(action)) {
        return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    try {
        if (action === 'delete') {
            if (contentType === 'post') {
                const post = await db.ForumPost.findByPk(contentId);
                if (!post) return res.status(404).json({ error: 'Post não encontrado.' });
                if (db.ForumComment) await db.ForumComment.destroy({ where: { ForumPostId: contentId } });
                if (db.ForumVote) await db.ForumVote.destroy({ where: { ForumPostId: contentId } });
                if (db.ForumReport) await db.ForumReport.destroy({ where: { itemId: contentId, type: 'post' } });
                await post.destroy();
                return res.json({ message: 'Post excluído permanentemente com sucesso.' });
            } else {
                const comment = await db.ForumComment.findByPk(contentId);
                if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });
                if (db.ForumCommentVote) await db.ForumCommentVote.destroy({ where: { ForumCommentId: contentId } });
                if (db.ForumReport) await db.ForumReport.destroy({ where: { itemId: contentId, type: 'comment' } });
                await comment.destroy();
                return res.json({ message: 'Comentário excluído permanentemente com sucesso.' });
            }
        }

        const Model = contentType === 'post' ? db.ForumPost : db.ForumComment;
        const isApprove = action === 'approve' || action === 'restore';
        const newStatus = isApprove ? 'approved_by_admin' : 'hidden_by_admin';
        const message = isApprove ? 'Conteúdo restaurado e visível no fórum.' : 'Conteúdo ocultado do fórum com sucesso.';

        await Model.update({ status: newStatus }, { where: { id: contentId } });
        if (db.ForumReport) await db.ForumReport.update({ status: 'resolved' }, { where: { itemId: contentId, type: contentType } });

        res.json({ message, status: newStatus });
    } catch (error) {
        console.error("Erro ao moderar conteúdo do fórum:", error);
        res.status(500).json({ error: error.message || "Erro interno ao moderar conteúdo." });
    }
};

/**
 * Rota: DELETE /api/admin/forum/posts/:id
 * Descrição: Exclui permanentemente um post e suas dependências.
 */
exports.deleteForumPost = async (req, res) => {
    const { id } = req.params;
    try {
        const post = await db.ForumPost.findByPk(id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        if (db.ForumComment) await db.ForumComment.destroy({ where: { ForumPostId: id } });
        if (db.ForumVote) await db.ForumVote.destroy({ where: { ForumPostId: id } });
        if (db.ForumReport) await db.ForumReport.destroy({ where: { itemId: id, type: 'post' } });
        await post.destroy();

        res.json({ message: 'Post excluído permanentemente com sucesso.' });
    } catch (error) {
        console.error("Erro ao excluir post pelo admin:", error);
        res.status(500).json({ error: error.message || "Erro ao excluir post." });
    }
};

/**
 * Rota: GET /api/admin/forum/posts/:id
 * Descrição: Busca detalhes completos de um post e comentários para o preview admin.
 */
exports.getForumPostDetailsForAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const post = await db.ForumPost.findByPk(id, {
            include: [
                {
                    model: db.Psychologist,
                    attributes: ['id', 'nome', 'fotoUrl', 'email', 'crp', 'slug']
                },
                {
                    model: db.ForumComment,
                    include: [{
                        model: db.Psychologist,
                        attributes: ['id', 'nome', 'fotoUrl']
                    }],
                    required: false
                }
            ],
            order: [
                [{ model: db.ForumComment }, 'createdAt', 'ASC']
            ]
        });

        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        res.json({
            id: post.id,
            title: post.title,
            content: post.content,
            category: post.category,
            status: post.status || 'active',
            isPinned: post.isPinned || false,
            votes: post.votes || 0,
            isAnonymous: post.isAnonymous || false,
            createdAt: post.createdAt,
            author: {
                name: post.isAnonymous ? 'Anônimo' : (post.Psychologist?.nome || 'Usuário Removido'),
                photo: post.isAnonymous ? null : (post.Psychologist?.fotoUrl || null),
                email: post.isAnonymous ? null : (post.Psychologist?.email || null),
                crp: post.isAnonymous ? null : (post.Psychologist?.crp || null)
            },
            comments: (post.ForumComments || []).map(c => ({
                id: c.id,
                content: c.content,
                createdAt: c.createdAt,
                likes: c.likes || 0,
                isPinned: c.isPinned || false,
                authorName: c.isAnonymous ? 'Anônimo' : (c.Psychologist?.nome || 'Usuário Removido'),
                authorPhoto: c.isAnonymous ? null : (c.Psychologist?.fotoUrl || null)
            }))
        });
    } catch (error) {
        console.error("Erro ao buscar detalhes do post para admin:", error);
        res.status(500).json({ error: 'Erro ao carregar detalhes do post.' });
    }
};

/**
 * Rota: PUT /api/admin/forum/posts/:id/pin (NOVA)
 * Descrição: Fixa ou desfixa um post no fórum.
 */
exports.pinForumPost = async (req, res) => {
    const { id } = req.params;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ error: 'Parâmetro "isPinned" (booleano) é obrigatório.' });
    }

    try {
        const post = await db.ForumPost.findByPk(id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado.' });

        await post.update({ isPinned });
        const message = isPinned ? 'Post fixado com sucesso!' : 'Post desfixado com sucesso!';
        res.json({ message, isPinned: post.isPinned });
    } catch (error) {
        console.error("Erro ao fixar/desfixar post do fórum:", error);
        res.status(500).json({ error: "Erro interno ao processar a solicitação." });
    }
};

/**
 * Rota: PUT /api/admin/forum/comments/:id/pin
 * Descrição: Fixa ou desfixa um comentário no fórum.
 */
exports.pinForumComment = async (req, res) => {
    const { id } = req.params;
    const { isPinned } = req.body;

    if (typeof isPinned !== 'boolean') {
        return res.status(400).json({ error: 'Parâmetro "isPinned" (booleano) é obrigatório.' });
    }

    try {
        const comment = await db.ForumComment.findByPk(id);
        if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });

        if (isPinned) {
            // Desfixa qualquer outro comentário do mesmo post
            await db.ForumComment.update(
                { isPinned: false },
                { where: { ForumPostId: comment.ForumPostId, isPinned: true } }
            );
        }

        await comment.update({ isPinned });
        const message = isPinned ? 'Comentário fixado com sucesso!' : 'Comentário desfixado com sucesso!';
        res.json({ message, isPinned: comment.isPinned });
    } catch (error) {
        console.error("Erro ao fixar/desfixar comentário do fórum:", error);
        res.status(500).json({ error: "Erro interno ao processar a solicitação." });
    }
};


/**
 * Rota: GET /api/admin/forum/posts (NOVA)
 * Descrição: Busca todos os posts do fórum para moderação com filtros avançados e métricas.
 */
exports.getAllForumPosts = async (req, res) => {
    try {
        const { page = 1, limit = 50, status = 'all', search, category } = req.query;
        const parsedLimit = parseInt(limit, 10);
        const parsedPage = parseInt(page, 10);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        // Filtro de status
        if (status === 'active') {
            where[db.Sequelize.Op.or] = [
                { status: 'active' },
                { status: 'approved_by_admin' },
                { status: null }
            ];
        } else if (status === 'hidden') {
            where.status = 'hidden_by_admin';
        } else if (status === 'pending') {
            where.status = 'pending_review';
        }

        // Filtro de busca (título ou conteúdo)
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            where[db.Sequelize.Op.and] = where[db.Sequelize.Op.and] || [];
            where[db.Sequelize.Op.and].push({
                [db.Sequelize.Op.or]: [
                    { title: { [db.Sequelize.Op.iLike]: searchTerm } },
                    { content: { [db.Sequelize.Op.iLike]: searchTerm } }
                ]
            });
        }

        // Filtro de categoria
        if (category && category.trim() && category !== 'all') {
            where.category = category.trim();
        }

        const { count, rows } = await db.ForumPost.findAndCountAll({
            where,
            attributes: [
                'id',
                'title',
                'content',
                'category',
                'isAnonymous',
                'votes',
                'status',
                'isPinned',
                'createdAt',
                [
                    db.Sequelize.literal(`(SELECT COUNT(*) FROM "ForumComments" WHERE "ForumComments"."ForumPostId" = "ForumPost"."id")`),
                    'commentCount'
                ]
            ],
            include: [{
                model: db.Psychologist,
                attributes: ['nome', 'fotoUrl', 'email'],
                required: false
            }],
            order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
            limit: parsedLimit,
            offset: offset,
            distinct: true
        });

        // Contadores agregados para os KPIs do topo
        const [totalCount, activeCount, hiddenCount, pinnedCount] = await Promise.all([
            db.ForumPost.count(),
            db.ForumPost.count({
                where: {
                    [db.Sequelize.Op.or]: [
                        { status: 'active' },
                        { status: 'approved_by_admin' },
                        { status: null }
                    ]
                }
            }),
            db.ForumPost.count({ where: { status: 'hidden_by_admin' } }),
            db.ForumPost.count({ where: { isPinned: true } })
        ]);

        const formattedPosts = rows.map(post => ({
            id: post.id,
            title: post.title,
            content: post.content || '',
            authorName: post.isAnonymous ? 'Anônimo' : (post.Psychologist?.nome || 'Usuário Removido'),
            authorPhoto: post.isAnonymous ? null : (post.Psychologist?.fotoUrl || null),
            authorEmail: post.isAnonymous ? null : (post.Psychologist?.email || null),
            category: post.category,
            createdAt: post.createdAt,
            status: post.status || 'active',
            isPinned: post.isPinned || false,
            votes: post.votes || 0,
            commentCount: parseInt(post.dataValues.commentCount, 10) || 0
        }));

        res.json({
            data: formattedPosts,
            totalPages: Math.ceil(count / parsedLimit),
            currentPage: parsedPage,
            totalPosts: count,
            stats: {
                total: totalCount,
                active: activeCount,
                hidden: hiddenCount,
                pinned: pinnedCount
            }
        });
    } catch (error) {
        console.error("Erro ao buscar todos os posts do fórum para admin:", error);
        res.status(500).json({ error: 'Erro ao carregar posts.' });
    }
};

// --- GESTÃO DOS LINKS DE RECURSOS ---
exports.getCommunityResources = async (req, res) => {
    try {
        let resources = await db.CommunityResource.findOne();
        if (!resources) resources = await db.CommunityResource.create({ link_intervisao: "#", link_biblioteca: "#", link_cursos: "#" });
        res.json(resources);
    } catch (error) { res.status(500).json({ error: "Erro ao buscar recursos" }); }
};

exports.updateCommunityResources = async (req, res) => {
    try {
        const { whatsapp_group_link, guides_folder_link } = req.body;
        const payload = { whatsapp_group_link, guides_folder_link };

        let resources = await db.CommunityResource.findOne();
        if (resources) await resources.update(payload);
        else await db.CommunityResource.create(payload);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: "Erro ao salvar recursos" }); }
};

// --- GESTÃO DA COMUNIDADE ---
exports.getCommunityEvent = async (req, res) => {
    try {
        let event = await db.CommunityEvent.findOne({ order: [['updatedAt', 'DESC']] });
        if (!event) return res.json({ titulo: "Próximo Workshop", subtitulo: "Em breve novidades", data_hora: "A definir", tipo: "Online", link_acao: "#", texto_botao: "Aguarde", ativo: false });
        res.json(event);
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
};

exports.updateCommunityEvent = async (req, res) => {
    try {
        const { titulo, subtitulo, data_hora, tipo, link_acao, texto_botao, ativo } = req.body;
        const payload = { titulo, subtitulo, data_hora, tipo, link_acao, texto_botao, ativo };
        
        let event = await db.CommunityEvent.findOne({ order: [['updatedAt', 'DESC']] });
        if (event) await event.update(payload);
        else event = await db.CommunityEvent.create(payload);
        res.json({ success: true, event });
    } catch (error) { res.status(500).json({ error: "Erro ao salvar" }); }
};

// --- GESTÃO DE BLOG E FÓRUM GERAL ---
exports.getAllBlogPosts = async (req, res) => {
    try {
        const posts = await db.Post.findAll({ include: [{ model: db.Psychologist, as: 'autor', attributes: ['nome', 'email'] }], order: [['created_at', 'DESC']], limit: 100 });
        res.json(posts);
    } catch (error) { res.status(500).json({ error: 'Erro ao buscar posts do blog' }); }
};

exports.deleteBlogPost = async (req, res) => {
    try {
        await db.Post.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Post excluído com sucesso' });
    } catch (error) { res.status(500).json({ error: 'Erro ao excluir post' }); }
};

exports.deleteForumPost = async (req, res) => {
    try {
        await db.ForumPost.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Post do fórum excluído com sucesso' });
    } catch (error) { res.status(500).json({ error: 'Erro ao excluir post do fórum' }); }
};