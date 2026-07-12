'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.addColumn('Psychologists', 'utm_content', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('Patients', 'utm_content', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await queryInterface.addColumn('WaitingLists', 'utm_content', {
        type: Sequelize.STRING,
        allowNull: true,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('Psychologists', 'utm_content', { transaction });
      await queryInterface.removeColumn('Patients', 'utm_content', { transaction });
      await queryInterface.removeColumn('WaitingLists', 'utm_content', { transaction });
      
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
