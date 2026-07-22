'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('Psychologists');
    
    const operations = [];

    if (!tableInfo.rua) {
      operations.push(queryInterface.addColumn('Psychologists', 'rua', { type: Sequelize.STRING, allowNull: true }));
    }
    if (!tableInfo.numero) {
      operations.push(queryInterface.addColumn('Psychologists', 'numero', { type: Sequelize.STRING, allowNull: true }));
    }
    if (!tableInfo.bairro) {
      operations.push(queryInterface.addColumn('Psychologists', 'bairro', { type: Sequelize.STRING, allowNull: true }));
    }
    if (!tableInfo.complemento) {
      operations.push(queryInterface.addColumn('Psychologists', 'complemento', { type: Sequelize.STRING, allowNull: true }));
    }

    return Promise.all(operations);
  },

  down: async (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn('Psychologists', 'rua'),
      queryInterface.removeColumn('Psychologists', 'numero'),
      queryInterface.removeColumn('Psychologists', 'bairro'),
      queryInterface.removeColumn('Psychologists', 'complemento'),
    ]);
  }
};
