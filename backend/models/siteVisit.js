module.exports = (sequelize, DataTypes) => {
    const SiteVisit = sequelize.define('SiteVisit', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        page: {
            type: DataTypes.STRING,
            defaultValue: 'home' // Pode ser 'home', 'blog', 'search'
        },
        actor_type: {
            type: DataTypes.STRING,
            defaultValue: 'patient'
        }
        // createdAt é gerado automaticamente, é ele que usaremos para saber o dia/hora
    }, {
        sequelize,
        modelName: 'SiteVisit',
        timestamps: true,
        updatedAt: false // Não precisamos saber quando atualizou, só quando criou
    });

    return SiteVisit;
};