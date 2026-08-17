// migrations/20260820000000-alter-payments-psychologistId-nullable.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Payments', 'psychologistId', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    console.log('✅ Alterou psychologistId para permitir NULL');
  },

  down: async (queryInterface, Sequelize) => {
    // Reverte para NOT NULL (necessita valor default ou manejo adicional)
    await queryInterface.changeColumn('Payments', 'psychologistId', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
    console.log('🔙 Reverteu alteração de psychologistId');
  },
};
