const { Sequelize, DataTypes, Op } = require('sequelize');

const generateSlug = (text) => {
    if (!text) return '';
    return text.toString().toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') 
        .replace(/\s+/g, '-') 
        .replace(/[^\w\-]+/g, '') 
        .replace(/\-\-+/g, '-') 
        .replace(/^-+/, '') 
        .replace(/-+$/, ''); 
};

async function fixSlugs() {
    // Instancia uma nova conexão apontando direto para o seu banco no Render, com SSL ativado
    const sequelize = new Sequelize('postgresql://yelo_db_user:***REMOVED_DB_PASS***@dpg-d500f1s9c44c73d84n70-a.ohio-postgres.render.com/yelo_db', {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        logging: false
    });

    const Post = sequelize.define('Post', {
        titulo: { type: DataTypes.STRING },
        slug: { type: DataTypes.STRING }
    }, {
        tableName: 'posts',
        timestamps: false
    });

    try {
        await sequelize.authenticate();
        console.log('Conectado ao banco de dados RENDER com sucesso.');
        
        // Busca todos os posts que não têm slug
        const posts = await Post.findAll({
            where: {
                [Op.or]: [
                    { slug: null },
                    { slug: '' }
                ]
            }
        });
        
        console.log(`Encontrados ${posts.length} posts sem slug no Render.`);
        
        for (let post of posts) {
            let baseSlug = generateSlug(post.titulo);
            let finalSlug = baseSlug;
            let counter = 1;
            
            // Checa unicidade
            while (await Post.findOne({ where: { slug: finalSlug } })) {
                finalSlug = `${baseSlug}-${counter}`;
                counter++;
            }
            
            post.slug = finalSlug;
            await post.save();
            console.log(`✅ Post ID ${post.id} atualizado com slug: ${finalSlug}`);
        }
        
        console.log('🚀 Migração de slugs concluída com sucesso!');
        process.exit(0);
    } catch (error) {
        console.error('Erro ao atualizar slugs:', error);
        process.exit(1);
    }
}

fixSlugs();
