'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Psychologists', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        nome: {
          type: Sequelize.STRING,
          allowNull: false
        },
        crp: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true // O CRP deve ser único
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true // O email deve ser único
        },
        senha: {
          type: Sequelize.STRING,
          allowNull: false
        },
        abordagem: {
          type: Sequelize.STRING,
          allowNull: false // Ex: Psicanálise, TCC, Terapia Comunitária
        },
        especialidades: {
          type: Sequelize.STRING // Ex: "Ansiedade, Depressão, Família" (separado por vírgula)
        },
        cidade: {
          type: Sequelize.STRING
        },
        online: {
          type: Sequelize.BOOLEAN
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Psychologists');
  }
};