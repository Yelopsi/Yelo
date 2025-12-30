'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Altera a coluna 'plano' na tabela 'Psychologists'
    // para que o valor padrão seja NULL em vez de 'ESSENTIAL'
    await queryInterface.changeColumn('Psychologists', 'plano', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    // Opcional: Código para reverter a alteração, caso necessário.
    // Retorna o valor padrão para 'ESSENTIAL'.
    await queryInterface.changeColumn('Psychologists', 'plano', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'ESSENTIAL'
    });
  }
};
