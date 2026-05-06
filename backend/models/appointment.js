'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Appointment extends Model {
        static associate(models) {
            this.belongsTo(models.Psychologist, {
                foreignKey: 'psychologistId',
                as: 'psychologist'
            });
            if (models.Patient) {
                this.belongsTo(models.Patient, {
                    foreignKey: 'patientId',
                    as: 'patient'
                });
            }
        }
    }
    Appointment.init({
        title: DataTypes.STRING,
        start: DataTypes.DATE,
        end: DataTypes.DATE,
        status: { type: DataTypes.STRING, defaultValue: 'scheduled' },
        value: { type: DataTypes.FLOAT, defaultValue: 0 },
        psychologistId: DataTypes.INTEGER,
        patientId: DataTypes.INTEGER
    }, {
        sequelize,
        modelName: 'Appointment',
        timestamps: true,
        indexes: [
            { name: 'idx_appointments_psychologist_start', fields: ['psychologistId', 'start'] },
            { name: 'idx_appointments_patient_start', fields: ['patientId', 'start'] }
        ]
    });
    return Appointment;
};