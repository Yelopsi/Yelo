'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Patients', {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER
        },
        nome: {
          type: Sequelize.STRING,
          allowNull: false // Não permitimos paciente sem nome
        },
        email: {
          type: Sequelize.STRING,
          allowNull: false, // Não permitimos paciente sem email
          unique: true      // O email deve ser único no banco
        },
        senha: {
          type: Sequelize.STRING,
          allowNull: false // Não permitimos paciente sem senha
        },
        telefone: {
          type: Sequelize.STRING,
          allowNull: true // Telefone é opcional
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
    await queryInterface.dropTable('Patients');
  }
};