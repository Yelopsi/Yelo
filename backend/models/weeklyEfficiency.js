'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class WeeklyEfficiency extends Model {
        static associate(models) {
            // Sem associações por enquanto
        }
    }
    WeeklyEfficiency.init({
        week_start: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            unique: true
        },
        meta_ads: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        meta_impressions: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        meta_clicks: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        google_ads: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        google_impressions: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        google_clicks: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        novos_trials: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        meta_trials: { type: DataTypes.INTEGER, defaultValue: 0 },
        google_trials: { type: DataTypes.INTEGER, defaultValue: 0 },
        organic_trials: { type: DataTypes.INTEGER, defaultValue: 0 },
        novos_pagantes: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        meta_pagantes: { type: DataTypes.INTEGER, defaultValue: 0 },
        google_pagantes: { type: DataTypes.INTEGER, defaultValue: 0 },
        organic_pagantes: { type: DataTypes.INTEGER, defaultValue: 0 },
        cpl: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        cac: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'WeeklyEfficiency',
        tableName: 'WeeklyEfficiencies',
        timestamps: true
    });
    return WeeklyEfficiency;
};
