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
        // Um Post pertence a um Psicólogo
        // Nota: Assumindo que seu model de psicólogo chama 'Psychologist'
        if(models.Psychologist) {
            Post.belongsTo(models.Psychologist, { foreignKey: 'psychologist_id', as: 'autor' });
        }
    };

    return Post;
};