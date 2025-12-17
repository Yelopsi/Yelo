// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
// Tenta carregar com maiúscula ou minúscula para evitar erro no Linux/Render
const Psychologist = db.Psychologist || db.psychologist || db.Sequelize.models.Psychologist;

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

    // ÁREA PÚBLICA: Lista do Blog
    exibirBlogPublico: async (req, res) => {
        try {
            let queryOptions = { order: [['created_at', 'DESC']] };
            if (Psychologist) {
                queryOptions.include = [{ model: Psychologist, as: 'autor', attributes: ['nome', 'fotoUrl', 'slug'] }];
            }

            let posts = await Post.findAll(queryOptions);

            // Adiciona Mocks se tiver poucos posts
            if (posts.length < 4) {
                const mocks = [
                    {
                        id: 'mock-1', titulo: "Como a ansiedade afeta o sono", conteudo: "Dificuldade para dormir é um dos sintomas mais comuns...",
                        imagem_url: "https://images.pexels.com/photos/3771097/pexels-photo-3771097.jpeg?auto=compress&cs=tinysrgb&w=600",
                        created_at: new Date('2025-11-20'), autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" },
                        curtidas: 24
                    },
                    {
                        id: 'mock-2', titulo: "Terapia Online funciona mesmo?", conteudo: "Estudos mostram que a eficácia é a mesma...",
                        imagem_url: "https://images.pexels.com/photos/4098228/pexels-photo-4098228.jpeg?auto=compress&cs=tinysrgb&w=600",
                        created_at: new Date('2025-11-15'), autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" },
                        curtidas: 56
                    }
                ];
                posts = posts.concat(mocks);
            }
            res.render('blog', { posts: posts, formatImageUrl: formatImageUrl });
        } catch (error) {
            console.error("Erro blog público:", error);
            res.render('blog', { posts: [], formatImageUrl: formatImageUrl, error: "Erro." });
        }
    },

    // ÁREA PÚBLICA: Post Único (Com Sidebar)
    exibirPostUnico: async (req, res) => {
        try {
            const { id } = req.params;
            
            // 1. Busca o Post Principal
            let queryOptions = {};
            if (Psychologist) {
                queryOptions.include = [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug']
                }];
            }
            const post = await Post.findByPk(id, queryOptions);

            if (!post) return res.redirect('/blog');

            // 2. Busca posts recentes para a Sidebar (excluindo o atual)
            // Usamos db.Sequelize.Op para fazer a exclusão "Not Equal" (ne)
            const Op = db.Sequelize.Op; 
            const recentes = await Post.findAll({
                where: { id: { [Op.ne]: id } }, // Exclui o ID atual
                limit: 3, // Traz 3 sugestões
                order: [['created_at', 'DESC']],
                attributes: ['id', 'titulo', 'imagem_url', 'created_at'] // Leve, só o necessário
            });

            res.render('post_completo', { 
                post: post, 
                recentes: recentes, // Enviamos a lista para a lateral
                formatImageUrl: formatImageUrl 
            });

        } catch (error) {
            console.error("Erro ao abrir post único:", error);
            res.redirect('/blog');
        }
    },

    // Dar Like
    curtirPost: async (req, res) => {
        try {
            const { id } = req.params;
            await Post.increment('curtidas', { where: { id: id } });
            const postAtualizado = await Post.findByPk(id, { attributes: ['curtidas'] });
            res.json({ success: true, curtidas: postAtualizado.curtidas });
        } catch (error) {
            console.error("Erro ao dar like:", error);
            res.status(500).json({ error: "Erro ao processar like." });
        }
    }
};