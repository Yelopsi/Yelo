// controllers/blogController.js
const db = require('../models');
const Post = db.Post; 

module.exports = {
    // 1. Listar apenas os posts do psicólogo logado
    listarMeusPosts: async (req, res) => {
        try {
            // O ID vem do token (req.userId foi definido na rota)
            const posts = await Post.findAll({
                where: { psychologist_id: req.userId },
                // CORREÇÃO AQUI: Mudamos de 'createdAt' para 'created_at'
                order: [['created_at', 'DESC']] 
            });
            res.json(posts);
        } catch (error) {
            console.error("Erro ao listar posts:", error);
            res.status(500).json({ error: "Erro interno ao buscar posts." });
        }
    },

    // 2. Criar novo post
    criarPost: async (req, res) => {
        try {
            const { titulo, conteudo, imagem_url } = req.body;
            
            if (!titulo || !conteudo) {
                return res.status(400).json({ error: "Título e conteúdo são obrigatórios." });
            }

            const novoPost = await Post.create({
                titulo,
                conteudo,
                imagem_url,
                psychologist_id: req.userId // Pega o ID seguro do token
            });

            res.status(201).json(novoPost);
        } catch (error) {
            console.error("Erro ao criar post:", error);
            res.status(500).json({ error: "Erro ao salvar o artigo." });
        }
    },

    // 3. Atualizar post existente
    atualizarPost: async (req, res) => {
        try {
            const { id } = req.params;
            const { titulo, conteudo, imagem_url } = req.body;

            // Segurança: Garante que o post pertence mesmo a quem está tentando editar
            const post = await Post.findOne({ 
                where: { id: id, psychologist_id: req.userId } 
            });

            if (!post) {
                return res.status(404).json({ error: "Artigo não encontrado ou sem permissão." });
            }

            await post.update({ titulo, conteudo, imagem_url });
            res.json({ message: "Atualizado com sucesso!", post });

        } catch (error) {
            console.error("Erro ao atualizar:", error);
            res.status(500).json({ error: "Erro ao atualizar." });
        }
    },

    // 4. Deletar post
    deletarPost: async (req, res) => {
        try {
            const { id } = req.params;
            
            const deletado = await Post.destroy({
                where: { id: id, psychologist_id: req.userId }
            });

            if (!deletado) {
                return res.status(404).json({ error: "Artigo não encontrado ou sem permissão." });
            }

            res.json({ message: "Artigo excluído." });
        } catch (error) {
            console.error("Erro ao deletar:", error);
            res.status(500).json({ error: "Erro ao excluir." });
        }
    }
};