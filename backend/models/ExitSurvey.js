module.exports = (sequelize, DataTypes) => {
    const ExitSurvey = sequelize.define('ExitSurvey', {
        psychologistId: {
            type: DataTypes.INTEGER,
            allowNull: true, // Pode ser nulo se decidirmos apagar o ID do psi depois (mas no soft delete mantemos)
            references: {
                model: 'Psychologists',
                key: 'id'
            }
        },
        motivo: {
            type: DataTypes.STRING,
            allowNull: false
        },
        avaliacao: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        sugestao: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    });

    ExitSurvey.associate = (models) => {
        // Associação opcional, útil para relatórios futuros
        ExitSurvey.belongsTo(models.Psychologist, { foreignKey: 'psychologistId', as: 'psychologist' });
    };

    return ExitSurvey;
};