// models/Post.js
module.exports = (sequelize, DataTypes) => {
    const Post = sequelize.define('Post', {
        titulo: {
            type: DataTypes.STRING,
            allowNull: false
        },
        conteudo: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        imagem_url: {
            type: DataTypes.STRING(500),
            allowNull: true
        },
        tags: {
            type: DataTypes.STRING,
            allowNull: true
        },
        slug: {
            type: DataTypes.STRING,
            unique: true
        },
        psychologist_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'posts', // Garante que usa a tabela que criamos manualmente
        timestamps: true    // Gerencia createdAt e updatedAt sozinho
    });

    Post.associate = (models) => {
        // CORREÇÃO: Verifica se o modelo existe com letra maiúscula OU minúscula
        // Isso resolve o erro no Render (Linux)
        const PsiModel = models.Psychologist || models.psychologist;
        
        if (PsiModel) {
            Post.belongsTo(PsiModel, { 
                foreignKey: 'psychologist_id', 
                as: 'autor' 
            });
        }
    };

    return Post;
};