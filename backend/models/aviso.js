'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Aviso extends Model {
        static associate(models) {
            this.hasMany(models.AvisoLido, { foreignKey: 'avisoId', as: 'leituras' });
            this.belongsTo(models.Psychologist, { foreignKey: 'psychologistId', as: 'psychologist' });
        }
    }
    Aviso.init({
        title: DataTypes.STRING,
        content: DataTypes.TEXT,
        author: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'published' },
        psychologistId: { type: DataTypes.INTEGER, allowNull: true }
    }, {
        sequelize,
        modelName: 'Aviso',
        timestamps: true
    });
    return Aviso;
};