const db = require('../models');
const seoService = require('../services/seoService');

exports.run = async () => {
    try {
        console.log("🚀 [SEO BATCH] Iniciando varredura de posts sem SEO gerado...");
        
        // FIX: Aumenta o tamanho da coluna 'tags' no banco para caber o JSON array (evita o erro 'value too long for type character varying(255)')
        try {
            await db.sequelize.query('ALTER TABLE "posts" ALTER COLUMN "tags" TYPE TEXT;');
            console.log("✅ [SEO BATCH] Coluna 'tags' redimensionada para TEXT com sucesso.");
        } catch (e) {
            console.log("⚠️ [SEO BATCH] Erro ao alterar coluna (já pode estar como TEXT):", e.message);
        }

        const { Op } = require('sequelize');
        const posts = await db.Post.findAll({
            where: {
                tags: {
                    [Op.or]: [
                        null,
                        '',
                        '[]'
                    ]
                }
            }
        });

        if (posts.length === 0) {
            console.log("✅ [SEO BATCH] Nenhum post pendente de SEO encontrado.");
            return;
        }

        console.log(`⏳ [SEO BATCH] Encontrados ${posts.length} posts pendentes. Iniciando processamento em background...`);

        // Processa sequencialmente para não estourar os limites de quota do Gemini API (Rate Limiting)
        for (const post of posts) {
            console.log(`🤖 [SEO BATCH] Gerando SEO para o post ID ${post.id}: "${post.titulo}"...`);
            try {
                const seoData = await seoService.generateSEO(post.conteudo, post.titulo);
                if (seoData && seoData.tags && seoData.tags.length > 0) {
                    let tagsArray = seoData.tags;
                    let tagsString = JSON.stringify(tagsArray);
                    
                    // Fallback de segurança: Garante que nunca vai passar de 255 chars no banco de dados
                    while (tagsString.length > 250 && tagsArray.length > 1) {
                        tagsArray.pop(); // Remove a última tag
                        tagsString = JSON.stringify(tagsArray);
                    }
                    
                    // Se ainda for maior que 250 (uma única tag gigantesca), corta grosseiramente
                    if (tagsString.length > 250) {
                        tagsString = tagsString.substring(0, 250);
                    }

                    await post.update({
                        meta_description: seoData.meta_description,
                        tags: tagsString
                    });
                    console.log(`✅ [SEO BATCH] SEO salvo com sucesso para o post ID ${post.id}.`);
                } else {
                    console.warn(`⚠️ [SEO BATCH] Fallback retornado vazio para o post ID ${post.id}. Conteúdo muito curto?`);
                }
            } catch (err) {
                console.error(`❌ [SEO BATCH] Erro ao gerar SEO para o post ID ${post.id}:`, err.message);
            }

            // Aguarda 4 segundos entre cada chamada para evitar block de rate limit (Google Gemini free tier max 15 RPM)
            await new Promise(resolve => setTimeout(resolve, 4000));
        }

        console.log("🎉 [SEO BATCH] Varredura e atualização de SEO concluída com sucesso!");
    } catch (error) {
        console.error("❌ [SEO BATCH] Erro crítico na execução do batch:", error);
    }
};
