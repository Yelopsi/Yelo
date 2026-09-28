'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class YeloMonthlyFinance extends Model {
        static associate(models) {
            // No associations needed for now
        }
    }
    YeloMonthlyFinance.init({
        monthYear: {
            type: DataTypes.STRING, // format: "YYYY-MM"
            allowNull: false,
            unique: true
        },
        closingCashBalance: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: true
        },
        opexIsComplete: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        appliedTaxVariableRate: {
            type: DataTypes.DECIMAL(5, 4), // Example: 0.0600
            allowNull: true
        },
        appliedTaxFixedMonthly: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },
        appliedRequiredCashReserve: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: true
        },
        isClosed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        closedAt: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'YeloMonthlyFinance',
        timestamps: true
    });
    return YeloMonthlyFinance;
};
