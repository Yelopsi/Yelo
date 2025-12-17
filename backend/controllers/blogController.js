// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
// Tenta carregar com maiúscula ou minúscula para evitar erro no Linux/Render
const Psychologist = db.Psychologist || db.psychologist || db.Sequelize.models.Psychologist;

// --- BANCO DE IMAGENS PADRÃO (Estilo Flat/Minimalista/Verde Yelo) ---
const imagensPadrao = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80", // Abstrato Verde
    "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80", // Plantas Flat
    "https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&w=800&q=80", // Minimalismo Bege
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80", // Gradiente Verde
    "https://images.unsplash.com/photo-1586035025785-5b4d6a6d6342?auto=format&fit=crop&w=800&q=80", // Escritório Clean
    "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=800&q=80", // Folhas Flat
    "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80", // Abstrato Geométrico
    "https://images.unsplash.com/photo-1620121692029-d088224ddc74?auto=format&fit=crop&w=800&q=80", // Verde Escuro Clean
    "https://images.unsplash.com/photo-1470790376778-a9fcd48d50e9?auto=format&fit=crop&w=800&q=80", // Natureza Minimalista
    "https://images.unsplash.com/photo-1621839673705-6617adf9e890?auto=format&fit=crop&w=800&q=80", // Formas Bege/Verde
    "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=800&q=80", // Estilo Zen
    "https://images.unsplash.com/photo-1596464716127-f9a862557963?auto=format&fit=crop&w=800&q=80", // Ilustração 3D Soft
    "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?auto=format&fit=crop&w=800&q=80", // Design Gráfico Verde
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80", // Terapia/Conversa
    "https://images.unsplash.com/photo-1615196677587-b2094dc63973?auto=format&fit=crop&w=800&q=80", // Textura Papel Verde
    "https://images.unsplash.com/photo-1564419434663-c49967363849?auto=format&fit=crop&w=800&q=80", // Montanhas Flat
    "https://images.unsplash.com/photo-1614851099175-e5b30eb6f696?auto=format&fit=crop&w=800&q=80", // Fluido Verde
    "https://images.unsplash.com/photo-1584448141569-69f34551225a?auto=format&fit=crop&w=800&q=80", // Livros/Estudos
    "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&w=800&q=80", // Relaxamento
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80"  // Modelo Feminino Clean
];

// Função de Sorteio
const getImagemPadrao = () => imagensPadrao[Math.floor(Math.random() * imagensPadrao.length)];

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
                        imagem_url: null,
                        created_at: new Date('2025-11-20'), autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" },
                        curtidas: 24
                    },
                    {
                        id: 'mock-2', titulo: "Terapia Online funciona mesmo?", conteudo: "Estudos mostram que a eficácia é a mesma...",
                        imagem_url: null,
                        created_at: new Date('2025-11-15'), autor: { nome: "Equipe Yelo", fotoUrl: null, slug: "#" },
                        curtidas: 56
                    }
                ];
                posts = posts.concat(mocks);
            }
            res.render('blog', { 
                posts: posts, 
                formatImageUrl: formatImageUrl,
                getImagemPadrao: getImagemPadrao
            });
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
                formatImageUrl: formatImageUrl,
                getImagemPadrao: getImagemPadrao
            });

        } catch (error) {
            console.error("Erro ao abrir post único:", error);
            res.redirect('/blog');
        }
    },

    // Dar Like ou Deslike (Toggle)
    curtirPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { action } = req.body; // Recebe 'like' ou 'unlike' do frontend

            if (action === 'unlike') {
                // Se for descurtir, subtrai 1 (mas não deixa ficar negativo)
                await Post.decrement('curtidas', { where: { id: id } });
                // Garante que não ficou negativo (segurança extra)
                await db.sequelize.query('UPDATE posts SET curtidas = 0 WHERE curtidas < 0 AND id = :id', { replacements: { id } });
            } else {
                // Padrão: Soma 1
                await Post.increment('curtidas', { where: { id: id } });
            }
            
            const postAtualizado = await Post.findByPk(id, { attributes: ['curtidas'] });
            res.json({ success: true, curtidas: postAtualizado.curtidas });
        } catch (error) {
            console.error("Erro ao dar like:", error);
            res.status(500).json({ error: "Erro ao processar like." });
        }
    }
};