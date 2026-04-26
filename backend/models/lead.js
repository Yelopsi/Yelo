// backend/models/lead.js
module.exports = (sequelize, DataTypes) => {
    const Lead = sequelize.define('Lead', {
        nome: {
            type: DataTypes.STRING,
            allowNull: false
        },
        telefone: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true // Evita prospectar a mesma pessoa duas vezes
        },
        origem_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        status_funil: {
            type: DataTypes.ENUM('Pendente', 'Contatado', 'Aguardando', 'Cadastrado'),
            defaultValue: 'Pendente'
        },
        data_ultimo_contato: {
            type: DataTypes.DATE,
            allowNull: true
        },
        data_proximo_followup: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'Leads',
        timestamps: true // Cria automaticamente createdAt e updatedAt
    });

    return Lead;
};
