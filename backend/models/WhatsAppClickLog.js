module.exports = (sequelize, DataTypes) => {
    const WhatsAppClickLog = sequelize.define('WhatsAppClickLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        psychologistId: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        guestName: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'Visitante'
        },
        utmSource: {
            type: DataTypes.STRING,
            allowNull: true
        },
        patientId: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        guestPhone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        source: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status: {
            type: DataTypes.STRING,
            defaultValue: 'pending'
        },
        message_sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        feedbackGiven: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // Só vira true quando o psi responder o modal
        },
        feedbackToken: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            allowNull: true
        },
        contactReceived: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        dealClosed: {
            type: DataTypes.STRING, // Valores esperados do front: 'yes', 'no'
            allowNull: true
        },
        reminderEmailSent: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        adminWppReminderSentAt: {
            type: DataTypes.DATE,
            allowNull: true
        },
        adminWppReminderCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        timestamps: true // Cria automaticamente createdAt (data do clique) e updatedAt
    });

    WhatsAppClickLog.associate = (models) => {
        // Relacionamento com o psicólogo (Assumindo que seu modelo principal seja Psychologist)
        WhatsAppClickLog.belongsTo(models.Psychologist, { 
            foreignKey: 'psychologistId', 
            as: 'psychologist' 
        });
    };

    return WhatsAppClickLog;
};
