// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
const Psychologist = db.Psychologist; 

module.exports = {
    // --- ÁREA RESTRITA DO PSICÓLOGO ---
    
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

    // --- NOVA FUNÇÃO: ÁREA PÚBLICA ---
    exibirBlogPublico: async (req, res) => {
        try {
            // Busca todos os posts, incluindo nome e foto do autor
            const posts = await Post.findAll({
                order: [['created_at', 'DESC']],
                include: [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug'] // Só pegamos o necessário
                }]
            });
            
            // Renderiza a página blog.ejs enviando a lista de posts
            res.render('blog', { posts: posts });
        } catch (error) {
            console.error("Erro ao carregar blog público:", error);
            // Se der erro, renderiza vazio para não quebrar o site
            res.render('blog', { posts: [] });
        }
    }
};