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
 * Descrição: Modera um conteúdo do fórum (mantém ou remove).
 */
exports.moderateForumContent = async (req, res) => {
    const { contentType, contentId, action } = req.body;

    if (!['post', 'comment'].includes(contentType) || !contentId || !['approve', 'remove'].includes(action)) {
        return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    try {
        const Model = contentType === 'post' ? db.ForumPost : db.ForumComment;
        const newStatus = action === 'approve' ? 'approved_by_admin' : 'hidden_by_admin';
        const message = action === 'approve' ? 'Conteúdo mantido com sucesso.' : 'Conteúdo removido com sucesso.';

        await Model.update({ status: newStatus }, { where: { id: contentId } });
        if (db.ForumReport) await db.ForumReport.update({ status: 'resolved' }, { where: { itemId: contentId, type: contentType } });

        res.json({ message });
    } catch (error) {
        console.error("Erro ao moderar conteúdo do fórum:", error);
        res.status(500).json({ error: error.message || "Erro interno ao moderar conteúdo." });
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
 * Rota: GET /api/admin/forum/posts (NOVA)
 * Descrição: Busca todos os posts do fórum para moderação.
 */
exports.getAllForumPosts = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const { count, rows } = await db.ForumPost.findAndCountAll({
            include: [{
                model: db.Psychologist,
                attributes: ['nome'],
                required: false
            }],
            order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
            limit: parseInt(limit, 10),
            offset: offset,
            distinct: true
        });

        const formattedPosts = rows.map(post => ({
            id: post.id,
            title: post.title,
            authorName: post.isAnonymous ? 'Anônimo' : (post.Psychologist?.nome || 'Usuário Removido'),
            category: post.category,
            createdAt: post.createdAt,
            status: post.status || 'active',
            isPinned: post.isPinned || false
        }));

        res.json({ data: formattedPosts, totalPages: Math.ceil(count / parseInt(limit, 10)), currentPage: parseInt(page, 10) });
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