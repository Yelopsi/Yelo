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

    // ÁREA PÚBLICA: Lista do Blog (Com Mockups Automáticos)
    exibirBlogPublico: async (req, res) => {
        try {
            let queryOptions = {
                order: [['created_at', 'DESC']]
            };

            if (Psychologist) {
                queryOptions.include = [{
                    model: Psychologist,
                    as: 'autor',
                    attributes: ['nome', 'fotoUrl', 'slug'] 
                }];
            }

            // 1. Busca os posts reais do banco
            let posts = await Post.findAll(queryOptions);

            // 2. GERADOR DE MOCKUPS (Se tiver menos de 4 posts, completa com fakes)
            if (posts.length < 4) {
                const mocks = [
                    {
                        id: 'mock-1',
                        titulo: "Como a ansiedade afeta o sono",
                        conteudo: "Dificuldade para dormir é um dos sintomas mais comuns. Descubra técnicas de higiene do sono...",
                        imagem_url: "https://images.pexels.com/photos/3771097/pexels-photo-3771097.jpeg?auto=compress&cs=tinysrgb&w=600",
                        created_at: new Date('2025-11-20'),
                        autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" }
                    },
                    {
                        id: 'mock-2',
                        titulo: "Terapia Online funciona mesmo?",
                        conteudo: "Estudos mostram que a eficácia é a mesma do presencial para a maioria dos casos. Entenda as vantagens.",
                        imagem_url: "https://images.pexels.com/photos/4098228/pexels-photo-4098228.jpeg?auto=compress&cs=tinysrgb&w=600",
                        created_at: new Date('2025-11-15'),
                        autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" }
                    },
                    {
                        id: 'mock-3',
                        titulo: "O poder da escuta ativa",
                        conteudo: "Muitas vezes, tudo que precisamos é ser ouvidos sem julgamentos. A escuta é uma ferramenta de cura.",
                        imagem_url: "https://images.pexels.com/photos/7176026/pexels-photo-7176026.jpeg?auto=compress&cs=tinysrgb&w=600",
                        created_at: new Date('2025-11-10'),
                        autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" }
                    }
                ];
                
                // Junta os reais com os mocks
                posts = posts.concat(mocks);
            }

            res.render('blog', { posts: posts, formatImageUrl: formatImageUrl });
        } catch (error) {
            console.error("Erro blog público:", error);
            res.render('blog', { posts: [], formatImageUrl: formatImageUrl, error: "Erro." });
        }
    },

    // ÁREA PÚBLICA: Post Único
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

            if (!post) return res.redirect('/blog');
            res.render('post_completo', { post: post, formatImageUrl: formatImageUrl });
        } catch (error) {
            console.error("Erro ao abrir post:", error);
            res.redirect('/blog');
        }
    },

    // --- NOVA FUNÇÃO: DAR LIKE ---
    curtirPost: async (req, res) => {
        try {
            const { id } = req.params;
            // Incrementa 1 no contador de curtidas deste post
            await Post.increment('curtidas', { where: { id: id } });
            
            // Busca o valor atualizado para devolver pro site
            const postAtualizado = await Post.findByPk(id, { attributes: ['curtidas'] });
            
            res.json({ success: true, curtidas: postAtualizado.curtidas });
        } catch (error) {
            console.error("Erro ao dar like:", error);
            res.status(500).json({ error: "Erro ao processar like." });
        }
    }
};