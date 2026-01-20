// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
// Tenta carregar com maiúscula ou minúscula para evitar erro no Linux/Render
const Psychologist = db.Psychologist || db.psychologist || db.Sequelize.models.Psychologist;
const gamificationService = require('../services/gamificationService');

// --- BANCO DE IMAGENS (Estilo Flat/Yelo) ---
const imagensPadrao = [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1490682143684-14369e18dce8?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1586035025785-5b4d6a6d6342?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1620121692029-d088224ddc74?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1470790376778-a9fcd48d50e9?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1621839673705-6617adf9e890?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1507646227500-4d389b0012be?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1596464716127-f9a862557963?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1615196677587-b2094dc63973?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1564419434663-c49967363849?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1614851099175-e5b30eb6f696?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1584448141569-69f34551225a?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1505330622279-bf7d7fc918f4?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=800&q=80"
];

// Lógica: O mesmo ID sempre pega a mesma imagem da lista
const getImagemFixa = (id) => {
    if (!id) return imagensPadrao[0];
    // Se o ID for texto (mocks), converte para número
    const num = typeof id === 'string' ? id.charCodeAt(id.length - 1) : id;
    return imagensPadrao[num % imagensPadrao.length];
};

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
            const { page = 1, limit = 10 } = req.query;
            const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
            
            // [CORREÇÃO] Obtém o ID corretamente (suporta req.psychologist do middleware)
            const userId = req.psychologist?.id || req.user?.id || req.userId;

            // Tenta buscar usando 'psychologistId' (Padrão Sequelize CamelCase)
            try {
                const posts = await Post.findAll({
                    where: { psychologistId: userId },
                    order: [['createdAt', 'DESC']],
                    limit: parseInt(limit, 10),
                    offset: offset
                });
                return res.json(posts);
            } catch (e1) {
                // Fallback 1: Tenta 'psychologist_id' (Snake Case - Banco legado)
                try {
                    const posts = await Post.findAll({
                        where: { psychologist_id: userId },
                        order: [['createdAt', 'DESC']],
                        limit: parseInt(limit, 10),
                        offset: offset
                    });
                    return res.json(posts);
                } catch (e2) {
                    // Fallback 2: Tenta 'PsychologistId' (Pascal Case) e 'created_at'
                    const posts = await Post.findAll({
                        where: { PsychologistId: userId },
                        order: [['created_at', 'DESC']],
                        limit: parseInt(limit, 10),
                        offset: offset
                    });
                    return res.json(posts);
                }
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Erro interno ao listar posts." });
        }
    },

    criarPost: async (req, res) => {
        try {
            let { titulo, conteudo, imagem_url } = req.body;
            if (!titulo || !conteudo) return res.status(400).json({ error: "Título/Conteúdo obrigatórios." });

            // [CORREÇÃO] Obtém o ID corretamente
            const userId = req.psychologist?.id || req.user?.id || req.userId;

            // Se não enviou imagem, sorteia uma agora e SALVA no banco
            if (!imagem_url) {
                imagem_url = imagensPadrao[Math.floor(Math.random() * imagensPadrao.length)];
            }

            let novoPost;
            // Tenta criar com 'psychologistId'
            try {
                novoPost = await Post.create({
                    titulo, conteudo, imagem_url,
                    psychologistId: userId
                });
            } catch (e1) {
                // Fallback: Tenta 'psychologist_id'
                try {
                    novoPost = await Post.create({ titulo, conteudo, imagem_url, psychologist_id: userId });
                } catch (e2) {
                    // Fallback: Tenta 'PsychologistId'
                    novoPost = await Post.create({ titulo, conteudo, imagem_url, PsychologistId: userId });
                }
            }

            // --- GAMIFICATION HOOK ---
            // Publicar Artigo (50 pts, max 1/dia)
            gamificationService.processAction(userId, 'blog_post').catch(err => console.error("Gamification hook error:", err));

            res.status(201).json(novoPost);
        } catch (error) {
            console.error("Erro criarPost:", error);
            res.status(500).json({ error: "Erro ao salvar." });
        }
    },

    atualizarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { titulo, conteudo, imagem_url } = req.body;
            const userId = req.psychologist?.id || req.user?.id || req.userId;
            
            // Tenta encontrar o post com as variações de ID
            let post = await Post.findOne({ where: { id, psychologistId: userId } })
                .catch(() => Post.findOne({ where: { id, psychologist_id: userId } }))
                .catch(() => Post.findOne({ where: { id, PsychologistId: userId } }));

            if (!post) {
                // Última tentativa: busca só pelo ID e verifica o dono manualmente (se o banco permitir leitura)
                post = await Post.findByPk(id);
                if (!post || (post.psychologistId !== userId && post.psychologist_id !== userId && post.PsychologistId !== userId)) {
                    return res.status(404).json({ error: "Não encontrado ou sem permissão." });
                }
            }

            await post.update({ titulo, conteudo, imagem_url });
            res.json({ message: "Atualizado!", post });
        } catch (error) {
            res.status(500).json({ error: "Erro ao atualizar." });
        }
    },

    deletarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.psychologist?.id || req.user?.id || req.userId;
            
            // Tenta deletar com as variações
            let deleted = await Post.destroy({ where: { id, psychologistId: userId } })
                .catch(() => 0);
            
            if (!deleted) deleted = await Post.destroy({ where: { id, psychologist_id: userId } }).catch(() => 0);
            if (!deleted) deleted = await Post.destroy({ where: { id, PsychologistId: userId } }).catch(() => 0);

            if (!deleted) return res.status(404).json({ error: "Post não encontrado ou não excluído." });
            
            res.json({ message: "Excluído." });
        } catch (error) {
            res.status(500).json({ error: "Erro ao excluir." });
        }
    },

    // ÁREA PÚBLICA: Lista do Blog
    exibirBlogPublico: async (req, res) => {
        try {
            // Lógica Híbrida: Recentes no topo, mas "Virais" (Curtidas >= 5) furam a fila
            let queryOptions = { 
                order: [
                    [db.Sequelize.literal('CASE WHEN curtidas >= 5 THEN 1 ELSE 0 END'), 'DESC'],
                    ['created_at', 'DESC']
                ] 
            };
            if (Psychologist) {
                queryOptions.include = [{ model: Psychologist, as: 'autor', attributes: ['nome', 'fotoUrl', 'slug'] }];
            }

            let posts = await Post.findAll(queryOptions);

            res.render('blog', { 
                posts: posts, 
                formatImageUrl: formatImageUrl,
                getImagemPadrao: getImagemFixa,
                getImagemFixa: getImagemFixa
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
                getImagemPadrao: getImagemFixa,
                getImagemFixa: getImagemFixa
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