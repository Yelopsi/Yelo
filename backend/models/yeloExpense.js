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
            type: DataTypes.DECIMAL(12, 2),
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
        },
        nature: {
            type: DataTypes.ENUM('FIXED', 'VARIABLE', 'UNCLASSIFIED'),
            allowNull: false,
            defaultValue: 'UNCLASSIFIED'
        },
        purpose: {
            type: DataTypes.ENUM('OPERATION', 'GROWTH', 'UNCLASSIFIED'),
            allowNull: false,
            defaultValue: 'UNCLASSIFIED'
        },
        provider: {
            type: DataTypes.ENUM('GOOGLE', 'META', 'ASAAS', 'RENDER', 'OPENAI', 'WHATSAPP', 'ACCOUNTING', 'OTHER'),
            allowNull: false,
            defaultValue: 'OTHER'
        },
        entryMethod: {
            type: DataTypes.ENUM('MANUAL', 'API', 'IMPORT', 'SYSTEM'),
            allowNull: false,
            defaultValue: 'MANUAL'
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
