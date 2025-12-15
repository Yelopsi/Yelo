module.exports = (sequelize, DataTypes) => {
    const DemandSearch = sequelize.define('DemandSearch', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        searchParams: {
            type: DataTypes.JSON,
            allowNull: true // Permite nulo para criar o rascunho inicial
        },
        // --- AQUI ESTÁ A PARTE QUE FALTOU ---
        status: {
            type: DataTypes.STRING,
            defaultValue: 'started',
            allowNull: false
        }
        // ------------------------------------
    }, {
        sequelize,
        modelName: 'DemandSearch',
        paranoid: true, // Mantém o Soft Delete
        timestamps: true
    });

    return DemandSearch;
};