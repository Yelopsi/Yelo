require('dotenv').config();
const db = require('../backend/models');
const seoService = require('../backend/services/seoService');

async function backfillBlogSeo() {
    console.log("🚀 Iniciando backfill de Títulos de SEO com Inteligência Artificial...");
    try {
        const posts = await db.Post.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { seo_title: null },
                    { seo_title: '' }
                ]
            },
            order: [['id', 'ASC']]
        });

        console.log(`📋 Encontrados ${posts.length} posts sem seo_title.`);

        for (let i = 0; i < posts.length; i++) {
            const post = posts[i];
            console.log(`\n[${i + 1}/${posts.length}] Processando Post ID ${post.id}: "${post.titulo}"...`);
            
            try {
                const seoData = await seoService.generateSEO(post.conteudo, post.titulo);
                console.log(`   ✨ Novo Título de SEO (Google): "${seoData.seo_title}"`);
                console.log(`   📝 Meta Description: "${seoData.meta_description.substring(0, 80)}..."`);
                
                await post.update({
                    seo_title: seoData.seo_title,
                    meta_description: post.meta_description || seoData.meta_description,
                    tags: post.tags || JSON.stringify(seoData.tags)
                });
                console.log(`   ✅ Salvo com sucesso!`);
            } catch (err) {
                console.error(`   ❌ Falha ao gerar SEO para o post ${post.id}:`, err.message);
            }

            // Pequena pausa para evitar rate limit da API do Gemini
            await new Promise(r => setTimeout(r, 1200));
        }

        console.log("\n🎉 Concluído com sucesso! Todos os posts foram otimizados com Título de SEO invisível.");
    } catch (e) {
        console.error("💥 Erro geral no backfill:", e);
    } finally {
        process.exit(0);
    }
}

backfillBlogSeo();
