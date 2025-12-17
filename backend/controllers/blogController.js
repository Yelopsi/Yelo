// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
const Psychologist = db.Psychologist; 

// Função auxiliar para formatar URL da imagem (mesma lógica do frontend)
const formatImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    let cleanPath = path.replace(/\\/g, '/');
    if (cleanPath.includes('uploads/')) cleanPath = cleanPath.substring(cleanPath.lastIndexOf('uploads/'));
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    return cleanPath;
};

module.exports = {
    // --- ÁREA RESTRITA (DASHBOARD) ---
    listarMeusPosts: async (req, res) => {
        try {
            const posts = await Post.findAll({
                where: { psychologist_id: req.userId },
                order: [['created_at', 'DESC']]
            });
            res.json(posts);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Erro interno." });
        }
    },

    criarPost: async (req, res) => {
        try {
            const { titulo, conteudo, imagem_url } = req.body;
            if (!titulo || !conteudo) return res.status(400).json({ error: "Título e conteúdo obrigatórios." });

            const novoPost = await Post.create({
                titulo, conteudo, imagem_url,
                psychologist_id: req.userId
            });
            res.status(201).json(novoPost);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Erro ao salvar." });
        }
    },

    atualizarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { titulo, conteudo, imagem_url } = req.body;
            
            const post = await Post.findOne({ where: { id, psychologist_id: req.userId } });
            if (!post) return res.status(404).json({ error: "Não encontrado." });

            await post.update({ titulo, conteudo, imagem_url });
            res.json({ message: "Atualizado!", post });
        } catch (error) {
            res.status(500).json({ error: "Erro ao atualizar." });
        }
    },

    deletarPost: async (req, res) => {
        try {
            const { id } = req.params;
            await Post.destroy({ where: { id, psychologist_id: req.userId } });
            res.json({ message: "Excluído." });
        } catch (error) {
            res.status(500).json({ error: "Erro ao excluir." });
        }
    },

    // --- ÁREA PÚBLICA ---

    // 1. O Blog Geral (Lista)
    exibirBlogPublico: async (req, res) => {
        try {
            const posts = await Post.findAll({
                order: [['created_at', 'DESC']],
                include: [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug'] 
                }]
            });
            // Enviamos a função formatImageUrl para o EJS usar
            res.render('blog', { posts: posts, formatImageUrl: formatImageUrl });
        } catch (error) {
            console.error("Erro ao carregar blog público:", error);
            res.render('blog', { posts: [], formatImageUrl: formatImageUrl });
        }
    },

    // 2. NOVO: O Post Completo (Leitura)
    exibirPostUnico: async (req, res) => {
        try {
            const { id } = req.params;
            
            const post = await Post.findByPk(id, {
                include: [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug']
                }]
            });

            if (!post) {
                return res.redirect('/blog'); // Se não achar, volta pra lista
            }

            res.render('post_completo', { post: post, formatImageUrl: formatImageUrl });
        } catch (error) {
            console.error("Erro ao abrir post:", error);
            res.redirect('/blog');
        }
    }
};