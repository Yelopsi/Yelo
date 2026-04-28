// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 
// Precisamos do modelo Psychologist para saber quem escreveu
// Tenta carregar com maiúscula ou minúscula para evitar erro no Linux/Render
const Psychologist = db.Psychologist || db.psychologist || db.Sequelize.models.Psychologist;
const gamificationService = require('../services/gamificationService');

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

            // Uso padrão do Sequelize (O modelo Post.js já mapeia created_at para createdAt)
            const posts = await Post.findAll({
                where: { psychologistId: userId },
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit, 10),
                offset: offset
            });
            return res.json(posts);
        } catch (error) {
            console.error("Erro ao listar posts:", error);
            res.status(500).json({ error: "Erro interno ao listar posts." });
        }
    },

    criarPost: async (req, res) => {
        try {
            let { titulo, conteudo, imagem_url } = req.body;
            if (!titulo || !conteudo) return res.status(400).json({ error: "Título/Conteúdo obrigatórios." });

            // [CORREÇÃO] Obtém o ID corretamente
            const userId = req.psychologist?.id || req.user?.id || req.userId;

            const novoPost = await Post.create({
                titulo,
                conteudo,
                imagem_url,
                psychologistId: userId
            });

            // --- GAMIFICATION HOOK ---
            gamificationService.processAction(userId, 'blog_post').catch(err => console.error("Gamification hook error:", err));

            return res.status(201).json(novoPost);
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
            
            const post = await Post.findOne({ where: { id, psychologistId: userId } });

            if (!post) {
                return res.status(404).json({ error: "Não encontrado ou sem permissão." });
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
            
            const deleted = await Post.destroy({ where: { id, psychologistId: userId } });
            if (!deleted) return res.status(404).json({ error: "Post não encontrado ou não excluído." });
            
            // --- GAMIFICATION ROLLBACK ---
            let pointsDeducted = 0;
            try {
                const rollbackResult = await gamificationService.rollbackAction(userId, 'blog_post');
                if (rollbackResult && rollbackResult.pointsDeducted) {
                    pointsDeducted = rollbackResult.pointsDeducted;
                }
            } catch (err) {
                console.error("Gamification rollback error:", err);
            }

            res.json({ message: "Excluído.", pointsDeducted });
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

            // CORREÇÃO: Usa .scope(null) para remover qualquer escopo padrão que possa estar
            // ocultando o campo 'conteudo' da consulta.
            let posts = await Post.scope(null).findAll(queryOptions);

            res.render('blog', { 
                posts: posts, 
                formatImageUrl: formatImageUrl
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
            // CORREÇÃO: Usa .scope(null) para garantir que o campo 'conteudo' seja incluído,
            // ignorando qualquer escopo padrão do modelo que possa o estar excluindo.
            const post = await Post.scope(null).findByPk(id, queryOptions);

            if (!post) {
                // CORREÇÃO DE SOFT 404: Renderizar a página oficial 404 em vez de redirecionar para a home do blog
                res.status(404);
                return res.render('404', { url: req.originalUrl });
            }

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