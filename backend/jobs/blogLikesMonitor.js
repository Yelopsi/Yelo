const db = require('../models');
const { Op } = require('sequelize');

/**
 * Função para adicionar curtidas aleatórias aos posts do blog de forma orgânica.
 * Rodará diariamente via CRON.
 */
const simulateBlogLikes = async () => {
    console.log('\n=============================================');
    console.log('❤️ [BLOG LIKES MONITOR] Iniciando distribuição orgânica de curtidas...');
    console.log('=============================================');

    try {
        // Busca todos os posts
        const posts = await db.Post.findAll({
            attributes: ['id', 'curtidas', 'titulo']
        });

        if (!posts || posts.length === 0) {
            console.log('❌ Nenhum post encontrado no blog. Encerrando rotina.');
            return;
        }

        console.log(`Encontrados ${posts.length} posts no total.`);

        // Sorteia aproximadamente 30% dos posts para ganharem likes hoje
        // Assim parece orgânico, não é todo dia que todo post ganha like.
        let likesDistribuidos = 0;
        let postsImpactados = 0;

        for (const post of posts) {
            // Chance de 30% do post ganhar likes hoje
            if (Math.random() <= 0.3) {
                // Sorteia de 1 a 5 curtidas
                const likesGanhos = Math.floor(Math.random() * 5) + 1;
                
                // Atualiza o banco de dados
                await post.increment('curtidas', { by: likesGanhos });
                
                likesDistribuidos += likesGanhos;
                postsImpactados++;
                
                console.log(`   ➜ Post ID ${post.id} (${post.titulo.substring(0, 20)}...) ganhou +${likesGanhos} likes.`);
            }
        }

        console.log('=============================================');
        console.log(`✅ Rotina Finalizada!`);
        console.log(`📊 Resumo: ${postsImpactados} posts impactados | Total de +${likesDistribuidos} curtidas simuladas.`);
        console.log('=============================================\n');

    } catch (error) {
        console.error('🔥 Erro na rotina simulateBlogLikes:', error);
    }
};

module.exports = {
    simulateBlogLikes
};
