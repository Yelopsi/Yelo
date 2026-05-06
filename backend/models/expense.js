'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Expense extends Model {
        static associate(models) {
            this.belongsTo(models.Psychologist, { 
                foreignKey: 'psychologistId', 
                as: 'psychologist' 
            });
        }
    }
    Expense.init({
        description: DataTypes.STRING,
        value: DataTypes.FLOAT,
        date: DataTypes.DATEONLY,
        psychologistId: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'Expense',
        timestamps: true
    });
    return Expense;
};