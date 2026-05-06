'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AvisoLido extends Model {
        static associate(models) {
            this.belongsTo(models.Aviso, { foreignKey: 'avisoId', as: 'aviso' });
            this.belongsTo(models.Psychologist, { foreignKey: 'psychologistId', as: 'psychologist' });
        }
    }
    AvisoLido.init({
        psychologistId: DataTypes.INTEGER,
        avisoId: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'AvisoLido',
        tableName: 'AvisoLidos',
        timestamps: true
    });
    return AvisoLido;
};