'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class YeloExpense extends Model {
        static associate(models) {
            // No associations needed for now
        }
    }
    YeloExpense.init({
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        amount: {
            type: DataTypes.FLOAT,
            allowNull: false
        },
        monthYear: {
            type: DataTypes.STRING, // format: "YYYY-MM"
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Outros'
        }
    }, {
        sequelize,
        modelName: 'YeloExpense',
        timestamps: true,
        indexes: [
            { name: 'idx_yelo_expenses_month_year', fields: ['monthYear'] }
        ]
    });
    return YeloExpense;
};
