// models/Post.js (CORRIGIDO PARA MAPEAMENTO DE DATA)
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
        psychologistId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'psychologist_id' // Mapeia para a coluna correta no banco (snake_case)
        },
        // --- ADICIONE ISTO AQUI: ---
        curtidas: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        // --- CORREÇÃO DO ERRO 500 (ORDER BY) ---
        // Definimos explicitamente os campos de data para garantir que o Sequelize
        // saiba exatamente qual coluna do banco usar.
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at'
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at'
        }
        // ---------------------------
    }, {
        tableName: 'posts', 
        timestamps: true,
        
        // --- AQUI ESTÁ A CORREÇÃO MÁGICA ---
        // Dizemos ao Sequelize: "Quando você quiser usar createdAt, use a coluna created_at do banco"
        createdAt: 'created_at',
        updatedAt: 'updated_at'
        // -----------------------------------
    });

    Post.associate = (models) => {
        // Correção de compatibilidade (Linux/Windows)
        const PsiModel = models.Psychologist || models.psychologist;
        if (PsiModel) {
            Post.belongsTo(PsiModel, { foreignKey: 'psychologistId', as: 'autor' });
        }
    };

    return Post;
};