'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Adiciona is_ghost_profile
    await queryInterface.addColumn('Patients', 'is_ghost_profile', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    // Permite que a coluna senha seja nula
    await queryInterface.changeColumn('Patients', 'senha', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Patients', 'is_ghost_profile');

    // Reverte a coluna senha para NOT NULL (se possível; se existirem nulos falhará, mas é uma migration down padrão)
    await queryInterface.changeColumn('Patients', 'senha', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
