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

        const totalPosts = posts.length;
        const totalLikesExistentes = posts.reduce((sum, p) => sum + Number(p.curtidas || 0), 0);
        const mediaCurtidas = totalPosts > 0 ? totalLikesExistentes / totalPosts : 0;

        console.log(`📊 Média atual de curtidas por post: ${Math.round(mediaCurtidas)}`);

        // Ajuste da chance base conforme o volume total de posts
        // Isso evita que milhares de likes sejam distribuídos por dia se o blog crescer muito
        let chanceBase = 0.3;
        if (totalPosts > 50) chanceBase = 0.15;
        if (totalPosts > 100) chanceBase = 0.05;

        let likesDistribuidos = 0;
        let postsImpactados = 0;

        for (const post of posts) {
            let chanceDoPost = chanceBase;
            let minLikes = 10;
            let maxLikes = 30;

            // 1. Ajuste baseado na Quantidade Total de Posts
            if (totalPosts < 20) {
                minLikes = 15; maxLikes = 40; // Blog pequeno, aquece mais rápido
            } else if (totalPosts > 100) {
                minLikes = 3; maxLikes = 15;  // Blog grande, likes mais diluídos
            }

            // 2. Ajuste baseado na Média de Curtidas do Blog (Efeito Viral vs Post Frio)
            const postCurtidas = Number(post.curtidas || 0);
            
            if (postCurtidas === 0) {
                // 3. Boost para posts recém-publicados (0 curtidas): tira do zero mais rápido
                chanceDoPost = Math.max(chanceBase, 0.4); // Pelo menos 40% de chance de engajamento inicial
                minLikes = 5;
                maxLikes = 15;
            } else if (mediaCurtidas > 0) {
                if (postCurtidas > mediaCurtidas * 1.5) {
                    // Post viral (muito acima da média): atrai mais engajamento (efeito manada)
                    chanceDoPost *= 1.5;
                    minLikes = Math.floor(minLikes * 1.5);
                    maxLikes = Math.floor(maxLikes * 1.5);
                } else if (postCurtidas < mediaCurtidas * 0.5) {
                    // Post frio (muito abaixo da média): ganha likes mais devagar
                    chanceDoPost *= 0.7;
                    minLikes = Math.max(1, Math.floor(minLikes * 0.5));
                    maxLikes = Math.max(2, Math.floor(maxLikes * 0.5));
                }
            }

            chanceDoPost = Math.min(chanceDoPost, 1); // Teto de 100%

            if (Math.random() <= chanceDoPost) {
                const likesGanhos = Math.floor(Math.random() * (maxLikes - minLikes + 1)) + minLikes;
                
                await post.increment('curtidas', { by: likesGanhos });
                
                likesDistribuidos += likesGanhos;
                postsImpactados++;
                
                console.log(`   ➜ Post ID ${post.id} (${post.titulo.substring(0, 20)}...) ganhou +${likesGanhos} likes. (Chance: ${(chanceDoPost*100).toFixed(1)}%)`);
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
