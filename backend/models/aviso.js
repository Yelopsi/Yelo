'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Aviso extends Model {
        static associate(models) {
            this.hasMany(models.AvisoLido, { foreignKey: 'avisoId', as: 'leituras' });
        }
    }
    Aviso.init({
        title: DataTypes.STRING,
        content: DataTypes.TEXT,
        author: DataTypes.STRING,
        status: { type: DataTypes.STRING, defaultValue: 'published' }
    }, {
        sequelize,
        modelName: 'Aviso',
        timestamps: true
    });
    return Aviso;
};